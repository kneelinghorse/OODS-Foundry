-- Sprint 28 · Mission B28.2 — Static SoD trigger enforcement (R28.1)
-- Prevents conflicting role assignments during insert/update on memberships.

BEGIN;

CREATE OR REPLACE FUNCTION authz.prevent_conflicting_roles()
RETURNS TRIGGER AS $$
DECLARE
  conflict_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM authz.memberships m
    JOIN authz.sod_role_conflicts c
      ON (
        (c.role_a_id = NEW.role_id AND c.role_b_id = m.role_id)
        OR (c.role_b_id = NEW.role_id AND c.role_a_id = m.role_id)
      )
    WHERE m.user_id = NEW.user_id
      AND m.organization_id = NEW.organization_id
      AND c.active = true
      AND (c.organization_id IS NULL OR c.organization_id = NEW.organization_id)
  ) INTO conflict_exists;

  IF conflict_exists THEN
    RAISE EXCEPTION 'SoD violation: % already has a conflicting role (%).', NEW.user_id, NEW.organization_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_sod_on_membership ON authz.memberships;
CREATE TRIGGER enforce_sod_on_membership
  BEFORE INSERT OR UPDATE ON authz.memberships
  FOR EACH ROW
  EXECUTE FUNCTION authz.prevent_conflicting_roles();

COMMENT ON FUNCTION authz.prevent_conflicting_roles() IS 'R28.1 Static SoD trigger blocking conflicting role assignments.';

COMMIT;
