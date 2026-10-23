import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFactories, type Factories } from '../factories';
import { grantPermissions, makeSuperAdmin } from '../support/access';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';
import { type TestSession, freshSession, registerSession } from '../support/sessions';

// The smallest files that start like real images (only the signature is inspected, then they are served as they are).
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('product-photo-png'),
]);
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.from('product-photo-jpg'),
]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([4, 0, 0, 0]),
  Buffer.from('WEBPVP8 '),
]);

interface Model {
  id: string;
  photos: string[];
}

let database: TestDatabase;
let app: TestApp;
let clock: FakeClock;
let f: Factories;
let boss: TestSession;
let customer: TestSession;

beforeAll(async () => {
  database = await createTestDatabase();
  f = createFactories(database.db);
  clock = new FakeClock('2030-01-07T03:00:00Z');
  app = await createTestApp({ config: testConfig({ DATABASE_URL: database.url }), clock });
  boss = await registerSession(app, clock, 'x');
  customer = await registerSession(app, clock, 'x');
  await makeSuperAdmin(database.pool, boss.user.id);
});
afterAll(async () => {
  await app.app.close();
  await database.drop();
});

const upload = async (
  who: TestSession | null,
  modelId: string,
  body: Buffer | string,
  type = 'image/png',
) =>
  app.app.inject({
    method: 'POST',
    url: `/v1/admin/item-models/${modelId}/photos`,
    headers: {
      'content-type': type,
      ...(who && { authorization: `Bearer ${(await freshSession(app, clock, who)).accessToken}` }),
    },
    payload: body,
  });
const remove = async (who: TestSession, modelId: string, mediaId: string) =>
  app.app.inject({
    method: 'DELETE',
    url: `/v1/admin/item-models/${modelId}/photos/${mediaId}`,
    headers: { authorization: `Bearer ${(await freshSession(app, clock, who)).accessToken}` },
  });
const idOf = (ref: string) => ref.split('/').pop()!;
const mediaCount = async () =>
  (await database.pool.query('SELECT count(*)::int AS n FROM media')).rows[0].n as number;

describe('product photos', () => {
  it('P-1 an uploaded photo is added to the product and served to anyone, unchanged and cacheable', async () => {
    const model = await f.itemModel();
    const res = await upload(boss, model.id, PNG);
    expect(res.statusCode, res.body).toBe(201);
    const photos = res.json<Model>().photos;
    expect(photos).toHaveLength(1);
    expect(photos[0]).toMatch(/^\/v1\/media\/[0-9a-f-]{36}$/);

    const served = await app.app.inject({ method: 'GET', url: photos[0]! }); // no token: public catalogue pictures
    expect(served.statusCode).toBe(200);
    expect(served.rawPayload.equals(PNG)).toBe(true);
    expect(served.headers['content-type']).toBe('image/png');
    expect(served.headers['cache-control']).toContain('immutable');
    expect(served.headers['x-content-type-options']).toBe('nosniff');
    expect(served.headers['content-security-policy']).toBe("default-src 'none'");
    const etag = String(served.headers['etag']);
    const cached = await app.app.inject({
      method: 'GET',
      url: photos[0]!,
      headers: { 'if-none-match': etag },
    });
    expect(cached.statusCode).toBe(304);

    const audit = await database.pool.query(
      `SELECT actor_id FROM audit_logs WHERE action = 'item_model.photo_added' AND entity_id = $1`,
      [model.id],
    );
    expect(audit.rows).toEqual([{ actor_id: boss.user.id }]);
  });

  it('P-2 JPEG and WebP are accepted too; photos keep their order', async () => {
    const model = await f.itemModel();
    await upload(boss, model.id, PNG);
    const second = await upload(boss, model.id, JPEG, 'image/jpeg');
    const third = await upload(boss, model.id, WEBP, 'image/webp');
    expect(third.statusCode, third.body).toBe(201);
    const photos = third.json<Model>().photos;
    expect(photos).toHaveLength(3);
    expect(second.json<Model>().photos[1]).toBe(photos[1]);
    const jpeg = await app.app.inject({ method: 'GET', url: photos[1]! });
    expect(jpeg.headers['content-type']).toBe('image/jpeg');
  });

  it('P-3 anything that is not a real, small JPEG/PNG/WebP is refused and nothing is stored', async () => {
    const model = await f.itemModel();
    const before = await mediaCount();
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    const cases: Array<[string, Buffer | string, string, number[]]> = [
      ['svg pretending to be png', svg, 'image/png', [422]],
      ['html pretending to be jpeg', Buffer.from('<html></html>'), 'image/jpeg', [422]],
      ['png bytes declared as jpeg', PNG, 'image/jpeg', [422]],
      ['empty body', Buffer.alloc(0), 'image/png', [400, 422]],
      ['not an image type at all', 'hello', 'text/plain', [400, 415, 422]],
      ['svg content type', svg, 'image/svg+xml', [400, 415, 422]],
      [
        'more than 5 MB',
        Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]),
        'image/png',
        [413, 422],
      ],
    ];
    for (const [label, body, type, expected] of cases) {
      const res = await upload(boss, model.id, body, type);
      expect(expected, `${label}: ${res.statusCode} ${res.body}`).toContain(res.statusCode);
    }
    expect(await mediaCount()).toBe(before);
    const row = await database.pool.query('SELECT photos FROM item_models WHERE id = $1', [
      model.id,
    ]);
    expect(row.rows[0].photos).toEqual([]);
  });

  it('P-4 a product holds at most 10 photos', async () => {
    const model = await f.itemModel();
    for (let i = 0; i < 10; i += 1) {
      expect((await upload(boss, model.id, PNG)).statusCode).toBe(201);
    }
    const eleventh = await upload(boss, model.id, PNG);
    expect(eleventh.statusCode).toBe(422);
    expect(eleventh.json<{ errors: Array<{ message: string }> }>().errors[0]!.message).toMatch(
      /at most 10/,
    );
  });

  it('P-5 removing a photo drops it from the product and deletes its bytes; unknown photos are 404', async () => {
    const model = await f.itemModel();
    const first = (await upload(boss, model.id, PNG)).json<Model>().photos[0]!;
    await upload(boss, model.id, JPEG, 'image/jpeg');
    const res = await remove(boss, model.id, idOf(first));
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json<Model>().photos).not.toContain(first);
    expect(res.json<Model>().photos).toHaveLength(1);
    expect((await app.app.inject({ method: 'GET', url: first })).statusCode).toBe(404);
    expect((await remove(boss, model.id, idOf(first))).statusCode).toBe(404);
    expect((await remove(boss, model.id, '00000000-0000-4000-8000-000000000000')).statusCode).toBe(
      404,
    );
    expect((await remove(boss, model.id, 'nope')).statusCode).toBe(404);
    const audit = await database.pool.query(
      `SELECT 1 FROM audit_logs WHERE action = 'item_model.photo_removed' AND entity_id = $1`,
      [model.id],
    );
    expect(audit.rowCount).toBe(1);
  });

  it('P-6 editing the list: our own photo paths and https URLs are fine, anything else is not; dropped photos lose their bytes', async () => {
    const model = await f.itemModel();
    const [a, b] = [
      (await upload(boss, model.id, PNG)).json<Model>().photos[0]!,
      (await upload(boss, model.id, JPEG, 'image/jpeg')).json<Model>().photos[1]!,
    ];
    const patch = async (photos: string[]) =>
      app.app.inject({
        method: 'PATCH',
        url: `/v1/admin/item-models/${model.id}`,
        headers: { authorization: `Bearer ${(await freshSession(app, clock, boss)).accessToken}` },
        payload: { photos },
      });
    expect((await patch([b, a, 'https://img.example/x.jpg'])).statusCode).toBe(200); // reorder + external
    for (const bad of [
      'http://img.example/x.jpg',
      '/v1/media/not-an-id',
      '/etc/passwd',
      'javascript:alert(1)',
    ]) {
      expect((await patch([bad])).statusCode, bad).toBe(422);
    }
    expect((await patch([b])).statusCode).toBe(200); // `a` is dropped
    expect((await app.app.inject({ method: 'GET', url: a })).statusCode).toBe(404);
    expect((await app.app.inject({ method: 'GET', url: b })).statusCode).toBe(200);
  });

  it('P-7 permissions: only people who maintain the catalogue may add or remove photos', async () => {
    const model = await f.itemModel();
    const reader = await registerSession(app, clock, 'x');
    await grantPermissions(database.pool, reader.user.id, ['inventory:read']);
    const editor = await registerSession(app, clock, 'x');
    await grantPermissions(database.pool, editor.user.id, ['inventory:read', 'inventory:write']);
    const before = await mediaCount();

    expect((await upload(null, model.id, PNG)).statusCode).toBe(401);
    expect((await upload(customer, model.id, PNG)).statusCode).toBe(403);
    expect((await upload(reader, model.id, PNG)).statusCode).toBe(403);
    expect(await mediaCount()).toBe(before);
    const added = await upload(editor, model.id, PNG);
    expect(added.statusCode, added.body).toBe(201);
    expect((await remove(reader, model.id, idOf(added.json<Model>().photos[0]!))).statusCode).toBe(
      403,
    );
    expect((await upload(boss, '00000000-0000-4000-8000-000000000000', PNG)).statusCode).toBe(404);
    expect((await remove(editor, model.id, idOf(added.json<Model>().photos[0]!))).statusCode).toBe(
      200,
    );
  });

  it('P-8 customers see the photos in the catalogue of a drawer', async () => {
    const drawer = await f.drawer();
    const model = await f.itemModel();
    await f.asset({
      drawer_id: drawer.id,
      item_model_id: model.id,
      asset_code: `PH-${Date.now()}`,
    });
    const ref = (await upload(boss, model.id, PNG)).json<Model>().photos[0]!;
    const res = await app.app.inject({ method: 'GET', url: `/v1/drawers/${drawer.id}/inventory` });
    expect(res.statusCode, res.body).toBe(200);
    const entry = res
      .json<Array<{ itemModelId: string; photos: string[] }>>()
      .find((e) => e.itemModelId === model.id);
    expect(entry?.photos).toEqual([ref]);
  });

  it('P-9 an unknown or malformed photo address is a 404', async () => {
    expect(
      (
        await app.app.inject({
          method: 'GET',
          url: '/v1/media/00000000-0000-4000-8000-000000000000',
        })
      ).statusCode,
    ).toBe(404);
    expect((await app.app.inject({ method: 'GET', url: '/v1/media/not-a-uuid' })).statusCode).toBe(
      404,
    );
  });
});
