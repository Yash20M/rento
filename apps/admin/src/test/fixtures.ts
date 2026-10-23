export const drawerA = {
  id: 'd-1',
  name: 'Indiranagar',
  address: '1 Test Street, Bengaluru',
  timezone: 'Asia/Kolkata',
  latitude: 12.9716,
  longitude: 77.5946,
  status: 'active',
  pickupInstructions: null,
  photoUrl: null,
  hours: [
    { weekday: 1, opensAt: '09:00', closesAt: '21:00' },
    { weekday: 2, opensAt: '09:00', closesAt: '21:00' },
  ],
  assetCount: 3,
};

export const drawerB = {
  ...drawerA,
  id: 'd-2',
  name: 'Koramangala',
  address: '2 Test Road',
  assetCount: 1,
  hours: [],
};

export const bookingFixture = (overrides: Record<string, unknown> = {}) => ({
  id: 'b-1',
  status: 'confirmed',
  drawer: {
    id: 'd-1',
    name: 'Indiranagar',
    address: '1 Test Street, Bengaluru',
    timezone: 'Asia/Kolkata',
  },
  itemModel: { id: 'm-1', name: 'PlayStation 5' },
  assetCode: 'PS5-001',
  startsAt: '2030-01-07T04:30:00.000Z',
  endsAt: '2030-01-07T05:30:00.000Z',
  durationMinutes: 60,
  pricePaise: 9800,
  depositPaise: 20000,
  totalPaise: 29800,
  currency: 'INR',
  holdExpiresAt: null,
  cancellable: true,
  cancelReason: null,
  payment: { status: 'captured', orderId: 'order-1', amountPaise: 29800 },
  refund: null,
  createdAt: '2030-01-06T10:00:00.000Z',
  customer: { id: 'c-1', email: 'asha@example.com', name: 'Asha' },
  ...overrides,
});

export const detailFixture = (overrides: Record<string, unknown> = {}) => ({
  ...bookingFixture(overrides),
  history: [
    { from: null, to: 'held', actorUserId: 'c-1', note: null, at: '2030-01-06T10:00:00.000Z' },
    {
      from: 'held',
      to: 'confirmed',
      actorUserId: 'c-1',
      note: null,
      at: '2030-01-06T10:02:00.000Z',
    },
  ],
});

export const roleFixture = (overrides: Record<string, unknown> = {}) => ({
  id: 'r-1',
  name: 'Support',
  description: 'Front desk',
  isSystem: false,
  isSuperAdmin: false,
  permissions: ['bookings:read'],
  assignedCount: 2,
  createdAt: '2030-01-01T00:00:00.000Z',
  updatedAt: '2030-01-01T00:00:00.000Z',
  ...overrides,
});

export const superRole = roleFixture({
  id: 'r-super',
  name: 'Super Admin',
  description: 'Everything',
  isSystem: true,
  isSuperAdmin: true,
  permissions: [],
  assignedCount: 1,
});

export const permissionGroups = [
  {
    group: 'Bookings',
    permissions: [
      { key: 'bookings:read', description: 'View bookings' },
      { key: 'bookings:cancel', description: 'Cancel bookings' },
    ],
  },
  {
    group: 'Inventory',
    permissions: [{ key: 'inventory:read', description: 'View inventory models and categories' }],
  },
];
