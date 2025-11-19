-- Sprint 28 · Mission B28.5 — Permission cache guardrails
-- Establishes telemetry table mirroring the Preferenceable pattern so cache
-- hit rates, misses, and latency budgets stay observable under <5ms targets.

BEGIN;

CREATE SCHEMA IF NOT EXISTS authz;

CREATE TABLE IF NOT EXISTS authz.permission_cache_metrics (
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cache_key TEXT NOT NULL,
  hit BOOLEAN NOT NULL,
  latency_ms NUMERIC(10,3) NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('cache', 'loader', 'miss')),
  notes JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS permission_cache_metrics_recent_idx
  ON authz.permission_cache_metrics (ts DESC);

CREATE INDEX IF NOT EXISTS permission_cache_metrics_source_idx
  ON authz.permission_cache_metrics (source, hit);

COMMIT;
