import type { SessionStore } from '@/auth/session';
import type { Env } from '@/config/env';
import { type ApiClient, createAuthedClient } from './authed-client';

export type { ApiClient };

/** The typed API client (generated from the OpenAPI contract) pointed at the configured origin, carrying the session. */
export function createClientFromEnv(env: Env, session: SessionStore): ApiClient {
  return createAuthedClient(env.apiBaseUrl, session);
}
