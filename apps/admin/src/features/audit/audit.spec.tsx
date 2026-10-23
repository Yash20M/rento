import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi } from '@/test/mock-api';
import { renderApp, superAdminMe } from '@/test/render';

const entry = (o: Record<string, unknown> = {}) => ({
  id: 'e-1',
  at: '2030-01-07T10:00:00.000Z',
  actor: { id: 'u-boss', email: 'owner@rento.demo', name: 'Owner' },
  action: 'booking.cancelled',
  entityType: 'booking',
  entityId: '0f8fad5b-d9cb-469f-a165-70867728950e',
  reason: 'Unit damaged',
  before: { status: 'confirmed' },
  after: { status: 'cancelled', refundPaise: 29800 },
  ip: null,
  ...o,
});

describe('audit log', () => {
  it('L-01 shows when, who, what and why; system actions say "system"', async () => {
    const api = mockApi({
      'GET /v1/admin/audit-logs': {
        items: [
          entry(),
          entry({ id: 'e-2', actor: null, action: 'booking.expired', reason: null }),
        ],
        nextCursor: null,
      },
    });
    renderApp('/audit', { me: superAdminMe, api });
    const table = await screen.findByRole('table', { name: 'Audit log' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(within(rows[0]!).getByText('owner@rento.demo')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('booking.cancelled')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Unit damaged')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('system')).toBeInTheDocument();
  });

  it('L-02 "Details" reveals before and after', async () => {
    const api = mockApi({ 'GET /v1/admin/audit-logs': { items: [entry()], nextCursor: null } });
    renderApp('/audit', { me: superAdminMe, api });
    await userEvent.click(await screen.findByRole('button', { name: 'Details' }));
    expect(screen.getByText(/"status": "confirmed"/)).toBeInTheDocument();
    expect(screen.getByText(/"refundPaise": 29800/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByText(/"refundPaise"/)).not.toBeInTheDocument();
  });

  it('L-03 filters and "Next page" go to the server', async () => {
    const api = mockApi({
      'GET /v1/admin/audit-logs': ({ url }) =>
        url.searchParams.get('cursor')
          ? {
              items: [entry({ id: 'e-9', action: 'role.created', reason: null })],
              nextCursor: null,
            }
          : { items: [entry()], nextCursor: 'next-1' },
    });
    renderApp('/audit', { me: superAdminMe, api });
    await screen.findByRole('table', { name: 'Audit log' });
    await userEvent.selectOptions(screen.getByLabelText('About'), 'booking');
    await userEvent.type(screen.getByLabelText('Action'), 'booking.');
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    await screen.findByRole('table', { name: 'Audit log' });
    expect(Object.fromEntries(api.callsTo('GET', '/v1/admin/audit-logs').at(-1)!.query)).toEqual({
      limit: '25',
      entityType: 'booking',
      action: 'booking.',
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Next page' }));
    expect(await screen.findByText('role.created')).toBeInTheDocument();
  });

  it('L-04 an empty trail says so', async () => {
    const api = mockApi({ 'GET /v1/admin/audit-logs': { items: [], nextCursor: null } });
    renderApp('/audit', { me: superAdminMe, api });
    expect(await screen.findByText('Nothing recorded for these filters')).toBeInTheDocument();
  });
});
