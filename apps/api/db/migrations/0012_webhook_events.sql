-- Up Migration
-- Payment-gateway webhooks are delivered at least once, so every event is recorded by its gateway-assigned id and
-- processed only the first time (README §9.5).

CREATE TABLE webhook_events (
  provider     text        NOT NULL,
  event_id     text        NOT NULL,
  event_type   text        NOT NULL,
  outcome      text        NOT NULL DEFAULT 'received' CHECK (outcome IN ('received', 'applied', 'ignored')),
  note         text,
  received_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, event_id)
);
