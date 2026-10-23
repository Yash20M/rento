-- Up Migration
-- Booking engine support tables (README §8.2, §9.4–§9.8): idempotency, booking history, transactional outbox,
-- payments and refunds. Forward-only; the booking/occupancy tables themselves are in 0001.

-- ---------------------------------------------------------------------------
-- Idempotency (README §9.6): one row per (user, Idempotency-Key). `response_status` NULL = still running.
-- ---------------------------------------------------------------------------
CREATE TABLE idempotency_keys (
  user_id         uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  key             text        NOT NULL,
  request_hash    text        NOT NULL,
  response_status integer,
  response_body   jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  PRIMARY KEY (user_id, key),
  CONSTRAINT idempotency_keys_key_length CHECK (char_length(key) BETWEEN 8 AND 128),
  CONSTRAINT idempotency_keys_complete_together
    CHECK ((response_status IS NULL) = (completed_at IS NULL))
);
CREATE INDEX idempotency_keys_created_idx ON idempotency_keys (created_at);

-- ---------------------------------------------------------------------------
-- Booking history: append-only, for every database role.
-- ---------------------------------------------------------------------------
CREATE TABLE booking_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    uuid        NOT NULL REFERENCES bookings (id),
  from_status   text,
  to_status     text        NOT NULL,
  actor_user_id uuid REFERENCES users (id),     -- NULL = the system (sweeper, payment confirmation)
  note          text,
  meta          jsonb,
  at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_events_to_status CHECK (to_status IN
    ('held', 'confirmed', 'active', 'overdue', 'completed', 'cancelled', 'expired', 'no_show'))
);
CREATE INDEX booking_events_booking_idx ON booking_events (booking_id, at);

CREATE FUNCTION booking_events_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'booking_events is append-only' USING ERRCODE = '23000';
END;
$$;
CREATE TRIGGER booking_events_no_update_delete
  BEFORE UPDATE OR DELETE ON booking_events
  FOR EACH ROW EXECUTE FUNCTION booking_events_append_only();
CREATE TRIGGER booking_events_no_truncate
  BEFORE TRUNCATE ON booking_events
  FOR EACH STATEMENT EXECUTE FUNCTION booking_events_append_only();

-- ---------------------------------------------------------------------------
-- Transactional outbox (README §12.3): written in the same transaction as the change; a runner delivers it.
-- ---------------------------------------------------------------------------
CREATE TABLE outbox_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type         text        NOT NULL,             -- 'booking.held', 'booking.confirmed', …
  payload      jsonb       NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  available_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempts     integer     NOT NULL DEFAULT 0,
  last_error   text,
  CONSTRAINT outbox_events_type_format CHECK (type ~ '^[a-z_]+\.[a-z_]+$')
);
CREATE INDEX outbox_events_pending_idx ON outbox_events (available_at) WHERE processed_at IS NULL;

-- ---------------------------------------------------------------------------
-- Payments and refunds (README §9.5, §9.8). Amounts in integer paise.
-- ---------------------------------------------------------------------------
CREATE TABLE payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id          uuid        NOT NULL REFERENCES bookings (id),
  provider            text        NOT NULL,
  provider_order_id   text        NOT NULL,
  provider_payment_id text,
  amount_paise        integer     NOT NULL CHECK (amount_paise >= 0),
  currency            text        NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  status              text        NOT NULL DEFAULT 'created'
                        CHECK (status IN ('created', 'captured', 'failed', 'refunded')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_order_unique UNIQUE (provider, provider_order_id)
);
CREATE INDEX payments_booking_idx ON payments (booking_id);
-- A booking has at most one payment that is not failed.
CREATE UNIQUE INDEX payments_one_open_per_booking
  ON payments (booking_id) WHERE status IN ('created', 'captured');

CREATE TABLE refunds (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id         uuid        NOT NULL REFERENCES bookings (id),
  payment_id         uuid        NOT NULL REFERENCES payments (id),
  amount_paise       integer     NOT NULL CHECK (amount_paise >= 0),
  status             text        NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'processed', 'failed')),
  provider_refund_id text,
  reason             text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refunds_booking_idx ON refunds (booking_id);
-- One refund per booking: cancelling twice must never refund twice.
CREATE UNIQUE INDEX refunds_one_per_booking ON refunds (booking_id);

CREATE TRIGGER payments_set_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER refunds_set_updated_at BEFORE UPDATE ON refunds
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
