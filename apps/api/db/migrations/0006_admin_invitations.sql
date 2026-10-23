-- Up Migration
-- Admin invitations (README §13.5): an email, the role(s) to grant (optionally drawer-scoped), a single-use expiring
-- token (only its SHA-256 is stored). Accepting creates the account and the user_roles rows.

CREATE TABLE admin_invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       citext NOT NULL,
  token_hash  text NOT NULL,
  invited_by  uuid NOT NULL REFERENCES users (id),
  expires_at  timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES users (id),
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT admin_invitations_token_hash_key UNIQUE (token_hash),
  CONSTRAINT admin_invitations_accepted_xor_revoked CHECK (accepted_at IS NULL OR revoked_at IS NULL)
);
-- At most one OPEN invitation per address: re-inviting supersedes the older one (done in a transaction by the API).
CREATE UNIQUE INDEX admin_invitations_open_email_key
  ON admin_invitations (email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- Deleting a role drops it from historic invitations; the API refuses to delete a role that an OPEN invitation uses.
CREATE TABLE admin_invitation_roles (
  invitation_id uuid NOT NULL REFERENCES admin_invitations (id) ON DELETE CASCADE,
  role_id       uuid NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  drawer_id     uuid REFERENCES drawers (id)
);
CREATE UNIQUE INDEX admin_invitation_roles_key
  ON admin_invitation_roles (invitation_id, role_id, COALESCE(drawer_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX admin_invitation_roles_role_idx ON admin_invitation_roles (role_id);
