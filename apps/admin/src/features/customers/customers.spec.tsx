import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi } from '@/test/mock-api';
import { meWith, problemResponse, renderApp, superAdminMe } from '@/test/render';

const customer = (o: Record<string, unknown> = {}) => ({
  id: 'c-1',
  email: 'asha@example.com',
  name: 'Asha',
  createdAt: '2030-01-01T10:00:00.000Z',
  kycStatus: 'none',
  maskedAadhaar: null,
  bookingCount: 2,
  ...o,
});
const detail = (o: Record<string, unknown> = {}, kyc: Record<string, unknown> = {}) => ({
  ...customer(o),
  activeBookings: 1,
  kyc: {
    required: true,
    status: 'none',
    maskedAadhaar: null,
    verifiedAt: null,
    verifiedName: null,
    reason: null,
    ...kyc,
  },
});
const page = (items: unknown[], nextCursor: string | null = null) => ({ items, nextCursor });

const setup = (me = superAdminMe, extra: Record<string, unknown> = {}) => {
  const api = mockApi({
    'GET /v1/admin/customers': page([
      customer(),
      customer({
        id: 'c-2',
        email: 'ravi@example.com',
        name: null,
        kycStatus: 'verified',
        maskedAadhaar: 'XXXX XXXX 0128',
      }),
    ]),
    'GET /v1/admin/customers/:id': detail(),
    ...extra,
  });
  return renderApp('/customers', { me, api });
};

describe('customers', () => {
  it('U-01 lists people with their identity state and masked Aadhaar — never a full number', async () => {
    setup();
    const table = await screen.findByRole('table', { name: 'Customers' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(within(rows[0]!).getByText('Not verified')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Verified')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('XXXX XXXX 0128')).toBeInTheDocument();
    expect(table.textContent).not.toMatch(/\d{12}/);
  });

  it('U-02 the menu entry and the page need users:read', async () => {
    renderApp('/customers', { me: meWith(['bookings:read']), api: mockApi({}) });
    expect(await screen.findByRole('alert')).toHaveTextContent(/do not have access/i);
    expect(screen.queryByRole('link', { name: 'Customers' })).not.toBeInTheDocument();
  });

  it('U-03 filters and search go to the server; "Load more" uses the cursor', async () => {
    const { api } = setup(superAdminMe, {
      'GET /v1/admin/customers': ({ url }: { url: URL }) =>
        url.searchParams.get('cursor')
          ? page([customer({ id: 'c-9', email: 'zed@example.com' })])
          : page([customer()], 'next-1'),
    });
    await screen.findByRole('table', { name: 'Customers' });
    await userEvent.selectOptions(screen.getByLabelText('Identity'), 'pending');
    await userEvent.type(screen.getByLabelText('Search'), 'asha');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByRole('table', { name: 'Customers' });
    expect(Object.fromEntries(api.callsTo('GET', '/v1/admin/customers').at(-1)!.query)).toEqual({
      limit: '25',
      kyc: 'pending',
      q: 'asha',
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Next page' }));
    expect(await screen.findByText('zed@example.com')).toBeInTheDocument();
  });

  it('U-04 the detail shows the verification record and the booking counts', async () => {
    setup(superAdminMe, {
      'GET /v1/admin/customers/:id': detail(
        { kycStatus: 'verified', maskedAadhaar: 'XXXX XXXX 0128' },
        {
          status: 'verified',
          maskedAadhaar: 'XXXX XXXX 0128',
          verifiedName: 'Aadhaar Holder (demo)',
          verifiedAt: '2030-01-02T10:00:00.000Z',
        },
      ),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Open asha@example.com' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(await dialog.findByText('Aadhaar Holder (demo)')).toBeInTheDocument();
    expect(dialog.getByText('2 in total, 1 active')).toBeInTheDocument();
  });

  it('U-05 read-only staff see no decision buttons', async () => {
    setup(meWith(['users:read']));
    await userEvent.click(await screen.findByRole('button', { name: 'Open asha@example.com' }));
    const dialog = within(await screen.findByRole('dialog'));
    await dialog.findByText('2 in total, 1 active');
    expect(dialog.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    expect(dialog.queryByRole('button', { name: /decline/i })).not.toBeInTheDocument();
  });

  it('U-06 approving by hand needs a reason and sends decision + reason', async () => {
    const { api } = setup(superAdminMe, {
      'POST /v1/admin/customers/:id/kyc': {
        required: true,
        status: 'verified',
        maskedAadhaar: null,
        verifiedAt: null,
        verifiedName: null,
        reason: 'x',
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Open asha@example.com' }));
    await userEvent.click(await screen.findByRole('button', { name: /approve by hand/i }));
    const dialog = within(await screen.findByRole('dialog', { name: /approve identity by hand/i }));
    const submit = dialog.getByRole('button', { name: 'Approve' });
    expect(submit).toBeDisabled();
    await userEvent.type(dialog.getByLabelText('Reason'), 'Checked the original card');
    await userEvent.click(submit);
    await waitFor(() => expect(api.callsTo('POST', '/v1/admin/customers/c-1/kyc')).toHaveLength(1));
    expect(api.callsTo('POST', '/v1/admin/customers/c-1/kyc')[0]!.body).toEqual({
      decision: 'approve',
      reason: 'Checked the original card',
    });
  });

  it('U-07 only the sensible decisions are offered for each state', async () => {
    setup(superAdminMe, {
      'GET /v1/admin/customers/:id': detail(
        { kycStatus: 'rejected' },
        { status: 'rejected', reason: 'Card altered' },
      ),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Open asha@example.com' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(await dialog.findByText('Card altered')).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: /approve by hand/i })).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: /reset/i })).toBeInTheDocument();
    expect(dialog.queryByRole('button', { name: /decline/i })).not.toBeInTheDocument();
  });

  it('U-08 a refusal by the server (permission changed meanwhile) is shown in the dialog', async () => {
    setup(superAdminMe, {
      'POST /v1/admin/customers/:id/kyc': problemResponse(403, 'PERMISSION_DENIED', 'no'),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Open asha@example.com' }));
    await userEvent.click(await screen.findByRole('button', { name: /decline/i }));
    const dialog = within(await screen.findByRole('dialog', { name: /decline identity/i }));
    await userEvent.type(dialog.getByLabelText('Reason'), 'Name does not match');
    await userEvent.click(dialog.getByRole('button', { name: 'Decline' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent(
      'You do not have permission to do that.',
    );
  });
});
