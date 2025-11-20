-- Sprint 29 · Mission B29.2 rollback — drop communication.messages
BEGIN;
DROP TABLE IF EXISTS communication.messages CASCADE;
COMMIT;
