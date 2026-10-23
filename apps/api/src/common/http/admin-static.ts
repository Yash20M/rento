import { existsSync } from 'node:fs';
import path from 'node:path';
import fastifyStatic from '@fastify/static';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

/**
 * The pages of the admin panel (its router, `apps/admin/src/app/router.tsx`). A browser that opens or reloads one of
 * these addresses gets the app's single HTML file; the panel then shows the right page itself. Everything else that is
 * not a real file stays a 404, so the API's own answers (`/v1/...`, `/healthz`) are never shadowed.
 */
export const ADMIN_PAGES = [
  '/',
  '/login',
  '/accept-invitation',
  '/account',
  '/bookings',
  '/schedule',
  '/customers',
  '/inventory/categories',
  '/inventory/models',
  '/inventory/assets',
  '/drawers',
  '/staff',
  '/roles',
  '/reports',
  '/payments',
  '/settings',
  '/audit',
] as const;

/**
 * Serves the built admin panel from the API's own address (`ADMIN_STATIC_DIR`). One address for both means the panel's
 * session cookie (`SameSite=Strict`) works without any cross-site setup, and one small host runs the whole product.
 */
export function registerAdminStatic(app: NestFastifyApplication, directory: string): void {
  const root = path.resolve(directory);
  if (!existsSync(path.join(root, 'index.html'))) {
    throw new Error(`ADMIN_STATIC_DIR (${root}) has no index.html: build the admin panel first`);
  }
  const fastify = app.getHttpAdapter().getInstance();
  void fastify.register(fastifyStatic, {
    root,
    prefix: '/',
    index: false, // `/` is answered below, with the right headers
    setHeaders: (response, filePath) => {
      // File names under assets/ contain a content hash: they never change, so they may be cached for good.
      response.header(
        'cache-control',
        filePath.includes(`${path.sep}assets${path.sep}`)
          ? 'public, max-age=31536000, immutable'
          : 'no-cache',
      );
    },
  });
  for (const page of ADMIN_PAGES) {
    fastify.get(page, (_request, reply) =>
      reply
        .header('cache-control', 'no-cache')
        .type('text/html; charset=utf-8')
        .sendFile('index.html'),
    );
  }
}
