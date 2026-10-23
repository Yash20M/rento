// Drives the REAL running demo stack (`pnpm demo` first) in a headless browser and takes screenshots. Part of `pnpm demo:smoke`.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(root + 'apps/admin/package.json');
const { chromium } = require('@playwright/test');

const out = process.argv[2] ?? `${root}demo-shots`;
mkdirSync(out, { recursive: true });
const base = 'http://127.0.0.1:5173';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 860 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

await page.goto(base + '/');
await page.waitForURL('**/login');
await page.screenshot({ path: `${out}/01-login.png` });

await page.getByLabel('Email').fill('demo.admin@rento.demo');
await page.getByLabel('Password').fill('Demo-Passw0rd!2026');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.getByRole('heading', { name: /welcome/i }).waitFor();
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/02-dashboard.png` });

for (const [name, path] of [
  ['03-bookings', '/bookings'],
  ['04-categories', '/inventory/categories'],
  ['05-models', '/inventory/models'],
  ['06-assets', '/inventory/assets'],
  ['07-drawers', '/drawers'],
  ['08-staff', '/staff'],
  ['09-roles', '/roles'],
  ['10-audit', '/audit'],
  ['11-schedule', '/schedule'],
  ['12-reports', '/reports'],
  ['13-payments', '/payments'],
  ['14-settings', '/settings'],
]) {
  await page.getByRole('navigation', { name: 'Main' }).locator(`a[href="${path}"]`).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${name}.png` });
}

console.log(JSON.stringify(errors, null, 2));
await browser.close();
