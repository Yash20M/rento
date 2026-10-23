import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFactories, type Factories } from '../factories';
import { grantPermissions, makeSuperAdmin } from '../support/access';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';

const PASSWORD = 'correct horse battery staple';

interface Session {
  accessToken: string;
  user: { id: string };
}
interface Problem {
  code: string;
  errors?: Array<{ field: string; message: string }>;
}
interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  itemModelCount: number;
}
interface Model {
  id: string;
  categoryId: string;
  name: string;
  status: string;
  pricePerSlotPaise: number;
  assetCount: number;
  photos: string[];
}
interface Asset {
  id: string;
  assetCode: string;
  drawerId: string;
  status: string;
  itemModelId: string;
}
interface AssetPage {
  data: Asset[];
  nextCursor: string | null;
}

let database: TestDatabase;
let app: TestApp;
let f: Factories;
let counter = 0;
let boss: Session;
let inventoryReader: Session;
let customer: Session;
let scoped: Session; // assets:* limited to drawer A
let drawerA: string;
let drawerB: string;

beforeAll(async () => {
  database = await createTestDatabase();
  f = createFactories(database.db);
  app = await createTestApp({ config: testConfig({ DATABASE_URL: database.url }) });
  boss = await register();
  inventoryReader = await register();
  customer = await register();
  scoped = await register();
  await makeSuperAdmin(database.pool, boss.user.id);
  await grantPermissions(database.pool, inventoryReader.user.id, ['inventory:read']);
  drawerA = (await f.drawer()).id;
  drawerB = (await f.drawer()).id;
  await grantPermissions(database.pool, scoped.user.id, ['assets:read', 'assets:write'], drawerA);
});
afterAll(async () => {
  await app.app.close();
  await database.drop();
});

async function register(): Promise<Session> {
  const res = await app.app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: {
      email: `m2i-${(counter += 1)}-${Date.now()}@example.com`,
      password: PASSWORD,
      name: 'Tester',
    },
  });
  return res.json<Session>();
}
const unique = (tag: string) => `${tag} ${(counter += 1)}-${Date.now()}`;
const call = (
  who: Session | undefined,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  payload?: Record<string, unknown>,
) =>
  app.app.inject({
    method,
    url,
    ...(who && { headers: { authorization: `Bearer ${who.accessToken}` } }),
    ...(payload !== undefined && { payload }),
  });
const makeCategory = async (overrides: Record<string, unknown> = {}) =>
  (
    await call(boss, 'POST', '/v1/admin/categories', { name: unique('Cat'), ...overrides })
  ).json<Category>();
const modelBody = (categoryId: string, overrides: Record<string, unknown> = {}) => ({
  categoryId,
  name: unique('Model'),
  pricePerSlotPaise: 9900,
  slotMinutes: 60,
  minDurationMin: 60,
  maxDurationMin: 240,
  bufferMin: 15,
  depositPaise: 50_000,
  ...overrides,
});
const makeModel = async (overrides: Record<string, unknown> = {}) => {
  const category = await makeCategory();
  return (
    await call(boss, 'POST', '/v1/admin/item-models', modelBody(category.id, overrides))
  ).json<Model>();
};
const audit = async (entityId: string) =>
  (
    await database.pool.query(
      'SELECT action FROM audit_logs WHERE entity_id = $1 ORDER BY at, id',
      [entityId],
    )
  ).rows.map((r) => r.action as string);

describe('permissions', () => {
  const routes: Array<[string, 'GET' | 'POST' | 'PATCH' | 'DELETE', string, string]> = [
    ['list categories', 'GET', '/v1/admin/categories', 'inventory:read'],
    ['create category', 'POST', '/v1/admin/categories', 'inventory:write'],
    ['list models', 'GET', '/v1/admin/item-models', 'inventory:read'],
    ['create model', 'POST', '/v1/admin/item-models', 'inventory:write'],
    ['list assets', 'GET', '/v1/admin/assets', 'assets:read'],
    ['create asset', 'POST', '/v1/admin/assets', 'assets:write'],
  ];

  it.each(routes)(
    'P-1 %s: no token ⇒ 401, customer ⇒ 403 PERMISSION_DENIED',
    async (_n, method, url) => {
      expect(
        (await call(undefined, method, url, method === 'POST' ? {} : undefined)).statusCode,
      ).toBe(401);
      const res = await call(customer, method, url, method === 'POST' ? {} : undefined);
      expect(res.statusCode).toBe(403);
      expect(res.json<Problem>().code).toBe('PERMISSION_DENIED');
    },
  );

  it('P-2 inventory:read reads but cannot write', async () => {
    expect((await call(inventoryReader, 'GET', '/v1/admin/categories')).statusCode).toBe(200);
    expect((await call(inventoryReader, 'GET', '/v1/admin/item-models')).statusCode).toBe(200);
    const write = await call(inventoryReader, 'POST', '/v1/admin/categories', { name: 'Nope' });
    expect(write.statusCode).toBe(403);
    expect((await call(inventoryReader, 'GET', '/v1/admin/assets')).statusCode).toBe(403); // assets:* is separate
  });
});

describe('categories', () => {
  it('C-1 create derives the slug, lists with model counts, and is audited', async () => {
    const created = await makeCategory({ name: 'Game Consoles & VR' });
    expect(created).toMatchObject({ slug: 'game-consoles-vr', parentId: null, itemModelCount: 0 });
    expect(
      (await call(inventoryReader, 'GET', '/v1/admin/categories'))
        .json<Category[]>()
        .map((c) => c.id),
    ).toContain(created.id);
    expect(await audit(created.id)).toEqual(['category.created']);
  });

  it('C-2 duplicate slug ⇒ 409 ALREADY_EXISTS; invalid slug / parent ⇒ 422', async () => {
    const first = await makeCategory();
    const dup = await call(boss, 'POST', '/v1/admin/categories', {
      name: unique('Other'),
      slug: first.slug,
    });
    expect(dup.statusCode).toBe(409);
    expect(dup.json<Problem>().code).toBe('ALREADY_EXISTS');
    expect(
      (await call(boss, 'POST', '/v1/admin/categories', { name: 'X', slug: 'Bad Slug!' }))
        .statusCode,
    ).toBe(422);
    expect(
      (
        await call(boss, 'POST', '/v1/admin/categories', {
          name: 'X',
          parentId: '00000000-0000-4000-8000-000000000000',
        })
      ).statusCode,
    ).toBe(422);
  });

  it('C-3 sub-categories; a category cannot be moved inside itself or its descendants', async () => {
    const parent = await makeCategory();
    const child = await makeCategory({ parentId: parent.id });
    const grandchild = await makeCategory({ parentId: child.id });
    expect(child.parentId).toBe(parent.id);
    for (const target of [parent.id, child.id, grandchild.id]) {
      const res = await call(boss, 'PATCH', `/v1/admin/categories/${parent.id}`, {
        parentId: target,
      });
      expect(res.statusCode, target).toBe(422);
    }
    const detach = await call(boss, 'PATCH', `/v1/admin/categories/${child.id}`, {
      parentId: null,
    });
    expect(detach.json<Category>().parentId).toBeNull();
  });

  it('C-4 delete: refused while it holds models or sub-categories (409 IN_USE), fine when empty', async () => {
    const category = await makeCategory();
    await call(boss, 'POST', '/v1/admin/item-models', modelBody(category.id));
    const blocked = await call(boss, 'DELETE', `/v1/admin/categories/${category.id}`);
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json<Problem>().code).toBe('IN_USE');

    const empty = await makeCategory();
    expect((await call(boss, 'DELETE', `/v1/admin/categories/${empty.id}`)).statusCode).toBe(204);
    expect((await call(boss, 'DELETE', `/v1/admin/categories/${empty.id}`)).statusCode).toBe(404);
    expect((await audit(empty.id)).slice(-1)).toEqual(['category.deleted']);
  });

  it('C-5 customers see categories without signing in', async () => {
    const created = await makeCategory();
    const res = await call(undefined, 'GET', '/v1/categories');
    expect(res.statusCode).toBe(200);
    expect(res.json<Category[]>().map((c) => c.id)).toContain(created.id);
  });
});

describe('item models', () => {
  it('M-1 create ⇒ 201 with the rules stored and audited; listed for admins and customers', async () => {
    const model = await makeModel({
      photos: ['https://cdn.example.com/ps5.jpg'],
      description: ' A console ',
    });
    expect(model).toMatchObject({ status: 'active', pricePerSlotPaise: 9900, assetCount: 0 });
    expect(model.photos).toEqual(['https://cdn.example.com/ps5.jpg']);
    expect(await audit(model.id)).toEqual(['item_model.created']);
    expect((await call(undefined, 'GET', `/v1/item-models/${model.id}`)).statusCode).toBe(200);
    const byCategory = await call(
      undefined,
      'GET',
      `/v1/item-models?categoryId=${model.categoryId}`,
    );
    expect(byCategory.json<Model[]>().map((m) => m.id)).toEqual([model.id]);
  });

  it.each([
    ['negative price', { pricePerSlotPaise: -1 }],
    ['fractional price', { pricePerSlotPaise: 99.5 }],
    ['absurd price', { pricePerSlotPaise: 10_000_001 }],
    ['zero slot', { slotMinutes: 0 }],
    ['min not a multiple of the slot', { slotMinutes: 60, minDurationMin: 45 }],
    ['max not a multiple of the slot', { slotMinutes: 60, maxDurationMin: 100 }],
    ['max below min', { minDurationMin: 120, maxDurationMin: 60 }],
    ['negative buffer', { bufferMin: -5 }],
    ['http photo', { photos: ['http://insecure.example.com/x.jpg'] }],
    [
      'too many photos',
      { photos: Array.from({ length: 11 }, () => 'https://x.example.com/a.jpg') },
    ],
    ['unknown category', { categoryId: '00000000-0000-4000-8000-000000000000' }],
    ['unknown field', { colour: 'red' }],
  ])('M-2 %s ⇒ 422 and nothing stored', async (_name, overrides) => {
    const category = await makeCategory();
    const name = unique('Rejected');
    const body = { ...modelBody(category.id, { name }), ...overrides };
    const res = await call(boss, 'POST', '/v1/admin/item-models', body);
    expect(res.statusCode).toBe(422);
    expect(
      (await database.pool.query('SELECT 1 FROM item_models WHERE name = $1', [name])).rowCount,
    ).toBe(0);
  });

  it('M-3 update validates the combination with the stored values', async () => {
    const model = await makeModel({ slotMinutes: 60, minDurationMin: 60, maxDurationMin: 240 });
    const bad = await call(boss, 'PATCH', `/v1/admin/item-models/${model.id}`, { slotMinutes: 45 });
    expect(bad.statusCode).toBe(422);
    const ok = await call(boss, 'PATCH', `/v1/admin/item-models/${model.id}`, {
      slotMinutes: 30,
      pricePerSlotPaise: 5000,
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json<Model>().pricePerSlotPaise).toBe(5000);
    expect(await audit(model.id)).toEqual(['item_model.created', 'item_model.updated']);
  });

  it('M-4 deactivating hides the model from customers but not from admins; it can be reactivated', async () => {
    const model = await makeModel();
    const off = await call(boss, 'PATCH', `/v1/admin/item-models/${model.id}`, {
      status: 'inactive',
    });
    expect(off.json<Model>().status).toBe('inactive');
    expect((await call(undefined, 'GET', `/v1/item-models/${model.id}`)).statusCode).toBe(404);
    expect(
      (await call(undefined, 'GET', '/v1/item-models')).json<Model[]>().map((m) => m.id),
    ).not.toContain(model.id);
    expect(
      (await call(inventoryReader, 'GET', '/v1/admin/item-models'))
        .json<Model[]>()
        .map((m) => m.id),
    ).toContain(model.id);
    await call(boss, 'PATCH', `/v1/admin/item-models/${model.id}`, { status: 'active' });
    expect((await call(undefined, 'GET', `/v1/item-models/${model.id}`)).statusCode).toBe(200);
    expect(await audit(model.id)).toEqual([
      'item_model.created',
      'item_model.deactivated',
      'item_model.activated',
    ]);
  });

  it('M-5 deactivating with upcoming bookings ⇒ 409 HAS_FUTURE_BOOKINGS; past bookings do not block', async () => {
    const model = await makeModel();
    const asset = await f.asset({ item_model_id: model.id });
    await f.booking({
      asset_id: asset.id,
      status: 'confirmed',
      starts_at: '2000-01-01T10:00:00Z',
      ends_at: '2000-01-01T11:00:00Z',
    });
    expect(
      (await call(boss, 'PATCH', `/v1/admin/item-models/${model.id}`, { status: 'inactive' }))
        .statusCode,
    ).toBe(200);
    await call(boss, 'PATCH', `/v1/admin/item-models/${model.id}`, { status: 'active' });

    await f.booking({
      asset_id: asset.id,
      status: 'confirmed',
      starts_at: '2099-01-01T10:00:00Z',
      ends_at: '2099-01-01T11:00:00Z',
    });
    const blocked = await call(boss, 'PATCH', `/v1/admin/item-models/${model.id}`, {
      status: 'inactive',
    });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json<Problem>().code).toBe('HAS_FUTURE_BOOKINGS');
    expect(
      (await call(boss, 'GET', `/v1/admin/item-models/${model.id}`)).json<Model>().status,
    ).toBe('active');
  });

  it('M-6 unknown / malformed ids are 404', async () => {
    for (const id of ['00000000-0000-4000-8000-000000000000', 'nope']) {
      expect((await call(boss, 'GET', `/v1/admin/item-models/${id}`)).statusCode).toBe(404);
      expect(
        (await call(boss, 'PATCH', `/v1/admin/item-models/${id}`, { name: 'x' })).statusCode,
      ).toBe(404);
      expect((await call(undefined, 'GET', `/v1/item-models/${id}`)).statusCode).toBe(404);
    }
  });
});

describe('assets', () => {
  const makeAsset = (
    modelId: string,
    drawerId: string,
    code = unique('AST').replaceAll(' ', '-'),
    who = boss,
  ) => call(who, 'POST', '/v1/admin/assets', { assetCode: code, itemModelId: modelId, drawerId });

  it('A-1 create ⇒ 201 with names, audited; reading back works', async () => {
    const model = await makeModel();
    const res = await makeAsset(model.id, drawerA, 'PS5-001-' + counter);
    expect(res.statusCode).toBe(201);
    const asset = res.json<Asset & { itemModelName: string; drawerName: string }>();
    expect(asset).toMatchObject({
      status: 'available',
      itemModelName: model.name,
      drawerId: drawerA,
    });
    expect((await call(boss, 'GET', `/v1/admin/assets/${asset.id}`)).statusCode).toBe(200);
    expect(await audit(asset.id)).toEqual(['asset.created']);
  });

  it('A-2 duplicate code ⇒ 409 ALREADY_EXISTS (also for different case of the same text only if identical)', async () => {
    const model = await makeModel();
    const code = `DUP-${counter}`;
    expect((await makeAsset(model.id, drawerA, code)).statusCode).toBe(201);
    const again = await makeAsset(model.id, drawerB, code);
    expect(again.statusCode).toBe(409);
    expect(again.json<Problem>()).toMatchObject({
      code: 'ALREADY_EXISTS',
      errors: [{ field: 'assetCode' }],
    });
  });

  it('A-3 invalid code / unknown or inactive model / unknown drawer ⇒ 422', async () => {
    const model = await makeModel();
    for (const code of ['x', 'has space', '-lead', 'a'.repeat(41), 'semi;colon']) {
      expect((await makeAsset(model.id, drawerA, code)).statusCode, code).toBe(422);
    }
    expect((await makeAsset('00000000-0000-4000-8000-000000000000', drawerA)).statusCode).toBe(422);
    expect((await makeAsset(model.id, '00000000-0000-4000-8000-000000000000')).statusCode).toBe(
      422,
    );
    await call(boss, 'PATCH', `/v1/admin/item-models/${model.id}`, { status: 'inactive' });
    expect((await makeAsset(model.id, drawerA)).statusCode).toBe(422);
  });

  it('A-4 status transitions: available⇄maintenance, → retired is final, in_transfer cannot be set by hand', async () => {
    const model = await makeModel();
    const asset = (await makeAsset(model.id, drawerA)).json<Asset>();
    const set = (status: string) => call(boss, 'PATCH', `/v1/admin/assets/${asset.id}`, { status });

    expect((await set('maintenance')).json<Asset>().status).toBe('maintenance');
    expect((await set('available')).json<Asset>().status).toBe('available');
    expect((await set('in_transfer')).statusCode).toBe(422);
    expect((await set('retired')).json<Asset>().status).toBe('retired');
    const back = await set('available');
    expect(back.statusCode).toBe(409);
    expect(back.json<Problem>().code).toBe('IN_USE');
    expect((await audit(asset.id)).filter((a) => a === 'asset.status_changed')).toHaveLength(3);
  });

  it('A-5 maintenance / retirement with upcoming bookings or blocks ⇒ 409 HAS_FUTURE_BOOKINGS', async () => {
    const model = await makeModel();
    const asset = (await makeAsset(model.id, drawerA)).json<Asset>();
    await f.occupancy({
      asset_id: asset.id,
      kind: 'maintenance',
      during: '[2099-01-01 10:00+00, 2099-01-01 11:00+00)',
    });
    for (const status of ['maintenance', 'retired']) {
      const res = await call(boss, 'PATCH', `/v1/admin/assets/${asset.id}`, { status });
      expect(res.statusCode, status).toBe(409);
      expect(res.json<Problem>().code).toBe('HAS_FUTURE_BOOKINGS');
    }
    expect((await call(boss, 'GET', `/v1/admin/assets/${asset.id}`)).json<Asset>().status).toBe(
      'available',
    );
  });

  it('A-6 serial number can be set and cleared; a released occupancy does not block', async () => {
    const model = await makeModel();
    const asset = (await makeAsset(model.id, drawerA)).json<Asset>();
    const set = await call(boss, 'PATCH', `/v1/admin/assets/${asset.id}`, { serialNo: ' SN-123 ' });
    expect(set.json<{ serialNo: string }>().serialNo).toBe('SN-123');
    expect(
      (await call(boss, 'PATCH', `/v1/admin/assets/${asset.id}`, { serialNo: null })).json<{
        serialNo: null;
      }>().serialNo,
    ).toBeNull();

    await f.occupancy({
      asset_id: asset.id,
      kind: 'maintenance',
      during: '[2099-02-01 10:00+00, 2099-02-01 11:00+00)',
      released_at: new Date(),
    });
    expect(
      (await call(boss, 'PATCH', `/v1/admin/assets/${asset.id}`, { status: 'maintenance' }))
        .statusCode,
    ).toBe(200);
  });

  it('A-7 list: filters, ordering by code, and stable cursor pagination without gaps or repeats', async () => {
    const model = await makeModel();
    const tag = `PG${counter}`;
    const codes = Array.from({ length: 7 }, (_v, i) => `${tag}-${String(i).padStart(2, '0')}`);
    for (const code of [...codes].reverse()) await makeAsset(model.id, drawerA, code);

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const res = await call(
        boss,
        'GET',
        `/v1/admin/assets?itemModelId=${model.id}&limit=3${cursor ? `&cursor=${cursor}` : ''}`,
      );
      const page = res.json<AssetPage>();
      seen.push(...page.data.map((a) => a.assetCode));
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);
    expect(seen).toEqual(codes);
    expect(pages).toBe(3);

    const filtered = await call(
      boss,
      'GET',
      `/v1/admin/assets?itemModelId=${model.id}&q=${tag}-03`,
    );
    expect(filtered.json<AssetPage>().data.map((a) => a.assetCode)).toEqual([`${tag}-03`]);
    const wildcard = await call(boss, 'GET', `/v1/admin/assets?itemModelId=${model.id}&q=%25`);
    expect(wildcard.json<AssetPage>().data).toEqual([]); // % is a literal, not a wildcard
    expect((await call(boss, 'GET', '/v1/admin/assets?limit=0')).statusCode).toBe(422);
    expect(
      (await call(boss, 'GET', '/v1/admin/assets?cursor=@@@')).statusCode,
    ).toBeGreaterThanOrEqual(400);
  });

  it("A-8 an admin limited to one drawer sees and changes only that drawer's assets", async () => {
    const model = await makeModel();
    const mine = (await makeAsset(model.id, drawerA)).json<Asset>();
    const theirs = (await makeAsset(model.id, drawerB)).json<Asset>();

    const list = (
      await call(scoped, 'GET', `/v1/admin/assets?itemModelId=${model.id}`)
    ).json<AssetPage>();
    expect(list.data.map((a) => a.id)).toEqual([mine.id]);
    expect((await call(scoped, 'GET', `/v1/admin/assets/${theirs.id}`)).statusCode).toBe(404);
    expect(
      (await call(scoped, 'PATCH', `/v1/admin/assets/${theirs.id}`, { status: 'maintenance' }))
        .statusCode,
    ).toBe(404);
    expect(
      (await call(scoped, 'PATCH', `/v1/admin/assets/${mine.id}`, { status: 'maintenance' }))
        .statusCode,
    ).toBe(200);

    expect((await makeAsset(model.id, drawerA, undefined, scoped)).statusCode).toBe(201);
    const outside = await makeAsset(model.id, drawerB, undefined, scoped);
    expect(outside.statusCode).toBe(403);
    expect(outside.json<Problem>().code).toBe('PERMISSION_DENIED');
    // asking for the other drawer explicitly still shows nothing
    const explicit = await call(scoped, 'GET', `/v1/admin/assets?drawerId=${drawerB}`);
    expect(explicit.json<AssetPage>().data).toEqual([]);
  });

  it("A-9 the model's asset count reflects non-retired assets", async () => {
    const model = await makeModel();
    const a = (await makeAsset(model.id, drawerA)).json<Asset>();
    await makeAsset(model.id, drawerA);
    expect(
      (await call(boss, 'GET', `/v1/admin/item-models/${model.id}`)).json<Model>().assetCount,
    ).toBe(0); // detail shows no count
    const listed = (
      await call(boss, 'GET', `/v1/admin/item-models?categoryId=${model.categoryId}`)
    ).json<Model[]>();
    expect(listed.find((m) => m.id === model.id)?.assetCount).toBe(2);
    await call(boss, 'PATCH', `/v1/admin/assets/${a.id}`, { status: 'retired' });
    const after = (
      await call(boss, 'GET', `/v1/admin/item-models?categoryId=${model.categoryId}`)
    ).json<Model[]>();
    expect(after.find((m) => m.id === model.id)?.assetCount).toBe(1);
  });
});
