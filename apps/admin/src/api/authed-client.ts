import { type ApiClient, createApiClient } from '@rento/contracts';
import type { SessionStore } from '@/auth/session';

export type { ApiClient };

type FetchLike = (request: Request) => Promise<Response>;

const SESSION_PREFIX = '/v1/auth/session';
const REFRESH_PATH = `${SESSION_PREFIX}/refresh`;
const NO_AUTH_PATHS = [`${SESSION_PREFIX}/`, '/v1/auth/register', '/v1/auth/admin-invitations/'];

/**
 * Calls to the session routes carry the HttpOnly refresh cookie (`credentials: 'include'`) and the custom header the
 * API requires on cookie-authenticated calls (CSRF defence, ADR-012).
 */
function forSession(request: Request): Request {
  const headers = new Headers(request.headers);
  headers.set('x-requested-with', 'rento-web');
  return new Request(request, { headers, credentials: 'include' });
}

/**
 * The typed client with the session layered on: it sends the bearer token and, when the server says the access token
 * expired, refreshes it ONCE (single flight — ADR-012: two simultaneous refreshes of one cookie would revoke the whole
 * family) and repeats the request. If the refresh is refused the session ends.
 */
export function createAuthedClient(
  baseUrl: string,
  session: SessionStore,
  baseFetch: FetchLike = (request) => fetch(request),
): ApiClient {
  let refreshing: Promise<boolean> | undefined;

  const refresh = (): Promise<boolean> => {
    refreshing ??= doRefresh().finally(() => {
      refreshing = undefined;
    });
    return refreshing;
  };

  async function doRefresh(): Promise<boolean> {
    try {
      const response = await baseFetch(
        forSession(new Request(`${baseUrl}${REFRESH_PATH}`, { method: 'POST' })),
      );
      if (!response.ok) {
        session.clear(true);
        return false;
      }
      const body = (await response.json()) as { accessToken: string };
      session.setAccess(body.accessToken);
      return true;
    } catch {
      return false; // the network is down: keep the session, the request just fails
    }
  }

  const authedFetch: FetchLike = async (original) => {
    const path = new URL(original.url, 'http://placeholder').pathname;
    const isSession = path.startsWith(SESSION_PREFIX);
    const request = isSession ? forSession(original) : original;
    const retry = request.clone();
    const token = session.accessToken;
    if (token) request.headers.set('authorization', `Bearer ${token}`);
    const response = await baseFetch(request);

    if (response.status === 403 && !isSession) {
      // A sensitive action wants a fresh authenticator code: ask once, then repeat the action with the upgraded token.
      const refusal = (await response
        .clone()
        .json()
        .catch(() => undefined)) as { code?: string } | undefined;
      if (refusal?.code === 'STEP_UP_REQUIRED' && (await session.requestStepUp())) {
        retry.headers.set('authorization', `Bearer ${session.accessToken ?? ''}`);
        return baseFetch(retry);
      }
      return response;
    }
    if (response.status !== 401 || NO_AUTH_PATHS.some((p) => path.startsWith(p))) return response;
    const problem = (await response
      .clone()
      .json()
      .catch(() => undefined)) as { code?: string } | undefined;
    if (problem?.code !== 'TOKEN_EXPIRED') return response;

    // Someone else may have refreshed while this request was in flight: then just repeat it with the new token.
    if (token === session.accessToken && !(await refresh())) return response;
    retry.headers.set('authorization', `Bearer ${session.accessToken ?? ''}`);
    return baseFetch(retry);
  };

  return createApiClient(baseUrl, { fetch: authedFetch });
}
