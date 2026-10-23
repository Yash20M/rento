// Fills a LOCAL development database with a small demo business, through the public API (so every rule applies) —
// plus one direct SQL step, because the very first Super Admin cannot be created through the API (by design).
//
//   node scripts/seed-demo.mjs            (API on http://127.0.0.1:3000, DATABASE_URL set)
//
// Safe to run twice: everything is looked up by name/code first. Demo credentials are printed at the end.
// NEVER run against anything but a local development database.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { productArt } from './demo-art.mjs';

// The repository's untracked .env (see .env.example) may define the owner Super Admin: ADMIN_EMAIL / ADMIN_PASSWORD.
const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const API = process.env.API_URL ?? 'http://127.0.0.1:3000';
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://rento:rento@127.0.0.1:5433/rento';
// Local development keeps the well-known demo password. Anything that is not this computer MUST bring its own secret
// password (SEED_PASSWORD): the demo accounts include a Super Admin, and a published address is a public address.
const isLocal = ['127.0.0.1', 'localhost'].includes(new URL(API).hostname);
if (!isLocal && !process.env.SEED_PASSWORD) {
  console.error(
    'Refusing to seed a non-local API with the well-known demo password. Set SEED_PASSWORD to a long secret.',
  );
  process.exit(1);
}
const PASSWORD = process.env.SEED_PASSWORD ?? 'Demo-Passw0rd!2026';

export const CREDENTIALS = {
  admin: { email: 'demo.admin@rento.demo', password: PASSWORD, name: 'Demo Admin' },
  frontDesk: { email: 'frontdesk@rento.demo', password: PASSWORD, name: 'Front Desk' },
  customer: { email: 'demo.customer@rento.demo', password: PASSWORD, name: 'Asha (demo customer)' },
};

async function call(method, path, { token, body, headers } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body !== undefined && { 'content-type': 'application/json' }),
      ...(token && { authorization: `Bearer ${token}` }),
      ...headers,
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : undefined;
  return { status: response.status, body: json };
}

async function ok(label, promise, allowed = [200, 201, 204]) {
  const result = await promise;
  if (!allowed.includes(result.status)) {
    throw new Error(`${label} failed: ${result.status} ${JSON.stringify(result.body)}`);
  }
  return result.body;
}

async function account({ email, password, name }) {
  const login = await call('POST', '/v1/auth/login', { body: { email, password } });
  if (login.status === 200) return login.body;
  return ok(
    `register ${email}`,
    call('POST', '/v1/auth/register', { body: { email, password, name } }),
  );
}

// A well-formed demo Aadhaar number (Verhoeff check digit) — NOT a real card. The fake verifier accepts OTP 123456.
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
const INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];
function demoAadhaar(payload) {
  let c = 0;
  [...payload].reverse().forEach((d, i) => {
    c = D[c][P[(i + 1) % 8][Number(d)]];
  });
  return payload + INV[c];
}

async function main() {
  const health = await call('GET', '/healthz').catch(() => undefined);
  if (health?.status !== 200)
    throw new Error(`The API is not answering at ${API}. Start it first.`);

  // 1. Accounts. The first Super Admin is granted in SQL (the API never creates one).
  const admin = await account(CREDENTIALS.admin);
  const db = new pg.Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    await db.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT u.id, r.id FROM users u, roles r WHERE u.email = $1 AND r.is_super_admin
       ON CONFLICT DO NOTHING`,
      [CREDENTIALS.admin.email],
    );
  } finally {
    await db.end();
  }
  // The owner's own Super Admin account, from the environment (never from the repository).
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    await account({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: ADMIN_NAME || 'Owner' });
    const owner = new pg.Client({ connectionString: DATABASE_URL });
    await owner.connect();
    try {
      await owner.query(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT u.id, r.id FROM users u, roles r WHERE u.email = $1 AND r.is_super_admin
         ON CONFLICT DO NOTHING`,
        [ADMIN_EMAIL.trim().toLowerCase()],
      );
    } finally {
      await owner.end();
    }
  }
  // A fresh token so the new role is visible straight away.
  const adminToken = (await account(CREDENTIALS.admin)).accessToken;
  const customer = await account(CREDENTIALS.customer);
  const frontDesk = await account(CREDENTIALS.frontDesk);

  // 2. A front-desk role and its person.
  const roles = await ok('roles', call('GET', '/v1/admin/roles', { token: adminToken }));
  let role = roles.find((r) => r.name === 'Front desk');
  role ??= await ok(
    'create role',
    call('POST', '/v1/admin/roles', {
      token: adminToken,
      body: {
        name: 'Front desk',
        description: 'Looks after bookings at the counter',
        permissions: [
          'bookings:read',
          'bookings:write',
          'bookings:cancel',
          'drawers:read',
          'inventory:read',
          'assets:read',
        ],
      },
    }),
  );
  await ok(
    'assign front desk',
    call('PUT', `/v1/admin/admins/${frontDesk.user.id}/roles`, {
      token: adminToken,
      body: { roles: [{ roleId: role.id, drawerId: null }] },
    }),
  );

  // 3. Catalogue.
  const categories = await ok(
    'categories',
    call('GET', '/v1/admin/categories', { token: adminToken }),
  );
  const category = async (name) =>
    categories.find((c) => c.name === name) ??
    ok(
      'create category',
      call('POST', '/v1/admin/categories', { token: adminToken, body: { name } }),
    );
  const consoles = await category('Game consoles');
  const cameras = await category('Cameras');

  const existingModels = await ok(
    'models',
    call('GET', '/v1/admin/item-models?includeInactive=true', { token: adminToken }),
  );
  const model = async (spec) =>
    existingModels.find((m) => m.name === spec.name) ??
    ok('create model', call('POST', '/v1/admin/item-models', { token: adminToken, body: spec }));
  const ps5 = await model({
    name: 'PlayStation 5',
    description: 'Console with two controllers and three games.',
    categoryId: consoles.id,
    pricePerSlotPaise: 4900,
    slotMinutes: 30,
    minDurationMin: 60,
    maxDurationMin: 240,
    bufferMin: 15,
    depositPaise: 200000,
  });
  const quest = await model({
    name: 'Meta Quest 3',
    description: 'Standalone VR headset.',
    categoryId: consoles.id,
    pricePerSlotPaise: 7900,
    slotMinutes: 30,
    minDurationMin: 30,
    maxDurationMin: 180,
    bufferMin: 15,
    depositPaise: 500000,
  });
  const gopro = await model({
    name: 'GoPro Hero 12',
    description: 'Action camera with a mount kit.',
    categoryId: cameras.id,
    pricePerSlotPaise: 3900,
    slotMinutes: 60,
    minDurationMin: 60,
    maxDurationMin: 480,
    bufferMin: 0,
    depositPaise: 300000,
  });

  // Photos for the demo products (uploaded through the real endpoint; a product that already has one keeps it unless
  // SEED_REFRESH_ART=1 asks for the pictures to be replaced).
  const photoFor = async (m, kind, theme) => {
    const refresh = process.env.SEED_REFRESH_ART === '1';
    if ((m.photos ?? []).length > 0 && !refresh) return;
    if (refresh) {
      for (const ref of m.photos ?? []) {
        const id = ref.split('/').pop();
        await call('DELETE', `/v1/admin/item-models/${m.id}/photos/${id}`, { token: adminToken });
      }
    }
    const response = await fetch(`${API}/v1/admin/item-models/${m.id}/photos`, {
      method: 'POST',
      headers: { 'content-type': 'image/png', authorization: `Bearer ${adminToken}` },
      body: productArt(kind, theme),
    });
    if (response.status !== 201) throw new Error(`photo for ${m.name} failed: ${response.status}`);
  };
  await photoFor(ps5, 'console', 'blue');
  await photoFor(quest, 'headset', 'purple');
  await photoFor(gopro, 'camera', 'teal');

  // 4. Places (coordinates are latitude, longitude; the API stores them longitude-first).
  const drawers = await ok('drawers', call('GET', '/v1/admin/drawers', { token: adminToken }));
  const allWeek = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    opensAt: '09:00',
    closesAt: '21:00',
  }));
  const drawer = async (spec) =>
    drawers.find((d) => d.name === spec.name) ??
    ok(
      'create drawer',
      call('POST', '/v1/admin/drawers', {
        token: adminToken,
        body: { timezone: 'Asia/Kolkata', hours: allWeek, ...spec },
      }),
    );
  const indiranagar = await drawer({
    name: 'Indiranagar Hub',
    address: '100 Feet Road, Indiranagar, Bengaluru',
    latitude: 12.9784,
    longitude: 77.6408,
    pickupInstructions: 'Locker wall next to the cafe entrance. Show your booking on the app.',
  });
  const koramangala = await drawer({
    name: 'Koramangala Hub',
    address: '80 Feet Road, Koramangala, Bengaluru',
    latitude: 12.9352,
    longitude: 77.6245,
    pickupInstructions: 'Ground floor, behind the reception desk.',
  });
  const delhi = await drawer({
    name: 'Connaught Place Hub',
    address: 'Inner Circle, Connaught Place, New Delhi',
    latitude: 28.6315,
    longitude: 77.2167,
    pickupInstructions: 'Gate 3, security will point you to the locker.',
  });

  const hub = (name, address, latitude, longitude, pickupInstructions) =>
    drawer({ name, address, latitude, longitude, pickupInstructions });
  const puneKp = await hub(
    'Koregaon Park Hub',
    'North Main Road, Koregaon Park, Pune',
    18.5362,
    73.894,
    'Locker wall inside the lobby, next to the lifts.',
  );
  const puneKothrud = await hub(
    'Kothrud Hub',
    'Karve Road, Kothrud, Pune',
    18.5074,
    73.8077,
    'Ground floor, behind the reception desk.',
  );
  const hydBanjara = await hub(
    'Banjara Hills Hub',
    'Road No. 12, Banjara Hills, Hyderabad',
    17.4126,
    78.4482,
    'Show your booking at the front desk; lockers are on the left.',
  );
  const hydHitec = await hub(
    'HITEC City Hub',
    'Madhapur, HITEC City, Hyderabad',
    17.4435,
    78.3772,
    'Tower B, ground floor, near the food court.',
  );

  // Cover photos for the places and a profile photo for the demo customer (through the real endpoints; a place or a
  // person that already has a picture keeps it unless SEED_REFRESH_ART=1).
  {
    const refresh = process.env.SEED_REFRESH_ART === '1';
    const themes = ['indigo', 'teal', 'amber', 'purple', 'blue'];
    const all = await ok('drawers', call('GET', '/v1/admin/drawers', { token: adminToken }));
    for (const [index, d] of all.entries()) {
      if (d.photoUrl && !refresh) continue;
      const response = await fetch(`${API}/v1/admin/drawers/${d.id}/photo`, {
        method: 'POST',
        headers: { 'content-type': 'image/png', authorization: `Bearer ${adminToken}` },
        body: productArt('lockers', themes[index % themes.length]),
      });
      if (response.status !== 204)
        throw new Error(`cover for ${d.name} failed: ${response.status}`);
    }
    const me = await ok('me', call('GET', '/v1/me', { token: customer.accessToken }));
    if (!me.avatarUrl || refresh) {
      const response = await fetch(`${API}/v1/me/avatar`, {
        method: 'POST',
        headers: { 'content-type': 'image/png', authorization: `Bearer ${customer.accessToken}` },
        body: productArt('portrait', 'purple'),
      });
      if (response.status !== 200) throw new Error(`avatar failed: ${response.status}`);
    }
  }

  // 5. Units.
  const assets = await ok(
    'assets',
    call('GET', '/v1/admin/assets?limit=100', { token: adminToken }),
  );
  const have = new Set(assets.data.map((a) => a.assetCode));
  const unit = async (assetCode, itemModelId, drawerId) => {
    if (have.has(assetCode)) return;
    await ok(
      'create asset',
      call('POST', '/v1/admin/assets', {
        token: adminToken,
        body: { assetCode, itemModelId, drawerId },
      }),
    );
  };
  for (const n of [1, 2, 3]) await unit(`PS5-BLR1-00${n}`, ps5.id, indiranagar.id);
  for (const n of [1, 2]) await unit(`QUEST-BLR1-00${n}`, quest.id, indiranagar.id);
  await unit('GOPRO-BLR1-001', gopro.id, indiranagar.id);
  for (const n of [1, 2]) await unit(`PS5-BLR2-00${n}`, ps5.id, koramangala.id);
  await unit('GOPRO-BLR2-001', gopro.id, koramangala.id);
  for (const n of [1, 2]) await unit(`PS5-DEL1-00${n}`, ps5.id, delhi.id);
  await unit('QUEST-DEL1-001', quest.id, delhi.id);

  for (const [d, code] of [
    [puneKp, 'PUN1'],
    [puneKothrud, 'PUN2'],
    [hydBanjara, 'HYD1'],
    [hydHitec, 'HYD2'],
  ]) {
    for (const n of [1, 2]) await unit(`PS5-${code}-00${n}`, ps5.id, d.id);
    await unit(`QUEST-${code}-001`, quest.id, d.id);
    await unit(`GOPRO-${code}-001`, gopro.id, d.id);
  }

  // Identity: every customer must verify with Aadhaar before booking (owner decision). Demo customer is verified here.
  const kyc = await ok('kyc status', call('GET', '/v1/me/kyc', { token: customer.accessToken }));
  if (kyc.status !== 'verified') {
    const started = await ok(
      'kyc start',
      call('POST', '/v1/me/kyc/aadhaar', {
        token: customer.accessToken,
        body: { aadhaarNumber: demoAadhaar('23456789012') },
      }),
    );
    await ok(
      'kyc verify',
      call('POST', '/v1/me/kyc/aadhaar/verify', {
        token: customer.accessToken,
        body: { requestId: started.requestId, otp: process.env.KYC_FAKE_OTP ?? '123456' },
      }),
    );
  }

  // 6. A little history so the dashboard and bookings list are not empty: two confirmed bookings tomorrow (one is
  //    cancelled again with a refund). Skipped when the customer already has bookings.
  const mine = await ok(
    'my bookings',
    call('GET', '/v1/bookings', { token: customer.accessToken }),
  );
  if (mine.length === 0) {
    const tomorrow = new Date(Date.now() + 24 * 3_600_000);
    const day = tomorrow.toISOString().slice(0, 10);
    // 11:00 and 15:00 India time on that UTC date's calendar day — close enough for a demo, always in opening hours.
    const at = (hhmmUtc) => `${day}T${hhmmUtc}:00.000Z`;
    const book = async (model, drawerId, startsAt, minutes) => {
      const booking = await ok(
        'book',
        call('POST', '/v1/bookings', {
          token: customer.accessToken,
          headers: { 'idempotency-key': `seed-${model.id}-${startsAt}` },
          body: { drawerId, itemModelId: model.id, startsAt, durationMinutes: minutes },
        }),
      );
      await ok(
        'order',
        call('POST', `/v1/bookings/${booking.id}/payment`, { token: customer.accessToken }),
      );
      const checkout = await ok(
        'checkout',
        call('POST', `/v1/bookings/${booking.id}/payment/simulate`, {
          token: customer.accessToken,
        }),
      );
      return ok(
        'confirm',
        call('POST', `/v1/bookings/${booking.id}/payment/confirm`, {
          token: customer.accessToken,
          body: checkout,
        }),
      );
    };
    await book(ps5, indiranagar.id, at('05:30'), 120);
    const second = await book(quest, indiranagar.id, at('09:30'), 60);
    await ok(
      'cancel',
      call('POST', `/v1/bookings/${second.id}/cancel`, { token: customer.accessToken }),
    );
  }

  console.log('\nDemo data is ready.\n');
  console.log(`  Admin panel   ${CREDENTIALS.admin.email}   /  ${PASSWORD}   (Super Admin)`);
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    console.log(
      `  Owner admin   ${process.env.ADMIN_EMAIL}   /  (the ADMIN_PASSWORD in your .env)   (Super Admin)`,
    );
  }
  console.log(`  Front desk    ${CREDENTIALS.frontDesk.email}   /  ${PASSWORD}   (bookings only)`);
  console.log(`  Customer app  ${CREDENTIALS.customer.email}   /  ${PASSWORD}\n`);
  void admin;
}

main().catch((error) => {
  console.error(`\nSeeding failed: ${error.message}`);
  process.exit(1);
});
