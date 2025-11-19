-- Sprint 28 · Mission B28.2 — authz.permissions DDL (R21.2 TABLE 2)
-- Permission names follow 'resource:action' notation for deterministic joins.

BEGIN;

CREATE TABLE IF NOT EXISTS authz.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  resource_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT permissions_name_unique UNIQUE (name),
  CONSTRAINT permissions_name_format CHECK (position(':' in name) > 0)
);

COMMENT ON TABLE authz.permissions IS 'Atomic RBAC permissions. Naming convention resource:action per R21.2 TABLE 2.';
COMMENT ON COLUMN authz.permissions.resource_type IS 'Optional grouping for UI facets (document, user, org, etc.).';

COMMIT;
