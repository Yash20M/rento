import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mockApi } from '@/test/mock-api';
import { meWith, problemResponse, renderApp, superAdminMe } from '@/test/render';

const emptyDashboard = {
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

const links = (nav: HTMLElement) =>
  within(nav)
    .getAllByRole('link')
    .map((a) => a.textContent);

describe('layout and navigation', () => {
  it('N-01 a Super Admin sees every section', async () => {
    renderApp('/', {
      me: superAdminMe,
      api: mockApi({ 'GET /v1/admin/dashboard': emptyDashboard }),
    });
    const nav = await screen.findByRole('navigation', { name: /main/i });
    expect(links(nav)).toEqual([
      'Dashboard',
      'Bookings',
      'Schedule',
      'Customers',
      'Categories',
      'Item models',
      'Assets',
      'Drawers',
      'Staff',
      'Roles',
      'Reports',
      'Payments',
      'Audit log',
      'Settings',
    ]);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByTestId('signed-in-as')).toHaveTextContent('Owner');
  });

  it('N-02 menu entries follow the permissions: a front-desk role sees bookings and nothing about money or access', async () => {
    renderApp('/', {
      me: meWith(['bookings:read', 'bookings:write', 'drawers:read']),
      api: mockApi({ 'GET /v1/admin/dashboard': emptyDashboard }),
    });
    const nav = await screen.findByRole('navigation', { name: /main/i });
    expect(links(nav)).toEqual(['Dashboard', 'Bookings', 'Schedule', 'Drawers']);
  });

  it('N-03 someone with no permissions still gets a dashboard that explains the situation', async () => {
    renderApp('/', { me: meWith([]) });
    expect(await screen.findByText(/does not include viewing bookings/i)).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: /main/i });
    expect(links(nav)).toEqual(['Dashboard']);
  });

  it('N-04 typing the address of a page you may not open shows "no access" — and sends no request for its data', async () => {
    const api = mockApi({});
    renderApp('/roles', { me: meWith(['bookings:read']), api });
    expect(await screen.findByRole('alert')).toHaveTextContent(/do not have access/i);
    expect(screen.getByText(/roles:read/)).toBeInTheDocument();
    expect(api.callsTo('GET', '/v1/admin/roles')).toHaveLength(0);
  });

  it('N-05 the API answer is what counts: when the server refuses, the page says so instead of showing data', async () => {
    // The UI believes the person may read audit logs, but the server (the real authority) says no.
    renderApp('/audit', {
      me: meWith(['audit:read']),
      api: mockApi({ 'GET /v1/admin/audit-logs': problemResponse(403, 'PERMISSION_DENIED', 'no') }),
    });
    expect(await screen.findByText('You do not have permission to do that.')).toBeInTheDocument();
  });

  it('N-06 unknown addresses show the 404 page', async () => {
    renderApp('/definitely/not/here', { me: superAdminMe });
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to dashboard/i })).toHaveAttribute('href', '/');
  });

  it('N-07 the header shows whether the API is reachable', async () => {
    renderApp('/', {
      me: superAdminMe,
      api: mockApi({ 'GET /v1/admin/dashboard': emptyDashboard }),
    });
    await waitFor(() =>
      expect(screen.getByRole('status', { name: /api status/i })).toHaveTextContent('API: ok'),
    );
  });
});

describe('dashboard', () => {
  it('N-08 shows live counts, the week, money in rupees and the next pickups in the drawer’s time', async () => {
    const api = mockApi({
      'GET /v1/admin/dashboard': {
        ...emptyDashboard,
        upcoming: [
          {
            id: 'b-1',
            status: 'confirmed',
            startsAt: '2030-01-07T04:30:00.000Z',
            endsAt: '2030-01-07T05:30:00.000Z',
            durationMinutes: 60,
            drawer: { id: 'd-1', name: 'Indiranagar', address: 'x', timezone: 'Asia/Kolkata' },
            itemModel: { id: 'm-1', name: 'PlayStation 5' },
            assetCode: 'PS5-001',
            customer: { id: 'c-1', email: 'asha@example.com' },
          },
        ],
      },
    });
    renderApp('/', { me: meWith(['bookings:read']), api });
    expect(await screen.findByText('Unpaid holds')).toBeInTheDocument();
    const stat = (label: string) => screen.getByText(label).closest('div')!.parentElement!;
    expect(within(stat('Unpaid holds')).getByText('2')).toBeInTheDocument();
    expect(within(stat('Confirmed')).getByText('3')).toBeInTheDocument();
    expect(within(stat('Out on rental')).getByText('1')).toBeInTheDocument();
    expect(screen.getByText('₹12,345.00')).toBeInTheDocument();
    expect(screen.getByText('₹298.00')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('asha@example.com')).toBeInTheDocument();
    expect(within(table).getByText(/10:00/)).toBeInTheDocument(); // 04:30Z is 10:00 in India
  });

  it('N-09 a failing dashboard offers a retry', async () => {
    let failing = true;
    const api = mockApi({
      'GET /v1/admin/dashboard': () =>
        failing ? problemResponse(503, 'RETRY_LATER', 'busy') : emptyDashboard,
    });
    renderApp('/', { me: meWith(['bookings:read']), api });
    expect(await screen.findByRole('alert')).toHaveTextContent(/system is busy/i);
    failing = false;
    screen.getByRole('button', { name: /try again/i }).click();
    expect(await screen.findByText('Unpaid holds')).toBeInTheDocument();
  });
});
