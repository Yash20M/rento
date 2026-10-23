// Compile-time assertions only (never executed). If the API contract changes in a way that breaks how
// clients use it, `tsc` (and therefore `pnpm contracts:check`) fails here.
import { type components, createApiClient } from './index';

const client = createApiClient('http://localhost');

export async function usageCheck(): Promise<void> {
  const health = await client.GET('/healthz');
  if (health.data) {
    // Literal type, not `string`.
    const status: 'ok' = health.data.status;
    void status;
  }

  const ready = await client.GET('/readyz');
  if (ready.data) {
    const database: 'up' = ready.data.checks.database;
    void database;
  }
  if (ready.error) {
    // Errors are typed as RFC 9457 problem details with a closed `code` union.
    const code: components['schemas']['ErrorCode'] = ready.error.code;
    const traceId: string = ready.error.traceId;
    void code;
    void traceId;
  }

  const login = await client.POST('/v1/auth/login', {
    body: { email: 'asha@example.com', password: 'a long enough password' },
  });
  if (login.data) {
    const token: string = login.data.accessToken;
    const type: 'Bearer' = login.data.tokenType;
    const verified: boolean = login.data.user.emailVerified;
    void [token, type, verified];
  }
  if (login.error) {
    const code: components['schemas']['ErrorCode'] = login.error.code;
    void code;
  }

  // @ts-expect-error — the request body is typed: `email` is required
  await client.POST('/v1/auth/login', { body: { password: 'x' } });

  await client.POST('/v1/auth/password/forgot', { body: { email: 'asha@example.com' } });
  await client.POST('/v1/auth/password/reset', {
    body: { token: 'from-the-email-link', newPassword: 'a long enough password' },
  });
  await client.POST('/v1/auth/email/verify', { body: { token: 'from-the-email-link' } });
  await client.POST('/v1/auth/email/verification/resend');

  const google = await client.POST('/v1/auth/social/google', { body: { idToken: 'from-google' } });
  if (google.data) {
    const missing: Array<'email' | 'phone'> = google.data.needsProfileCompletion;
    const token: string = google.data.accessToken;
    void [missing, token];
  }
  if (google.error) {
    const code: components['schemas']['ErrorCode'] = google.error.code;
    void code;
  }

  const identities = await client.GET('/v1/me/identities');
  if (identities.data) {
    const first = identities.data[0];
    const provider: string | undefined = first?.provider;
    const linkedAt: string | undefined = first?.linkedAt;
    void [provider, linkedAt];
  }
  await client.POST('/v1/me/identities/google', { body: { idToken: 'from-google' } });
  await client.DELETE('/v1/me/identities/{provider}', { params: { path: { provider: 'google' } } });
  const patched = await client.PATCH('/v1/me', { body: { phone: '+919876543210' } });
  if (patched.data) {
    const needs: Array<'email' | 'phone'> = patched.data.needsProfileCompletion;
    void needs;
  }

  const roles = await client.GET('/v1/admin/roles');
  if (roles.data) {
    const first = roles.data[0];
    const keys: string[] | undefined = first?.permissions;
    const locked: boolean | undefined = first?.isSystem;
    void [keys, locked];
  }
  await client.POST('/v1/admin/roles', {
    body: { name: 'Support Agent', permissions: ['bookings:read'] },
  });
  await client.PATCH('/v1/admin/roles/{id}', {
    params: { path: { id: 'x' } },
    body: { permissions: [] },
  });
  await client.DELETE('/v1/admin/roles/{id}', { params: { path: { id: 'x' } } });
  await client.GET('/v1/admin/permissions');

  await client.POST('/v1/admin/admins/invitations', {
    body: { email: 'agent@example.com', roles: [{ roleId: 'r1' }] },
  });
  await client.PUT('/v1/admin/admins/{userId}/roles', {
    params: { path: { userId: 'u1' } },
    body: { roles: [] },
  });
  const accepted = await client.POST('/v1/auth/admin-invitations/accept', {
    body: { token: 'from-the-link', password: 'a long enough password' },
  });
  if (accepted.data) {
    const access: string = accepted.data.accessToken;
    void access;
  }

  const me = await client.GET('/v1/admin/me');
  if (me.data) {
    const superAdmin: boolean = me.data.superAdmin;
    const scopes: Array<{ permission: string; drawerIds: string[] }> = me.data.drawerScopes;
    void [superAdmin, scopes];
  }

  // @ts-expect-error — the reset body needs `newPassword`
  await client.POST('/v1/auth/password/reset', { body: { token: 'x' } });

  // @ts-expect-error — unknown paths must not type-check
  await client.GET('/definitely-not-an-endpoint');
}
