-- Sprint 28 · Mission B28.2 — authz.role_hierarchy DDL (R21.2 TABLE 5)
-- Supports inheritance / composite roles. Stored as adjacency list.

BEGIN;

CREATE TABLE IF NOT EXISTS authz.role_hierarchy (
  parent_role_id uuid NOT NULL REFERENCES authz.roles(id) ON DELETE CASCADE,
  child_role_id uuid NOT NULL REFERENCES authz.roles(id) ON DELETE CASCADE,
  depth smallint NOT NULL DEFAULT 1 CHECK (depth >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT role_hierarchy_pk PRIMARY KEY (parent_role_id, child_role_id),
  CONSTRAINT role_hierarchy_no_self CHECK (parent_role_id <> child_role_id)
);

COMMENT ON TABLE authz.role_hierarchy IS 'R21.2 TABLE 5: adjacency list enabling inheritance-aware queries.';

COMMIT;
