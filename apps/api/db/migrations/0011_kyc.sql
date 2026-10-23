-- Up Migration
-- Identity verification (Aadhaar), owner decision 2026-10-18 (README Q-11). PRIVACY: the full Aadhaar number is never
-- stored. We keep the last four digits (to show "XXXX XXXX 1234") and a keyed HMAC of the number, so that one card
-- cannot verify several accounts without the number being recoverable from the database.

CREATE TABLE user_kyc (
  user_id        uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  status         text        NOT NULL CHECK (status IN ('verified', 'rejected')),
  method         text        NOT NULL CHECK (method IN ('aadhaar_otp', 'manual')),
  aadhaar_last4  text        CHECK (aadhaar_last4 ~ '^[0-9]{4}$'),
  aadhaar_hash   text,
  verified_name  text,
  provider       text,
  provider_ref   text,
  decided_by     uuid REFERENCES users (id),          -- staff member for manual decisions
  reason         text,
  verified_at    timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_kyc_verified_has_time CHECK (status <> 'verified' OR verified_at IS NOT NULL)
);
-- One verified account per card.
CREATE UNIQUE INDEX user_kyc_aadhaar_unique ON user_kyc (aadhaar_hash)
  WHERE status = 'verified' AND aadhaar_hash IS NOT NULL;

-- An OTP verification in progress. `aadhaar_hash` only (never the number).
CREATE TABLE kyc_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  aadhaar_hash  text        NOT NULL,
  aadhaar_last4 text        NOT NULL CHECK (aadhaar_last4 ~ '^[0-9]{4}$'),
  provider      text        NOT NULL,
  provider_ref  text        NOT NULL,
  otp_attempts  integer     NOT NULL DEFAULT 0,
  expires_at    timestamptz NOT NULL,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kyc_requests_user_idx ON kyc_requests (user_id, created_at DESC);

CREATE TRIGGER user_kyc_set_updated_at BEFORE UPDATE ON user_kyc
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
