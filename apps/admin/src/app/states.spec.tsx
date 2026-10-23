import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi } from '@/test/mock-api';
import { problemResponse, renderApp, superAdminMe } from '@/test/render';

/**
 * P3-29 — what each admin page shows while its data loads, when the server fails, when the network is down, and when
 * there is nothing to list. Never a blank page or a spinner that never ends; a failure is a sentence plus "Try again".
 */
const PAGES: Array<{ name: string; path: string; get: string; empty: unknown }> = [
  { name: 'Dashboard', path: '/', get: '/v1/admin/dashboard', empty: undefined },
  {
    name: 'Bookings',
    path: '/bookings',
    get: '/v1/admin/bookings',
    empty: { items: [], nextCursor: null },
  },
  {
    name: 'Customers',
    path: '/customers',
    get: '/v1/admin/customers',
    empty: { items: [], nextCursor: null },
  },
  { name: 'Categories', path: '/inventory/categories', get: '/v1/admin/categories', empty: [] },
  { name: 'Item models', path: '/inventory/models', get: '/v1/admin/item-models', empty: [] },
  {
    name: 'Assets',
    path: '/inventory/assets',
    get: '/v1/admin/assets',
    empty: { data: [], nextCursor: null },
  },
  { name: 'Drawers', path: '/drawers', get: '/v1/admin/drawers', empty: [] },
  { name: 'Staff', path: '/staff', get: '/v1/admin/admins', empty: [] },
  { name: 'Roles', path: '/roles', get: '/v1/admin/roles', empty: [] },
  {
    name: 'Payments',
    path: '/payments',
    get: '/v1/admin/payments',
    empty: { items: [], nextCursor: null },
  },
  {
    name: 'Audit log',
    path: '/audit',
    get: '/v1/admin/audit-logs',
    empty: { items: [], nextCursor: null },
  },
  { name: 'Settings', path: '/settings', get: '/v1/admin/settings', empty: undefined },
];

describe.each(PAGES)('$name', (page) => {
  it('P-01 a server error is a sentence and a "Try again" that asks again', async () => {
    const api = mockApi({
      [`GET ${page.get}`]: () =>
        problemResponse(500, 'INTERNAL_ERROR', 'Something went wrong on our side.'),
    });
    renderApp(page.path, { me: superAdminMe, api });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/something went wrong/i);
    const retry = screen.getAllByRole('button', { name: 'Try again' })[0]!;
    const before = api.calls.filter((c) => c.path === page.get).length;
    await userEvent.click(retry);
    await waitFor(() =>
      expect(api.calls.filter((c) => c.path === page.get).length).toBeGreaterThan(before),
    );
    expect(await screen.findByRole('alert')).toBeInTheDocument(); // still failing: still explained
  });

  it('P-02 an unreachable server says so plainly', async () => {
    const api = mockApi({
      [`GET ${page.get}`]: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    renderApp(page.path, { me: superAdminMe, api });
    expect(await screen.findByText(/cannot reach the server/i)).toBeInTheDocument();
  });

  it('P-03 while the data loads there is a loading indicator, not a blank page', async () => {
    const api = mockApi({ [`GET ${page.get}`]: () => new Promise<never>(() => {}) });
    renderApp(page.path, { me: superAdminMe, api });
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(await screen.findAllByRole('status')).not.toHaveLength(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe.each(PAGES.filter((p) => p.empty !== undefined))('$name (empty)', (page) => {
  it('P-04 nothing to list is an answer: a message, no error, no table of nothing', async () => {
    const api = mockApi({ [`GET ${page.get}`]: page.empty as object });
    renderApp(page.path, { me: superAdminMe, api });
    await screen.findByRole('heading', { level: 1 });
    await screen.findByText(/no .+ (yet|match|found)|nothing/i);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
