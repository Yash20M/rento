-- Up Migration
-- Two-step verification for administrators (P4-05): one authenticator-app (TOTP) secret per user, and single-use
-- recovery codes. The secret is stored encrypted (AES-256-GCM, key from configuration); recovery codes only as hashes.

CREATE TABLE user_mfa_totp (
  user_id        uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  secret_enc     text NOT NULL,
  -- NULL while the person is still setting it up: an unconfirmed secret never counts as protection.
  confirmed_at   timestamptz,
  -- The 30-second step of the last accepted code: a code (or an older one) can never be used twice.
  last_used_step bigint,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_mfa_recovery_codes (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at   timestamptz,
  CONSTRAINT user_mfa_recovery_codes_hash_key UNIQUE (user_id, code_hash)
);
CREATE INDEX user_mfa_recovery_codes_user_idx ON user_mfa_recovery_codes (user_id);

-- When this sign-in session (token family) last proved the second step; carried over on every rotation, so a refresh
-- keeps the protection. NULL = the session never did.
ALTER TABLE refresh_tokens ADD COLUMN mfa_verified_at timestamptz;
