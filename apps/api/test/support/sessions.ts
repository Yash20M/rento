import type { Clock } from '../../src/common/clock/clock';
import type { TestApp } from './create-test-app';

export const TEST_PASSWORD = 'correct horse battery staple';
const MINUTE_MS = 60_000;

/** A signed-in test user that can sign in again when the fake clock has moved far from when the token was issued. */
export interface TestSession {
  accessToken: string;
  user: { id: string };
  email: string;
  /** Fake-clock instant (ms) at which `accessToken` was issued. */
  issuedAt: number;
}

let counter = 0;

export async function registerSession(
  app: TestApp,
  clock: Clock,
  prefix = 'user',
): Promise<TestSession> {
  const email = `${prefix}-${(counter += 1)}-${Date.now()}@example.com`;
  const res = await app.app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email, password: TEST_PASSWORD, name: 'Tester' },
  });
  const body = res.json<{ accessToken: string; user: { id: string } }>();
  return { accessToken: body.accessToken, user: body.user, email, issuedAt: clock.now().getTime() };
}

/**
 * Access tokens follow the fake clock, which tests move by hours or days. Signs the user in again whenever the clock
 * is more than five minutes away from the token's issue time (in either direction).
 */
export async function freshSession(
  app: TestApp,
  clock: Clock,
  session: TestSession,
): Promise<TestSession> {
  const now = clock.now().getTime();
  if (Math.abs(now - session.issuedAt) <= 5 * MINUTE_MS) return session;
  const res = await app.app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: session.email, password: TEST_PASSWORD },
  });
  session.accessToken = res.json<{ accessToken: string }>().accessToken;
  session.issuedAt = now;
  return session;
}
