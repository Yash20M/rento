// Gives the demo products their real photographs (demo-photos/, licences in ATTRIBUTION.md) on ANY running Rento API,
// through the admin endpoints only (no database access), so it also works on the hosted demo.
//
//   API_URL=https://rento-zc0w.onrender.com ADMIN_EMAIL=demo.admin@rento.demo ADMIN_PASSWORD=… \
//     node scripts/upload-demo-photos.mjs
//
// A product that already has three or more pictures is left alone unless SEED_REFRESH_ART=1.
import { readFile } from 'node:fs/promises';

const API = (process.env.API_URL ?? 'http://127.0.0.1:3000').replace(/\/+$/, '');
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (an administrator allowed to edit products).');
  process.exit(1);
}
const refresh = process.env.SEED_REFRESH_ART === '1';
const PRODUCTS = [
  ['PlayStation 5', 'ps5'],
  ['Meta Quest 3', 'quest3'],
  ['GoPro Hero 12', 'gopro'],
];

async function call(method, path, { token, body, headers } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body !== undefined &&
        !(body instanceof Uint8Array) && { 'content-type': 'application/json' }),
      ...(token && { authorization: `Bearer ${token}` }),
      ...headers,
    },
    ...(body !== undefined && {
      body: body instanceof Uint8Array ? body : JSON.stringify(body),
    }),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : undefined };
}

const login = await call('POST', '/v1/auth/login', { body: { email, password } });
if (login.status !== 200) {
  console.error(`Sign-in failed (${login.status}).`);
  process.exit(1);
}
const token = login.body.accessToken;
const models = await call('GET', '/v1/admin/item-models', { token });
if (models.status !== 200) {
  console.error(`Could not list products (${models.status}).`);
  process.exit(1);
}

for (const [name, prefix] of PRODUCTS) {
  const model = models.body.find((m) => m.name === name);
  if (!model) {
    console.log(`- ${name}: not in this catalogue, skipped`);
    continue;
  }
  if (model.photos.length >= 3 && !refresh) {
    console.log(`- ${name}: already has ${model.photos.length} photos, kept`);
    continue;
  }
  for (const ref of model.photos) {
    const id = ref.split('/').pop();
    await call('DELETE', `/v1/admin/item-models/${model.id}/photos/${id}`, { token });
  }
  let stored = 0;
  for (const n of [1, 2, 3]) {
    const file = await readFile(new URL(`./demo-photos/${prefix}-${n}.jpg`, import.meta.url));
    const result = await call('POST', `/v1/admin/item-models/${model.id}/photos`, {
      token,
      body: new Uint8Array(file),
      headers: { 'content-type': 'image/jpeg' },
    });
    if (result.status !== 201) {
      console.error(`  ${name} photo ${n} failed: ${result.status}`);
      process.exit(1);
    }
    stored += 1;
  }
  console.log(`- ${name}: ${stored} photos uploaded`);
}
