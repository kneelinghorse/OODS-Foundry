-- Sprint 29 · Mission B29.4 — communication.sla_metrics for SLA telemetry

BEGIN;

CREATE TABLE IF NOT EXISTS communication.sla_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type text NOT NULL CHECK (metric_type IN ('time_to_send', 'success_rate', 'retry_exhaustion_rate')),
  channel_type text NOT NULL DEFAULT 'all',
  value numeric(14,3) NOT NULL,
  p50 numeric(14,3) NOT NULL,
  p95 numeric(14,3) NOT NULL,
  p99 numeric(14,3) NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sla_metrics_type_window
  ON communication.sla_metrics (metric_type, window_start DESC);

COMMIT;
