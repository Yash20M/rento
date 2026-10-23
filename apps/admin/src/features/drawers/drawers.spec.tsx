import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi } from '@/test/mock-api';
import { drawerA, drawerB } from '@/test/fixtures';
import { meWith, problemResponse, renderApp, superAdminMe } from '@/test/render';

const setup = (extra: Record<string, unknown> = {}) =>
  mockApi({ 'GET /v1/admin/drawers': [drawerA, drawerB], ...extra });

describe('drawers', () => {
  it('W-01 lists drawers with their time zone, a summary of the hours, units and status', async () => {
    renderApp('/drawers', { me: superAdminMe, api: setup() });
    const table = await screen.findByRole('table', { name: 'Drawers' });
    const first = within(within(table).getAllByRole('row')[1]!);
    expect(first.getByText('Indiranagar')).toBeInTheDocument();
    expect(first.getByText('Asia/Kolkata')).toBeInTheDocument();
    expect(first.getByText(/Mon–Tue 09:00–21:00/)).toBeInTheDocument();
    expect(
      within(within(table).getAllByRole('row')[2]!).getByText('No opening hours set'),
    ).toBeInTheDocument();
  });

  it('W-02 read-only staff can look at closures but cannot change anything', async () => {
    renderApp('/drawers', { me: meWith(['drawers:read']), api: setup() });
    await screen.findByRole('table', { name: 'Drawers' });
    expect(screen.queryByRole('button', { name: /new drawer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hours' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Closures' })).toHaveLength(2);
  });

  it('W-03 creating a drawer sends latitude and longitude as numbers, the zone, and the open days only', async () => {
    const api = setup({ 'POST /v1/admin/drawers': { ...drawerA, id: 'd-3' } });
    renderApp('/drawers', { me: superAdminMe, api });
    await userEvent.click(await screen.findByRole('button', { name: /new drawer/i }));
    const dialog = within(await screen.findByRole('dialog', { name: 'New drawer' }));
    await userEvent.type(dialog.getByLabelText('Name'), 'Whitefield');
    await userEvent.type(dialog.getByLabelText('Address'), '3 Test Lane');
    await userEvent.type(dialog.getByLabelText('Latitude'), '12.9698');
    await userEvent.type(dialog.getByLabelText('Longitude'), '77.7500');
    await userEvent.click(dialog.getByLabelText('Sunday')); // close Sundays
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const body = api.callsTo('POST', '/v1/admin/drawers')[0]!.body as {
      latitude: number;
      longitude: number;
      timezone: string;
      hours: Array<{ weekday: number }>;
    };
    expect(body).toMatchObject({
      name: 'Whitefield',
      address: '3 Test Lane',
      timezone: 'Asia/Kolkata',
      latitude: 12.9698,
      longitude: 77.75,
    });
    expect(body.hours.map((h) => h.weekday)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(body.hours[0]).toEqual({ weekday: 1, opensAt: '09:00', closesAt: '21:00' });
  });

  it('W-04 coordinates are checked before anything is sent (a longitude typed into latitude is caught when out of range)', async () => {
    const api = setup();
    renderApp('/drawers', { me: superAdminMe, api });
    await userEvent.click(await screen.findByRole('button', { name: /new drawer/i }));
    const dialog = within(await screen.findByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Name'), 'X');
    await userEvent.type(dialog.getByLabelText('Address'), 'Y');
    await userEvent.type(dialog.getByLabelText('Latitude'), '151.2'); // Sydney's longitude typed into latitude
    await userEvent.type(dialog.getByLabelText('Longitude'), '-33.8');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByText('Latitude is a number from −90 to 90.')).toBeInTheDocument();
    expect(api.callsTo('POST', '/v1/admin/drawers')).toHaveLength(0);
  });

  it('W-05 an unknown time zone is explained by the server on the field', async () => {
    const api = setup({
      'POST /v1/admin/drawers': problemResponse(422, 'VALIDATION_FAILED', 'invalid', [
        { field: 'timezone', message: 'must be an IANA time zone such as Asia/Kolkata' },
      ]),
    });
    renderApp('/drawers', { me: superAdminMe, api });
    await userEvent.click(await screen.findByRole('button', { name: /new drawer/i }));
    const dialog = within(await screen.findByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Name'), 'X');
    await userEvent.type(dialog.getByLabelText('Address'), 'Y');
    await userEvent.clear(dialog.getByLabelText('Time zone'));
    await userEvent.type(dialog.getByLabelText('Time zone'), 'IST');
    await userEvent.type(dialog.getByLabelText('Latitude'), '12.9');
    await userEvent.type(dialog.getByLabelText('Longitude'), '77.5');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    expect(
      await dialog.findByText('must be an IANA time zone such as Asia/Kolkata'),
    ).toBeInTheDocument();
  });

  it('W-06 closing a drawer that has upcoming bookings is refused with the server’s explanation', async () => {
    const api = setup({
      'PATCH /v1/admin/drawers/:id': problemResponse(
        409,
        'HAS_FUTURE_BOOKINGS',
        'Upcoming bookings prevent this',
      ),
    });
    renderApp('/drawers', { me: superAdminMe, api });
    const table = await screen.findByRole('table', { name: 'Drawers' });
    await userEvent.click(
      within(within(table).getAllByRole('row')[1]!).getByRole('button', { name: 'Edit' }),
    );
    const dialog = within(await screen.findByRole('dialog', { name: /edit indiranagar/i }));
    await userEvent.selectOptions(dialog.getByLabelText('Status'), 'inactive');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('Upcoming bookings prevent this');
  });

  it('W-07 the hours editor saves only the open days and shows the server’s complaint on the right line', async () => {
    const api = setup({
      'PUT /v1/admin/drawers/:id/hours': problemResponse(422, 'VALIDATION_FAILED', 'invalid', [
        { field: 'hours.1.closesAt', message: 'must be later than opensAt' },
      ]),
    });
    renderApp('/drawers', { me: superAdminMe, api });
    const table = await screen.findByRole('table', { name: 'Drawers' });
    await userEvent.click(
      within(within(table).getAllByRole('row')[1]!).getByRole('button', { name: 'Hours' }),
    );
    const dialog = within(await screen.findByRole('dialog', { name: /opening hours/i }));
    // Monday and Tuesday are open (from the fixture); everything else is closed
    expect(dialog.getAllByText('Closed')).toHaveLength(5);
    await userEvent.click(dialog.getByRole('button', { name: 'Save hours' }));
    expect(await dialog.findByText('must be later than opensAt')).toBeInTheDocument();
    const sent = api.callsTo('PUT', '/v1/admin/drawers/d-1/hours')[0]!.body as {
      hours: Array<{ weekday: number }>;
    };
    expect(sent.hours.map((h) => h.weekday)).toEqual([1, 2]);
  });

  it('W-08 a closure is entered in the drawer’s own time and sent as UTC', async () => {
    const api = setup({
      'GET /v1/admin/drawers/:id/closures': [],
      'POST /v1/admin/drawers/:id/closures': { id: 'cl-1', from: 'x', to: 'y', reason: 'Diwali' },
    });
    renderApp('/drawers', { me: superAdminMe, api });
    const table = await screen.findByRole('table', { name: 'Drawers' });
    await userEvent.click(
      within(within(table).getAllByRole('row')[1]!).getByRole('button', { name: 'Closures' }),
    );
    const dialog = within(await screen.findByRole('dialog', { name: /closures/i }));
    await dialog.findByText('No closures planned.');
    await userEvent.type(dialog.getByLabelText('From'), '2030-01-07T09:00');
    await userEvent.type(dialog.getByLabelText('To'), '2030-01-07T18:30');
    await userEvent.type(dialog.getByLabelText('Reason (optional)'), 'Diwali');
    await userEvent.click(dialog.getByRole('button', { name: 'Add closure' }));
    await waitFor(() =>
      expect(api.callsTo('POST', '/v1/admin/drawers/d-1/closures')).toHaveLength(1),
    );
    expect(api.callsTo('POST', '/v1/admin/drawers/d-1/closures')[0]!.body).toEqual({
      from: '2030-01-07T03:30:00.000Z', // 09:00 in India is 03:30 UTC
      to: '2030-01-07T13:00:00.000Z',
      reason: 'Diwali',
    });
  });

  it('W-09 a closure that ends before it starts is caught on the form', async () => {
    const api = setup({ 'GET /v1/admin/drawers/:id/closures': [] });
    renderApp('/drawers', { me: superAdminMe, api });
    const table = await screen.findByRole('table', { name: 'Drawers' });
    await userEvent.click(
      within(within(table).getAllByRole('row')[1]!).getByRole('button', { name: 'Closures' }),
    );
    const dialog = within(await screen.findByRole('dialog', { name: /closures/i }));
    await dialog.findByText('No closures planned.');
    await userEvent.type(dialog.getByLabelText('From'), '2030-01-07T18:00');
    await userEvent.type(dialog.getByLabelText('To'), '2030-01-07T09:00');
    await userEvent.click(dialog.getByRole('button', { name: 'Add closure' }));
    expect(await dialog.findByText('The end must be after the start.')).toBeInTheDocument();
    expect(api.callsTo('POST', '/v1/admin/drawers/d-1/closures')).toHaveLength(0);
  });

  it('W-10 existing closures are listed in the drawer’s time and can be removed', async () => {
    const api = setup({
      'GET /v1/admin/drawers/:id/closures': [
        {
          id: 'cl-1',
          from: '2030-01-07T03:30:00.000Z',
          to: '2030-01-07T13:00:00.000Z',
          reason: 'Diwali',
        },
      ],
      'DELETE /v1/admin/drawers/:id/closures/:closureId': undefined,
    });
    renderApp('/drawers', { me: superAdminMe, api });
    const table = await screen.findByRole('table', { name: 'Drawers' });
    await userEvent.click(
      within(within(table).getAllByRole('row')[1]!).getByRole('button', { name: 'Closures' }),
    );
    const dialog = within(await screen.findByRole('dialog', { name: /closures/i }));
    expect(await dialog.findByText('Diwali')).toBeInTheDocument();
    expect(dialog.getByText(/9:00/)).toBeInTheDocument();
    await userEvent.click(dialog.getByRole('button', { name: 'Remove' }));
    await waitFor(() =>
      expect(api.callsTo('DELETE', '/v1/admin/drawers/d-1/closures/cl-1')).toHaveLength(1),
    );
  });
});
