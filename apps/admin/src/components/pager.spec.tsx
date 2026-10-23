import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { mockApi } from '@/test/mock-api';
import { renderApp, superAdminMe } from '@/test/render';

const payment = (id: string, customer: string, status = 'captured') => ({
  id,
  bookingId: `b-${id}`,
  customer,
  drawerName: 'Indiranagar',
  provider: 'fake',
  status,
  amountPaise: 29800,
  extension: false,
  refundedPaise: null,
  refundStatus: null,
  createdAt: '2030-01-07T04:00:00.000Z',
});

/** Three pages of two payments each, chained by cursors c-2 and c-3. */
const threePages = ({ url }: { url: URL }) => {
  const cursor = url.searchParams.get('cursor');
  if (cursor === 'c-3')
    return { items: [payment('5', 'Eve'), payment('6', 'Finn')], nextCursor: null };
  if (cursor === 'c-2')
    return { items: [payment('3', 'Cara'), payment('4', 'Dev')], nextCursor: 'c-3' };
  return { items: [payment('1', 'Asha'), payment('2', 'Ben')], nextCursor: 'c-2' };
};

beforeEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    // not available
  }
});

describe('pagination', () => {
  it('PG-01 shows the rows on screen and the page number; previous is off on the first page', async () => {
    renderApp('/payments', {
      me: superAdminMe,
      api: mockApi({ 'GET /v1/admin/payments': threePages } as never),
    });
    const nav = within(await screen.findByRole('navigation', { name: 'Pagination' }));
    expect(nav.getByText('1–2')).toBeInTheDocument();
    expect(nav.getByText(/Showing/)).toHaveTextContent('page 1');
    expect(nav.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(nav.getByRole('button', { name: 'Next page' })).toBeEnabled();
  });

  it('PG-02 next / previous walk the cursors exactly: no row is skipped or repeated, in either direction', async () => {
    const api = mockApi({ 'GET /v1/admin/payments': threePages } as never);
    renderApp('/payments', { me: superAdminMe, api });
    await screen.findByText('Asha');
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByText('Cara')).toBeInTheDocument();
    expect(screen.queryByText('Asha')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByText('Eve')).toBeInTheDocument();
    const nav = within(screen.getByRole('navigation', { name: 'Pagination' }));
    expect(nav.getByText('51–52')).toBeInTheDocument(); // the range keeps counting across pages (25 per page)
    expect(nav.getByRole('button', { name: 'Next page' })).toBeDisabled(); // last page

    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(await screen.findByText('Dev')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(await screen.findByText('Ben')).toBeInTheDocument();
    const cursors = api.callsTo('GET', '/v1/admin/payments').map((c) => c.query.get('cursor'));
    expect(cursors).toContain('c-3');
    expect(new Set(cursors.filter(Boolean))).toEqual(new Set(['c-2', 'c-3']));
  });

  it('PG-03 changing the rows per page asks the server for that many, returns to page 1 and is remembered', async () => {
    const api = mockApi({ 'GET /v1/admin/payments': threePages } as never);
    const first = renderApp('/payments', { me: superAdminMe, api });
    await screen.findByText('Asha');
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText('Cara');
    await userEvent.selectOptions(screen.getByLabelText('Rows per page'), '10');
    expect(await screen.findByText('Asha')).toBeInTheDocument(); // back on page 1
    const last = api.callsTo('GET', '/v1/admin/payments').at(-1)!;
    expect(last.query.get('limit')).toBe('10');
    expect(last.query.get('cursor')).toBeNull();
    expect(window.localStorage.getItem('rento.admin.pagesize.payments')).toBe('10');
    first.unmount();

    const again = mockApi({ 'GET /v1/admin/payments': threePages } as never);
    renderApp('/payments', { me: superAdminMe, api: again });
    await screen.findByText('Asha');
    expect(again.callsTo('GET', '/v1/admin/payments')[0]!.query.get('limit')).toBe('10');
    expect(screen.getByLabelText('Rows per page')).toHaveValue('10');
  });

  it('PG-04 changing a filter starts again from the first page', async () => {
    const api = mockApi({ 'GET /v1/admin/payments': threePages } as never);
    renderApp('/payments', { me: superAdminMe, api });
    await screen.findByText('Asha');
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText('Cara');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'refunded');
    expect(await screen.findByText('Asha')).toBeInTheDocument();
    const last = api.callsTo('GET', '/v1/admin/payments').at(-1)!;
    expect(last.query.get('status')).toBe('refunded');
    expect(last.query.get('cursor')).toBeNull();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  });

  it('PG-05 an empty list has no pager', async () => {
    renderApp('/payments', {
      me: superAdminMe,
      api: mockApi({ 'GET /v1/admin/payments': { items: [], nextCursor: null } }),
    });
    expect(await screen.findByText('No payments match')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  it('PG-06 an unusable browser storage never breaks the page size', async () => {
    const original = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('denied');
      },
    });
    try {
      renderApp('/payments', {
        me: superAdminMe,
        api: mockApi({ 'GET /v1/admin/payments': threePages } as never),
      });
      expect(await screen.findByText('Asha')).toBeInTheDocument();
      await userEvent.selectOptions(screen.getByLabelText('Rows per page'), '50');
      expect(await screen.findByText('Asha')).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, 'localStorage', { configurable: true, value: original });
    }
  });
});
