import type { NestFastifyApplication } from '@nestjs/platform-fastify';

/** Request headers a browser client may send (the bearer token and the booking idempotency key). */
const ALLOWED_HEADERS =
  'authorization, content-type, idempotency-key, x-request-id, x-requested-with';
const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const EXPOSED_HEADERS = 'idempotency-replayed, x-request-id, retry-after';
const PREFLIGHT_MAX_AGE_SECONDS = '600';
const SESSION_PREFIX = '/v1/auth/session';

/**
 * Cross-origin access for browsers, from an explicit allow-list (`CORS_ALLOWED_ORIGINS`; empty = nothing allowed, which
 * is the production default for the mobile and same-origin admin setups). Origins are matched exactly — never by pattern —
 * and credentials (cookies) are allowed ONLY on `/v1/auth/session/*`; everywhere else sessions travel in the `Authorization` header.
 */
export function registerCors(app: NestFastifyApplication, allowedOrigins: readonly string[]): void {
  if (allowedOrigins.length === 0) return;
  const allowed = new Set(allowedOrigins);

  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', async (request, reply) => {
      const origin = request.headers.origin;
      if (typeof origin !== 'string' || !allowed.has(origin)) return;

      void reply.header('access-control-allow-origin', origin);
      void reply.header('vary', 'Origin');
      // Cookies are accepted on the browser-session routes only (the HttpOnly refresh cookie); nowhere else.
      if (request.url.startsWith(SESSION_PREFIX)) {
        void reply.header('access-control-allow-credentials', 'true');
      }
      void reply.header('access-control-expose-headers', EXPOSED_HEADERS);

      const isPreflight =
        request.method === 'OPTIONS' &&
        typeof request.headers['access-control-request-method'] === 'string';
      if (isPreflight) {
        void reply.header('access-control-allow-methods', ALLOWED_METHODS);
        void reply.header('access-control-allow-headers', ALLOWED_HEADERS);
        void reply.header('access-control-max-age', PREFLIGHT_MAX_AGE_SECONDS);
        return reply.code(204).send();
      }
      return undefined;
    });
}
