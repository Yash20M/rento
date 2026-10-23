import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AuthMailService } from '../../src/modules/auth-users/services/auth-mail.service';
import { grantPermissions, makeSuperAdmin } from '../support/access';
import { type TestApp, createTestApp, testConfig } from '../support/create-test-app';
import { type TestDatabase, createTestDatabase } from '../support/db/test-database';
import { FakeClock } from '../support/fake-clock';
import { FakeSocialVerifier } from '../support/fake-social-verifier';
import { tokenFromMail } from '../support/in-memory-mail-sender';
import { type Factories, createFactories } from '../factories';

const PASSWORD = 'correct horse battery staple';
const INVITEE_PASSWORD = 'a brand new passphrase 2030';
const START = '2030-01-01T00:00:00Z';
const HOUR = 3_600_000;

interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string | null; emailVerified: boolean };
}
interface Problem {
  code: string;
  errors?: Array<{ field: string; message: string }>;
}
interface Invitation {
  id: string;
  email: string;
  invitedBy: string;
  expiresAt: string;
  roles: Array<{ roleId: string; roleName: string; drawerId: string | null }>;
}
interface Admin {
  id: string;
  email: string | null;
  status: string;
  roles: Array<{
    roleId: string;
    roleName: string;
    isSuperAdmin: boolean;
    drawerId: string | null;
  }>;
}

let database: TestDatabase;
let app: TestApp;
let clock: FakeClock;
let f: Factories;
let counter = 0;
const google = new FakeSocialVerifier('google');

let boss: Session; // Super Admin
let reader: Session; // admins:read
let manager: Session; // admins:manage (not Super Admin)
let supportRoleId: string;
let drawerId: string;

beforeAll(async () => {
  database = await createTestDatabase();
  clock = new FakeClock(START);
  f = createFactories(database.db);
  app = await createTestApp({
    config: testConfig({ DATABASE_URL: database.url, PUBLIC_WEB_URL: 'https://app.rento.example' }),
    clock,
    socialVerifiers: { google },
  });
  boss = await register();
  reader = await register();
  manager = await register();
  await makeSuperAdmin(database.pool, boss.user.id);
  await grantPermissions(database.pool, reader.user.id, ['admins:read']);
  await grantPermissions(database.pool, manager.user.id, ['admins:manage', 'admins:read']);
  supportRoleId = await role(['roles:read', 'bookings:read']);
  drawerId = (await f.drawer()).id;
});
afterAll(async () => {
  await app.app.close();
  await database.drop();
});
beforeEach(() => {
  clock.set(START);
  app.mail.clear();
});

const unique = (tag: string) => `${tag}-${(counter += 1)}-${Date.now()}`;
const email = (tag = 'person') => `${unique(tag)}@example.com`;
async function register(): Promise<Session> {
  const res = await app.app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email: email('user'), password: PASSWORD, name: 'Someone' },
  });
  expect(res.statusCode).toBe(201);
  return res.json<Session>();
}
async function role(permissions: string[]): Promise<string> {
  const res = await app.app.inject({
    method: 'POST',
    url: '/v1/admin/roles',
    headers: { authorization: `Bearer ${boss.accessToken}` },
    payload: { name: unique('Role'), permissions },
  });
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string }>().id;
}
const call = (
  who: Session | undefined,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  url: string,
  payload?: Record<string, unknown>,
) =>
  app.app.inject({
    method,
    url,
    ...(who && { headers: { authorization: `Bearer ${who.accessToken}` } }),
    ...(payload !== undefined && { payload }),
  });
const drain = () => app.app.get(AuthMailService).drain();
const invite = (who: Session, address: string, roles: unknown[] = [{ roleId: supportRoleId }]) =>
  call(who, 'POST', '/v1/admin/admins/invitations', { email: address, roles });
async function invited(address = email('invitee'), roles?: unknown[]) {
  const res = await invite(boss, address, roles);
  expect(res.statusCode).toBe(201);
  await drain();
  const token = tokenFromMail(app.mail.find(address, 'invited').at(-1)!);
  return { address, token, invitation: res.json<Invitation>() };
}
const accept = (token: string, password = INVITEE_PASSWORD, name?: string) =>
  call(undefined, 'POST', '/v1/auth/admin-invitations/accept', {
    token,
    password,
    ...(name && { name }),
  });
const acceptGoogle = (token: string, idToken: string) =>
  call(undefined, 'POST', '/v1/auth/admin-invitations/accept/google', { token, idToken });
const rolesOf = async (userId: string) =>
  (
    await database.pool.query(
      'SELECT role_id, drawer_id, granted_by FROM user_roles WHERE user_id = $1',
      [userId],
    )
  ).rows;
const expectInvalidToken = (res: { statusCode: number; json: <T>() => T }) => {
  expect(res.statusCode).toBe(422);
  expect(res.json<Problem>().errors?.map((e) => e.field)).toContain('token');
};

describe('authorization', () => {
  const routes: Array<
    [string, 'GET' | 'POST' | 'PUT' | 'DELETE', string, Record<string, unknown>?]
  > = [
    ['list admins', 'GET', '/v1/admin/admins'],
    ['list invitations', 'GET', '/v1/admin/admins/invitations'],
    ['invite', 'POST', '/v1/admin/admins/invitations', { email: 'a@b.co', roles: [] }],
    ['revoke', 'DELETE', '/v1/admin/admins/invitations/00000000-0000-4000-8000-000000000000'],
    [
      'set roles',
      'PUT',
      '/v1/admin/admins/00000000-0000-4000-8000-000000000000/roles',
      { roles: [] },
    ],
    ['deactivate', 'DELETE', '/v1/admin/admins/00000000-0000-4000-8000-000000000000'],
  ];

  it.each(routes)('A-1 %s: no token ⇒ 401', async (_n, method, url, body) => {
    expect((await call(undefined, method, url, body)).statusCode).toBe(401);
  });

  it.each(routes)(
    'A-2 %s: an ordinary customer ⇒ 403 PERMISSION_DENIED',
    async (_n, method, url, body) => {
      const customer = await register();
      const res = await call(customer, method, url, body);
      expect(res.statusCode).toBe(403);
      expect(res.json<Problem>().code).toBe('PERMISSION_DENIED');
    },
  );

  it('A-3 admins:read lists but cannot change anything (PERMISSION_DENIED)', async () => {
    expect((await call(reader, 'GET', '/v1/admin/admins')).statusCode).toBe(200);
    expect((await call(reader, 'GET', '/v1/admin/admins/invitations')).statusCode).toBe(200);
    const res = await invite(reader, email());
    expect(res.statusCode).toBe(403);
    expect(res.json<Problem>().code).toBe('PERMISSION_DENIED');
  });

  it('A-4 admins:manage cannot grant a role made of permissions it does not hold (403 ROLE_ESCALATION)', async () => {
    const target = await register();
    for (const res of [
      await invite(manager, email()),
      await call(manager, 'PUT', `/v1/admin/admins/${target.user.id}/roles`, {
        roles: [{ roleId: supportRoleId }],
      }),
    ]) {
      expect(res.statusCode).toBe(403);
      expect(res.json<Problem>().code).toBe('ROLE_ESCALATION');
    }
    expect(await rolesOf(target.user.id)).toEqual([]);
  });
});

describe('inviting', () => {
  it('V-1 creates an invitation, mails the link once, and stores only the token hash', async () => {
    const address = email('newbie');
    const res = await invite(boss, address.toUpperCase(), [{ roleId: supportRoleId, drawerId }]);
    expect(res.statusCode).toBe(201);
    const body = res.json<Invitation>();
    expect(body).toMatchObject({ email: address, invitedBy: boss.user.id });
    expect(body.roles).toEqual([{ roleId: supportRoleId, roleName: expect.any(String), drawerId }]);
    expect(new Date(body.expiresAt).getTime()).toBe(new Date(START).getTime() + 168 * HOUR);

    await drain();
    const mails = app.mail.find(address, 'invited');
    expect(mails).toHaveLength(1);
    expect(mails[0]?.purpose).toBe('admin_invitation');
    expect(mails[0]?.text).toContain('https://app.rento.example/accept-invitation?token=');
    const token = tokenFromMail(mails[0]!);
    const stored = await database.pool.query(
      'SELECT token_hash FROM admin_invitations WHERE id = $1',
      [body.id],
    );
    expect(stored.rows[0].token_hash).not.toContain(token);
    expect(
      (await database.pool.query('SELECT 1 FROM admin_invitations WHERE token_hash = $1', [token]))
        .rowCount,
    ).toBe(0);

    const listed = await call(reader, 'GET', '/v1/admin/admins/invitations');
    expect(listed.json<Invitation[]>().map((i) => i.id)).toContain(body.id);
  });

  it.each([
    ['no roles', { roles: [] }],
    ['unknown role', { roles: [{ roleId: '00000000-0000-4000-8000-000000000000' }] }],
    [
      'unknown drawer',
      { roles: [{ roleId: '', drawerId: '00000000-0000-4000-8000-000000000000' }] },
    ],
    ['malformed role id', { roles: [{ roleId: 'nope' }] }],
    [
      'too many roles',
      {
        roles: Array.from({ length: 21 }, () => ({
          roleId: '00000000-0000-4000-8000-000000000000',
        })),
      },
    ],
    ['bad email', { email: 'not-an-email', roles: [{ roleId: '' }] }],
    ['unknown field', { roles: [{ roleId: '' }], isSuperAdmin: true }],
  ])('V-2 %s ⇒ 422 and nothing stored', async (_name, overrides) => {
    const address = email('rejected');
    const body = JSON.parse(
      JSON.stringify({ email: address, ...overrides }).replaceAll(
        '"roleId":""',
        `"roleId":"${supportRoleId}"`,
      ),
    ) as Record<string, unknown>;
    const res = await call(boss, 'POST', '/v1/admin/admins/invitations', body);
    expect(res.statusCode).toBe(422);
    expect(
      (await database.pool.query('SELECT 1 FROM admin_invitations WHERE email = $1', [address]))
        .rowCount,
    ).toBe(0);
  });

  it('V-3 an address that already has an account is a 409 EMAIL_TAKEN (promote it instead)', async () => {
    const existing = await register();
    const res = await invite(boss, existing.user.email!);
    expect(res.statusCode).toBe(409);
    expect(res.json<Problem>().code).toBe('EMAIL_TAKEN');
  });

  it('V-4 re-inviting supersedes the older invitation: its link stops working, the new one works', async () => {
    const address = email('twice');
    const first = await invited(address);
    const second = await invited(address);
    expect(second.token).not.toBe(first.token);
    expectInvalidToken(await accept(first.token));
    expect((await accept(second.token)).statusCode).toBe(200);
  });

  it('V-5 simultaneous invites of one address end with exactly one open invitation and no 5xx', async () => {
    const address = email('race');
    const results = await Promise.all(Array.from({ length: 5 }, () => invite(boss, address)));
    expect(results.map((r) => r.statusCode)).toEqual(Array(5).fill(201));
    const open = await database.pool.query(
      'SELECT count(*)::int AS n FROM admin_invitations WHERE email = $1 AND accepted_at IS NULL AND revoked_at IS NULL',
      [address],
    );
    expect(open.rows[0].n).toBe(1);
  });

  it('V-6 revoking works once; the link dies; unknown invitations are 404', async () => {
    const { invitation, token } = await invited();
    expect(
      (await call(boss, 'DELETE', `/v1/admin/admins/invitations/${invitation.id}`)).statusCode,
    ).toBe(204);
    expectInvalidToken(await accept(token));
    expect(
      (await call(boss, 'DELETE', `/v1/admin/admins/invitations/${invitation.id}`)).statusCode,
    ).toBe(404);
    expect((await call(boss, 'DELETE', '/v1/admin/admins/invitations/not-a-uuid')).statusCode).toBe(
      404,
    );
  });

  it('V-7 a role cannot be deleted while an open invitation uses it, but can afterwards', async () => {
    const roleId = await role(['bookings:read']);
    const { invitation } = await invited(email('blocker'), [{ roleId }]);
    const blocked = await call(boss, 'DELETE', `/v1/admin/roles/${roleId}`);
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json<Problem>().code).toBe('ROLE_IN_USE');

    await call(boss, 'DELETE', `/v1/admin/admins/invitations/${invitation.id}`);
    expect((await call(boss, 'DELETE', `/v1/admin/roles/${roleId}`)).statusCode).toBe(204);
  });
});

describe('accepting with a password', () => {
  it('V-8 invite → accept → the new administrator is signed in, verified, holds exactly the invited (scoped) roles', async () => {
    const { address, token, invitation } = await invited(email('hire'), [
      { roleId: supportRoleId, drawerId },
    ]);
    const res = await accept(token, INVITEE_PASSWORD, ' New Hire ');
    expect(res.statusCode).toBe(200);
    const session = res.json<Session>();
    expect(session.user).toMatchObject({ email: address, emailVerified: true });

    const assigned = await rolesOf(session.user.id);
    expect(assigned).toEqual([
      { role_id: supportRoleId, drawer_id: drawerId, granted_by: boss.user.id },
    ]);
    const row = await database.pool.query('SELECT display_name, status FROM users WHERE id = $1', [
      session.user.id,
    ]);
    expect(row.rows[0]).toEqual({ display_name: 'New Hire', status: 'active' });
    const used = await database.pool.query(
      'SELECT accepted_by FROM admin_invitations WHERE id = $1',
      [invitation.id],
    );
    expect(used.rows[0].accepted_by).toBe(session.user.id);

    // can log in with the chosen password afterwards
    const login = await call(undefined, 'POST', '/v1/auth/login', {
      email: address,
      password: INVITEE_PASSWORD,
    });
    expect(login.statusCode).toBe(200);
  });

  it('V-9 …and can use exactly what the role allows: roles:read yes, admins:read no', async () => {
    const { token } = await invited();
    const session = (await accept(token)).json<Session>();
    expect((await call(session, 'GET', '/v1/admin/roles')).statusCode).toBe(200);
    const denied = await call(session, 'GET', '/v1/admin/admins');
    expect(denied.statusCode).toBe(403);
    expect(denied.json<Problem>().code).toBe('PERMISSION_DENIED');
  });

  it('V-10 the link works once; unknown and garbage tokens are the same 422 on "token"', async () => {
    const { token } = await invited();
    expect((await accept(token)).statusCode).toBe(200);
    expectInvalidToken(await accept(token));
    expectInvalidToken(await accept('x'.repeat(43)));
    expect((await accept('short', INVITEE_PASSWORD)).statusCode).toBe(422);
  });

  it('V-11 an invitation expires exactly 7 days after it was sent; a later one has its own window', async () => {
    const early = await invited(email('early'));
    const justInTime = await invited(email('in-time'));
    clock.advance(10 * 60_000); // the administrator's own access token is still valid (15 min)
    const late = await invited(email('late')); // expires 10 minutes after the others
    const expiry = new Date(START).getTime() + 168 * HOUR;

    clock.set(new Date(expiry - 1000));
    expect((await accept(justInTime.token)).statusCode).toBe(200); // one second before the end

    clock.set(new Date(expiry + 1000));
    expectInvalidToken(await accept(early.token)); // over
    expect((await accept(late.token)).statusCode).toBe(200); // 9 minutes left
  });

  it('V-12 a weak password is a 422 on "password" and does not burn the link', async () => {
    const { token } = await invited();
    const weak = await accept(token, 'short');
    expect(weak.statusCode).toBe(422);
    expect(weak.json<Problem>().errors?.map((e) => e.field)).toContain('password');
    expect((await accept(token)).statusCode).toBe(200);
  });

  it('V-13 six simultaneous accepts: exactly one wins, one account, one set of roles', async () => {
    const { address, token } = await invited(email('parallel'));
    const results = await Promise.all(Array.from({ length: 6 }, () => accept(token)));
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 422, 422, 422, 422, 422]);
    const users = await database.pool.query('SELECT id FROM users WHERE email = $1', [address]);
    expect(users.rowCount).toBe(1);
    expect(await rolesOf(users.rows[0].id)).toHaveLength(1);
  });

  it('V-14 an account created for the address after the invitation is NOT given the roles (409 EMAIL_TAKEN, invitation stays open)', async () => {
    const { address, token, invitation } = await invited(email('squatted'));
    // someone registers the address first (possibly the wrong person: no way to tell who)
    const squatter = await call(undefined, 'POST', '/v1/auth/register', {
      email: address,
      password: PASSWORD,
      name: 'Squatter',
    });
    expect(squatter.statusCode).toBe(201);

    const res = await accept(token);
    expect(res.statusCode).toBe(409);
    expect(res.json<Problem>().code).toBe('EMAIL_TAKEN');
    expect(await rolesOf(squatter.json<Session>().user.id)).toEqual([]);
    const row = await database.pool.query(
      'SELECT accepted_at FROM admin_invitations WHERE id = $1',
      [invitation.id],
    );
    expect(row.rows[0].accepted_at).toBeNull();
  });
});

describe('accepting with Google', () => {
  it('G-1 a Google account whose VERIFIED email is the invited address accepts: signed in, no password, identity linked', async () => {
    const { address, token } = await invited(email('goog'));
    const idToken = google.grant(unique('tok'), {
      subject: unique('sub'),
      email: address,
      emailVerified: true,
      name: 'Gita Google',
    });
    const res = await acceptGoogle(token, idToken);
    expect(res.statusCode).toBe(200);
    const session = res.json<Session>();
    expect(session.user).toMatchObject({ email: address, emailVerified: true });
    const identities = await database.pool.query(
      'SELECT provider FROM user_identities WHERE user_id = $1',
      [session.user.id],
    );
    expect(identities.rows).toEqual([{ provider: 'google' }]);
    expect(await rolesOf(session.user.id)).toHaveLength(1);
    expect((await call(session, 'GET', '/v1/admin/roles')).statusCode).toBe(200);
  });

  it('G-2 a Google account with a DIFFERENT email cannot accept; nothing is created; the invitation stays open', async () => {
    const { address, token, invitation } = await invited(email('mismatch'));
    const idToken = google.grant(unique('tok'), {
      subject: unique('sub'),
      email: email('other'),
      emailVerified: true,
    });
    const res = await acceptGoogle(token, idToken);
    expect(res.statusCode).toBe(422);
    expect(res.json<Problem>().errors?.map((e) => e.field)).toContain('idToken');
    expect(
      (await database.pool.query('SELECT 1 FROM users WHERE email = $1', [address])).rowCount,
    ).toBe(0);
    const row = await database.pool.query(
      'SELECT accepted_at FROM admin_invitations WHERE id = $1',
      [invitation.id],
    );
    expect(row.rows[0].accepted_at).toBeNull();
  });

  it('G-3 the right email but NOT verified by Google is refused too', async () => {
    const { address, token } = await invited(email('unverified'));
    const idToken = google.grant(unique('tok'), {
      subject: unique('sub'),
      email: address,
      emailVerified: false,
    });
    expect((await acceptGoogle(token, idToken)).statusCode).toBe(422);
    expect(
      (await database.pool.query('SELECT 1 FROM users WHERE email = $1', [address])).rowCount,
    ).toBe(0);
  });

  it('G-4 emails compare case-insensitively', async () => {
    const { address, token } = await invited(email('Case'));
    const idToken = google.grant(unique('tok'), {
      subject: unique('sub'),
      email: address.toUpperCase(),
      emailVerified: true,
    });
    expect((await acceptGoogle(token, idToken)).statusCode).toBe(200);
  });

  it('G-5 a rejected Google token is 401 SOCIAL_TOKEN_INVALID; a bad invitation token is the usual 422', async () => {
    const { token } = await invited();
    const bad = await acceptGoogle(token, 'forged-google-token');
    expect(bad.statusCode).toBe(401);
    expect(bad.json<Problem>().code).toBe('SOCIAL_TOKEN_INVALID');

    const idToken = google.grant(unique('tok'), {
      subject: unique('sub'),
      email: email(),
      emailVerified: true,
    });
    expectInvalidToken(await acceptGoogle('y'.repeat(43), idToken));
  });

  it('G-6 a Google account already linked to another user cannot be used (409 IDENTITY_IN_USE); the invitation stays open', async () => {
    const owner = await register();
    const subject = unique('owned-sub');
    await database.pool.query(
      `INSERT INTO user_identities (user_id, provider, provider_subject) VALUES ($1, 'google', $2)`,
      [owner.user.id, subject],
    );
    const { address, token, invitation } = await invited(email('conflict'));
    const idToken = google.grant(unique('tok'), { subject, email: address, emailVerified: true });
    const res = await acceptGoogle(token, idToken);
    expect(res.statusCode).toBe(409);
    expect(res.json<Problem>().code).toBe('IDENTITY_IN_USE');
    expect(
      (await database.pool.query('SELECT 1 FROM users WHERE email = $1', [address])).rowCount,
    ).toBe(0);
    const row = await database.pool.query(
      'SELECT accepted_at FROM admin_invitations WHERE id = $1',
      [invitation.id],
    );
    expect(row.rows[0].accepted_at).toBeNull();
  });
});

describe('role assignment', () => {
  it('P-1 promotes an existing customer in place: same account, immediately allowed what the role allows', async () => {
    const customer = await register();
    expect((await call(customer, 'GET', '/v1/admin/roles')).statusCode).toBe(403);

    const res = await call(boss, 'PUT', `/v1/admin/admins/${customer.user.id}/roles`, {
      roles: [{ roleId: supportRoleId }],
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<Admin>()).toMatchObject({ id: customer.user.id, status: 'active' });
    expect(res.json<Admin>().roles.map((r) => r.roleId)).toEqual([supportRoleId]);
    expect((await call(customer, 'GET', '/v1/admin/roles')).statusCode).toBe(200); // next request, no re-login
    const login = await call(undefined, 'POST', '/v1/auth/login', {
      email: customer.user.email,
      password: PASSWORD,
    });
    expect(login.json<Session>().user.id).toBe(customer.user.id);
  });

  it('P-2 PUT REPLACES the assignments; a drawer scope is stored; duplicates collapse', async () => {
    const person = await register();
    const other = await role(['audit:read']);
    await call(boss, 'PUT', `/v1/admin/admins/${person.user.id}/roles`, {
      roles: [{ roleId: supportRoleId }],
    });
    const res = await call(boss, 'PUT', `/v1/admin/admins/${person.user.id}/roles`, {
      roles: [{ roleId: other, drawerId }, { roleId: other, drawerId }, { roleId: other }],
    });
    expect(res.statusCode).toBe(200);
    const roles = res.json<Admin>().roles;
    expect(roles).toHaveLength(2); // same role, two different scopes (drawer / all)
    expect(roles.map((r) => r.roleId)).toEqual([other, other]);
    expect(roles.map((r) => r.drawerId).sort()).toEqual([drawerId, null].sort());
    expect((await rolesOf(person.user.id)).every((r) => r.granted_by === boss.user.id)).toBe(true);
    expect((await call(person, 'GET', '/v1/admin/roles')).statusCode).toBe(403); // support role was replaced
  });

  it('P-3 invalid input is 422 and changes nothing; unknown / suspended users are 404', async () => {
    const person = await register();
    await call(boss, 'PUT', `/v1/admin/admins/${person.user.id}/roles`, {
      roles: [{ roleId: supportRoleId }],
    });
    for (const roles of [
      [{ roleId: '00000000-0000-4000-8000-000000000000' }],
      [{ roleId: supportRoleId, drawerId: '00000000-0000-4000-8000-000000000000' }],
      [{ roleId: 'nope' }],
    ]) {
      expect(
        (await call(boss, 'PUT', `/v1/admin/admins/${person.user.id}/roles`, { roles })).statusCode,
      ).toBe(422);
    }
    expect((await rolesOf(person.user.id)).map((r) => r.role_id)).toEqual([supportRoleId]);

    expect(
      (
        await call(boss, 'PUT', '/v1/admin/admins/00000000-0000-4000-8000-000000000000/roles', {
          roles: [],
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await call(boss, 'PUT', '/v1/admin/admins/not-a-uuid/roles', { roles: [] })).statusCode,
    ).toBe(404);
    const suspended = await register();
    await database.pool.query("UPDATE users SET status = 'suspended' WHERE id = $1", [
      suspended.user.id,
    ]);
    expect(
      (
        await call(boss, 'PUT', `/v1/admin/admins/${suspended.user.id}/roles`, {
          roles: [{ roleId: supportRoleId }],
        })
      ).statusCode,
    ).toBe(404);
  });

  it('P-4 deactivation: the very next admin request is refused, the customer account keeps working', async () => {
    const person = await register();
    await call(boss, 'PUT', `/v1/admin/admins/${person.user.id}/roles`, {
      roles: [{ roleId: supportRoleId }],
    });
    expect((await call(person, 'GET', '/v1/admin/roles')).statusCode).toBe(200);

    expect((await call(boss, 'DELETE', `/v1/admin/admins/${person.user.id}`)).statusCode).toBe(204);
    const after = await call(person, 'GET', '/v1/admin/roles');
    expect(after.statusCode).toBe(403);
    expect(after.json<Problem>().code).toBe('PERMISSION_DENIED');

    expect((await call(boss, 'DELETE', `/v1/admin/admins/${person.user.id}`)).statusCode).toBe(204); // idempotent
    const login = await call(undefined, 'POST', '/v1/auth/login', {
      email: person.user.email,
      password: PASSWORD,
    });
    expect(login.statusCode).toBe(200); // still a customer
    expect(
      (await call(boss, 'DELETE', '/v1/admin/admins/00000000-0000-4000-8000-000000000000'))
        .statusCode,
    ).toBe(404);
  });

  it('P-5 editing a role takes effect on the very next request of everyone who holds it', async () => {
    const roleId = await role(['roles:read']);
    const person = await register();
    await call(boss, 'PUT', `/v1/admin/admins/${person.user.id}/roles`, { roles: [{ roleId }] });
    expect((await call(person, 'GET', '/v1/admin/admins')).statusCode).toBe(403);
    await call(boss, 'PATCH', `/v1/admin/roles/${roleId}`, {
      permissions: ['roles:read', 'admins:read'],
    });
    expect((await call(person, 'GET', '/v1/admin/admins')).statusCode).toBe(200);
    await call(boss, 'PATCH', `/v1/admin/roles/${roleId}`, { permissions: [] });
    expect((await call(person, 'GET', '/v1/admin/admins')).statusCode).toBe(403);
  });

  it('P-6 the admin list contains role holders only, with their assignments', async () => {
    const holder = await register();
    const plain = await register();
    await call(boss, 'PUT', `/v1/admin/admins/${holder.user.id}/roles`, {
      roles: [{ roleId: supportRoleId, drawerId }],
    });
    const list = (await call(reader, 'GET', '/v1/admin/admins')).json<Admin[]>();
    const entry = list.find((a) => a.id === holder.user.id);
    expect(entry?.roles).toMatchObject([{ roleId: supportRoleId, drawerId, isSuperAdmin: false }]);
    expect(list.find((a) => a.id === plain.user.id)).toBeUndefined();
    expect(list.find((a) => a.id === boss.user.id)?.roles.some((r) => r.isSuperAdmin)).toBe(true);
  });
});

describe('hygiene', () => {
  it('H-1 invitation tokens, passwords and Google tokens never reach the logs', async () => {
    app.logLines.length = 0;
    const { address, token } = await invited(email('logs'));
    const googleToken = google.grant(unique('tok'), {
      subject: unique('sub'),
      email: address,
      emailVerified: true,
    });
    await acceptGoogle(token, googleToken);
    const second = await invited(email('logs2'));
    await accept(second.token, INVITEE_PASSWORD);
    const logs = app.logLines.join('\n');
    for (const needle of [token, second.token, googleToken, INVITEE_PASSWORD, address]) {
      expect(logs).not.toContain(needle);
    }
  });
});
