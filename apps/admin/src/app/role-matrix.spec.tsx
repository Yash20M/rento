import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { bookingFixture, detailFixture, drawerA } from '@/test/fixtures';
import { mockApi } from '@/test/mock-api';
import { meWith, renderApp, superAdminMe } from '@/test/render';

/**
 * The screens' half of the role matrix (P3-10): for each role, which menu entries exist, which pages open when the
 * address is typed by hand, and which action buttons are offered. The API half (`m18-role-matrix.api.spec`) proves the
 * server refuses everything the screens hide.
 */
interface Role {
  name: string;
  me: ReturnType<typeof meWith>;
  menu: string[];
  /** Pages that must refuse to open (path → permission named in the refusal). */
  forbidden: Array<[string, string]>;
  bookingActions: { handOver: boolean; cancel: boolean; move: boolean };
  customerActions: boolean;
  assetActions: { edit: boolean; transfer: boolean };
  catalogueEdit: boolean;
  drawerCreate: boolean;
}

const scope = (permissions: string[], drawerId: string) =>
  permissions.map((permission) => ({ permission, drawerIds: [drawerId] }));

const OPS = [
  'bookings:read',
  'bookings:write',
  'bookings:cancel',
  'bookings:refund',
  'assets:read',
  'assets:write',
  'assets:transfer',
  'drawers:read',
  'drawers:write',
  'inventory:read',
  'inventory:write',
  'users:read',
  'reports:read',
];
const STAFF = ['bookings:read', 'bookings:write', 'bookings:cancel', 'assets:read', 'drawers:read'];
const SUPPORT = ['bookings:read', 'bookings:cancel', 'users:read', 'users:write'];
const VIEWER = [
  'bookings:read',
  'reports:read',
  'audit:read',
  'inventory:read',
  'drawers:read',
  'assets:read',
];

const ROLES: Role[] = [
  {
    name: 'Super Admin',
    me: superAdminMe,
    menu: [
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
    ],
    forbidden: [],
    bookingActions: { handOver: true, cancel: true, move: true },
    customerActions: true,
    assetActions: { edit: true, transfer: true },
    catalogueEdit: true,
    drawerCreate: true,
  },
  {
    name: 'Operations Manager',
    me: meWith(OPS),
    menu: [
      'Dashboard',
      'Bookings',
      'Schedule',
      'Customers',
      'Categories',
      'Item models',
      'Assets',
      'Drawers',
      'Reports',
      'Payments',
    ],
    forbidden: [
      ['/roles', 'roles:read'],
      ['/staff', 'admins:read'],
      ['/audit', 'audit:read'],
      ['/settings', 'settings:read'],
    ],
    bookingActions: { handOver: true, cancel: true, move: true },
    customerActions: false,
    assetActions: { edit: true, transfer: true },
    catalogueEdit: true,
    drawerCreate: true,
  },
  {
    name: 'Drawer Staff (one drawer)',
    me: meWith(STAFF, scope(STAFF, 'd-1')),
    menu: ['Dashboard', 'Bookings', 'Schedule', 'Assets', 'Drawers'],
    forbidden: [
      ['/customers', 'users:read'],
      ['/reports', 'reports:read'],
      ['/inventory/models', 'inventory:read'],
      ['/roles', 'roles:read'],
    ],
    bookingActions: { handOver: true, cancel: true, move: true },
    customerActions: false,
    assetActions: { edit: false, transfer: false },
    catalogueEdit: false,
    drawerCreate: false,
  },
  {
    name: 'Support Agent',
    me: meWith(SUPPORT),
    menu: ['Dashboard', 'Bookings', 'Schedule', 'Customers'],
    forbidden: [
      ['/inventory/assets', 'assets:read'],
      ['/drawers', 'drawers:read'],
      ['/reports', 'reports:read'],
      ['/audit', 'audit:read'],
    ],
    bookingActions: { handOver: false, cancel: true, move: false },
    customerActions: true,
    assetActions: { edit: false, transfer: false },
    catalogueEdit: false,
    drawerCreate: false,
  },
  {
    name: 'Viewer',
    me: meWith(VIEWER),
    menu: [
      'Dashboard',
      'Bookings',
      'Schedule',
      'Categories',
      'Item models',
      'Assets',
      'Drawers',
      'Reports',
      'Payments',
      'Audit log',
    ],
    forbidden: [
      ['/customers', 'users:read'],
      ['/staff', 'admins:read'],
      ['/settings', 'settings:read'],
    ],
    bookingActions: { handOver: false, cancel: false, move: false },
    customerActions: false,
    assetActions: { edit: false, transfer: false },
    catalogueEdit: false,
    drawerCreate: false,
  },
];

const page = (items: unknown[]) => ({ items, nextCursor: null });
const asset = {
  id: 'a-1',
  assetCode: 'PS5-001',
  itemModelId: 'm-1',
  itemModelName: 'PlayStation 5',
  drawerId: 'd-1',
  drawerName: 'Indiranagar',
  serialNo: null,
  status: 'available',
};
const model = {
  id: 'm-1',
  categoryId: 'cat-1',
  name: 'PlayStation 5',
  description: null,
  photos: [],
  pricePerSlotPaise: 4900,
  slotMinutes: 30,
  minDurationMin: 30,
  maxDurationMin: 240,
  bufferMin: 15,
  depositPaise: 20000,
  status: 'active',
  assetCount: 1,
};
const customer = {
  id: 'c-1',
  email: 'asha@example.com',
  name: 'Asha',
  createdAt: '2030-01-01T10:00:00.000Z',
  kycStatus: 'none',
  maskedAadhaar: null,
  bookingCount: 1,
  accountStatus: 'active',
};

const api = () =>
  mockApi({
    'GET /v1/admin/dashboard': {
      generatedAt: '2030-01-01T00:00:00Z',
      windowDays: 7,
      now: { held: 0, confirmed: 0, active: 0, overdue: 0 },
      lastDays: {
        completed: 0,
        cancelled: 0,
        noShow: 0,
        expired: 0,
        grossPaise: 0,
        refundedPaise: 0,
      },
      upcoming: [],
    },
    'GET /v1/admin/bookings': page([bookingFixture()]),
    'GET /v1/admin/bookings/:id': detailFixture(),
    'GET /v1/admin/bookings/:id/reassign-options': [],
    'GET /v1/admin/drawers': [drawerA],
    'GET /v1/admin/assets': { data: [asset], nextCursor: null },
    'GET /v1/admin/item-models': [model],
    'GET /v1/admin/categories': [
      { id: 'cat-1', name: 'Consoles', slug: 'consoles', parentId: null, itemModelCount: 1 },
    ],
    'GET /v1/admin/customers': page([customer]),
    'GET /v1/admin/customers/:id': {
      ...customer,
      activeBookings: 0,
      kyc: {
        required: true,
        status: 'none',
        maskedAadhaar: null,
        verifiedAt: null,
        verifiedName: null,
        reason: null,
      },
    },
    'GET /v1/admin/assets/:id/transfer': null,
  } as never);

/** A page the role has no entry for must also refuse to open by address. */
async function expectDenied(role: Role, path: string) {
  renderApp(path, { me: role.me, api: api() });
  expect(await screen.findByRole('alert')).toHaveTextContent(/do not have access/i);
}

describe.each(ROLES)('screens for $name', (role) => {
  it('R-menu: shows exactly its menu entries, in order', async () => {
    renderApp('/', { me: role.me, api: api() });
    const nav = await screen.findByRole('navigation', { name: /main/i });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(role.menu);
  });

  it('R-urls: typing the address of a forbidden page shows "no access", names the permission and asks for no data', async () => {
    for (const [path, permission] of role.forbidden) {
      const calls = api();
      const view = renderApp(path, { me: role.me, api: calls });
      const alert = await screen.findByRole('alert');
      expect(alert, path).toHaveTextContent(/do not have access/i);
      expect(alert, path).toHaveTextContent(permission);
      expect(
        calls.calls.filter(
          (c) =>
            c.path.startsWith('/v1/admin/') &&
            !['/v1/admin/me'].includes(c.path) &&
            c.method === 'GET' &&
            c.path !== '/v1/admin/dashboard' &&
            c.path !== '/v1/admin/drawers',
        ),
        path,
      ).toEqual([]);
      view.unmount();
    }
  });

  it('R-bookings: the booking offers only the actions the role may take', async () => {
    renderApp('/bookings', { me: role.me, api: api() });
    await userEvent.click(
      await screen.findByRole('button', { name: /open booking of asha@example.com/i }),
    );
    const dialog = within(await screen.findByRole('dialog', { name: 'Booking' }));
    await dialog.findByText('Indiranagar');
    const has = (name: RegExp) => dialog.queryByRole('button', { name }) !== null;
    expect(has(/hand over to customer/i), 'hand over').toBe(role.bookingActions.handOver);
    expect(has(/cancel booking/i), 'cancel').toBe(role.bookingActions.cancel);
    expect(has(/move to another unit/i), 'move').toBe(role.bookingActions.move);
  });

  it('R-customers: identity and suspension buttons only for users:write', async () => {
    if (!role.menu.includes('Customers')) return expectDenied(role, '/customers');
    renderApp('/customers', { me: role.me, api: api() });
    await userEvent.click(await screen.findByRole('button', { name: 'Open asha@example.com' }));
    const dialog = within(await screen.findByRole('dialog'));
    await dialog.findByText('1 in total, 0 active');
    const shown =
      dialog.queryAllByRole('button', { name: /suspend account|approve by hand/i }).length > 0;
    expect(shown).toBe(role.customerActions);
  });

  it('R-assets: edit and transfer buttons follow assets:write / assets:transfer', async () => {
    if (!role.menu.includes('Assets')) return expectDenied(role, '/inventory/assets');
    renderApp('/inventory/assets', { me: role.me, api: api() });
    await screen.findByRole('table', { name: 'Assets' });
    expect(screen.queryByRole('button', { name: 'Edit' }) !== null, 'edit').toBe(
      role.assetActions.edit,
    );
    expect(screen.queryByRole('button', { name: 'Transfer…' }) !== null, 'transfer').toBe(
      role.assetActions.transfer,
    );
  });

  it('R-catalogue: editing products needs inventory:write', async () => {
    if (!role.menu.includes('Item models')) return expectDenied(role, '/inventory/models');
    renderApp('/inventory/models', { me: role.me, api: api() });
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: 'Edit' }) !== null).toBe(role.catalogueEdit);
    expect(screen.queryByRole('button', { name: /new item model/i }) !== null).toBe(
      role.catalogueEdit,
    );
  });

  it('R-drawers: creating a drawer needs drawers:write', async () => {
    if (!role.menu.includes('Drawers')) return expectDenied(role, '/drawers');
    renderApp('/drawers', { me: role.me, api: api() });
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: 'New drawer' }) !== null).toBe(role.drawerCreate);
  });
});
