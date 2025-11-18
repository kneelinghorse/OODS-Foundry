-- Sprint 26 · Mission B26.2 — ltree Infrastructure & Database Migrations
-- Provides canonical taxonomy schema, adjacency/closure projections, and
-- reparent helpers for Postgres-backed Classifiable deployments.

BEGIN;

-- Enable the ltree extension for materialized path operations.
CREATE EXTENSION IF NOT EXISTS ltree;

-- Namespace to isolate taxonomy data + helper functions.
CREATE SCHEMA IF NOT EXISTS classification;

-- ---------------------------------------------------------------------------
-- Canonical taxonomy nodes (ltree-backed)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classification.categories (
  tenant_id UUID NOT NULL,
  category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL CHECK (identifier ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID NULL,
  ltree_path LTREE NOT NULL,
  depth SMALLINT NOT NULL CHECK (depth BETWEEN 0 AND 63),
  child_count INTEGER NOT NULL DEFAULT 0 CHECK (child_count >= 0),
  is_selectable BOOLEAN NOT NULL DEFAULT TRUE,
  synonyms TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  mode TEXT NOT NULL CHECK (mode IN ('taxonomy', 'hybrid', 'tag')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  governance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, identifier),
  UNIQUE (tenant_id, slug),
  UNIQUE (tenant_id, ltree_path)
);

ALTER TABLE classification.categories
  ADD CONSTRAINT categories_parent_fk
  FOREIGN KEY (tenant_id, parent_id)
  REFERENCES classification.categories (tenant_id, category_id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS categories_tenant_idx
  ON classification.categories (tenant_id, ltree_path);

CREATE INDEX IF NOT EXISTS categories_parent_idx
  ON classification.categories (tenant_id, parent_id);

CREATE INDEX IF NOT EXISTS categories_depth_idx
  ON classification.categories (tenant_id, depth);

CREATE INDEX IF NOT EXISTS categories_mode_idx
  ON classification.categories (tenant_id, mode);

CREATE INDEX IF NOT EXISTS categories_ltree_gist_idx
  ON classification.categories
  USING GIST (ltree_path);

COMMENT ON TABLE classification.categories IS
  'Canonical taxonomy nodes persisted as PostgreSQL ltree paths.';

-- ---------------------------------------------------------------------------
-- Adjacency + closure projections (fallback + governance queries)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classification.category_adjacency (
  tenant_id UUID NOT NULL,
  parent_id UUID,
  child_id UUID NOT NULL,
  depth SMALLINT NOT NULL DEFAULT 0 CHECK (depth BETWEEN 0 AND 63),
  PRIMARY KEY (tenant_id, child_id),
  FOREIGN KEY (tenant_id, child_id) REFERENCES classification.categories (tenant_id, category_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, parent_id) REFERENCES classification.categories (tenant_id, category_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS category_adjacency_parent_idx
  ON classification.category_adjacency (tenant_id, parent_id);

COMMENT ON TABLE classification.category_adjacency IS
  'Adjacency projection used by sqlite-compatible environments or governance exports.';

CREATE TABLE IF NOT EXISTS classification.category_closure (
  tenant_id UUID NOT NULL,
  ancestor_id UUID NOT NULL,
  descendant_id UUID NOT NULL,
  depth SMALLINT NOT NULL CHECK (depth >= 0),
  PRIMARY KEY (tenant_id, ancestor_id, descendant_id),
  FOREIGN KEY (tenant_id, ancestor_id) REFERENCES classification.categories (tenant_id, category_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, descendant_id) REFERENCES classification.categories (tenant_id, category_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS category_closure_desc_idx
  ON classification.category_closure (tenant_id, descendant_id, depth);

COMMENT ON TABLE classification.category_closure IS
  'Closure projection mirroring WordPress three-table pattern (terms, term_taxonomy, term_relationships).';

-- ---------------------------------------------------------------------------
-- Utility triggers + graph rebuild helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION classification.touch_category_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS categories_touch_updated_at ON classification.categories;

CREATE TRIGGER categories_touch_updated_at
  BEFORE UPDATE ON classification.categories
  FOR EACH ROW
  EXECUTE FUNCTION classification.touch_category_updated_at();

CREATE OR REPLACE FUNCTION classification.rebuild_graph_projections(p_tenant UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM classification.category_adjacency WHERE tenant_id = p_tenant;

  INSERT INTO classification.category_adjacency (tenant_id, parent_id, child_id, depth)
  SELECT tenant_id, parent_id, category_id, depth
  FROM classification.categories
  WHERE tenant_id = p_tenant;

  DELETE FROM classification.category_closure WHERE tenant_id = p_tenant;

  INSERT INTO classification.category_closure (tenant_id, ancestor_id, descendant_id, depth)
  SELECT c.tenant_id,
         ancestor.category_id AS ancestor_id,
         c.category_id AS descendant_id,
         (c.depth - ancestor.depth) AS depth
  FROM classification.categories c
  JOIN classification.categories ancestor
    ON ancestor.tenant_id = c.tenant_id
   AND ancestor.ltree_path @> c.ltree_path
  WHERE c.tenant_id = p_tenant;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION classification.rebuild_graph_projections(UUID) IS
  'Regenerates adjacency + closure tables for hybrid (WordPress-style) mode.';

-- ---------------------------------------------------------------------------
-- Reparent helper (ltree-aware + adjacency refresh)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION classification.reparent_category(
  p_tenant UUID,
  p_category UUID,
  p_new_parent UUID,
  p_actor TEXT DEFAULT 'system'
) RETURNS INTEGER AS $$
DECLARE
  existing RECORD;
  parent_path LTREE;
  parent_depth SMALLINT;
  base_depth SMALLINT;
  updated_rows INTEGER := 0;
BEGIN
  SELECT category_id, parent_id, ltree_path, depth
    INTO existing
  FROM classification.categories
  WHERE tenant_id = p_tenant AND category_id = p_category
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Category % not found for tenant %', p_category, p_tenant;
  END IF;

  IF p_new_parent IS NOT NULL THEN
    SELECT ltree_path, depth
      INTO parent_path, parent_depth
    FROM classification.categories
    WHERE tenant_id = p_tenant AND category_id = p_new_parent;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Parent % not found for tenant %', p_new_parent, p_tenant;
    END IF;

    IF parent_path <@ existing.ltree_path THEN
      RAISE EXCEPTION 'Cannot reparent node % into its own subtree.', p_category;
    END IF;
  ELSE
    parent_path := NULL;
    parent_depth := -1;
  END IF;

  base_depth := existing.depth;

  WITH subtree AS (
    SELECT category_id, ltree_path, depth
    FROM classification.categories
    WHERE tenant_id = p_tenant AND ltree_path <@ existing.ltree_path
  )
  UPDATE classification.categories AS target
  SET
    ltree_path = CASE
      WHEN parent_path IS NULL THEN subpath(subtree.ltree_path, base_depth)
      ELSE parent_path || subpath(subtree.ltree_path, base_depth)
    END,
    depth = CASE
      WHEN parent_path IS NULL THEN subtree.depth - base_depth
      ELSE parent_depth + 1 + (subtree.depth - base_depth)
    END,
    parent_id = CASE
      WHEN target.category_id = p_category THEN p_new_parent
      ELSE target.parent_id
    END,
    updated_at = NOW()
  FROM subtree
  WHERE target.tenant_id = p_tenant
    AND target.category_id = subtree.category_id;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;

  -- Recompute child counts (denormalised for quick dashboards).
  UPDATE classification.categories AS c
  SET child_count = (
    SELECT COUNT(*) FROM classification.categories AS children
    WHERE children.tenant_id = c.tenant_id AND children.parent_id = c.category_id
  )
  WHERE c.tenant_id = p_tenant;

  PERFORM classification.rebuild_graph_projections(p_tenant);

  RETURN updated_rows;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION classification.reparent_category(UUID, UUID, UUID, TEXT) IS
  'ltree-aware subtree reparent helper (<10ms target) that updates adjacency + closure projections.';

COMMIT;
