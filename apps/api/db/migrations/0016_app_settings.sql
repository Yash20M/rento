-- Up Migration
-- Operator-editable platform settings (README §10.3). One row per group, JSON value validated by the API on write.
-- Rows are absent until an administrator changes something: the environment values apply until then.

CREATE TABLE app_settings (
  key        text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_.]*$'),
  value      jsonb       NOT NULL,
  updated_by uuid REFERENCES users (id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
