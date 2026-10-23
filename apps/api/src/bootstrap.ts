import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Logger } from 'pino';
import { registerAdminStatic } from './common/http/admin-static';
import { registerCors } from './common/http/cors';
import { MAX_IMAGE_BYTES } from './modules/inventory/domain/images';
import { NestPinoLogger } from './common/logging/nest-pino-logger';
import { resolveRequestId } from './common/request-id';
import type { AppConfig } from './config/app-config';
import { setupOpenApi } from './openapi';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Fastify adapter with pino request logging and validated request-ID propagation. */
export function createFastifyAdapter(logger: Logger, trustProxy = false): FastifyAdapter {
  return new FastifyAdapter({
    loggerInstance: logger,
    trustProxy,
    genReqId: (request: IncomingMessage) =>
      resolveRequestId(request.headers[REQUEST_ID_HEADER], randomUUID),
  });
}

/** Cross-cutting setup shared by `main.ts` and the test harness. Does not listen. */
export function configureApp(app: NestFastifyApplication, config: AppConfig, logger: Logger): void {
  app.useLogger(new NestPinoLogger(logger));
  app.setGlobalPrefix('v1', { exclude: ['healthz', 'readyz'] });

  // Echo the request ID on every response (including errors and 404s).
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', (request, reply, done) => {
      void reply.header(REQUEST_ID_HEADER, request.id);
      done();
    });

  // Photo uploads send the image itself as the body: hand it over as bytes (the size limit is enforced here, before
  // any handler runs; the handler checks the real file signature).
  const fastify = app.getHttpAdapter().getInstance();
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    fastify.addContentTypeParser(
      type,
      { parseAs: 'buffer', bodyLimit: MAX_IMAGE_BYTES },
      (_request, body, done) => done(null, body),
    );
  }

  registerCors(app, config.corsAllowedOrigins);
  if (config.adminStaticDir) registerAdminStatic(app, config.adminStaticDir);

  if (config.docsEnabled) setupOpenApi(app);
}
