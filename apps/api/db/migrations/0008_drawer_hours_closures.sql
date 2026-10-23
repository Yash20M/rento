-- Up Migration
-- When a drawer is open (README §8.2, §10). Times are LOCAL to the drawer's IANA timezone (drawers.timezone); the
-- application converts them to UTC instants. One opening window per weekday; overnight windows are not supported
-- (README Q-7 default: a booking must fit inside one day's hours).

CREATE TABLE drawer_hours (
  drawer_id uuid NOT NULL REFERENCES drawers (id) ON DELETE CASCADE,
  weekday   smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),  -- ISO: 1 = Monday … 7 = Sunday
  opens_at  time NOT NULL,
  closes_at time NOT NULL,
  PRIMARY KEY (drawer_id, weekday),
  CONSTRAINT drawer_hours_opens_before_closes CHECK (opens_at < closes_at)
);

-- Closed periods (holiday, repair). Half-open [from, to) in UTC; two closures of one drawer can never overlap.
CREATE TABLE drawer_closures (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drawer_id  uuid NOT NULL REFERENCES drawers (id) ON DELETE CASCADE,
  during     tstzrange NOT NULL,
  reason     text,
  created_by uuid REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT drawer_closures_finite CHECK (NOT isempty(during) AND NOT lower_inf(during) AND NOT upper_inf(during)),
  CONSTRAINT drawer_closures_reason_length CHECK (reason IS NULL OR char_length(reason) <= 500),
  CONSTRAINT drawer_closures_no_overlap EXCLUDE USING gist (drawer_id WITH =, during WITH &&)
);
CREATE INDEX drawer_closures_drawer_idx ON drawer_closures USING gist (drawer_id, during);
