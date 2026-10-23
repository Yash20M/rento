import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi } from '@/test/mock-api';
import { renderApp, superAdminMe } from '@/test/render';

/** P3-44 / P3-45 on the admin side: the customer's photo and the verification ticks, with spoken names. */
const customer = (o: Record<string, unknown> = {}) => ({
  id: 'c-1',
  email: 'asha@example.com',
  name: 'Asha',
  createdAt: '2030-01-01T10:00:00.000Z',
  kycStatus: 'verified',
  maskedAadhaar: 'XXXX XXXX 1234',
  bookingCount: 2,
  accountStatus: 'active',
  avatarUrl: '/v1/media/11111111-1111-4111-8111-111111111111',
  emailVerified: true,
  ...o,
});
const detail = (o: Record<string, unknown> = {}) => ({
  ...customer(o),
  activeBookings: 0,
  kyc: {
    required: true,
    status: o['kycStatus'] ?? 'verified',
    maskedAadhaar: 'XXXX XXXX 1234',
    verifiedAt: null,
    verifiedName: null,
    reason: null,
  },
});

const open = (list: unknown[], one: unknown) => {
  const api = mockApi({
    'GET /v1/admin/customers': { items: list, nextCursor: null },
    'GET /v1/admin/customers/:id': one,
  } as never);
  renderApp('/customers', { me: superAdminMe, api });
  return api;
};

describe('customers: photo and verification', () => {
  it('T-01 the list shows the photo, a blue tick for a verified identity and the email state', async () => {
    open([customer()], detail());
    const row = within(await screen.findByRole('row', { name: /asha@example.com/i }));
    const photo = row.getByTestId('avatar').querySelector('img');
    expect(photo?.getAttribute('src')).toBe('/v1/media/11111111-1111-4111-8111-111111111111');
    expect(row.getByRole('img', { name: 'Identity verified' })).toBeInTheDocument();
    expect(row.getByRole('img', { name: 'Email verified' })).toBeInTheDocument();
  });

  it('T-02 without a photo the first letter is shown; an unverified person gets no tick and a question mark', async () => {
    open(
      [customer({ avatarUrl: null, kycStatus: 'none', emailVerified: false })],
      detail({ avatarUrl: null, kycStatus: 'none', emailVerified: false }),
    );
    const row = within(await screen.findByRole('row', { name: /asha@example.com/i }));
    expect(row.getByTestId('avatar')).toHaveTextContent('A');
    expect(row.queryByRole('img', { name: 'Identity verified' })).not.toBeInTheDocument();
    expect(row.getByRole('img', { name: 'Email not verified' })).toBeInTheDocument();
  });

  it('T-03 a photo that cannot load falls back to the letter instead of a broken image', async () => {
    open([customer()], detail());
    const row = within(await screen.findByRole('row', { name: /asha@example.com/i }));
    const img = row.getByTestId('avatar').querySelector('img')!;
    img.dispatchEvent(new Event('error'));
    expect(await row.findByText('A')).toBeInTheDocument();
  });

  it('T-04 the detail shows the same facts in words', async () => {
    open([customer()], detail());
    await userEvent.click(await screen.findByRole('button', { name: 'Open asha@example.com' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(await dialog.findByText('Email verified', { selector: 'span' })).toBeInTheDocument();
    expect(dialog.getAllByRole('img', { name: 'Identity verified' }).length).toBeGreaterThan(0);
  });
});
