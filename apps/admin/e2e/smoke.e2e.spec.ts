import { expect, test } from '@playwright/test';

const ok = { status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) };
const unavailable = {
  status: 503,
  contentType: 'application/problem+json',
  body: JSON.stringify({
    type: 'urn:rento:problem:retry-later',
    title: 'Service Unavailable',
    status: 503,
    code: 'RETRY_LATER',
    detail: 'Database unavailable',
    traceId: 'trace-e2e',
  }),
};
const unauthenticated = {
  status: 401,
  contentType: 'application/problem+json',
  body: JSON.stringify({
    type: 'urn:rento:problem:unauthenticated',
    title: 'Unauthorized',
    status: 401,
    code: 'UNAUTHENTICATED',
    detail: 'Invalid email or password',
    traceId: 'trace-e2e',
  }),
};

test.describe('admin smoke (built app, stubbed API)', () => {
  test('E-01 opening the app sends an anonymous visitor to an accessible sign-in form', async ({
    page,
  }) => {
    await page.route('**/healthz', (route) => route.fulfill(ok));
    await page.goto('/');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page).toHaveTitle('Rento Admin');
    await expect(page.getByRole('heading', { name: /sign in to rento admin/i })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled();
    await expect(page.getByRole('navigation')).toHaveCount(0);
  });

  test('E-02 the sign-in page reflects the API status (ok, then down)', async ({ page }) => {
    await page.route('**/healthz', (route) => route.fulfill(ok));
    await page.goto('/login');
    await expect(page.getByRole('status', { name: 'API status' })).toHaveText('API: ok');

    await page.unroute('**/healthz');
    await page.route('**/healthz', (route) => route.fulfill(unavailable));
    await page.reload();
    await expect(page.getByRole('status', { name: 'API status' })).toHaveText('API: down');
  });

  test('E-03 a wrong password shows one generic message', async ({ page }) => {
    await page.route('**/healthz', (route) => route.fulfill(ok));
    await page.route('**/v1/auth/session/login', (route) => route.fulfill(unauthenticated));
    await page.goto('/login');

    await page.getByLabel('Email').fill('owner@rento.demo');
    await page.getByLabel('Password').fill('not the password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toHaveText('Incorrect email or password.');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('E-04 unknown URLs show the 404 page and its link leads to the sign-in page', async ({
    page,
  }) => {
    await page.route('**/healthz', (route) => route.fulfill(ok));
    await page.goto('/no/such/page');

    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await page.getByRole('link', { name: /back to dashboard/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
