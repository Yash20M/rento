import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFactories, type Factories } from '../factories';
import { grantPermissions, makeSuperAdmin } from '../support/access';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';
import { type TestSession, freshSession, registerSession } from '../support/sessions';

/** P3-44 / P3-46 — profile photos and drawer cover photos: the same checks as product photos, the same media table. */
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('face-png'),
]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('face-jpg')]);

let database: TestDatabase;
let app: TestApp;
let clock: FakeClock;
let f: Factories;
let boss: TestSession;
let asha: TestSession;
let ben: TestSession;

beforeAll(async () => {
  database = await createTestDatabase();
  f = createFactories(database.db);
  clock = new FakeClock('2030-01-07T03:00:00Z');
  app = await createTestApp({ config: testConfig({ DATABASE_URL: database.url }), clock });
  boss = await registerSession(app, clock, 'boss');
  asha = await registerSession(app, clock, 'asha');
  ben = await registerSession(app, clock, 'ben');
  await makeSuperAdmin(database.pool, boss.user.id);
});
afterAll(async () => {
  await app.app.close();
  await database.drop();
});

const token = async (who: TestSession) => (await freshSession(app, clock, who)).accessToken;
const send = async (
  who: TestSession | null,
  method: 'POST' | 'DELETE' | 'GET',
  url: string,
  body?: Buffer,
  type = 'image/png',
) =>
  app.app.inject({
    method,
    url,
    headers: {
      ...(body && { 'content-type': type }),
      ...(who && { authorization: `Bearer ${await token(who)}` }),
    },
    ...(body && { payload: body }),
  });
const me = async (who: TestSession) =>
  (await send(who, 'GET', '/v1/me')).json<{ avatarUrl: string | null }>();
const mediaCount = async () =>
  (await database.pool.query('SELECT count(*)::int AS n FROM media')).rows[0].n as number;
const idOf = (ref: string) => ref.split('/').pop()!;

describe('profile photo', () => {
  it('P-1 needs sign-in; stores the picture, shows it on the profile and serves it publicly', async () => {
    expect((await send(null, 'POST', '/v1/me/avatar', PNG)).statusCode).toBe(401);
    expect((await me(asha)).avatarUrl).toBeNull();

    const res = await send(asha, 'POST', '/v1/me/avatar', PNG);
    expect(res.statusCode).toBe(200);
    const url = res.json<{ avatarUrl: string }>().avatarUrl;
    expect(url).toMatch(/^\/v1\/media\/[0-9a-f-]{36}$/);
    expect((await me(asha)).avatarUrl).toBe(url);

    const served = await app.app.inject({ method: 'GET', url });
    expect(served.statusCode).toBe(200);
    expect(served.headers['content-type']).toBe('image/png');
    expect(served.rawPayload.equals(PNG)).toBe(true);
  });

  it('P-2 the sign-in answer carries the photo too', async () => {
    const login = await app.app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: asha.email, password: 'correct horse battery staple' },
    });
    expect(login.json<{ user: { avatarUrl: string | null } }>().user.avatarUrl).toMatch(
      /^\/v1\/media\//,
    );
  });

  it('P-3 a new photo replaces the old one: the old bytes are deleted, not kept', async () => {
    const before = await mediaCount();
    const first = (await me(asha)).avatarUrl!;
    const res = await send(asha, 'POST', '/v1/me/avatar', JPEG, 'image/jpeg');
    expect(res.statusCode).toBe(200);
    expect(await mediaCount()).toBe(before); // one in, one out
    expect((await app.app.inject({ method: 'GET', url: first })).statusCode).toBe(404);
  });

  it('P-4 only real small images: wrong signature, wrong claim, empty, too big and other types are refused', async () => {
    const before = await mediaCount();
    const refused = [
      await send(asha, 'POST', '/v1/me/avatar', Buffer.from('<svg onload=alert(1)>'), 'image/png'),
      await send(asha, 'POST', '/v1/me/avatar', PNG, 'image/jpeg'),
      await send(asha, 'POST', '/v1/me/avatar', Buffer.alloc(0), 'image/png'),
      await send(
        asha,
        'POST',
        '/v1/me/avatar',
        Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]),
      ),
      await send(asha, 'POST', '/v1/me/avatar', Buffer.from('hello'), 'text/plain'),
    ];
    for (const res of refused) expect(res.statusCode, res.body).toBeGreaterThanOrEqual(400);
    expect(refused.slice(0, 4).map((r) => r.statusCode)).toEqual([422, 422, 422, 422]);
    expect(await mediaCount()).toBe(before);
  });

  it('P-5 removing the photo clears it and frees the bytes; removing again is fine', async () => {
    const before = await mediaCount();
    const res = await send(asha, 'DELETE', '/v1/me/avatar');
    expect(res.statusCode).toBe(200);
    expect(res.json<{ avatarUrl: string | null }>().avatarUrl).toBeNull();
    expect(await mediaCount()).toBe(before - 1);
    expect((await send(asha, 'DELETE', '/v1/me/avatar')).statusCode).toBe(200);
    expect((await send(null, 'DELETE', '/v1/me/avatar')).statusCode).toBe(401);
  });

  it("P-6 one person's photo never touches another's", async () => {
    await send(asha, 'POST', '/v1/me/avatar', PNG);
    await send(ben, 'POST', '/v1/me/avatar', JPEG, 'image/jpeg');
    const [a, b] = [(await me(asha)).avatarUrl, (await me(ben)).avatarUrl];
    expect(a).not.toBe(b);
    await send(asha, 'DELETE', '/v1/me/avatar');
    expect((await me(ben)).avatarUrl).toBe(b);
  });

  it('P-7 deleting the account deletes the photo with it', async () => {
    const cara = await registerSession(app, clock, 'cara');
    await send(cara, 'POST', '/v1/me/avatar', PNG);
    const url = (await me(cara)).avatarUrl!;
    const del = await app.app.inject({
      method: 'DELETE',
      url: '/v1/me',
      headers: { authorization: `Bearer ${await token(cara)}` },
      payload: { password: 'correct horse battery staple' },
    });
    expect(del.statusCode).toBe(204);
    expect((await app.app.inject({ method: 'GET', url })).statusCode).toBe(404);
  });
});

describe('what staff see of a customer', () => {
  it('C-1 the customer list and detail carry the profile photo and whether the email is verified', async () => {
    const dana = await registerSession(app, clock, 'dana');
    await send(dana, 'POST', '/v1/me/avatar', PNG);
    const photo = (await me(dana)).avatarUrl;
    const detail = await send(boss, 'GET', `/v1/admin/customers/${dana.user.id}`);
    expect(detail.statusCode).toBe(200);
    expect(detail.json<{ avatarUrl: string | null; emailVerified: boolean }>()).toMatchObject({
      avatarUrl: photo,
      emailVerified: false,
    });
    const list = await send(boss, 'GET', '/v1/admin/customers?q=dana');
    const row = list
      .json<{ items: Array<{ id: string; avatarUrl: string | null }> }>()
      .items.find((c) => c.id === dana.user.id);
    expect(row?.avatarUrl).toBe(photo);
    await database.pool.query('UPDATE users SET email_verified_at = now() WHERE id = $1', [
      dana.user.id,
    ]);
    expect(
      (await send(boss, 'GET', `/v1/admin/customers/${dana.user.id}`)).json<{
        emailVerified: boolean;
      }>().emailVerified,
    ).toBe(true);
  });
});

describe('product photo on a booking', () => {
  it('B-1 a booking carries the cover photo of its product (the first one), or null', async () => {
    const model = await f.itemModel();
    const drawer = await f.drawer();
    const asset = await f.asset({ drawer_id: drawer.id, item_model_id: model.id });
    const owner = await registerSession(app, clock, 'owner');
    const made = await database.pool.query(
      `INSERT INTO bookings (user_id, asset_id, drawer_id, item_model_id, status, starts_at, ends_at, price_paise, deposit_paise)
       VALUES ($1, $2, $3, $4, 'confirmed', '2030-01-09T05:00:00Z', '2030-01-09T06:00:00Z', 9800, 20000) RETURNING id`,
      [owner.user.id, asset.id, drawer.id, model.id],
    );
    const id = made.rows[0].id as string;
    const read = async () =>
      (await send(owner, 'GET', `/v1/bookings/${id}`)).json<{
        itemModel: { photoUrl: string | null };
      }>();
    expect((await read()).itemModel.photoUrl).toBeNull();
    await database.pool.query(
      `UPDATE item_models SET photos = '["/v1/media/11111111-1111-4111-8111-111111111111","/v1/media/other"]'::jsonb WHERE id = $1`,
      [model.id],
    );
    expect((await read()).itemModel.photoUrl).toBe(
      '/v1/media/11111111-1111-4111-8111-111111111111',
    );
  });
});

describe('drawer cover photo', () => {
  let drawerId = '';
  let otherDrawerId = '';
  let reader: TestSession;
  let scoped: TestSession;

  beforeAll(async () => {
    drawerId = (await f.drawer()).id;
    otherDrawerId = (await f.drawer()).id;
    reader = await registerSession(app, clock, 'reader');
    await grantPermissions(database.pool, reader.user.id, ['drawers:read']);
    scoped = await registerSession(app, clock, 'scoped');
    await grantPermissions(
      database.pool,
      scoped.user.id,
      ['drawers:read', 'drawers:write'],
      drawerId,
    );
  });

  const put = (who: TestSession | null, id: string, body: Buffer, type = 'image/png') =>
    send(who, 'POST', `/v1/admin/drawers/${id}/photo`, body, type);
  const publicPhoto = async (id: string) =>
    (await app.app.inject({ method: 'GET', url: '/v1/drawers' }))
      .json<Array<{ id: string; photoUrl: string | null }>>()
      .find((d) => d.id === id)?.photoUrl;

  it('D-1 permissions: no token 401, drawers:read 403, a customer 403', async () => {
    expect((await put(null, drawerId, PNG)).statusCode).toBe(401);
    expect((await put(reader, drawerId, PNG)).statusCode).toBe(403);
    expect((await put(asha, drawerId, PNG)).statusCode).toBe(403);
    expect((await send(reader, 'DELETE', `/v1/admin/drawers/${drawerId}/photo`)).statusCode).toBe(
      403,
    );
  });

  it('D-2 a drawer-limited administrator can set the cover of their own drawer, not another one (404)', async () => {
    expect((await put(scoped, otherDrawerId, PNG)).statusCode).toBe(404);
    expect(await publicPhoto(otherDrawerId)).toBeNull();
    expect((await put(scoped, drawerId, PNG)).statusCode).toBe(204);
    expect(await publicPhoto(drawerId)).toMatch(/^\/v1\/media\//);
  });

  it('D-3 the photo shows on the public list, the nearby search and the admin view; replacing deletes the old one', async () => {
    const first = (await publicPhoto(drawerId))!;
    const before = await mediaCount();
    expect((await put(boss, drawerId, JPEG, 'image/jpeg')).statusCode).toBe(204);
    const second = (await publicPhoto(drawerId))!;
    expect(second).not.toBe(first);
    expect(await mediaCount()).toBe(before);
    expect((await app.app.inject({ method: 'GET', url: first })).statusCode).toBe(404);

    const admin = await send(boss, 'GET', `/v1/admin/drawers/${drawerId}`);
    expect(admin.json<{ photoUrl: string }>().photoUrl).toBe(second);

    await database.pool.query(
      `UPDATE drawers SET location = ST_SetSRID(ST_MakePoint(77.209, 28.6139), 4326)::geography WHERE id = $1`,
      [drawerId],
    );
    const nearby = await app.app.inject({
      method: 'POST',
      url: '/v1/drawers/nearby',
      payload: { latitude: 28.6139, longitude: 77.209 },
    });
    const found = nearby.json<{
      drawers: Array<{ id: string; photoUrl: string | null }>;
      unavailable: Array<{ id: string; photoUrl: string | null }>;
    }>();
    // (the factory drawer has no opening hours, so it is listed as closed — still with its photo)
    const all = { drawers: [...found.drawers, ...found.unavailable] };
    expect(all.drawers.find((d) => d.id === drawerId)?.photoUrl).toBe(second);
  });

  it('D-4 only real images up to 5 MB (422), and nothing is stored for a refused one', async () => {
    const before = await mediaCount();
    expect((await put(boss, drawerId, Buffer.from('not an image'))).statusCode).toBe(422);
    expect((await put(boss, drawerId, PNG, 'image/jpeg')).statusCode).toBe(422);
    expect(await mediaCount()).toBe(before);
  });

  it('D-5 removing the cover frees the picture; both changes are in the audit log', async () => {
    const before = await mediaCount();
    expect((await send(boss, 'DELETE', `/v1/admin/drawers/${drawerId}/photo`)).statusCode).toBe(
      204,
    );
    expect(await publicPhoto(drawerId)).toBeNull();
    expect(await mediaCount()).toBe(before - 1);
    expect((await send(boss, 'DELETE', `/v1/admin/drawers/${drawerId}/photo`)).statusCode).toBe(
      204,
    );
    const actions = (
      await database.pool.query(
        `SELECT action FROM audit_logs WHERE entity_id = $1 AND action LIKE 'drawer.photo%'`,
        [drawerId],
      )
    ).rows.map((r) => r.action as string);
    expect(actions).toEqual(expect.arrayContaining(['drawer.photo_set', 'drawer.photo_removed']));
    expect(idOf('/v1/media/x')).toBe('x');
  });
});
