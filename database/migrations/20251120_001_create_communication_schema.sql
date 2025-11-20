-- Sprint 29 · Mission B29.2 — Establish communication schema + migration ledger
-- Positions communication tables in a dedicated schema and persists migration history.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS communication;
COMMENT ON SCHEMA communication IS 'Multi-channel messaging and notification system (Sprint 29).';

CREATE TABLE IF NOT EXISTS communication.schema_migrations (
  filename text PRIMARY KEY,
  checksum text,
  applied_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE communication.schema_migrations IS 'Tracks applied communication migrations (filename + checksum).';
COMMENT ON COLUMN communication.schema_migrations.filename IS 'Migration file name (e.g., 20251120_001_create_communication_schema.sql).';

COMMIT;
