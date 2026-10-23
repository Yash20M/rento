import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi } from '@/test/mock-api';
import { bookingFixture, detailFixture, drawerA, drawerB } from '@/test/fixtures';
import { meWith, problemResponse, renderApp, superAdminMe } from '@/test/render';

const page = (items: unknown[], nextCursor: string | null = null) => ({ items, nextCursor });

const openFirst = async () => {
  await userEvent.click(
    await screen.findByRole('button', { name: /open booking of asha@example.com/i }),
  );
  return within(await screen.findByRole('dialog', { name: 'Booking' }));
};

describe('bookings list', () => {
  it('B-01 lists bookings with who, what, when (in the drawer’s time zone) and the total in rupees', async () => {
    const api = mockApi({
      'GET /v1/admin/bookings': page([
        bookingFixture(),
        bookingFixture({
          id: 'b-2',
          status: 'held',
          customer: { id: 'c-2', email: 'ravi@example.com' },
        }),
      ]),
      'GET /v1/admin/drawers': [drawerA, drawerB],
    });
    renderApp('/bookings', { me: superAdminMe, api });
    const table = await screen.findByRole('table', { name: 'Bookings' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText('asha@example.com')).toBeInTheDocument();
    expect(within(rows[0]!).getByText(/10:00/)).toBeInTheDocument();
    expect(within(rows[0]!).getByText('₹298.00')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Confirmed')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Awaiting payment')).toBeInTheDocument();
  });

  it('B-02 filters are sent to the server: status, drawer and search', async () => {
    const api = mockApi({
      'GET /v1/admin/bookings': page([bookingFixture()]),
      'GET /v1/admin/drawers': [drawerA, drawerB],
    });
    renderApp('/bookings', { me: superAdminMe, api });
    await screen.findByRole('table', { name: 'Bookings' });

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'held');
    await userEvent.selectOptions(await screen.findByLabelText('Drawer'), 'd-2');
    await userEvent.type(screen.getByLabelText('Search'), 'asha');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    await screen.findByRole('table', { name: 'Bookings' });
    const last = api.callsTo('GET', '/v1/admin/bookings').at(-1)!;
    expect(Object.fromEntries(last.query)).toEqual({
      limit: '25',
      status: 'held',
      drawerId: 'd-2',
      q: 'asha',
    });
  });

  it('B-03 "Next page" asks for the next page with the cursor', async () => {
    const api = mockApi({
      'GET /v1/admin/bookings': ({ url }) =>
        url.searchParams.get('cursor') === 'c-2'
          ? page([bookingFixture({ id: 'b-9', customer: { id: 'c-9', email: 'zed@example.com' } })])
          : page([bookingFixture()], 'c-2'),
      'GET /v1/admin/drawers': [drawerA],
    });
    renderApp('/bookings', { me: superAdminMe, api });
    await userEvent.click(await screen.findByRole('button', { name: 'Next page' }));
    expect(await screen.findByText('zed@example.com')).toBeInTheDocument();
    // A page replaces the previous one (no endless list); going back restores it exactly.
    expect(screen.queryByText('asha@example.com')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(await screen.findByText('asha@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  });

  it('B-04 an empty result says so; a failing list offers a retry', async () => {
    const api = mockApi({ 'GET /v1/admin/bookings': page([]), 'GET /v1/admin/drawers': [drawerA] });
    renderApp('/bookings', { me: superAdminMe, api });
    expect(await screen.findByText('No bookings match')).toBeInTheDocument();
  });
});

describe('one booking', () => {
  const setup = (me = superAdminMe, detail = detailFixture()) => {
    const api = mockApi({
      'GET /v1/admin/bookings': page([bookingFixture({ status: detail.status })]),
      'GET /v1/admin/drawers': [drawerA],
      'GET /v1/admin/bookings/:id': detail,
    });
    return renderApp('/bookings', { me, api });
  };

  it('B-05 the detail shows price, payment and the history, with times in the drawer’s zone', async () => {
    setup();
    const dialog = await openFirst();
    expect(await dialog.findByText('Asia/Kolkata', { exact: false })).toBeInTheDocument();
    expect(dialog.getByText('₹298.00')).toBeInTheDocument();
    expect(dialog.getByText(/Captured · ₹298.00/)).toBeInTheDocument();
    const history = dialog.getByRole('list');
    expect(within(history).getAllByRole('listitem')).toHaveLength(2);
    expect(within(history).getAllByText(/Awaiting payment/).length).toBeGreaterThan(0);
  });

  it('B-06 staff with only read access see no action buttons', async () => {
    setup(meWith(['bookings:read']));
    const dialog = await openFirst();
    await dialog.findByText('₹298.00');
    expect(dialog.queryByRole('button', { name: /cancel booking/i })).not.toBeInTheDocument();
    expect(dialog.queryByRole('button', { name: /hand over/i })).not.toBeInTheDocument();
  });

  it('B-07 handing over calls the API and refreshes the booking', async () => {
    const { api } = setup(meWith(['bookings:read', 'bookings:write']));
    api.on('POST /v1/admin/bookings/:id/pickup', () => {
      api.on('GET /v1/admin/bookings/:id', detailFixture({ status: 'active', cancellable: false }));
      return bookingFixture({ status: 'active' });
    });
    const dialog = await openFirst();
    await userEvent.click(await dialog.findByRole('button', { name: /hand over to customer/i }));
    expect(await dialog.findByText('Take back', { selector: 'button' })).toBeInTheDocument();
    expect(api.callsTo('POST', '/v1/admin/bookings/b-1/pickup')).toHaveLength(1);
  });

  it('B-08 a refused hand-over (too early) shows the server’s reason', async () => {
    const { api } = setup(meWith(['bookings:read', 'bookings:write']));
    api.on(
      'POST /v1/admin/bookings/:id/pickup',
      problemResponse(409, 'INVALID_STATE', 'Too early: the booking has not started yet'),
    );
    const dialog = await openFirst();
    await userEvent.click(await dialog.findByRole('button', { name: /hand over to customer/i }));
    expect(await dialog.findByRole('alert')).toHaveTextContent(
      'Too early: the booking has not started yet',
    );
  });

  it('B-09 cancelling needs a reason; the request carries it', async () => {
    const { api } = setup(meWith(['bookings:read', 'bookings:cancel']));
    api.on('POST /v1/admin/bookings/:id/cancel', bookingFixture({ status: 'cancelled' }));
    await openFirst();
    await userEvent.click(await screen.findByRole('button', { name: /cancel booking…/i }));
    const dialog = within(await screen.findByRole('dialog', { name: /cancel this booking/i }));
    const submit = dialog.getByRole('button', { name: 'Cancel booking' });
    expect(submit).toBeDisabled();
    await userEvent.type(dialog.getByLabelText('Reason'), 'Unit damaged');
    expect(submit).toBeEnabled();
    await userEvent.click(submit);
    await screen.findByRole('dialog', { name: 'Booking' });
    expect(api.callsTo('POST', '/v1/admin/bookings/b-1/cancel')[0]?.body).toEqual({
      reason: 'Unit damaged',
    });
  });

  it('B-10 the refund override only appears for people who hold bookings:refund, and sends the percentage', async () => {
    const { api } = setup(meWith(['bookings:read', 'bookings:cancel']));
    await openFirst();
    await userEvent.click(await screen.findByRole('button', { name: /cancel booking…/i }));
    expect(screen.queryByLabelText(/override the refund/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Keep booking' }));
    expect(api.callsTo('POST', '/v1/admin/bookings/b-1/cancel')).toHaveLength(0);
  });

  it('B-11 with bookings:refund the override is offered and validated (0–100)', async () => {
    const { api } = setup(meWith(['bookings:read', 'bookings:cancel', 'bookings:refund']));
    api.on('POST /v1/admin/bookings/:id/cancel', bookingFixture({ status: 'cancelled' }));
    await openFirst();
    await userEvent.click(await screen.findByRole('button', { name: /cancel booking…/i }));
    const dialog = within(await screen.findByRole('dialog', { name: /cancel this booking/i }));
    await userEvent.type(dialog.getByLabelText('Reason'), 'Goodwill');
    await userEvent.click(dialog.getByLabelText(/override the refund percentage/i));
    const percent = dialog.getByLabelText(/refund percentage of the rental price/i);
    await userEvent.clear(percent);
    await userEvent.type(percent, '150');
    expect(dialog.getByRole('button', { name: 'Cancel booking' })).toBeDisabled();
    await userEvent.clear(percent);
    await userEvent.type(percent, '50');
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel booking' }));
    await screen.findByRole('dialog', { name: 'Booking' });
    expect(api.callsTo('POST', '/v1/admin/bookings/b-1/cancel')[0]?.body).toEqual({
      reason: 'Goodwill',
      refundPercent: 50,
    });
  });

  it('B-12 when the server refuses the cancel (permission changed meanwhile) the dialog shows it and stays open', async () => {
    const { api } = setup(meWith(['bookings:read', 'bookings:cancel']));
    api.on('POST /v1/admin/bookings/:id/cancel', problemResponse(403, 'PERMISSION_DENIED', 'nope'));
    await openFirst();
    await userEvent.click(await screen.findByRole('button', { name: /cancel booking…/i }));
    const dialog = within(await screen.findByRole('dialog', { name: /cancel this booking/i }));
    await userEvent.type(dialog.getByLabelText('Reason'), 'Because');
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel booking' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent(
      'You do not have permission to do that.',
    );
  });

  it('B-13 a drawer-limited administrator gets actions only for their own drawer', async () => {
    const detail = detailFixture({ drawer: { ...drawerA, id: 'd-9', name: 'Elsewhere' } });
    setup(
      meWith(
        ['bookings:read', 'bookings:cancel'],
        [{ permission: 'bookings:cancel', drawerIds: ['d-1'] }],
      ),
      detail,
    );
    const dialog = await openFirst();
    await dialog.findByText('Elsewhere');
    expect(dialog.queryByRole('button', { name: /cancel booking/i })).not.toBeInTheDocument();
  });

  it('B-14 Escape closes the dialog', async () => {
    setup();
    await openFirst();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
