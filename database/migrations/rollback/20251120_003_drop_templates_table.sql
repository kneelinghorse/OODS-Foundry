-- Sprint 29 · Mission B29.2 rollback — drop communication.templates
BEGIN;
DROP TABLE IF EXISTS communication.templates CASCADE;
COMMIT;
