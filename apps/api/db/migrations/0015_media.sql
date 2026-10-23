-- Up Migration
-- Product photos uploaded by staff (item models). Stored in the database (so backups cover them and no extra service is
-- needed for the MVP); `MediaStore` hides that, so moving to object storage later changes one class.

CREATE TABLE media (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text        NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  byte_size    integer     NOT NULL CHECK (byte_size > 0 AND byte_size <= 5242880),
  sha256       text        NOT NULL,
  data         bytea       NOT NULL,
  uploaded_by  uuid REFERENCES users (id),
  created_at   timestamptz NOT NULL DEFAULT now()
);
