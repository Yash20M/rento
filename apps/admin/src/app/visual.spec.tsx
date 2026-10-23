import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { mockApi } from '@/test/mock-api';
import { meWith, renderApp, superAdminMe } from '@/test/render';

const dashboard = {
  generatedAt: '2030-01-01T00:00:00Z',
  windowDays: 7,
  now: { held: 2, confirmed: 3, active: 1, overdue: 0 },
  lastDays: {
    completed: 4,
    cancelled: 1,
    noShow: 0,
    expired: 2,
    grossPaise: 1234500,
    refundedPaise: 29800,
  },
  upcoming: [],
};
const report = (days: Array<{ day: string; bookings: number; collectedPaise: number }> = []) => ({
  totals: {
    bookings: 5,
    completed: 3,
    cancelled: 1,
    noShow: 0,
    rentedHours: 7.5,
    collectedPaise: 150000,
    refundedPaise: 30000,
    netPaise: 120000,
  },
  days,
  drawers: [
    { id: 'd-1', name: 'Indiranagar', bookings: 5, rentedHours: 7.5, collectedPaise: 150000 },
  ],
  models: [
    { id: 'm-1', name: 'PlayStation 5', bookings: 5, rentedHours: 7.5, collectedPaise: 150000 },
  ],
});

beforeEach(() => {
  document.documentElement.classList.remove('dark');
  try {
    window.localStorage.clear();
  } catch {
    // not available
  }
});

describe('look and feel', () => {
  it('V-01 the theme switch toggles dark mode on the page and remembers the choice', async () => {
    renderApp('/', {
      me: superAdminMe,
      api: mockApi({
        'GET /v1/admin/dashboard': dashboard,
        'GET /v1/admin/reports/summary': report(),
      }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Switch to dark theme' }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem('rento.admin.theme')).toBe('dark');
    await userEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(window.localStorage.getItem('rento.admin.theme')).toBe('light');
  });

  it('V-02 a saved dark choice is applied at start', async () => {
    window.localStorage.setItem('rento.admin.theme', 'dark');
    renderApp('/', { me: superAdminMe, api: mockApi({ 'GET /v1/admin/dashboard': dashboard }) });
    await screen.findByRole('button', { name: 'Switch to light theme' });
    // the class is put on the page by an effect right after the first paint: wait for it rather than race it
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));
  });

  it('V-03 the menu is grouped, and on a phone it opens and closes from the header button', async () => {
    renderApp('/', { me: superAdminMe, api: mockApi({ 'GET /v1/admin/dashboard': dashboard }) });
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    for (const group of ['Operations', 'Catalogue', 'Team', 'Insights']) {
      expect(within(nav).getByText(group)).toBeInTheDocument();
    }
    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(screen.getAllByRole('button', { name: 'Close menu' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Close menu' })[0]).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await userEvent.click(within(nav).getByRole('link', { name: 'Customers' }));
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('V-04 a role without reports sees no empty group headings', async () => {
    renderApp('/', {
      me: meWith(['bookings:read']),
      api: mockApi({ 'GET /v1/admin/dashboard': dashboard }),
    });
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByText('Operations')).toBeInTheDocument();
    for (const group of ['Catalogue', 'Team', 'Insights']) {
      expect(within(nav).queryByText(group)).not.toBeInTheDocument();
    }
  });
});

describe('charts on the dashboard and reports', () => {
  it('V-05 the dashboard trend fills quiet days with zeros and shows the money', async () => {
    const today = new Date().toISOString().slice(0, 10);
    renderApp('/', {
      me: superAdminMe,
      api: mockApi({
        'GET /v1/admin/dashboard': dashboard,
        'GET /v1/admin/reports/summary': report([
          { day: today, bookings: 2, collectedPaise: 99900 },
        ]),
      }),
    });
    const table = await screen.findByRole('table', { name: /Money taken per day, last 14 days/ });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(14); // every day, not only the busy one
    expect(rows.at(-1)).toHaveTextContent('₹999.00');
    expect(rows[0]).toHaveTextContent('₹0.00');
    expect(screen.getByText(/₹1,200\.00 net of refunds/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Bookings in flight by state' })).toBeInTheDocument();
  });

  it('V-06 without the reports permission the dashboard simply has no trend (and no error)', async () => {
    const api = mockApi({ 'GET /v1/admin/dashboard': dashboard });
    renderApp('/', { me: meWith(['bookings:read']), api });
    await screen.findByText('Unpaid holds');
    expect(screen.queryByRole('table', { name: /Money taken per day/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(api.callsTo('GET', '/v1/admin/reports/summary')).toHaveLength(0);
  });

  it('V-07 a failing trend never spoils the dashboard', async () => {
    renderApp('/', {
      me: superAdminMe,
      api: mockApi({ 'GET /v1/admin/dashboard': dashboard }), // no reports route: the mock answers 404
    });
    await screen.findByText('Unpaid holds');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('V-08 reports draw the charts with every day of the range, the outcome mix and the rankings', async () => {
    renderApp('/reports', {
      me: superAdminMe,
      api: mockApi({
        'GET /v1/admin/drawers': [],
        'GET /v1/admin/reports/summary': report([
          { day: new Date().toISOString().slice(0, 10), bookings: 5, collectedPaise: 150000 },
        ]),
      }),
    });
    const money = await screen.findByRole('table', { name: 'Money taken per day' });
    expect(within(money).getAllByRole('row')).toHaveLength(30); // the default range is 30 days
    expect(screen.getByRole('table', { name: 'Bookings per day' })).toBeInTheDocument();
    const outcomes = screen.getByRole('list', { name: 'Booking outcomes legend' });
    expect(within(outcomes).getByText('Completed').parentElement).toHaveTextContent('3 60%');
    expect(within(outcomes).getByText('Upcoming or running').parentElement).toHaveTextContent(
      '1 20%',
    ); // 5 − 3 − 1 − 0
    expect(screen.getByRole('list', { name: 'Money by drawer' })).toHaveTextContent('Indiranagar');
    expect(screen.getByRole('list', { name: 'Money by item model' })).toHaveTextContent(
      'PlayStation 5',
    );
  });
});
