-- Sprint 29 · Mission B29.2 rollback — drop communication.delivery_policies
BEGIN;
DROP TABLE IF EXISTS communication.delivery_policies CASCADE;
COMMIT;
