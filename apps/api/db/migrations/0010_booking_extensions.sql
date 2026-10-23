-- Up Migration
-- Extending a running rental (README §9.8): the extra time is paid by its own order and only applied when that payment
-- is verified; the exclusion constraint decides whether the unit is still free for the extra time.

CREATE TABLE booking_extensions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        uuid        NOT NULL REFERENCES bookings (id),
  extra_minutes     integer     NOT NULL CHECK (extra_minutes > 0),
  extra_price_paise integer     NOT NULL CHECK (extra_price_paise >= 0),
  status            text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  applied_at        timestamptz
);
CREATE INDEX booking_extensions_booking_idx ON booking_extensions (booking_id);

ALTER TABLE payments ADD COLUMN extension_id uuid REFERENCES booking_extensions (id);

-- The rental's own payment keeps its "one open payment" rule; each extension has at most one open payment of its own.
DROP INDEX payments_one_open_per_booking;
CREATE UNIQUE INDEX payments_one_open_per_booking
  ON payments (booking_id) WHERE extension_id IS NULL AND status IN ('created', 'captured');
CREATE UNIQUE INDEX payments_one_open_per_extension
  ON payments (extension_id) WHERE extension_id IS NOT NULL AND status IN ('created', 'captured');
