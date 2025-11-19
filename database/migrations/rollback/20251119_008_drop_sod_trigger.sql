-- Sprint 28 · Mission B28.2 rollback — Remove SoD trigger + function

BEGIN;

DROP TRIGGER IF EXISTS enforce_sod_on_membership ON authz.memberships;
DROP FUNCTION IF EXISTS authz.prevent_conflicting_roles();

COMMIT;
