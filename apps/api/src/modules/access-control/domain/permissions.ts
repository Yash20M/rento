/**
 * The fixed permission catalog (README §13.5). Permissions are CODE: every key corresponds to a route that enforces
 * it. Roles (data, P2-09) only combine them. The same list is seeded into the `permissions` table by migration
 * `0004_permissions.sql`; a startup check and a CI test fail if the two drift.
 *
 * Adding a permission = add it here AND add a new forward-only migration that inserts it (never edit an applied one).
 */
export interface PermissionDefinition {
  /** `resource:action`, lower case. */
  readonly key: string;
  readonly group: string;
  readonly description: string;
}

export const PERMISSION_KEY_PATTERN = /^[a-z_]+:[a-z_]+$/;

export const PERMISSIONS = [
  {
    key: 'inventory:read',
    group: 'Inventory',
    description: 'View inventory models and categories',
  },
  {
    key: 'inventory:write',
    group: 'Inventory',
    description: 'Create and edit inventory models and categories',
  },
  { key: 'assets:read', group: 'Assets', description: 'View physical assets' },
  { key: 'assets:write', group: 'Assets', description: 'Create and edit physical assets' },
  { key: 'assets:transfer', group: 'Assets', description: 'Move assets between drawers' },
  { key: 'drawers:read', group: 'Drawers', description: 'View drawers, hours and closures' },
  {
    key: 'drawers:write',
    group: 'Drawers',
    description: 'Create and edit drawers, hours and closures',
  },
  { key: 'bookings:read', group: 'Bookings', description: 'View bookings' },
  {
    key: 'bookings:write',
    group: 'Bookings',
    description: 'Change bookings (for example reassign an asset)',
  },
  { key: 'bookings:cancel', group: 'Bookings', description: 'Cancel bookings' },
  { key: 'bookings:refund', group: 'Bookings', description: 'Override refund amounts' },
  { key: 'users:read', group: 'Customers', description: 'View customer accounts' },
  {
    key: 'users:write',
    group: 'Customers',
    description: 'Suspend and unsuspend customer accounts',
  },
  { key: 'reports:read', group: 'Reports & audit', description: 'View reports' },
  { key: 'audit:read', group: 'Reports & audit', description: 'View the audit log' },
  { key: 'settings:read', group: 'Settings', description: 'View platform settings' },
  { key: 'settings:write', group: 'Settings', description: 'Change platform settings' },
  { key: 'roles:read', group: 'Access control', description: 'View roles and their permissions' },
  { key: 'roles:manage', group: 'Access control', description: 'Create, edit and delete roles' },
  {
    key: 'admins:read',
    group: 'Access control',
    description: 'View administrators and their roles',
  },
  {
    key: 'admins:manage',
    group: 'Access control',
    description: 'Invite administrators, assign and remove roles, deactivate',
  },
] as const satisfies readonly PermissionDefinition[];

export type PermissionKey = (typeof PERMISSIONS)[number]['key'];

const KEYS: ReadonlySet<string> = new Set(PERMISSIONS.map((permission) => permission.key));

export const isPermissionKey = (value: unknown): value is PermissionKey =>
  typeof value === 'string' && KEYS.has(value);

/** The catalog grouped for display (permission matrix rows), in declaration order. */
export function permissionsByGroup(): Array<{
  group: string;
  permissions: ReadonlyArray<PermissionDefinition>;
}> {
  const groups = new Map<string, PermissionDefinition[]>();
  for (const permission of PERMISSIONS) {
    const list = groups.get(permission.group) ?? [];
    list.push(permission);
    groups.set(permission.group, list);
  }
  return [...groups].map(([group, permissions]) => ({ group, permissions }));
}

export interface CatalogDiff {
  /** In code, absent from the database: no role could ever hold it. */
  missingInDatabase: string[];
  /** In the database, absent from code: nothing enforces it. */
  unknownToCode: string[];
}

export function diffCatalog(databaseKeys: Iterable<string>): CatalogDiff {
  const inDatabase = new Set(databaseKeys);
  return {
    missingInDatabase: PERMISSIONS.map((p) => p.key).filter((key) => !inDatabase.has(key)),
    unknownToCode: [...inDatabase].filter((key) => !KEYS.has(key)).sort(),
  };
}
