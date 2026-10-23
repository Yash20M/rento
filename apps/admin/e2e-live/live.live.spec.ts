import { createHmac } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

/**
 * The admin panel as a person uses it: real browser, real API, real (throw-away) database, no stubs.
 * Started by `pnpm test:live-ui`; the people below come from the demo seed.
 */
const env = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — run these specs through \`pnpm test:live-ui\``);
  return value;
};
const OWNER = { email: env('LIVE_OWNER_EMAIL'), password: env('LIVE_OWNER_PASSWORD') };
const FRONT_DESK = { email: env('LIVE_FRONTDESK_EMAIL'), password: env('LIVE_DEMO_PASSWORD') };

const problems = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const list: string[] = [];
  problems.set(page, list);
  page.on('pageerror', (error) => list.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    // The sign-in page probes for a session first; that 401 is expected.
    if (message.type() === 'error' && !/401/.test(message.text())) {
      list.push(`console: ${message.text()}`);
    }
  });
});
test.afterEach(({ page }) => {
  expect(problems.get(page), 'browser errors').toEqual([]);
});

async function signIn(page: Page, who: { email: string; password: string }) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password').fill(who.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
}
const menu = (page: Page) => page.getByRole('navigation', { name: 'Main' }).getByRole('link');

test('L-01 the owner signs in and lands on a dashboard with its cards and charts', async ({
  page,
}) => {
  await signIn(page, OWNER);
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await expect(page.locator('svg[role="img"]').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/live/dashboard.png', fullPage: true });
});

test('L-02 a wrong password is refused with one generic message and no session', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(OWNER.email);
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/bookings');
  await expect(page).toHaveURL(/\/login/);
});

test('L-03 every menu entry of the owner opens a page that loads without an error', async ({
  page,
}) => {
  await signIn(page, OWNER);
  const labels = await menu(page).allTextContents();
  expect(labels).toEqual(
    expect.arrayContaining([
      'Bookings',
      'Schedule',
      'Customers',
      'Item models',
      'Assets',
      'Drawers',
      'Staff',
      'Roles',
      'Reports',
      'Payments',
      'Audit log',
      'Settings',
    ]),
  );
  for (const label of labels) {
    await menu(page)
      .filter({ hasText: new RegExp(`^${label}$`) })
      .click();
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(page.getByText(/something went wrong|could not load/i), label).toHaveCount(0);
    await page.waitForLoadState('networkidle');
  }
});

test('L-04 changing the nearby-search rules saves, survives a reload, and is restored', async ({
  page,
}) => {
  await signIn(page, OWNER);
  await page.goto('/settings');
  const form = page.getByRole('form', { name: 'Nearby search' });
  await form.getByLabel('Search radius (km)').fill('7.5');
  await form.getByLabel('Drawers shown at most').fill('4');
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(form.getByText('Saved')).toBeVisible();
  await page.reload();
  await expect(page.getByText('7.5 km, up to 4 drawers')).toBeVisible();
  await form.getByLabel('Search radius (km)').fill('5');
  await form.getByLabel('Drawers shown at most').fill('3');
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('5 km, up to 3 drawers')).toBeVisible();
});

test('L-05 out-of-range settings cannot be saved', async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto('/settings');
  const form = page.getByRole('form', { name: 'Nearby search' });
  await form.getByLabel('Drawers shown at most').fill('11');
  await expect(form.getByRole('button', { name: 'Save' })).toBeDisabled();
});

test('L-06 a new category appears in the list and can be deleted again', async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto('/inventory/categories');
  const name = `Live ${Date.now().toString(36)}`;
  await page.getByRole('button', { name: 'New category' }).click();
  const dialog = page.getByRole('dialog', { name: 'New category' });
  await dialog.getByLabel('Name', { exact: true }).fill(name);
  await dialog.getByRole('button', { name: /save|create/i }).click();
  const row = page.getByRole('row', { name: new RegExp(name) });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Delete' }).click();
  await page
    .getByRole('dialog', { name: 'Delete category?' })
    .getByRole('button', { name: /delete/i })
    .click();
  await expect(row).toHaveCount(0);
});

test('L-07 tables are paged: rows-per-page changes the page and Next / Previous move through it', async ({
  page,
}) => {
  await signIn(page, OWNER);
  await page.goto('/audit');
  const pager = page.getByRole('navigation', { name: 'Pagination' });
  await expect(pager).toBeVisible();
  await pager.getByLabel('Rows per page').selectOption('10');
  const first = await page.getByRole('row').nth(1).textContent();
  if (await pager.getByRole('button', { name: 'Next page' }).isEnabled()) {
    await pager.getByRole('button', { name: 'Next page' }).click();
    await expect(pager.getByRole('button', { name: 'Previous page' })).toBeEnabled();
    await pager.getByRole('button', { name: 'Previous page' }).click();
    await expect(page.getByRole('row').nth(1)).toHaveText(first ?? '');
  }
});

test('L-08 the theme switch changes the look and is remembered after a reload', async ({
  page,
}) => {
  await signIn(page, OWNER);
  const html = page.locator('html');
  const isDark = () => html.evaluate((el) => el.classList.contains('dark'));
  const before = await isDark();
  await page.getByRole('button', { name: /switch to (dark|light) theme/i }).click();
  const after = await isDark();
  expect(after).not.toBe(before);
  await page.reload();
  await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
  expect(await isDark()).toBe(after);
  await page.screenshot({ path: 'test-results/live/theme.png' });
});

test('L-09 front desk sees only its own menu, is refused other pages by address, and is refused by the API', async ({
  page,
  request,
}) => {
  await signIn(page, FRONT_DESK);
  const labels = await menu(page).allTextContents();
  for (const hidden of ['Staff', 'Roles', 'Settings', 'Audit log']) {
    expect(labels, hidden).not.toContain(hidden);
  }
  await page.goto('/settings');
  await expect(page.getByRole('alert')).toContainText(/do not have access/i);
  const login = await request.post(`${env('LIVE_API_URL')}/v1/auth/login`, {
    data: { email: FRONT_DESK.email, password: FRONT_DESK.password },
  });
  const { accessToken } = (await login.json()) as { accessToken: string };
  const refused = await request.get(`${env('LIVE_API_URL')}/v1/admin/settings`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  expect(refused.status()).toBe(403);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('L-10 the layout fits the screen (no sideways scrolling) and the menu opens', async ({
    page,
  }) => {
    await signIn(page, OWNER);
    for (const path of [
      '/',
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
      '/audit',
      '/settings',
    ]) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(1);
    }
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await page.screenshot({ path: 'test-results/live/phone-menu.png' });
  });
});

test('L-11 signing out ends the session: protected pages send you back to sign in', async ({
  page,
}) => {
  await signIn(page, OWNER);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/login/);
});

test('L-12 the demo customer shows a photo and the verified tick in the customer list', async ({
  page,
}) => {
  await signIn(page, OWNER);
  await page.goto('/customers');
  const row = page.getByRole('row', { name: /demo.customer@rento.demo/i });
  await expect(row).toBeVisible();
  await expect(row.locator('[data-testid="avatar"] img')).toBeVisible();
  await expect(row.getByRole('img', { name: 'Identity verified' })).toBeVisible();
  const loaded = await row
    .locator('[data-testid="avatar"] img')
    .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
  expect(loaded, 'the photo really loads from the API').toBe(true);
  await page.screenshot({ path: 'test-results/live/customers.png', fullPage: true });
});

test('L-13 a drawer cover photo can be added, is served by the API, and can be removed again', async ({
  page,
}) => {
  await signIn(page, OWNER);
  await page.goto('/drawers');
  await page
    .getByRole('row', { name: /Koramangala Hub/ })
    .getByRole('button', { name: 'Edit' })
    .click();
  const dialog = page.getByRole('dialog');
  // The seed gave every drawer a cover; remove it, then add a new one.
  await dialog.getByRole('button', { name: 'Remove photo' }).click();
  await expect(dialog.getByRole('img', { name: 'No cover photo' })).toBeVisible();
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  await dialog.getByLabel('Choose cover photo').setInputFiles({
    name: 'cover.png',
    mimeType: 'image/png',
    buffer: png,
  });
  const cover = dialog.getByRole('img', { name: /Koramangala Hub cover/ });
  await expect(cover).toBeVisible();
  const src = await cover.getAttribute('src');
  expect(src).toMatch(/^\/v1\/media\//);
  const served = await page.request.get(src!);
  expect(served.status()).toBe(200);
  expect(served.headers()['content-type']).toBe('image/png');
});

test('L-14 blocking a unit over a booking is refused with the booking named, nothing is cancelled, and it works once the booking is gone', async ({
  page,
  request,
}) => {
  const api = env('LIVE_API_URL');
  const login = async (who: { email: string; password: string }) =>
    (await (await request.post(`${api}/v1/auth/login`, { data: who })).json())
      .accessToken as string;
  const owner = { Authorization: `Bearer ${await login(OWNER)}` };
  const customer = {
    Authorization: `Bearer ${await login({
      email: 'demo.customer@rento.demo',
      password: env('LIVE_DEMO_PASSWORD'),
    })}`,
  };

  // a unit and its drawer, and a booking of it three days ahead (10:30 IST = 05:00 UTC)
  const assets = (
    await (await request.get(`${api}/v1/admin/assets?limit=1`, { headers: owner })).json()
  ).data as Array<{ itemModelId: string; drawerId: string; drawerName: string }>;
  const unit = assets[0]!;
  const drawer = await (
    await request.get(`${api}/v1/admin/drawers/${unit.drawerId}`, { headers: owner })
  ).json();
  const zone = drawer.timezone as string;
  const startsAt = new Date(Date.now() + 3 * 24 * 3_600_000);
  startsAt.setUTCHours(5, 0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 60 * 60_000);
  const booked = await request.post(`${api}/v1/bookings`, {
    headers: { ...customer, 'Idempotency-Key': `l14-${Date.now()}` },
    data: {
      drawerId: unit.drawerId,
      itemModelId: unit.itemModelId,
      startsAt: startsAt.toISOString(),
      durationMinutes: 60,
    },
  });
  expect(booked.status(), await booked.text()).toBe(201);
  const booking = (await booked.json()) as { id: string; assetCode: string };

  // the drawer's own wall-clock for the block form and the day picker
  const local = (d: Date) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: zone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
        .formatToParts(d)
        .map((x) => [x.type, x.value]),
    );
    return { day: `${p['year']}-${p['month']}-${p['day']}`, time: `${p['hour']}:${p['minute']}` };
  };

  try {
    await signIn(page, OWNER);
    await page.goto('/schedule');
    await page.getByLabel('Drawer').selectOption({ label: drawer.name });
    await page.getByLabel('Day').fill(local(startsAt).day);
    const row = page.getByRole('group', { name: `Unit ${booking.assetCode}` });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Block time…' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('From').fill(`${local(startsAt).day}T${local(startsAt).time}`);
    await dialog.getByLabel('Until').fill(`${local(endsAt).day}T${local(endsAt).time}`);
    await dialog.getByLabel('Reason').fill('Brake check');
    await expect(dialog.getByRole('alert')).toContainText('Nothing is cancelled for you');
    await expect(dialog.getByRole('button', { name: 'Block this time' })).toBeDisabled();
    await page.screenshot({ path: 'test-results/live/block-refused.png' });

    // nothing was cancelled behind anyone's back
    const still = await (
      await request.get(`${api}/v1/bookings/${booking.id}`, { headers: customer })
    ).json();
    expect(still.status).toBe('held');

    // the booking goes away (the customer cancels) and the same time can now be blocked
    expect(
      (await request.post(`${api}/v1/bookings/${booking.id}/cancel`, { headers: customer })).ok(),
    ).toBe(true);
    // reopen the form (the check runs afresh) and block the same time
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await row.getByRole('button', { name: 'Block time…' }).click();
    await dialog.getByLabel('From').fill(`${local(startsAt).day}T${local(startsAt).time}`);
    await dialog.getByLabel('Until').fill(`${local(endsAt).day}T${local(endsAt).time}`);
    await dialog.getByLabel('Reason').fill('Brake check again');
    await expect(dialog.getByRole('status')).toContainText('Nothing is booked in this time');
    await dialog.getByRole('button', { name: 'Block this time' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: /Brake check/ }).first()).toBeVisible();
  } finally {
    await request.post(`${api}/v1/bookings/${booking.id}/cancel`, { headers: customer });
  }
});

test('L-15 my account: the owner changes their name and adds a photo, and the header shows both; the photo can be removed', async ({
  page,
}) => {
  await signIn(page, OWNER);
  await page.getByRole('link', { name: /my account/i }).click();
  await expect(page.getByRole('heading', { name: 'My account' })).toBeVisible();

  const name = page.getByLabel('Name');
  const original = await name.inputValue();
  await name.fill('Live Owner Renamed');
  await page.getByRole('button', { name: 'Save details' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Details saved' })).toBeVisible();
  await expect(page.getByRole('link', { name: /my account/i })).toContainText('Live Owner Renamed');

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  await page
    .getByLabel('Choose profile photo')
    .setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByRole('button', { name: 'Remove photo' })).toBeVisible();
  const headerPhoto = page.getByRole('link', { name: /my account/i }).locator('img');
  await expect(headerPhoto).toBeVisible();
  const src = await headerPhoto.getAttribute('src');
  expect(src).toMatch(/\/v1\/media\//);
  expect((await page.request.get(src!)).status()).toBe(200);
  await page.screenshot({ path: 'test-results/live/account.png', fullPage: true });

  await page.getByRole('button', { name: 'Remove photo' }).click();
  await expect(page.getByRole('button', { name: 'Add photo…' })).toBeVisible();
  await expect(headerPhoto).toHaveCount(0);

  // leave the account as we found it
  await name.fill(original);
  await page.getByRole('button', { name: 'Save details' }).click();
  await expect(page.getByRole('link', { name: /my account/i })).toContainText(original);
});

test('L-16 changing the password: a wrong current one is refused, the right one signs everyone out, the new one signs in, then it is put back', async ({
  page,
}) => {
  const NEW = 'A brand new live passphrase 2031';
  await signIn(page, FRONT_DESK);
  await page.getByRole('link', { name: /my account/i }).click();
  const fill = async (current: string, next: string) => {
    await page.getByLabel('Current password').fill(current);
    await page.getByLabel('New password', { exact: true }).fill(next);
    await page.getByLabel('New password again').fill(next);
    await page.getByRole('button', { name: 'Change password' }).click();
  };

  await fill('definitely not it', NEW);
  await expect(page.getByRole('alert')).toContainText(/invalid/i);
  await expect(page).toHaveURL(/\/account/);

  await page.getByLabel('Current password').fill('');
  await page.getByLabel('New password', { exact: true }).fill('');
  await page.getByLabel('New password again').fill('');
  await fill(FRONT_DESK.password, NEW);
  await expect(page.getByText(/every session was signed out/i)).toBeVisible();
  await page.getByRole('button', { name: 'Go to sign in' }).click();
  await expect(page).toHaveURL(/\/login/);

  // the old password no longer works, the new one does
  await page.getByLabel('Email').fill(FRONT_DESK.email);
  await page.getByLabel('Password').fill(FRONT_DESK.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('Password').fill(NEW);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('link', { name: /my account/i })).toBeVisible(); // back where they were headed

  // put it back so the other specs (and the next run of this one) find the original
  await page.goto('/account');
  await fill(NEW, FRONT_DESK.password);
  await expect(page.getByText(/every session was signed out/i)).toBeVisible();
});

/** The authenticator app's job, done in the test: the six digits for a base32 secret at a given time (RFC 6238). */
function totp(secretBase32: string, at = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of secretBase32.replace(/=+$/, '')) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  }
  const bytes = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => Number.parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const hmac = createHmac('sha1', bytes).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 15;
  const binary =
    ((hmac[offset]! & 127) << 24) |
    (hmac[offset + 1]! << 16) |
    (hmac[offset + 2]! << 8) |
    hmac[offset + 3]!;
  return String(binary % 1_000_000).padStart(6, '0');
}

test('L-17 two-step verification: set up with a scanned secret, keep the recovery codes, prove a code, get new codes, turn it off', async ({
  page,
}) => {
  test.setTimeout(120_000); // two waits for the next 30-second code
  await signIn(page, FRONT_DESK);
  await page.goto('/account');
  await expect(page.getByTestId('mfa-state')).toContainText('Off');

  await page.getByRole('button', { name: 'Set up' }).click();
  await page.getByLabel('Your password').fill(FRONT_DESK.password);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('img', { name: /qr code/i })).toBeVisible();
  const secret = (await page.locator('code').first().innerText()).trim();
  expect(secret).toMatch(/^[A-Z2-7]{32}$/);

  await page.getByLabel('First code from the app').fill(totp(secret));
  await page.getByRole('button', { name: 'Turn on' }).click();
  const codes = page.getByRole('list', { name: 'Recovery codes' }).getByRole('listitem');
  await expect(codes).toHaveCount(10);
  await page.screenshot({ path: 'test-results/live/mfa-codes.png', fullPage: true });
  await page.getByLabel(/saved my recovery codes/i).check();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('mfa-state')).toContainText('On. 10 recovery codes left.');

  // a code can be used once: the one the setup just used is spent, so wait for the next 30-second step
  await page.getByRole('button', { name: /new recovery codes/i }).click();
  await page.getByLabel('Your password').fill(FRONT_DESK.password);
  const nextStep = (Math.floor(Date.now() / 30_000) + 1) * 30_000 + 500;
  await page.waitForTimeout(Math.max(0, nextStep - Date.now()));
  await page.getByLabel('Code from your authenticator app').fill('000000');
  await page.getByRole('button', { name: 'Get new codes' }).click();
  await expect(page.getByText('That code is not right.')).toBeVisible();
  // the browser logs the refused request (422) as a console error: that one is expected here
  const log = problems.get(page)!;
  log.splice(0, log.length, ...log.filter((line) => !/422/.test(line)));
  await page.getByLabel('Code from your authenticator app').fill(totp(secret));
  await page.getByRole('button', { name: 'Get new codes' }).click();
  await expect(
    page.getByRole('list', { name: 'Recovery codes' }).getByRole('listitem'),
  ).toHaveCount(10);
  await page.getByRole('button', { name: 'I have saved them' }).click();

  // switch it off again (allowed while it is not required), with the next code
  await page.getByRole('button', { name: /turn off/i }).click();
  await page.getByLabel('Your password').fill(FRONT_DESK.password);
  const after = (Math.floor(Date.now() / 30_000) + 1) * 30_000 + 500;
  await page.waitForTimeout(Math.max(0, after - Date.now()));
  await page.getByLabel('Code from your authenticator app').fill(totp(secret));
  await page.getByRole('button', { name: 'Turn off' }).click();
  await expect(page.getByTestId('mfa-state')).toContainText('Off');
});
