-- Sprint 28 · Mission B28.2 — authz.roles DDL (R21.2 TABLE 1)
-- Roles are global in v1.0. org-specific overrides land in a later release.

BEGIN;

CREATE TABLE IF NOT EXISTS authz.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT roles_name_unique UNIQUE (name),
  CONSTRAINT roles_name_not_empty CHECK (length(btrim(name)) > 0)
);

COMMENT ON TABLE authz.roles IS 'Canonical RBAC roles (R21.2 TABLE 1). v1.0 roles are global across tenants.';
COMMENT ON COLUMN authz.roles.name IS 'Human-readable slug. Remains global to simplify SoD tables.';

COMMIT;
