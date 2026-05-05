-- 008_scoring_config.sql
-- Configurable weights for the priority score (RN-04, HU-08 CA5). Stored as
-- a flat key/value table so #20 (GET/PUT /scoring-config) can edit weights
-- without a migration. fn_priority_score reads from this table on every
-- recalculation, so changes propagate immediately to every recompute call.
--
-- Weights are seeded with the defaults documented in PLAN.md §Prioritization.
-- The seed runs in this migration (rather than db/seeds/) so the values exist
-- the first time fn_priority_score executes — without them, the function
-- would COALESCE to 0 and produce a meaningless score.

CREATE TABLE scoring_config (
    key        TEXT PRIMARY KEY,
    value      DOUBLE PRECISION NOT NULL,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial weights. ON CONFLICT keeps the migration idempotent across
-- environments where the row already exists (e.g. dev DBs touched manually).
INSERT INTO scoring_config (key, value) VALUES
    ('W_MEMBERS',      2),
    ('W_CHILDREN_5',   5),
    ('W_ADULTS_65',    4),
    ('W_PREGNANT',     5),
    ('W_DISABLED',     4),
    ('W_ZONE_RISK',    3),
    ('W_DAYS_NO_AID',  1.5),
    ('W_DELIVERIES',   2),
    ('MAX_DAYS',      30)
ON CONFLICT (key) DO NOTHING;
