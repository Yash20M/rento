-- Up Migration
-- Baseline schema (README §8.2, §9.2). Forward-only: never edit this file once applied anywhere;
-- fix forward with a new numbered migration.
--
-- Conventions: uuid PKs · timestamptz (UTC instants) · money = integer paise (INR) ·
-- enums = text + CHECK · every mutable table has created_at/updated_at (trigger-maintained).

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- GiST over uuid equality alongside range overlap
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;      -- case-insensitive email uniqueness

CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Identity (one table for customers and staff; sign-in methods arrive in P2-01)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             citext UNIQUE,                      -- NULL allowed (e.g. provider gave no email)
  email_verified_at timestamptz,
  phone             text,
  display_name      text,
  status            text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'suspended', 'deleted')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
CREATE TABLE categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text NOT NULL UNIQUE,
  parent_id  uuid REFERENCES categories (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT categories_not_own_parent CHECK (parent_id IS DISTINCT FROM id)
);

CREATE TABLE drawers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  address             text NOT NULL,
  timezone            text NOT NULL,                    -- IANA name; validated by the API (P2-17)
  location            geography(Point, 4326) NOT NULL,  -- ST_MakePoint(lng, lat): longitude first
  status              text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'temporarily_closed', 'inactive')),
  pickup_instructions text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX drawers_location_gist ON drawers USING gist (location);

CREATE TABLE item_models (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id          uuid NOT NULL REFERENCES categories (id),
  name                 text NOT NULL,
  description          text,
  photos               jsonb NOT NULL DEFAULT '[]'::jsonb,
  price_per_slot_paise integer NOT NULL CHECK (price_per_slot_paise >= 0),
  slot_minutes         integer NOT NULL CHECK (slot_minutes > 0),
  min_duration_min     integer NOT NULL CHECK (min_duration_min > 0),
  max_duration_min     integer NOT NULL,
  buffer_min           integer NOT NULL DEFAULT 0 CHECK (buffer_min >= 0),
  deposit_paise        integer NOT NULL DEFAULT 0 CHECK (deposit_paise >= 0),
  status               text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT item_models_duration_range CHECK (max_duration_min >= min_duration_min)
);
CREATE INDEX item_models_category_idx ON item_models (category_id);

CREATE TABLE assets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code    text NOT NULL UNIQUE,                   -- human code, e.g. PS5-001
  item_model_id uuid NOT NULL REFERENCES item_models (id),
  drawer_id     uuid NOT NULL REFERENCES drawers (id),
  serial_no     text,
  status        text NOT NULL DEFAULT 'available'
                  CHECK (status IN ('available', 'maintenance', 'in_transfer', 'retired')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assets_drawer_model_idx ON assets (drawer_id, item_model_id);

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------
CREATE TABLE bookings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users (id),
  asset_id        uuid NOT NULL REFERENCES assets (id),
  drawer_id       uuid NOT NULL REFERENCES drawers (id),
  item_model_id   uuid NOT NULL REFERENCES item_models (id),
  status          text NOT NULL CHECK (status IN
                    ('held', 'confirmed', 'active', 'overdue', 'completed', 'cancelled', 'expired', 'no_show')),
  starts_at       timestamptz NOT NULL,                 -- UTC instants
  ends_at         timestamptz NOT NULL,
  buffer_min      integer NOT NULL DEFAULT 0 CHECK (buffer_min >= 0),
  hold_expires_at timestamptz,
  price_paise     integer NOT NULL CHECK (price_paise >= 0),
  deposit_paise   integer NOT NULL DEFAULT 0 CHECK (deposit_paise >= 0),
  currency        text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  pickup_code_hash text,
  cancelled_by    uuid REFERENCES users (id),
  cancel_reason   text,
  version         integer NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_valid_period CHECK (ends_at > starts_at),
  CONSTRAINT bookings_held_has_expiry CHECK (status <> 'held' OR hold_expires_at IS NOT NULL)
);
CREATE INDEX bookings_user_created_idx ON bookings (user_id, created_at DESC);
CREATE INDEX bookings_asset_starts_idx ON bookings (asset_id, starts_at);
CREATE INDEX bookings_drawer_starts_idx ON bookings (drawer_id, starts_at);
CREATE INDEX bookings_held_expiry_idx ON bookings (hold_expires_at) WHERE status = 'held';

-- ---------------------------------------------------------------------------
-- The conflict ledger: every reason an asset is unavailable lives here (README §8.3, §9).
-- `during` is stored as [start, end + buffer) in UTC; computed by the application.
-- ---------------------------------------------------------------------------
CREATE TABLE asset_occupancies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id    uuid NOT NULL REFERENCES assets (id),
  kind        text NOT NULL CHECK (kind IN ('booking', 'maintenance', 'transfer', 'admin_block')),
  booking_id  uuid REFERENCES bookings (id),
  during      tstzrange NOT NULL,
  released_at timestamptz,                              -- NULL = still blocking
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT occupancy_bounded
    CHECK (NOT isempty(during) AND NOT lower_inf(during) AND NOT upper_inf(during)),
  -- Half-open [start, end): back-to-back bookings must not collide.
  CONSTRAINT occupancy_half_open
    CHECK (lower_inc(during) AND NOT upper_inc(during)),
  CONSTRAINT occupancy_booking_link
    CHECK ((kind = 'booking') = (booking_id IS NOT NULL)),

  -- THE GUARANTEE: no two un-released rows for the same asset may overlap.
  CONSTRAINT no_overlapping_occupancy
    EXCLUDE USING gist (asset_id WITH =, during WITH &&)
    WHERE (released_at IS NULL)
);

-- A booking holds at most one live occupancy (reassign releases the old row first).
CREATE UNIQUE INDEX asset_occupancies_one_active_per_booking
  ON asset_occupancies (booking_id)
  WHERE booking_id IS NOT NULL AND released_at IS NULL;
CREATE INDEX asset_occupancies_booking_idx ON asset_occupancies (booking_id) WHERE booking_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER categories_set_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER drawers_set_updated_at BEFORE UPDATE ON drawers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER item_models_set_updated_at BEFORE UPDATE ON item_models
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER assets_set_updated_at BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER bookings_set_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
