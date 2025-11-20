-- Sprint 29 · Mission B29.2 rollback — drop communication.message_recipients
BEGIN;
DROP TABLE IF EXISTS communication.message_recipients CASCADE;
COMMIT;
