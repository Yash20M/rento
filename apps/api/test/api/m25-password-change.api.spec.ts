import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthMailService } from '../../src/modules/auth-users/services/auth-mail.service';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';
import { FakeSocialVerifier } from '../support/fake-social-verifier';
import { TEST_PASSWORD, type TestSession, registerSession } from '../support/sessions';

/** M25 — a signed-in person changes their own password (staff and customers alike). */
const NEW_PASSWORD = 'a different long passphrase 2031';

let database: TestDatabase;
let app: TestApp;
const google = new FakeSocialVerifier('google');

beforeAll(async () => {
  database = await createTestDatabase();
  app = await createTestApp({
    config: testConfig({ DATABASE_URL: database.url }),
    clock: new FakeClock('2030-01-07T03:00:00Z'),
    socialVerifiers: { google },
  });
});
afterAll(async () => {
  await app.app.close();
  await database.drop();
});

const change = (token: string | undefined, payload: Record<string, unknown>) =>
  app.app.inject({
    method: 'POST',
    url: '/v1/me/password',
    ...(token && { headers: { authorization: `Bearer ${token}` } }),
    payload,
  });
const login = (email: string, password: string) =>
  app.app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password } });
const session = (): Promise<TestSession> =>
  registerSession(app, new FakeClock('2030-01-07T03:00:00Z'), 'pw');

describe('POST /v1/me/password', () => {
  it('C-1 needs a token', async () => {
    expect((await change(undefined, { currentPassword: 'x', newPassword: 'y' })).statusCode).toBe(
      401,
    );
  });

  it('C-2 a wrong current password changes nothing', async () => {
    const me = await session();
    const res = await change(me.accessToken, {
      currentPassword: 'not my password at all',
      newPassword: NEW_PASSWORD,
    });
    expect(res.statusCode).toBe(401);
    expect((await login(me.email, TEST_PASSWORD)).statusCode).toBe(200);
  });

  it('C-3 a weak or unchanged new password is explained and changes nothing', async () => {
    const me = await session();
    const weak = await change(me.accessToken, {
      currentPassword: TEST_PASSWORD,
      newPassword: 'short',
    });
    expect(weak.statusCode).toBe(422);
    expect(weak.json<{ errors: Array<{ field: string }> }>().errors[0]!.field).toBe('newPassword');
    const same = await change(me.accessToken, {
      currentPassword: TEST_PASSWORD,
      newPassword: TEST_PASSWORD,
    });
    expect(same.statusCode).toBe(422);
    expect((await login(me.email, TEST_PASSWORD)).statusCode).toBe(200);
  });

  it('C-4 the right current password changes it: the old one stops working, the new one works, every session ends, a notice is mailed', async () => {
    const me = await session();
    const other = await login(me.email, TEST_PASSWORD); // a second device
    const otherRefresh = other.json<{ refreshToken: string }>().refreshToken;
    app.mail.clear();

    const res = await change(me.accessToken, {
      currentPassword: TEST_PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expect(res.statusCode, res.body).toBe(204);

    expect((await login(me.email, TEST_PASSWORD)).statusCode).toBe(401);
    expect((await login(me.email, NEW_PASSWORD)).statusCode).toBe(200);
    const refreshed = await app.app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: otherRefresh },
    });
    expect(refreshed.statusCode, 'the other device is signed out').toBe(401);

    await app.app.get(AuthMailService).drain();
    expect(
      app.mail.sent.filter((m) => m.to === me.email && m.purpose === 'password_changed'),
    ).toHaveLength(1);
    expect(
      JSON.stringify(
        app.mail.sent.filter((m) => m.to === me.email && m.purpose === 'password_changed'),
      ),
    ).not.toContain(NEW_PASSWORD);
  });

  it('C-5 an account that signs in only with Google has no password to change', async () => {
    const idToken = google.grant('m25-google', {
      subject: 'm25-google-subject',
      email: 'm25-social@example.com',
      emailVerified: true,
      name: 'Social',
    });
    const social = await app.app.inject({
      method: 'POST',
      url: '/v1/auth/social/google',
      payload: { idToken },
    });
    const token = social.json<{ accessToken: string }>().accessToken;
    const res = await change(token, { currentPassword: 'anything', newPassword: NEW_PASSWORD });
    expect(res.statusCode).toBe(409);
    expect(res.json<{ code: string }>().code).toBe('INVALID_STATE');
  });
});
