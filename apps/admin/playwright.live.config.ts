import { defineConfig, devices } from '@playwright/test';

// Specs that drive the real admin panel against the real API (started by `pnpm test:live-ui`, scripts/live-ui.mjs).
// The stubbed-API smoke tests stay in e2e/ and run in `pnpm verify`.
export default defineConfig({
  testDir: 'e2e-live',
  testMatch: '**/*.live.spec.ts',
  fullyParallel: false, // one seeded database; specs that change settings must not interleave
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: 0, // a flaky test is a bug — never retry until green
  reporter: process.env['CI'] ? [['github'], ['list']] : 'list',
  outputDir: 'test-results/live',
  use: {
    baseURL: process.env['LIVE_ADMIN_URL'] ?? 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
