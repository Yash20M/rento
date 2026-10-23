-- Up Migration
-- Asset transfers between drawers (README §9.9) and booking reminders.

CREATE TABLE asset_transfers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id       uuid        NOT NULL REFERENCES assets (id),
  from_drawer_id uuid        NOT NULL REFERENCES drawers (id),
  to_drawer_id   uuid        NOT NULL REFERENCES drawers (id),
  status         text        NOT NULL DEFAULT 'in_transit'
                   CHECK (status IN ('in_transit', 'completed', 'cancelled')),
  reason         text        NOT NULL,
  started_by     uuid REFERENCES users (id),
  finished_by    uuid REFERENCES users (id),
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  CONSTRAINT asset_transfers_different_drawers CHECK (from_drawer_id <> to_drawer_id)
);
-- An asset is in at most one transfer at a time.
CREATE UNIQUE INDEX asset_transfers_one_open ON asset_transfers (asset_id) WHERE status = 'in_transit';

ALTER TABLE bookings ADD COLUMN reminder_sent_at timestamptz;
