-- Up Migration
-- Roles, their permissions and role assignments (README §13.5, ADR-013).
-- Permissions are CODE (0004_permissions); roles are DATA. The Super Admin role is a locked system role that holds every
-- permission implicitly (including future ones), so it has no role_permissions rows.

CREATE TABLE roles (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  description    text,
  is_system      boolean NOT NULL DEFAULT false,
  is_super_admin boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT roles_name_format CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT roles_description_length CHECK (description IS NULL OR char_length(description) <= 500),
  CONSTRAINT roles_super_admin_is_system CHECK (NOT is_super_admin OR is_system)
);
-- Names are unique ignoring case ("Support Agent" = "support agent").
CREATE UNIQUE INDEX roles_name_lower_key ON roles (lower(name));
-- There is exactly one Super Admin role.
CREATE UNIQUE INDEX roles_single_super_admin ON roles (is_super_admin) WHERE is_super_admin;

CREATE TABLE role_permissions (
  role_id        uuid NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES permissions (key),
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_key)
);
CREATE INDEX role_permissions_permission_idx ON role_permissions (permission_key);

-- Who holds which role, optionally limited to one drawer (NULL = all drawers). The assignment API, invitations and
-- the anti-escalation rules are P2-11 / P2-13. ON DELETE RESTRICT is the database guard behind "an assigned role
-- cannot be deleted" (409 ROLE_IN_USE).
CREATE TABLE user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id),
  role_id    uuid NOT NULL REFERENCES roles (id) ON DELETE RESTRICT,
  drawer_id  uuid REFERENCES drawers (id),
  granted_by uuid REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX user_roles_user_role_scope_key
  ON user_roles (user_id, role_id, COALESCE(drawer_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX user_roles_role_idx ON user_roles (role_id);
CREATE INDEX user_roles_user_idx ON user_roles (user_id);

-- System roles are locked at the database level, whatever the application does.
CREATE FUNCTION roles_protect_system() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'system roles cannot be modified or deleted' USING ERRCODE = '23000';
END;
$$;
CREATE TRIGGER roles_lock_system
  BEFORE UPDATE OR DELETE ON roles
  FOR EACH ROW WHEN (OLD.is_system)
  EXECUTE FUNCTION roles_protect_system();

-- The Super Admin implicitly holds everything; explicit rows would be misleading and go stale.
CREATE FUNCTION role_permissions_forbid_super_admin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM roles WHERE id = NEW.role_id AND is_super_admin) THEN
    RAISE EXCEPTION 'the Super Admin role holds every permission implicitly' USING ERRCODE = '23000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER role_permissions_no_super_admin
  BEFORE INSERT OR UPDATE ON role_permissions
  FOR EACH ROW EXECUTE FUNCTION role_permissions_forbid_super_admin();

INSERT INTO roles (name, description, is_system, is_super_admin)
VALUES ('Super Admin', 'Full access to everything, including permissions added in future releases', true, true);
