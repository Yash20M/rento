-- Runs once, on a fresh data volume only (docker-entrypoint-initdb.d semantics).
-- Required by README §9.2: exclusion constraint on (asset_id =, during &&) needs btree_gist.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
