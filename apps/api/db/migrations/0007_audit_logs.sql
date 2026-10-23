-- Up Migration
-- Append-only audit trail (README §8.2, §15, BR-13): who did what, to which thing, before/after, why, from where.
-- Written in the SAME transaction as the change it records, so a rolled-back change leaves no audit row.

CREATE TABLE audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES users (id),        -- NULL = the system or the operator CLI
  action      text NOT NULL,                      -- 'role.updated', 'admin.roles_set', …
  entity_type text NOT NULL,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  reason      text,
  ip          text,
  at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT audit_logs_action_format CHECK (action ~ '^[a-z_]+\.[a-z_]+$'),
  CONSTRAINT audit_logs_reason_length CHECK (reason IS NULL OR char_length(reason) <= 1000)
);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id, at DESC);
CREATE INDEX audit_logs_actor_idx ON audit_logs (actor_id, at DESC);
CREATE INDEX audit_logs_at_idx ON audit_logs (at DESC);

-- Append-only for EVERY database role, the application's included: rows can neither be changed nor removed.
CREATE FUNCTION audit_logs_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only' USING ERRCODE = '23000';
END;
$$;
CREATE TRIGGER audit_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();
CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_append_only();
