import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * P3-27 — accessibility of every admin page, checked by axe-core in a real browser against the real API: WCAG 2.0/2.1
 * A and AA rules, in the light and the dark theme, at desktop and phone width. Any violation fails the run.
 */
const env = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — run these specs through \`pnpm test:live-ui\``);
  return value;
};
const OWNER = { email: env('LIVE_OWNER_EMAIL'), password: env('LIVE_OWNER_PASSWORD') };
const PAGES = [
  '/',
  '/bookings',
  '/schedule',
  '/customers',
  '/inventory/categories',
  '/inventory/models',
  '/inventory/assets',
  '/offers',
  '/drawers',
  '/staff',
  '/roles',
  '/reports',
  '/payments',
  '/audit',
  '/settings',
  '/account',
];

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(OWNER.email);
  await page.getByLabel('Password').fill(OWNER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
}

const scan = async (page: Page, where: string) => {
  await page.waitForLoadState('networkidle');
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const summary = result.violations.map(
    (v) =>
      `${v.id} (${v.impact}) ×${v.nodes.length}: ${v.help} — ${v.nodes
        .slice(0, 2)
        .map((n) => n.html.slice(0, 140) + ' :: ' + (n.any[0]?.message ?? '').slice(0, 160))
        .join(' || ')}`,
  );
  expect.soft(summary, where).toEqual([]);
};

test('A-01 the sign-in page has no accessibility violations', async ({ page }) => {
  await page.goto('/login');
  await scan(page, '/login');
});

for (const theme of ['light', 'dark'] as const) {
  test(`A-02 every page, ${theme} theme, desktop`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await signIn(page);
    // The theme switch remembers a choice; make it match the one under test.
    const dark = () => page.locator('html').evaluate((el) => el.classList.contains('dark'));
    if ((await dark()) !== (theme === 'dark')) {
      await page.getByRole('button', { name: /switch to (dark|light) theme/i }).click();
    }
    for (const path of PAGES) {
      await page.goto(path);
      await scan(page, `${theme} ${path}`);
    }
  });
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('A-03 every page at phone width, and the open menu', async ({ page }) => {
    await signIn(page);
    for (const path of PAGES) {
      await page.goto(path);
      await scan(page, `phone ${path}`);
    }
    await page.getByRole('button', { name: 'Open menu' }).click();
    await scan(page, 'phone menu');
  });
});

test('A-04 dialogs: a form dialog is labelled, traps focus and closes with Escape', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/inventory/categories');
  await page.getByRole('button', { name: 'New category' }).click();
  const dialog = page.getByRole('dialog', { name: 'New category' });
  await expect(dialog).toBeVisible();
  await scan(page, 'new-category dialog');
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
  const insideDialog = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return !!d && d.contains(document.activeElement);
  });
  expect(insideDialog, 'focus stays inside the dialog').toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});
