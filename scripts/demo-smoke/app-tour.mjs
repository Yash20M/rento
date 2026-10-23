/* global document */
// Drives the REAL running demo stack (`pnpm demo` first) in a headless browser and takes screenshots. Part of `pnpm demo:smoke`.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(root + 'apps/admin/package.json');
const { chromium } = require('@playwright/test');

const out = process.argv[2] ?? `${root}demo-shots`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 420, height: 880 } });
const log = [];
page.on('pageerror', (e) => log.push('pageerror ' + e.message));
page.on('console', (m) => m.type() === 'error' && log.push('console ' + m.text()));
page.on('requestfailed', (r) =>
  log.push('requestfailed ' + r.url() + ' ' + r.failure()?.errorText),
);

const step = async (name) => {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/${name}.png` });
};

await page.goto('http://127.0.0.1:5555/');
await page.waitForSelector('flt-glass-pane', { state: 'attached', timeout: 60000 });
await page.evaluate(() => document.querySelector('flt-semantics-placeholder')?.click());
await page.waitForTimeout(1500);
await step('01-login');

// Flutter web text fields are fed through a hidden input; typing can garble under automation, so verify what
// landed in both fields and start again from a fresh page when it is wrong.
const EMAIL = 'demo.customer@rento.demo';
const PASSWORD = 'Demo-Passw0rd!2026';
let signedIn = false;
for (let attempt = 0; attempt < 5 && !signedIn; attempt += 1) {
  if (attempt > 0) {
    await page.reload();
    await page.waitForSelector('flt-glass-pane', { state: 'attached', timeout: 60000 });
    await page.evaluate(() => document.querySelector('flt-semantics-placeholder')?.click());
    await page.waitForTimeout(1500);
  }
  const email = page.locator('input[aria-label="Email"]');
  const password = page.locator('input[aria-label="Password"]');
  await email.click({ force: true });
  await page.waitForTimeout(700); // the first keystrokes after a focus change are lost otherwise
  await page.keyboard.type(EMAIL, { delay: 40 });
  await password.click({ force: true });
  await page.waitForTimeout(700);
  await page.keyboard.type(PASSWORD, { delay: 40 });
  await page.waitForTimeout(400);
  if ((await email.inputValue()) !== EMAIL || (await password.inputValue()) !== PASSWORD) continue;
  await page.getByRole('button', { name: 'Sign in' }).click();
  signedIn = await page
    .getByText('Find a drawer')
    .first()
    .waitFor({ timeout: 8000 })
    .then(() => true)
    .catch(() => false);
}
if (!signedIn) throw new Error('could not sign in to the customer app');
await step('02-explore');

await page
  .getByRole('button', { name: /Where are you/ })
  .first()
  .click();
await step('03-location-sheet');
await page.getByText('Bengaluru · Indiranagar').click();
await page.getByText('Indiranagar Hub').first().waitFor({ timeout: 20000 });
await step('04-nearby');

await page.getByText('Indiranagar Hub').first().click();
await page.getByText('PlayStation 5').first().waitFor({ timeout: 20000 });
await step('05-drawer');

await page.getByText('PlayStation 5').first().click();
await page
  .getByText('Choose a start time')
  .waitFor({ timeout: 8000 })
  .catch(() => {});
await step('06-slots');

await page
  .getByRole('button', { name: /^\d{1,2}:\d{2} [AP]M$/ })
  .nth(2)
  .click();
await page
  .getByRole('button', { name: /^(1 h|1 h 30 min|2 h)$/ })
  .first()
  .click();
await step('07-summary');
await page.getByRole('button', { name: 'Reserve & pay' }).click();
await page.getByText('Complete your booking').waitFor({ timeout: 20000 });
await step('08-checkout');
await page.getByRole('button', { name: /^Pay / }).click();
await page.getByText('Razorpay checkout (demo)').waitFor({ timeout: 20000 });
await step('08b-demo-gateway');
await page.getByRole('button', { name: /Test card 4111/ }).click();
await page.getByText('You are booked!').waitFor({ timeout: 20000 });
await step('09-confirmed');
await page.getByRole('button', { name: 'View booking' }).click();
await page.getByText('Booking').first().waitFor();
await step('10-detail');
await page.getByRole('button', { name: 'Cancel booking' }).click();
await step('11-cancel-dialog');
await page.getByRole('button', { name: 'Cancel booking' }).last().click();
await page.getByText('Cancelled').first().waitFor({ timeout: 20000 });
await step('12-cancelled');
console.log(JSON.stringify(log, null, 2));
await browser.close();
