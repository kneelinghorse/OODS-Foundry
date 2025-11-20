-- Sprint 29 · Mission B29.2 rollback — drop communication schema + ledger
BEGIN;
DROP TABLE IF EXISTS communication.schema_migrations;
DROP SCHEMA IF EXISTS communication CASCADE;
COMMIT;
