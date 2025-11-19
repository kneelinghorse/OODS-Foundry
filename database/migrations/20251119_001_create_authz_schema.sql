-- Sprint 28 · Mission B28.2 — Authorization Extension Pack schema bootstrap
-- Establishes the dedicated authz schema namespace plus pgcrypto for UUID
-- generation. All downstream migrations assume authz schema exists.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE SCHEMA IF NOT EXISTS authz;
COMMENT ON SCHEMA authz IS 'Authorization Extension Pack (RBAC) - Sprint 28, derived from R21.2 core model.';

COMMIT;
