-- Compliance Core (Sprint 17 B17.1)
-- Canonical RBAC schema + immutable audit log pipeline
-- Aligns with research references:
--   * OODS Direction Check for Sprint 17 (RBAC + Audit as converged core)
--   * Convergent Gravity & Divergent Forces — Architectural Analysis (RBAC meta-model)
--   * Security & Governance research (agent + CI enforcement)

BEGIN;

-- Ensure pgcrypto for UUID generation (PostgreSQL)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS compliance;

-- Roles -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compliance.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  parent_role_id UUID NULL REFERENCES compliance.roles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS roles_parent_idx
  ON compliance.roles(parent_role_id);

-- Permissions -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compliance.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  constraints JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(resource, action)
);

CREATE INDEX IF NOT EXISTS permissions_resource_action_idx
  ON compliance.permissions(resource, action);

-- Role ↔ Permission mapping ---------------------------------------------------
CREATE TABLE IF NOT EXISTS compliance.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES compliance.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES compliance.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS role_permissions_role_idx
  ON compliance.role_permissions(role_id);

CREATE INDEX IF NOT EXISTS role_permissions_permission_idx
  ON compliance.role_permissions(permission_id);

-- User ↔ Role assignments -----------------------------------------------------
CREATE TABLE IF NOT EXISTS compliance.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES compliance.roles(id) ON DELETE CASCADE,
  tenant_id TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by TEXT NOT NULL,
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS user_roles_user_idx
  ON compliance.user_roles(user_id);

CREATE INDEX IF NOT EXISTS user_roles_tenant_idx
  ON compliance.user_roles(tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_unique_assignment_idx
  ON compliance.user_roles(user_id, role_id, COALESCE(tenant_id, '__global__'));

-- Optional role hierarchy table ----------------------------------------------
CREATE TABLE IF NOT EXISTS compliance.role_hierarchy (
  parent_role_id UUID NOT NULL REFERENCES compliance.roles(id) ON DELETE CASCADE,
  child_role_id UUID NOT NULL REFERENCES compliance.roles(id) ON DELETE CASCADE,
  depth INTEGER NOT NULL DEFAULT 1 CHECK (depth >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(parent_role_id, child_role_id)
);

-- Separation of duty constraints ---------------------------------------------
CREATE TABLE IF NOT EXISTS compliance.sod_constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compliance.sod_constraint_roles (
  constraint_id UUID NOT NULL REFERENCES compliance.sod_constraints(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES compliance.roles(id) ON DELETE CASCADE,
  PRIMARY KEY(constraint_id, role_id)
);

-- Immutable audit log --------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS compliance.audit_log_sequence
  AS BIGINT
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1 OWNED BY NONE;

CREATE TABLE IF NOT EXISTS compliance.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_number BIGINT NOT NULL DEFAULT nextval('compliance.audit_log_sequence'),
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'agent', 'system')),
  tenant_id TEXT,
  action TEXT NOT NULL,
  resource_ref TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  metadata JSONB,
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  previous_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS audit_log_sequence_idx
  ON compliance.audit_log(sequence_number);

CREATE INDEX IF NOT EXISTS audit_log_actor_idx
  ON compliance.audit_log(actor_id);

CREATE INDEX IF NOT EXISTS audit_log_tenant_idx
  ON compliance.audit_log(tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_log_action_idx
  ON compliance.audit_log(action);

CREATE INDEX IF NOT EXISTS audit_log_resource_idx
  ON compliance.audit_log(resource_ref);

CREATE INDEX IF NOT EXISTS audit_log_severity_idx
  ON compliance.audit_log(severity);

-- Enforce append-only behavior
CREATE OR REPLACE FUNCTION compliance.prevent_audit_log_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Audit log is immutable: % operations are not allowed on compliance.audit_log', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON compliance.audit_log;
DROP TRIGGER IF EXISTS audit_log_no_delete ON compliance.audit_log;

CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON compliance.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION compliance.prevent_audit_log_mutation();

CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON compliance.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION compliance.prevent_audit_log_mutation();

COMMIT;
