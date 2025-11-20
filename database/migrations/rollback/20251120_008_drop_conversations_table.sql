-- Sprint 29 · Mission B29.2 rollback — drop communication.conversations
BEGIN;
DROP TABLE IF EXISTS communication.conversations CASCADE;
COMMIT;
