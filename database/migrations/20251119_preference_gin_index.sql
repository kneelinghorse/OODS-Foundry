-- Sprint 27 · Mission B27.6 — Preference Performance Optimization
-- Establishes the jsonb_path_ops GIN index mandated by research mission R21.5
-- so cache-miss queries stay under the <10ms p95 budget.

BEGIN;

CREATE SCHEMA IF NOT EXISTS preferences;

DO $$
DECLARE
  table_exists BOOLEAN;
  index_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'preferences'
       AND table_name = 'user_preferences'
  ) INTO table_exists;

  IF NOT table_exists THEN
    RAISE NOTICE 'preferences.user_preferences does not exist yet. Skipping GIN index install.';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'preferences'
       AND indexname = 'user_preferences_data_path_ops_idx'
  ) INTO index_exists;

  IF NOT index_exists THEN
    EXECUTE 'CREATE INDEX user_preferences_data_path_ops_idx
               ON preferences.user_preferences
               USING GIN (data jsonb_path_ops)';
    EXECUTE $$COMMENT ON INDEX user_preferences_data_path_ops_idx IS
      'GIN index tuned for jsonb_path_ops so notification fan-out queries can rely on data @> payload containment checks.'$$;
  END IF;
END
$$;

-- Surface cache pressure via simple telemetry counters.
CREATE TABLE IF NOT EXISTS preferences.preference_cache_metrics (
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id UUID,
  user_id UUID,
  cache_hit BOOLEAN NOT NULL,
  latency_ms NUMERIC(10,3) NOT NULL,
  path TEXT,
  notes JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS preference_cache_metrics_recent_idx
  ON preferences.preference_cache_metrics (recorded_at DESC);

COMMIT;
