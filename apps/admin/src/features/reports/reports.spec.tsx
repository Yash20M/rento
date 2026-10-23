import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { drawerA, drawerB } from '@/test/fixtures';
import { mockApi } from '@/test/mock-api';
import { meWith, renderApp, superAdminMe } from '@/test/render';

const report = (overrides: Record<string, unknown> = {}) => ({
  totals: {
    bookings: 3,
    completed: 1,
    cancelled: 1,
    noShow: 0,
    rentedHours: 3,
    collectedPaise: 79200,
    refundedPaise: 29800,
    netPaise: 49400,
  },
  days: [{ day: '2030-01-07', bookings: 3, collectedPaise: 79200 }],
  drawers: [{ id: 'd-1', name: 'Indiranagar', bookings: 3, rentedHours: 3, collectedPaise: 79200 }],
  models: [
    { id: 'm-1', name: 'PlayStation 5', bookings: 3, rentedHours: 3, collectedPaise: 79200 },
  ],
  ...overrides,
});

const payment = (o: Record<string, unknown> = {}) => ({
  id: 'p-1',
  bookingId: 'b-1',
  customer: 'Asha',
  drawerName: 'Indiranagar',
  provider: 'fake',
  status: 'captured',
  amountPaise: 29800,
  extension: false,
  refundedPaise: null,
  refundStatus: null,
  createdAt: '2030-01-07T04:00:00.000Z',
  ...o,
});

describe('reports', () => {
  it('R-01 shows the totals, with money in rupees and the refunds taken off', async () => {
    const api = mockApi({
      'GET /v1/admin/drawers': [drawerA, drawerB],
      'GET /v1/admin/reports/summary': report(),
    });
    renderApp('/reports', { me: superAdminMe, api });
    const totals = within(await screen.findByLabelText('Totals'));
    expect(totals.getAllByText('3')).toHaveLength(2); // bookings and hours rented
    expect(totals.getByText('1 / 1 / 0')).toBeInTheDocument();
    expect(totals.getByText('₹494.00')).toBeInTheDocument();
    expect(totals.getByText('₹792.00 taken − ₹298.00 refunded')).toBeInTheDocument();
    expect(
      within(screen.getByRole('table', { name: 'By day' })).getByText('2030-01-07'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('table', { name: 'By drawer' })).getByText('Indiranagar'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('table', { name: 'By item model' })).getByText('PlayStation 5'),
    ).toBeInTheDocument();
  });

  it('R-02 the chosen days and drawer are what the server is asked for (whole days, last day included)', async () => {
    const api = mockApi({
      'GET /v1/admin/drawers': [drawerA, drawerB],
      'GET /v1/admin/reports/summary': report(),
    });
    renderApp('/reports', { me: superAdminMe, api });
    await screen.findByLabelText('Totals');
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2030-01-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2030-01-07' } });
    await userEvent.selectOptions(await screen.findByLabelText('Drawer'), 'd-2');
    await screen.findByLabelText('Totals');
    const last = api.callsTo('GET', '/v1/admin/reports/summary').at(-1)!;
    expect(Object.fromEntries(last.query)).toEqual({
      from: '2030-01-01T00:00:00.000Z',
      to: '2030-01-08T00:00:00.000Z',
      drawerId: 'd-2',
    });
  });

  it('R-03 a start after the end is explained and nothing is requested', async () => {
    const api = mockApi({
      'GET /v1/admin/drawers': [drawerA],
      'GET /v1/admin/reports/summary': report(),
    });
    renderApp('/reports', { me: superAdminMe, api });
    await screen.findByLabelText('Totals');
    const before = api.callsTo('GET', '/v1/admin/reports/summary').length;
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2999-01-01' } });
    expect(await screen.findByText(/start day that is not after the end day/)).toBeInTheDocument();
    expect(api.callsTo('GET', '/v1/admin/reports/summary')).toHaveLength(before);
  });

  it('R-04 an empty period says so', async () => {
    const empty = report({
      totals: {
        bookings: 0,
        completed: 0,
        cancelled: 0,
        noShow: 0,
        rentedHours: 0,
        collectedPaise: 0,
        refundedPaise: 0,
        netPaise: 0,
      },
      days: [],
      drawers: [],
      models: [],
    });
    const api = mockApi({
      'GET /v1/admin/drawers': [drawerA],
      'GET /v1/admin/reports/summary': empty,
    });
    renderApp('/reports', { me: superAdminMe, api });
    expect(await screen.findByText('No bookings were paid for in this period')).toBeInTheDocument();
  });

  it('R-05 the page and its menu entry need reports:read', async () => {
    renderApp('/reports', { me: meWith(['bookings:read']), api: mockApi({}) });
    expect(await screen.findByRole('alert')).toHaveTextContent(/do not have access/i);
    expect(screen.queryByRole('link', { name: 'Reports' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Payments' })).not.toBeInTheDocument();
  });
});

describe('payments', () => {
  it('R-06 lists payments with refunds, marks the demo gateway and extensions', async () => {
    const api = mockApi({
      'GET /v1/admin/payments': {
        items: [
          payment(),
          payment({
            id: 'p-2',
            status: 'refunded',
            refundedPaise: 29800,
            refundStatus: 'processed',
            extension: true,
            customer: 'Ravi',
          }),
        ],
        nextCursor: null,
      },
    });
    renderApp('/payments', { me: superAdminMe, api });
    const table = await screen.findByRole('table', { name: 'Payments' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(within(rows[0]!).getByText('Captured')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Demo gateway')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Extension')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Refunded')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Processed')).toBeInTheDocument();
    expect(within(rows[1]!).getAllByText('₹298.00')).toHaveLength(2);
  });

  it('R-07 the status filter goes to the server and "Next page" uses the cursor', async () => {
    const api = mockApi({
      'GET /v1/admin/payments': ({ url }: { url: URL }) =>
        url.searchParams.get('cursor')
          ? { items: [payment({ id: 'p-9', customer: 'Zed' })], nextCursor: null }
          : { items: [payment()], nextCursor: 'next-1' },
    } as never);
    renderApp('/payments', { me: superAdminMe, api });
    await screen.findByRole('table', { name: 'Payments' });
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'refunded');
    await screen.findByRole('table', { name: 'Payments' });
    expect(Object.fromEntries(api.callsTo('GET', '/v1/admin/payments').at(-1)!.query)).toEqual({
      limit: '25',
      status: 'refunded',
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Next page' }));
    expect(await screen.findByText('Zed')).toBeInTheDocument();
  });
});

describe('settings', () => {
  const settings = (o: Record<string, unknown> = {}) => ({
    holdMinutes: 10,
    bookingMinLeadMinutes: 15,
    bookingMaxAdvanceDays: 90,
    refundTiers: [
      { minutesBeforeStart: 120, percent: 50 },
      { minutesBeforeStart: 1440, percent: 100 },
      { minutesBeforeStart: 0, percent: 0 },
    ],
    pickupEarlyMinutes: 15,
    noShowGraceMinutes: 30,
    discoveryRadiusMeters: 5000,
    discoveryMaxResults: 3,
    kycRequired: true,
    paymentProvider: 'fake',
    paymentDemoMode: true,
    webhookConfigured: false,
    jobsIntervalSeconds: 30,
    ...o,
  });

  it('R-08 shows the rules in force, the refund tiers from the best to the worst, and the demo-payments notice', async () => {
    renderApp('/settings', {
      me: superAdminMe,
      api: mockApi({ 'GET /v1/admin/settings': settings() }),
    });
    expect(await screen.findByText('Demo payments.')).toBeInTheDocument();
    const tiers = within(screen.getByRole('list', { name: 'Refund tiers' })).getAllByRole(
      'listitem',
    );
    expect(tiers.map((t) => t.textContent)).toEqual([
      'At least 24 h before the start100%',
      'At least 2 h before the start50%',
      'Any later cancellation0%',
    ]);
    expect(screen.getByText('Demo gateway')).toBeInTheDocument();
  });

  it('R-09 with Razorpay configured there is no demo notice and the webhook state shows', async () => {
    renderApp('/settings', {
      me: superAdminMe,
      api: mockApi({
        'GET /v1/admin/settings': settings({
          paymentProvider: 'razorpay',
          paymentDemoMode: false,
          webhookConfigured: true,
        }),
      }),
    });
    await screen.findByText('Razorpay');
    expect(screen.queryByText('Demo payments.')).not.toBeInTheDocument();
    expect(screen.getByText('Webhook secret set')).toBeInTheDocument();
  });

  it('R-11 with settings:write the nearby-search rules can be changed (km → metres), and only they', async () => {
    const api = mockApi({
      'GET /v1/admin/settings': settings(),
      'PUT /v1/admin/settings/discovery': { radiusMeters: 7500, maxResults: 4 },
    });
    renderApp('/settings', { me: superAdminMe, api });
    const form = within(await screen.findByRole('form', { name: 'Nearby search' }));
    const radius = form.getByLabelText('Search radius (km)');
    await userEvent.clear(radius);
    await userEvent.type(radius, '7.5');
    const count = form.getByLabelText('Drawers shown at most');
    await userEvent.clear(count);
    await userEvent.type(count, '4');
    await userEvent.click(form.getByRole('button', { name: 'Save' }));
    await form.findByText('Saved');
    const put = api.calls.find((c) => c.method === 'PUT');
    expect(put?.path).toBe('/v1/admin/settings/discovery');
    expect(put?.body).toEqual({ radiusMeters: 7500, maxResults: 4 });
  });

  it('R-12 out-of-range values cannot be saved, and without settings:write there is no form', async () => {
    const api = mockApi({ 'GET /v1/admin/settings': settings() });
    const view = renderApp('/settings', { me: superAdminMe, api });
    const form = within(await screen.findByRole('form', { name: 'Nearby search' }));
    const count = form.getByLabelText('Drawers shown at most');
    await userEvent.clear(count);
    await userEvent.type(count, '11');
    expect(form.getByRole('button', { name: 'Save' })).toBeDisabled();
    view.unmount();
    renderApp('/settings', { me: meWith(['settings:read']), api });
    await screen.findByText('Demo payments.');
    expect(screen.queryByRole('form', { name: 'Nearby search' })).not.toBeInTheDocument();
  });

  it('R-10 needs settings:read', async () => {
    renderApp('/settings', { me: meWith(['reports:read']), api: mockApi({}) });
    expect(await screen.findByRole('alert')).toHaveTextContent(/do not have access/i);
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
  });
});
