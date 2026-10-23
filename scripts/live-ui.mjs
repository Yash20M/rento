// `pnpm test:live-ui` — drives the REAL admin panel in a real browser against the REAL API and a throw-away database.
//
// Nothing is stubbed: scripts/lib/live-stack.mjs creates an empty database next to the dev Postgres, migrates it,
// starts the API and the admin panel on free ports and seeds the demo data through the API. This script then runs the
// Playwright specs in apps/admin/e2e-live and everything is stopped and dropped. Your dev data is never touched.
//
//   pnpm test:live-ui                  all specs
//   pnpm test:live-ui -- -g "L-03"     extra arguments go to Playwright
//
// Needs Docker's Postgres to be up (`pnpm dev:db`); LIVE_PG_URL overrides the admin connection (CI service container).
import { pnpm, run, withLiveStack } from './lib/live-stack.mjs';

await withLiveStack({ admin: true }, async (stack) => {
  stack.say('Running the browser specs');
  const extra = process.argv.slice(2).filter((a) => a !== '--');
  const result = run(
    pnpm,
    [
      '--filter',
      '@rento/admin',
      'exec',
      'playwright',
      'test',
      '-c',
      'playwright.live.config.ts',
      ...extra,
    ],
    {
      env: {
        ...stack.env,
        LIVE_ADMIN_URL: stack.adminUrl,
        LIVE_API_URL: stack.apiUrl,
        LIVE_OWNER_EMAIL: stack.owner.ADMIN_EMAIL,
        LIVE_OWNER_PASSWORD: stack.owner.ADMIN_PASSWORD,
        LIVE_FRONTDESK_EMAIL: 'frontdesk@rento.demo',
        LIVE_DEMO_PASSWORD: stack.demoPassword,
      },
    },
  );
  return result.status ?? 1;
});
