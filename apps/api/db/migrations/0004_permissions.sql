-- Up Migration
-- The fixed permission catalog (README §13.5, ADR-013). Permissions are defined in code
-- (apps/api/src/modules/access-control/domain/permissions.ts); this table mirrors them so that
-- role_permissions (P2-09) can reference a key by foreign key. A startup check and a CI test fail if the two drift.
-- Future permissions are added by NEW migrations; never edit this one.

CREATE TABLE permissions (
  key         text PRIMARY KEY,
  group_name  text NOT NULL,
  description text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT permissions_key_format CHECK (key ~ '^[a-z_]+:[a-z_]+$'),
  CONSTRAINT permissions_group_not_blank CHECK (btrim(group_name) <> ''),
  CONSTRAINT permissions_description_not_blank CHECK (btrim(description) <> '')
);

INSERT INTO permissions (key, group_name, description) VALUES
  ('inventory:read',  'Inventory',       'View inventory models and categories'),
  ('inventory:write', 'Inventory',       'Create and edit inventory models and categories'),
  ('assets:read',     'Assets',          'View physical assets'),
  ('assets:write',    'Assets',          'Create and edit physical assets'),
  ('assets:transfer', 'Assets',          'Move assets between drawers'),
  ('drawers:read',    'Drawers',         'View drawers, hours and closures'),
  ('drawers:write',   'Drawers',         'Create and edit drawers, hours and closures'),
  ('bookings:read',   'Bookings',        'View bookings'),
  ('bookings:write',  'Bookings',        'Change bookings (for example reassign an asset)'),
  ('bookings:cancel', 'Bookings',        'Cancel bookings'),
  ('bookings:refund', 'Bookings',        'Override refund amounts'),
  ('users:read',      'Customers',       'View customer accounts'),
  ('users:write',     'Customers',       'Suspend and unsuspend customer accounts'),
  ('reports:read',    'Reports & audit', 'View reports'),
  ('audit:read',      'Reports & audit', 'View the audit log'),
  ('settings:read',   'Settings',        'View platform settings'),
  ('settings:write',  'Settings',        'Change platform settings'),
  ('roles:read',      'Access control',  'View roles and their permissions'),
  ('roles:manage',    'Access control',  'Create, edit and delete roles'),
  ('admins:read',     'Access control',  'View administrators and their roles'),
  ('admins:manage',   'Access control',  'Invite administrators, assign and remove roles, deactivate');
