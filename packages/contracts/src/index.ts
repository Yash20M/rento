import createClient, { type ClientOptions } from 'openapi-fetch';
import type { paths } from './generated/schema';

export type { components, operations, paths } from './generated/schema';

/**
 * Typed REST client for the Rento API, derived from `openapi.json`.
 * Auth (bearer token, refresh) is layered on by each app (admin SPA in P1-10).
 */
export function createApiClient(baseUrl: string, options: Omit<ClientOptions, 'baseUrl'> = {}) {
  return createClient<paths>({ baseUrl, ...options });
}

export type ApiClient = ReturnType<typeof createApiClient>;
