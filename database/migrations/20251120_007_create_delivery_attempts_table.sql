-- Sprint 29 · Mission B29.2 — communication.delivery_attempts state tracking
-- Captures retries, scheduling, and lifecycle metrics per delivery attempt.

BEGIN;

CREATE TABLE IF NOT EXISTS communication.delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES communication.messages(id) ON DELETE CASCADE,
  channel_type text NOT NULL CHECK (channel_type IN ('email', 'sms', 'push', 'in_app', 'webhook')),
  status text NOT NULL CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'retried')),
  attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number > 0),
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE communication.delivery_attempts IS 'Per-attempt delivery status + retry metadata (R20.1 Part 3).';

CREATE INDEX IF NOT EXISTS idx_delivery_message ON communication.delivery_attempts (message_id, attempt_number);
CREATE INDEX IF NOT EXISTS idx_delivery_status_scheduled ON communication.delivery_attempts (status, scheduled_at);

COMMIT;
