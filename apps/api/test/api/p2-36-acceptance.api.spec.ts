import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthMailService } from '../../src/modules/auth-users/services/auth-mail.service';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeSocialVerifier } from '../support/fake-social-verifier';
import { tokenFromMail } from '../support/in-memory-mail-sender';

/**
 * P2-36 — the Phase 2 acceptance run: one story from an EMPTY database, through the public HTTP contract only
 * (plus the real, built CLI for the very first administrator):
 *   bootstrap owner → role → invite → accept → drawer, product, units → customer signs in with Google →
 *   finds the drawer nearby → sees availability → books → a second customer is refused the same slot →
 *   the first cancels → the second now gets the slot.
 */
const apiRoot = path.resolve(__dirname, '../..');
const mainJs = path.join(apiRoot, 'dist', 'cli', 'main.js');
const OWNER_PASSWORD = 'owner passphrase for acceptance 2030';
const STAFF_PASSWORD = 'staff passphrase for acceptance 2030';
// The CLI's one-time link is stamped by the real clock, so this story runs on it too: book 11:00 IST, two days ahead.
const day = new Date(Date.now() + 2 * 24 * 3_600_000);
const SLOT = `${day.toISOString().slice(0, 10)}T05:30:00Z`;
const BLR = { latitude: 12.9716, longitude: 77.5946 };

let database: TestDatabase;
let app: TestApp;
const google = new FakeSocialVerifier('google');

beforeAll(async () => {
  database = await createTestDatabase();
  app = await createTestApp({
    config: testConfig({ DATABASE_URL: database.url, PUBLIC_WEB_URL: 'https://app.rento.example' }),
    socialVerifiers: { google },
  });
});
afterAll(async () => {
  await app.app.close();
  await database.drop();
});

const call = (
  token: string | undefined,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  payload?: Record<string, unknown>,
  headers: Record<string, string> = {},
) =>
  app.app.inject({
    method,
    url,
    headers: { ...(token && { authorization: `Bearer ${token}` }), ...headers },
    ...(payload !== undefined && { payload }),
  });

const world: Record<string, string> = {};

describe('Phase 2 acceptance — from an empty database to a booked, cancelled and re-booked slot', () => {
  it('A-1 the owner is created by the CLI, sets a password from the one-time link and signs in', async () => {
    const result = spawnSync(
      process.execPath,
      [mainJs, 'bootstrap-super-admin', '--email', 'owner@acceptance.example', '--name', 'Owner'],
      {
        cwd: apiRoot,
        encoding: 'utf8',
        timeout: 60_000,
        env: {
          PATH: process.env['PATH'] ?? '',
          SystemRoot: process.env['SystemRoot'] ?? '',
          NODE_ENV: 'test',
          DATABASE_URL: database.url,
          JWT_SECRET: 'cli-test-jwt-secret-0123456789abcdef',
          PUBLIC_WEB_URL: 'https://app.rento.example',
        },
      },
    );
    expect(result.status, result.stderr).toBe(0);
    const link = /reset-password\?token=([A-Za-z0-9_%-]+)/.exec(result.stdout)?.[1];
    expect(link).toBeTruthy();

    const reset = await call(undefined, 'POST', '/v1/auth/password/reset', {
      token: decodeURIComponent(link!),
      newPassword: OWNER_PASSWORD,
    });
    expect(reset.statusCode, reset.body).toBe(204);
    const login = await call(undefined, 'POST', '/v1/auth/login', {
      email: 'owner@acceptance.example',
      password: OWNER_PASSWORD,
    });
    expect(login.statusCode, login.body).toBe(200);
    world['owner'] = login.json<{ accessToken: string }>().accessToken;
  });

  it('A-2 the owner makes a role, invites a staff member into it, who accepts and signs in with limited rights', async () => {
    const role = await call(world['owner'], 'POST', '/v1/admin/roles', {
      name: 'Floor staff',
      permissions: ['drawers:read', 'assets:read', 'bookings:read'],
    });
    expect(role.statusCode, role.body).toBe(201);

    const invite = await call(world['owner'], 'POST', '/v1/admin/admins/invitations', {
      email: 'staff@acceptance.example',
      roles: [{ roleId: role.json<{ id: string }>().id }],
    });
    expect(invite.statusCode, invite.body).toBe(201);
    await app.app.get(AuthMailService).drain();
    const token = tokenFromMail(app.mail.find('staff@acceptance.example', 'invited').at(-1)!);

    const accepted = await call(undefined, 'POST', '/v1/auth/admin-invitations/accept', {
      token,
      password: STAFF_PASSWORD,
      name: 'Staff',
    });
    expect(accepted.statusCode, accepted.body).toBeLessThan(300);
    const login = await call(undefined, 'POST', '/v1/auth/login', {
      email: 'staff@acceptance.example',
      password: STAFF_PASSWORD,
    });
    expect(login.statusCode, login.body).toBe(200);
    world['staff'] = login.json<{ accessToken: string }>().accessToken;

    expect((await call(world['staff'], 'GET', '/v1/admin/drawers')).statusCode).toBe(200);
    // deny by default: a read-only role cannot create anything
    expect(
      (await call(world['staff'], 'POST', '/v1/admin/categories', { name: 'Nope' })).statusCode,
    ).toBe(403);
  });

  it('A-3 the owner sets up a drawer with opening hours, a product and two units', async () => {
    const drawer = await call(world['owner'], 'POST', '/v1/admin/drawers', {
      name: 'Acceptance Hub',
      address: '1 MG Road, Bengaluru',
      timezone: 'Asia/Kolkata',
      ...BLR,
      hours: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        weekday,
        opensAt: '08:00',
        closesAt: '22:00',
      })),
    });
    expect(drawer.statusCode, drawer.body).toBe(201);
    world['drawerId'] = drawer.json<{ id: string }>().id;

    const category = await call(world['owner'], 'POST', '/v1/admin/categories', {
      name: 'Consoles',
    });
    expect(category.statusCode, category.body).toBe(201);

    const model = await call(world['owner'], 'POST', '/v1/admin/item-models', {
      categoryId: category.json<{ id: string }>().id,
      name: 'Acceptance Console',
      pricePerSlotPaise: 4900,
      slotMinutes: 30,
      minDurationMin: 30,
      maxDurationMin: 240,
      bufferMin: 0,
      depositPaise: 20000,
    });
    expect(model.statusCode, model.body).toBe(201);
    world['modelId'] = model.json<{ id: string }>().id;

    for (const code of ['ACC-001']) {
      const asset = await call(world['owner'], 'POST', '/v1/admin/assets', {
        assetCode: code,
        itemModelId: world['modelId'],
        drawerId: world['drawerId'],
      });
      expect(asset.statusCode, asset.body).toBe(201);
    }
  });

  it('A-4 a customer signs in with Google and finds the drawer nearby, with stock', async () => {
    const idToken = google.grant('acceptance-asha', {
      subject: 'google-asha',
      email: 'asha@acceptance.example',
      emailVerified: true,
      name: 'Asha',
    });
    const signedIn = await call(undefined, 'POST', '/v1/auth/social/google', { idToken });
    expect(signedIn.statusCode, signedIn.body).toBeLessThan(300);
    world['asha'] = signedIn.json<{ accessToken: string }>().accessToken;

    const nearby = await call(world['asha'], 'POST', '/v1/drawers/nearby', {
      ...BLR,
      itemModelId: world['modelId'],
    });
    expect(nearby.statusCode, nearby.body).toBe(200);
    const body = nearby.json<{
      drawers: Array<{ id: string }>;
      unavailable: Array<{ id: string }>;
    }>();
    // "now" is the real clock, so the drawer may be shut at this hour — it is still found
    expect([...body.drawers, ...body.unavailable].some((d) => d.id === world['drawerId'])).toBe(
      true,
    );

    const slots = await call(
      world['asha'],
      'GET',
      `/v1/drawers/${world['drawerId']}/items/${world['modelId']}/availability?date=${SLOT.slice(0, 10)}`,
    );
    expect(slots.statusCode, slots.body).toBe(200);
  });

  it('A-5 she books the slot; a second customer is refused the same slot (409 BOOKING_SLOT_TAKEN)', async () => {
    const book = (token: string, key: string) =>
      call(
        token,
        'POST',
        '/v1/bookings',
        {
          drawerId: world['drawerId'],
          itemModelId: world['modelId'],
          startsAt: SLOT,
          durationMinutes: 60,
        },
        { 'idempotency-key': key },
      );

    const first = await book(world['asha']!, 'acceptance-asha-1');
    expect(first.statusCode, first.body).toBe(201);
    world['bookingId'] = first.json<{ id: string }>().id;

    const ravi = await call(undefined, 'POST', '/v1/auth/social/google', {
      idToken: google.grant('acceptance-ravi', {
        subject: 'google-ravi',
        email: 'ravi@acceptance.example',
        emailVerified: true,
        name: 'Ravi',
      }),
    });
    world['ravi'] = ravi.json<{ accessToken: string }>().accessToken;

    const second = await book(world['ravi']!, 'acceptance-ravi-1');
    expect(second.statusCode, second.body).toBe(409);
    expect(second.json<{ code: string }>().code).toBe('BOOKING_SLOT_TAKEN');

    // the database, not the application, is what said no: exactly one live occupancy for the unit
    const rows = await database.pool.query(
      'SELECT count(*)::int AS n FROM asset_occupancies WHERE released_at IS NULL',
    );
    expect(rows.rows[0].n).toBe(1);
  });

  it('A-6 once the first customer cancels, the slot is free and the second customer gets it', async () => {
    const cancel = await call(world['asha'], 'POST', `/v1/bookings/${world['bookingId']}/cancel`);
    expect(cancel.statusCode, cancel.body).toBe(200);
    expect(cancel.json<{ status: string }>().status).toBe('cancelled');

    const again = await call(
      world['ravi'],
      'POST',
      '/v1/bookings',
      {
        drawerId: world['drawerId'],
        itemModelId: world['modelId'],
        startsAt: SLOT,
        durationMinutes: 60,
      },
      { 'idempotency-key': 'acceptance-ravi-2' },
    );
    expect(again.statusCode, again.body).toBe(201);
    expect(again.json<{ status: string }>().status).toBe('held');
  });
});
