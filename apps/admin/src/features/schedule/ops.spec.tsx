import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { bookingFixture, detailFixture, drawerA } from '@/test/fixtures';
import { mockApi } from '@/test/mock-api';
import { meWith, problemResponse, renderApp, superAdminMe } from '@/test/render';

const DAY = '2030-01-09'; // Wednesday in Asia/Kolkata (UTC+5:30)

const scheduleFixture = (assets: unknown[] = defaultAssets()) => ({
  drawerId: 'd-1',
  drawerName: 'Indiranagar',
  timezone: 'Asia/Kolkata',
  assets,
});
function defaultAssets() {
  return [
    {
      assetId: 'a-1',
      assetCode: 'PS5-001',
      itemModel: 'PlayStation 5',
      status: 'available',
      entries: [
        {
          kind: 'booking',
          blockedFrom: '2030-01-09T04:30:00.000Z', // 10:00 IST
          blockedUntil: '2030-01-09T05:45:00.000Z', // 11:15 IST (with the 15 min buffer)
          bookingId: 'b-1',
          bookingStatus: 'confirmed',
          startsAt: '2030-01-09T04:30:00.000Z',
          endsAt: '2030-01-09T05:30:00.000Z',
          customer: 'Asha',
        },
      ],
    },
    {
      assetId: 'a-2',
      assetCode: 'PS5-002',
      itemModel: 'PlayStation 5',
      status: 'available',
      entries: [
        {
          kind: 'maintenance',
          blockedFrom: '2030-01-09T08:30:00.000Z', // 14:00 IST
          blockedUntil: '2030-01-09T10:30:00.000Z', // 16:00 IST
          blockId: 'blk-1',
          reason: 'Controller repair',
        },
      ],
    },
  ];
}

const setup = (me = superAdminMe, extra: Record<string, unknown> = {}) => {
  const api = mockApi({
    'GET /v1/admin/drawers': [drawerA],
    'GET /v1/admin/drawers/:id/schedule': scheduleFixture(),
    'GET /v1/admin/bookings/:id': detailFixture(),
    ...extra,
  } as never);
  renderApp('/schedule', { me, api });
  return api;
};
const pickDay = async () => {
  const day = await screen.findByLabelText('Day');
  fireEvent.change(day, { target: { value: DAY } });
};

describe('schedule', () => {
  it('O-01 shows every unit with its bookings and blocks at the drawer’s own time, asking for exactly that day', async () => {
    const api = setup();
    await pickDay();
    expect(
      await screen.findByRole('button', { name: /Booking of Asha, 10:00 to 11:00/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Maintenance, 14:00 to 16:00: Controller repair/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Unit PS5-001' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Unit PS5-002' })).toBeInTheDocument();

    const last = api.callsTo('GET', '/v1/admin/drawers/d-1/schedule').at(-1)!;
    expect(Object.fromEntries(last.query)).toEqual({
      startsAt: '2030-01-08T18:30:00.000Z', // midnight IST
      endsAt: '2030-01-09T18:30:00.000Z',
    });
  });

  it('O-02 opening a booking from the schedule shows its details', async () => {
    setup();
    await pickDay();
    await userEvent.click(await screen.findByRole('button', { name: /Booking of Asha/ }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Booking' }));
    expect(await dialog.findByText('asha@example.com')).toBeInTheDocument();
  });

  it('O-03 a block can be opened and lifted by someone who may edit assets', async () => {
    const api = setup(superAdminMe, { 'DELETE /v1/admin/assets/:id/blocks/:blockId': undefined });
    await pickDay();
    await userEvent.click(await screen.findByRole('button', { name: /Maintenance, 14:00/ }));
    const dialog = within(await screen.findByRole('dialog', { name: /Maintenance · PS5-002/ }));
    expect(dialog.getByText('Controller repair')).toBeInTheDocument();
    await userEvent.click(dialog.getByRole('button', { name: 'Lift block' }));
    await waitFor(() =>
      expect(api.callsTo('DELETE', '/v1/admin/assets/a-2/blocks/blk-1')).toHaveLength(1),
    );
  });

  it('O-04 read-only staff can look but cannot block or lift', async () => {
    setup(meWith(['bookings:read', 'drawers:read']));
    await pickDay();
    await userEvent.click(await screen.findByRole('button', { name: /Maintenance, 14:00/ }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.queryByRole('button', { name: 'Lift block' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Block time…' })).not.toBeInTheDocument();
  });

  it('O-05 blocking sends the drawer’s local times as exact instants, with the reason and kind', async () => {
    const api = setup(superAdminMe, {
      'GET /v1/admin/assets/:id/impact-preview': { bookings: [], blocks: [], clear: true },
      'POST /v1/admin/assets/:id/blocks': {
        id: 'blk-9',
        assetId: 'a-1',
        kind: 'maintenance',
        startsAt: 'x',
        endsAt: 'y',
        reason: 'r',
        createdAt: 'z',
      },
    });
    await pickDay();
    const rows = await screen.findAllByRole('button', { name: 'Block time…' });
    await userEvent.click(rows[0]!);
    const dialog = within(await screen.findByRole('dialog', { name: 'Block PS5-001' }));
    expect(await dialog.findByText(/Nothing is booked in this time/)).toBeInTheDocument();
    await userEvent.type(dialog.getByLabelText('Reason'), 'Replace the fan');
    await userEvent.click(dialog.getByRole('button', { name: 'Block this time' }));

    await waitFor(() => expect(api.callsTo('POST', '/v1/admin/assets/a-1/blocks')).toHaveLength(1));
    expect(api.callsTo('POST', '/v1/admin/assets/a-1/blocks')[0]!.body).toEqual({
      startsAt: '2030-01-09T04:30:00.000Z', // 10:00 IST
      endsAt: '2030-01-09T06:30:00.000Z', // 12:00 IST
      reason: 'Replace the fan',
      kind: 'maintenance',
    });
  });

  it('O-06 bookings in the way are listed first, nothing can be blocked and nothing is cancelled for you', async () => {
    const api = setup(superAdminMe, {
      'GET /v1/admin/assets/:id/impact-preview': {
        bookings: [
          {
            bookingId: 'b-1',
            status: 'confirmed',
            startsAt: '2030-01-09T04:30:00.000Z',
            endsAt: '2030-01-09T05:30:00.000Z',
            customer: 'Asha',
          },
        ],
        blocks: [],
        clear: false,
      },
    });
    await pickDay();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Block time…' }))[0]!);
    const dialog = within(await screen.findByRole('dialog', { name: 'Block PS5-001' }));
    const alert = await dialog.findByRole('alert');
    expect(alert).toHaveTextContent('cannot be blocked yet');
    expect(alert).toHaveTextContent('Asha');
    expect(alert).toHaveTextContent('Confirmed');
    await userEvent.type(dialog.getByLabelText('Reason'), 'Replace the fan');
    expect(dialog.getByRole('button', { name: 'Block this time' })).toBeDisabled();
    expect(api.callsTo('POST', '/v1/admin/assets/a-1/blocks')).toHaveLength(0);
  });

  it('O-07 a refusal by the server (someone booked meanwhile) is shown and the dialog stays open', async () => {
    setup(superAdminMe, {
      'GET /v1/admin/assets/:id/impact-preview': { bookings: [], blocks: [], clear: true },
      'POST /v1/admin/assets/:id/blocks': problemResponse(
        409,
        'HAS_FUTURE_BOOKINGS',
        '1 booking(s) are in the way. Move or cancel them first',
        [{ field: 'bookings', message: 'b-7 (held)' }],
      ),
    });
    await pickDay();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Block time…' }))[0]!);
    const dialog = within(await screen.findByRole('dialog', { name: 'Block PS5-001' }));
    await dialog.findByText(/Nothing is booked/);
    await userEvent.type(dialog.getByLabelText('Reason'), 'Replace the fan');
    await userEvent.click(dialog.getByRole('button', { name: 'Block this time' }));
    expect(await dialog.findByText(/booking\(s\) are in the way/)).toBeInTheDocument();
  });

  it('O-08 an end before the start is flagged and cannot be submitted', async () => {
    setup(superAdminMe, {
      'GET /v1/admin/assets/:id/impact-preview': { bookings: [], blocks: [], clear: true },
    });
    await pickDay();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Block time…' }))[0]!);
    const dialog = within(await screen.findByRole('dialog', { name: 'Block PS5-001' }));
    fireEvent.change(dialog.getByLabelText('Until'), { target: { value: `${DAY}T09:00` } });
    await userEvent.type(dialog.getByLabelText('Reason'), 'Replace the fan');
    expect(await dialog.findByText('Must be after the start')).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Block this time' })).toBeDisabled();
  });
});

describe('moving a booking to another unit', () => {
  const open = async (
    me = superAdminMe,
    booking: Record<string, unknown> = {},
    extra: Record<string, unknown> = {},
  ) => {
    const api = mockApi({
      'GET /v1/admin/bookings': { items: [bookingFixture(booking)], nextCursor: null },
      'GET /v1/admin/drawers': [drawerA],
      'GET /v1/admin/bookings/:id': detailFixture(booking),
      'GET /v1/admin/bookings/:id/reassign-options': [
        { assetId: 'a-2', assetCode: 'PS5-002' },
        { assetId: 'a-3', assetCode: 'PS5-003' },
      ],
      ...extra,
    } as never);
    renderApp('/bookings', { me, api });
    await userEvent.click(
      await screen.findByRole('button', { name: /open booking of asha@example.com/i }),
    );
    return { api, dialog: within(await screen.findByRole('dialog', { name: 'Booking' })) };
  };

  it('O-09 offered for a booking that has not started, to people who may change bookings', async () => {
    const { dialog } = await open();
    expect(await dialog.findByRole('button', { name: /Move to another unit/ })).toBeInTheDocument();
  });

  it('O-10 not offered to read-only staff or for a finished booking', async () => {
    const reader = await open(meWith(['bookings:read', 'drawers:read']));
    await reader.dialog.findByText('Indiranagar');
    expect(
      reader.dialog.queryByRole('button', { name: /Move to another/ }),
    ).not.toBeInTheDocument();
  });

  it('O-11 a finished booking cannot be moved', async () => {
    const { dialog } = await open(superAdminMe, { status: 'completed', cancellable: false });
    await dialog.findByText('Indiranagar');
    expect(dialog.queryByRole('button', { name: /Move to another/ })).not.toBeInTheDocument();
  });

  it('O-12 sends the chosen unit and the reason', async () => {
    const { api, dialog } = await open(
      superAdminMe,
      {},
      {
        'POST /v1/admin/bookings/:id/reassign': detailFixture(),
      },
    );
    await userEvent.click(await dialog.findByRole('button', { name: /Move to another unit/ }));
    const move = within(await screen.findByRole('dialog', { name: 'Move to another unit' }));
    const submit = await move.findByRole('button', { name: 'Move booking' });
    expect(submit).toBeDisabled(); // a reason is needed first
    await userEvent.selectOptions(move.getByLabelText('Move to'), 'a-3');
    await userEvent.type(move.getByLabelText('Reason'), 'Worn controller');
    await userEvent.click(submit);
    await waitFor(() =>
      expect(api.callsTo('POST', '/v1/admin/bookings/b-1/reassign')).toHaveLength(1),
    );
    expect(api.callsTo('POST', '/v1/admin/bookings/b-1/reassign')[0]!.body).toEqual({
      reason: 'Worn controller',
      assetId: 'a-3',
    });
  });

  it('O-13 "Any free unit" sends no unit', async () => {
    const { api, dialog } = await open(
      superAdminMe,
      {},
      {
        'POST /v1/admin/bookings/:id/reassign': detailFixture(),
      },
    );
    await userEvent.click(await dialog.findByRole('button', { name: /Move to another unit/ }));
    const move = within(await screen.findByRole('dialog', { name: 'Move to another unit' }));
    await userEvent.type(await move.findByLabelText('Reason'), 'Rebalancing');
    await userEvent.click(move.getByRole('button', { name: 'Move booking' }));
    await waitFor(() =>
      expect(api.callsTo('POST', '/v1/admin/bookings/b-1/reassign')).toHaveLength(1),
    );
    expect(api.callsTo('POST', '/v1/admin/bookings/b-1/reassign')[0]!.body).toEqual({
      reason: 'Rebalancing',
    });
  });

  it('O-14 with no free unit it says so and cannot be submitted', async () => {
    const { dialog } = await open(
      superAdminMe,
      {},
      {
        'GET /v1/admin/bookings/:id/reassign-options': [],
      },
    );
    await userEvent.click(await dialog.findByRole('button', { name: /Move to another unit/ }));
    const move = within(await screen.findByRole('dialog', { name: 'Move to another unit' }));
    expect(await move.findByText(/No other unit of this model is free/)).toBeInTheDocument();
    expect(move.getByRole('button', { name: 'Move booking' })).toBeDisabled();
  });

  it('O-15 a unit taken meanwhile is refused with a clear message', async () => {
    const { dialog } = await open(
      superAdminMe,
      {},
      {
        'POST /v1/admin/bookings/:id/reassign': problemResponse(
          409,
          'BOOKING_SLOT_TAKEN',
          'The requested slot is no longer available',
        ),
      },
    );
    await userEvent.click(await dialog.findByRole('button', { name: /Move to another unit/ }));
    const move = within(await screen.findByRole('dialog', { name: 'Move to another unit' }));
    await userEvent.type(await move.findByLabelText('Reason'), 'Rebalancing');
    await userEvent.click(move.getByRole('button', { name: 'Move booking' }));
    expect(await move.findByRole('alert')).toBeInTheDocument();
  });
});
