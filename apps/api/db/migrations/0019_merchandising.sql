-- Up Migration
-- M29 — merchandising: offers (a percentage off the slot price, optionally for a window), a "featured" switch, the
-- savings kept on each booking, and banners ("promotions") that staff schedule for the customer app's home screen.

-- An offer is a percent plus an optional half-open window [starts, ends). Without a percent there is no offer, and dates
-- without a percent would silently do nothing, so the table refuses them.
ALTER TABLE item_models
  ADD COLUMN discount_percent   smallint    CHECK (discount_percent BETWEEN 1 AND 90),
  ADD COLUMN discount_starts_at timestamptz,
  ADD COLUMN discount_ends_at   timestamptz,
  ADD COLUMN featured           boolean     NOT NULL DEFAULT false,
  ADD CONSTRAINT item_models_offer_needs_percent
    CHECK (discount_percent IS NOT NULL OR (discount_starts_at IS NULL AND discount_ends_at IS NULL)),
  ADD CONSTRAINT item_models_offer_window_order
    CHECK (discount_starts_at IS NULL OR discount_ends_at IS NULL OR discount_ends_at > discount_starts_at);

-- What the customer saved, in paise: list price − price charged. `price_paise` stays the amount charged, so refunds and
-- reports keep working whatever happens to the offer afterwards.
ALTER TABLE bookings
  ADD COLUMN discount_paise integer NOT NULL DEFAULT 0 CHECK (discount_paise >= 0);

CREATE TABLE promotions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  subtitle      text        CHECK (subtitle IS NULL OR char_length(subtitle) BETWEEN 1 AND 160),
  cta_label     text        CHECK (cta_label IS NULL OR char_length(cta_label) BETWEEN 1 AND 30),
  theme         text        NOT NULL DEFAULT 'orange' CHECK (theme IN ('orange', 'ink', 'teal', 'plum')),
  image_media_id uuid       REFERENCES media (id) ON DELETE SET NULL,
  item_model_id uuid        REFERENCES item_models (id) ON DELETE SET NULL,
  starts_at     timestamptz,
  ends_at       timestamptz,
  active        boolean     NOT NULL DEFAULT true,
  sort_order    integer     NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 10000),
  created_by    uuid        REFERENCES users (id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promotions_window_order CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX promotions_shown_idx ON promotions (active, sort_order, created_at);
