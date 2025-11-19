-- Sprint 28 · Mission B28.2 rollback — Drop authz schema

BEGIN;

DROP SCHEMA IF EXISTS authz CASCADE;

COMMIT;
