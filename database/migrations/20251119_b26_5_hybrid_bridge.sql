-- Sprint 26 · Mission B26.5 — Hybrid Mode (WordPress 3-Table Pattern)
-- Introduces canonical term identity plus taxonomy bridge tables so
-- taxonomy + tag systems share the same normalized terms.

BEGIN;

CREATE SCHEMA IF NOT EXISTS classification;
CREATE EXTENSION IF NOT EXISTS ltree;

-- ---------------------------------------------------------------------------
-- Canonical terms — the shared dictionary used by taxonomy + tag roles.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classification.terms (
  tenant_id UUID NOT NULL,
  term_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name TEXT NOT NULL,
  description TEXT,
  language TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS terms_tenant_slug_idx
  ON classification.terms (tenant_id, lower(slug));

CREATE OR REPLACE FUNCTION classification.touch_term_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS terms_touch_updated_at ON classification.terms;

CREATE TRIGGER terms_touch_updated_at
  BEFORE UPDATE ON classification.terms
  FOR EACH ROW
  EXECUTE FUNCTION classification.touch_term_updated_at();

-- ---------------------------------------------------------------------------
-- term_taxonomy — describes how a canonical term is used (category/tag/etc).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classification.term_taxonomy (
  tenant_id UUID NOT NULL,
  term_taxonomy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id UUID NOT NULL REFERENCES classification.terms (term_id) ON DELETE CASCADE,
  taxonomy TEXT NOT NULL CHECK (taxonomy IN ('category', 'tag', 'custom')),
  category_id UUID,
  tag_id UUID,
  parent_term_taxonomy_id UUID NULL,
  hierarchy_path LTREE,
  depth SMALLINT NOT NULL DEFAULT 0 CHECK (depth BETWEEN 0 AND 63),
  relationship_count INTEGER NOT NULL DEFAULT 0 CHECK (relationship_count >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, term_id, taxonomy),
  FOREIGN KEY (category_id) REFERENCES classification.categories (category_id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES classification.tags (tag_id) ON DELETE CASCADE,
  FOREIGN KEY (parent_term_taxonomy_id) REFERENCES classification.term_taxonomy (term_taxonomy_id) ON DELETE SET NULL,
  CHECK (
    (taxonomy = 'category' AND category_id IS NOT NULL AND tag_id IS NULL)
    OR (taxonomy = 'tag' AND tag_id IS NOT NULL AND category_id IS NULL)
    OR (taxonomy = 'custom' AND category_id IS NULL AND tag_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS term_taxonomy_tenant_idx
  ON classification.term_taxonomy (tenant_id, taxonomy);

CREATE INDEX IF NOT EXISTS term_taxonomy_parent_idx
  ON classification.term_taxonomy (tenant_id, parent_term_taxonomy_id);

CREATE INDEX IF NOT EXISTS term_taxonomy_path_idx
  ON classification.term_taxonomy USING GIST (hierarchy_path);

CREATE OR REPLACE FUNCTION classification.touch_term_taxonomy_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS term_taxonomy_touch_updated_at ON classification.term_taxonomy;

CREATE TRIGGER term_taxonomy_touch_updated_at
  BEFORE UPDATE ON classification.term_taxonomy
  FOR EACH ROW
  EXECUTE FUNCTION classification.touch_term_taxonomy_updated_at();

-- ---------------------------------------------------------------------------
-- term_relationships — object ↔ taxonomy bridge sharing canonical terms.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classification.term_relationships (
  tenant_id UUID NOT NULL,
  object_type TEXT NOT NULL,
  object_id UUID NOT NULL,
  term_taxonomy_id UUID NOT NULL REFERENCES classification.term_taxonomy (term_taxonomy_id) ON DELETE CASCADE,
  field TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, object_type, object_id, term_taxonomy_id)
);

CREATE INDEX IF NOT EXISTS term_relationships_taxonomy_idx
  ON classification.term_relationships (tenant_id, term_taxonomy_id);

CREATE OR REPLACE FUNCTION classification.bump_term_relationship_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE classification.term_taxonomy
       SET relationship_count = relationship_count + 1,
           updated_at = NOW()
     WHERE term_taxonomy_id = NEW.term_taxonomy_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE classification.term_taxonomy
       SET relationship_count = GREATEST(relationship_count - 1, 0),
           updated_at = NOW()
     WHERE term_taxonomy_id = OLD.term_taxonomy_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS term_relations_increment ON classification.term_relationships;
DROP TRIGGER IF EXISTS term_relations_decrement ON classification.term_relationships;

CREATE TRIGGER term_relations_increment
  AFTER INSERT ON classification.term_relationships
  FOR EACH ROW
  EXECUTE FUNCTION classification.bump_term_relationship_count();

CREATE TRIGGER term_relations_decrement
  AFTER DELETE ON classification.term_relationships
  FOR EACH ROW
  EXECUTE FUNCTION classification.bump_term_relationship_count();

COMMIT;
