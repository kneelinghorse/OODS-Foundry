-- Sprint 29 · Mission B29.2 rollback — drop communication.channels
BEGIN;
DROP TABLE IF EXISTS communication.channels CASCADE;
COMMIT;
