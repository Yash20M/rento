-- Up Migration
-- Sign-in methods and refresh-token sessions (README §8.2, §15; ADR-012).

-- One row per sign-in method. For `password`, provider_subject is the user's own id; social providers
-- (P2-03…06) store the provider's stable subject. A provider account can belong to only one user.
CREATE TABLE user_identities (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES users (id),
  provider                text NOT NULL CHECK (provider IN ('password', 'google', 'facebook', 'apple')),
  provider_subject        text NOT NULL,
  password_hash           text,                          -- argon2id PHC string, only for provider = 'password'
  provider_email          citext,
  provider_email_verified boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT user_identities_provider_subject_key UNIQUE (provider, provider_subject),
  CONSTRAINT user_identities_user_provider_key UNIQUE (user_id, provider),
  CONSTRAINT identity_password_hash_only_for_password
    CHECK ((provider = 'password') = (password_hash IS NOT NULL))
);
CREATE INDEX user_identities_user_idx ON user_identities (user_id);

-- Opaque rotating refresh tokens. Only the SHA-256 of the token is stored. Tokens of one login share a
-- family_id; reuse of a rotated token revokes the whole family (theft detection). family_expires_at is the
-- absolute lifetime of the family and is never extended by rotation.
CREATE TABLE refresh_tokens (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users (id),
  family_id         uuid NOT NULL,
  token_hash        text NOT NULL,
  expires_at        timestamptz NOT NULL,
  family_expires_at timestamptz NOT NULL,
  revoked_at        timestamptz,
  replaced_by       uuid REFERENCES refresh_tokens (id),
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash),
  CONSTRAINT refresh_tokens_expiry_within_family CHECK (expires_at <= family_expires_at)
);
CREATE INDEX refresh_tokens_family_idx ON refresh_tokens (family_id);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);
