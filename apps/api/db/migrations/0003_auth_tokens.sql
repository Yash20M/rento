-- Up Migration
-- Single-use, expiring tokens for email verification and password reset (README §14.3, §15; ADR-012).
-- Only the SHA-256 of the token is stored; the raw value exists only in the emailed link.

CREATE TABLE auth_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id),
  purpose    text NOT NULL CHECK (purpose IN ('email_verification', 'password_reset')),
  token_hash text NOT NULL,
  -- The address the token was mailed to. A token is only honoured while it still equals the user's current
  -- email, so changing the address invalidates outstanding links.
  email      citext NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,      -- consumed (single use)
  revoked_at timestamptz,      -- superseded by a newer token of the same purpose
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT auth_tokens_token_hash_key UNIQUE (token_hash),
  CONSTRAINT auth_tokens_used_xor_revoked CHECK (used_at IS NULL OR revoked_at IS NULL)
);
CREATE INDEX auth_tokens_user_purpose_idx ON auth_tokens (user_id, purpose, created_at DESC);
