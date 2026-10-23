-- Up Migration
-- A profile photo for every person and a cover photo for every drawer. Both live in `media` (migration 0015); the
-- column only points at the picture, and the picture disappears with the row that owns it.

ALTER TABLE users   ADD COLUMN avatar_media_id uuid REFERENCES media (id) ON DELETE SET NULL;
ALTER TABLE drawers ADD COLUMN photo_media_id  uuid REFERENCES media (id) ON DELETE SET NULL;
