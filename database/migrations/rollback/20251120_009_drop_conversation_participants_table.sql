-- Sprint 29 · Mission B29.2 rollback — drop communication.conversation_participants
BEGIN;
DROP TABLE IF EXISTS communication.conversation_participants CASCADE;
COMMIT;
