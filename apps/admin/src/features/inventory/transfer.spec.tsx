import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { drawerA, drawerB } from '@/test/fixtures';
import { mockApi } from '@/test/mock-api';
import { meWith, problemResponse, renderApp, superAdminMe } from '@/test/render';

const asset = (o: Record<string, unknown> = {}) => ({
  id: 'a-1',
  assetCode: 'PS5-001',
  itemModelId: 'm-1',
  itemModelName: 'PlayStation 5',
  drawerId: 'd-1',
  drawerName: 'Indiranagar',
  serialNo: null,
  status: 'available',
  ...o,
});
const transfer = (o: Record<string, unknown> = {}) => ({
  id: 't-1',
  assetId: 'a-1',
  assetCode: 'PS5-001',
  fromDrawerId: 'd-1',
  toDrawerId: 'd-2',
  status: 'in_transit',
  reason: 'Demand moved',
  startedAt: '2030-01-07T03:00:00.000Z',
  finishedAt: null,
  ...o,
});

const setup = (
  me = superAdminMe,
  assets: unknown[] = [asset()],
  extra: Record<string, unknown> = {},
) => {
  const api = mockApi({
    'GET /v1/admin/assets': { data: assets, nextCursor: null },
    'GET /v1/admin/drawers': [drawerA, drawerB],
    'GET /v1/admin/item-models': [],
    'GET /v1/admin/assets/:id/transfer': null as never,
    ...extra,
  } as never);
  renderApp('/inventory/assets', { me, api });
  return api;
};
const open = async (name: string) => {
  await userEvent.click(await screen.findByRole('button', { name }));
  return within(await screen.findByRole('dialog', { name: /Transfer PS5-001/ }));
};

describe('asset transfers', () => {
  it('X-01 starting a transfer sends the destination and the reason', async () => {
    const api = setup(superAdminMe, [asset()], {
      'POST /v1/admin/assets/:id/transfer': transfer(),
    });
    const dialog = await open('Transfer…');
    const submit = await dialog.findByRole('button', { name: 'Start transfer' });
    expect(submit).toBeDisabled();
    // The drawer the unit is already in is not offered.
    expect(within(dialog.getByLabelText('Move to')).queryByText('Indiranagar')).toBeNull();
    await userEvent.selectOptions(dialog.getByLabelText('Move to'), 'd-2');
    await userEvent.type(dialog.getByLabelText('Reason'), 'Demand moved');
    await userEvent.click(submit);
    await waitFor(() =>
      expect(api.callsTo('POST', '/v1/admin/assets/a-1/transfer')).toHaveLength(1),
    );
    expect(api.callsTo('POST', '/v1/admin/assets/a-1/transfer')[0]!.body).toEqual({
      toDrawerId: 'd-2',
      reason: 'Demand moved',
    });
  });

  it('X-02 a unit on its way shows where to and can be received or the transfer cancelled', async () => {
    const api = setup(superAdminMe, [asset({ status: 'in_transfer' })], {
      'GET /v1/admin/assets/:id/transfer': transfer(),
      'POST /v1/admin/assets/:id/transfer/complete': transfer({ status: 'completed' }),
    });
    const dialog = await open('Transfer status');
    expect(await dialog.findByRole('status')).toHaveTextContent('Indiranagar');
    expect(dialog.getByRole('status')).toHaveTextContent('Koramangala');
    await userEvent.click(dialog.getByRole('button', { name: 'Received at Koramangala' }));
    await waitFor(() =>
      expect(api.callsTo('POST', '/v1/admin/assets/a-1/transfer/complete')).toHaveLength(1),
    );
  });

  it('X-03 cancelling goes to the cancel endpoint', async () => {
    const api = setup(superAdminMe, [asset({ status: 'in_transfer' })], {
      'GET /v1/admin/assets/:id/transfer': transfer(),
      'POST /v1/admin/assets/:id/transfer/cancel': transfer({ status: 'cancelled' }),
    });
    const dialog = await open('Transfer status');
    await userEvent.click(await dialog.findByRole('button', { name: 'Cancel transfer' }));
    await waitFor(() =>
      expect(api.callsTo('POST', '/v1/admin/assets/a-1/transfer/cancel')).toHaveLength(1),
    );
  });

  it('X-04 upcoming bookings are explained by the server and the dialog stays open', async () => {
    setup(superAdminMe, [asset()], {
      'POST /v1/admin/assets/:id/transfer': problemResponse(
        409,
        'HAS_FUTURE_BOOKINGS',
        'This asset still has upcoming bookings or blocks. Resolve them first',
      ),
    });
    const dialog = await open('Transfer…');
    await userEvent.selectOptions(await dialog.findByLabelText('Move to'), 'd-2');
    await userEvent.type(dialog.getByLabelText('Reason'), 'Demand moved');
    await userEvent.click(dialog.getByRole('button', { name: 'Start transfer' }));
    expect(await dialog.findByRole('alert')).toBeInTheDocument();
  });

  it('X-05 the button needs assets:transfer and an asset that can move', async () => {
    setup(meWith(['assets:read', 'assets:write', 'drawers:read']), [asset()]);
    await screen.findByRole('table', { name: 'Assets' });
    expect(screen.queryByRole('button', { name: 'Transfer…' })).not.toBeInTheDocument();
  });

  it('X-06 a unit in maintenance or retired offers no transfer', async () => {
    setup(superAdminMe, [
      asset({ status: 'maintenance' }),
      asset({ id: 'a-2', assetCode: 'PS5-002', status: 'retired' }),
    ]);
    await screen.findByRole('table', { name: 'Assets' });
    expect(screen.queryByRole('button', { name: /Transfer/ })).not.toBeInTheDocument();
  });
});

describe('suspending a customer', () => {
  const customer = {
    id: 'c-1',
    email: 'asha@example.com',
    name: 'Asha',
    createdAt: '2030-01-01T10:00:00.000Z',
    kycStatus: 'verified',
    maskedAadhaar: 'XXXX XXXX 0128',
    bookingCount: 2,
    accountStatus: 'active',
  };
  const detail = (accountStatus = 'active') => ({
    ...customer,
    accountStatus,
    activeBookings: 1,
    kyc: {
      required: true,
      status: 'verified',
      maskedAadhaar: 'XXXX XXXX 0128',
      verifiedAt: null,
      verifiedName: null,
      reason: null,
    },
  });
  const setupCustomers = (me = superAdminMe, status = 'active', extra = {}) => {
    const api = mockApi({
      'GET /v1/admin/customers': { items: [customer], nextCursor: null },
      'GET /v1/admin/customers/:id': detail(status),
      ...extra,
    } as never);
    renderApp('/customers', { me, api });
    return api;
  };

  it('X-07 suspending needs a reason and sends the status with it', async () => {
    const api = setupCustomers(superAdminMe, 'active', {
      'POST /v1/admin/customers/:id/status': detail('suspended'),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Open asha@example.com' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Suspend account…' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Suspend this account' }));
    const submit = dialog.getByRole('button', { name: 'Suspend' });
    expect(submit).toBeDisabled();
    await userEvent.type(dialog.getByLabelText('Reason'), 'Abusive behaviour');
    await userEvent.click(submit);
    await waitFor(() =>
      expect(api.callsTo('POST', '/v1/admin/customers/c-1/status')).toHaveLength(1),
    );
    expect(api.callsTo('POST', '/v1/admin/customers/c-1/status')[0]!.body).toEqual({
      status: 'suspended',
      reason: 'Abusive behaviour',
    });
  });

  it('X-08 a suspended account is marked and can be reinstated', async () => {
    const api = setupCustomers(superAdminMe, 'suspended', {
      'POST /v1/admin/customers/:id/status': detail('active'),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Open asha@example.com' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(await dialog.findByText('Suspended')).toBeInTheDocument();
    await userEvent.click(dialog.getByRole('button', { name: 'Reinstate account…' }));
    const form = within(await screen.findByRole('dialog', { name: 'Reinstate this account' }));
    await userEvent.type(form.getByLabelText('Reason'), 'Resolved');
    await userEvent.click(form.getByRole('button', { name: 'Reinstate' }));
    await waitFor(() =>
      expect(api.callsTo('POST', '/v1/admin/customers/c-1/status')).toHaveLength(1),
    );
    expect(api.callsTo('POST', '/v1/admin/customers/c-1/status')[0]!.body).toMatchObject({
      status: 'active',
    });
  });

  it('X-09 read-only staff cannot suspend', async () => {
    setupCustomers(meWith(['users:read']));
    await userEvent.click(await screen.findByRole('button', { name: 'Open asha@example.com' }));
    const dialog = within(await screen.findByRole('dialog'));
    await dialog.findByText('Active');
    expect(dialog.queryByRole('button', { name: /Suspend/ })).not.toBeInTheDocument();
  });
});
