-- Sprint 29 · Mission B29.2 rollback — drop communication.delivery_attempts
BEGIN;
DROP TABLE IF EXISTS communication.delivery_attempts CASCADE;
COMMIT;
