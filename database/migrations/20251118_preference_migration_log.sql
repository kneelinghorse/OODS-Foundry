-- Sprint 27 · Mission B27.3 — Preference Schema Evolution Logging
-- Captures per-user preference migration events so lazy and eager
-- strategies have an auditable source of truth.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE SCHEMA IF NOT EXISTS preferences;

CREATE TABLE IF NOT EXISTS preferences.migration_log (
  entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID,
  strategy TEXT NOT NULL CHECK (strategy IN ('lazy', 'eager')),
  from_version TEXT NOT NULL,
  to_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('started', 'dual_write', 'completed', 'failed', 'rollback')),
  message TEXT,
  change_set JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  applied_by TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS migration_log_user_idx
  ON preferences.migration_log (tenant_id, user_id);

CREATE INDEX IF NOT EXISTS migration_log_status_idx
  ON preferences.migration_log (status);

CREATE INDEX IF NOT EXISTS migration_log_versions_idx
  ON preferences.migration_log (from_version, to_version);

COMMENT ON TABLE preferences.migration_log IS
  'Tracks every preference schema migration, including lazy read-repair and eager dual-write phases.';

COMMENT ON COLUMN preferences.migration_log.change_set IS
  'JSONB array describing {path, from, to} mutations applied to the preference document.';

COMMIT;
