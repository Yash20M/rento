-- Up Migration
-- Maintenance / admin blocks (README §9.9) carry who created them and why.

ALTER TABLE asset_occupancies
  ADD COLUMN reason     text,
  ADD COLUMN created_by uuid REFERENCES users (id);

-- Blocks are listed per asset; only live ones matter.
CREATE INDEX asset_occupancies_blocks_idx ON asset_occupancies (asset_id)
  WHERE kind <> 'booking' AND released_at IS NULL;
