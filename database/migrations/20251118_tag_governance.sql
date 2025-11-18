-- Sprint 26 · Mission B26.4 — Tag Management & Folksonomy Governance
-- Adds canonical tag storage, synonym mapping, moderation queues, and
-- transactional merge helpers aligned with the Stack Overflow root-tag pattern.

BEGIN;

CREATE SCHEMA IF NOT EXISTS classification;

CREATE TABLE IF NOT EXISTS classification.tags (
  tenant_id UUID NOT NULL,
  tag_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active','pending_review','archived')),
  is_canonical BOOLEAN NOT NULL DEFAULT TRUE,
  synonyms TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS tags_tenant_usage_idx
  ON classification.tags (tenant_id, usage_count DESC);

CREATE TABLE IF NOT EXISTS classification.tag_synonyms (
  tenant_id UUID NOT NULL,
  synonym TEXT NOT NULL,
  canonical_tag_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  PRIMARY KEY (tenant_id, synonym),
  FOREIGN KEY (tenant_id, canonical_tag_id)
    REFERENCES classification.tags (tenant_id, tag_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS classification.tag_relationships (
  tenant_id UUID NOT NULL,
  tag_id UUID NOT NULL,
  object_type TEXT NOT NULL,
  object_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, tag_id, object_type, object_id),
  FOREIGN KEY (tenant_id, tag_id)
    REFERENCES classification.tags (tenant_id, tag_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS tag_relationships_object_idx
  ON classification.tag_relationships (tenant_id, object_type, object_id);

CREATE TABLE IF NOT EXISTS classification.tag_moderation_queue (
  queue_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  tag_id UUID,
  submitted_tag JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reason TEXT,
  submitted_by TEXT NOT NULL,
  reviewed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  FOREIGN KEY (tenant_id, tag_id)
    REFERENCES classification.tags (tenant_id, tag_id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS classification.tag_audit_log (
  event_id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  tag_id UUID,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (tenant_id, tag_id)
    REFERENCES classification.tags (tenant_id, tag_id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS tag_audit_tenant_idx
  ON classification.tag_audit_log (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS classification.tag_merges (
  merge_id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  source_tag_id UUID NOT NULL,
  target_tag_id UUID NOT NULL,
  actor TEXT NOT NULL,
  relationships_updated INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (tenant_id, target_tag_id)
    REFERENCES classification.tags (tenant_id, tag_id)
    ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION classification.touch_tag_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tags_touch_updated_at ON classification.tags;

CREATE TRIGGER tags_touch_updated_at
  BEFORE UPDATE ON classification.tags
  FOR EACH ROW
  EXECUTE FUNCTION classification.touch_tag_updated_at();

CREATE OR REPLACE FUNCTION classification.merge_tags(
  p_tenant UUID,
  p_source UUID,
  p_target UUID,
  p_actor TEXT DEFAULT 'system'
) RETURNS INTEGER AS $$
DECLARE
  source_tag RECORD;
  target_tag RECORD;
  merged_synonyms TEXT[];
  relationships_updated INTEGER := 0;
BEGIN
  SELECT * INTO source_tag
  FROM classification.tags
  WHERE tenant_id = p_tenant AND tag_id = p_source
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source tag % not found for tenant %', p_source, p_tenant;
  END IF;

  SELECT * INTO target_tag
  FROM classification.tags
  WHERE tenant_id = p_tenant AND tag_id = p_target
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target tag % not found for tenant %', p_target, p_tenant;
  END IF;

  IF p_source = p_target THEN
    RAISE EXCEPTION 'Source and target tags must differ.';
  END IF;

  merged_synonyms := (
    SELECT ARRAY(
      SELECT DISTINCT LOWER(value)
      FROM unnest(target_tag.synonyms || source_tag.synonyms || ARRAY[source_tag.slug]) value
      WHERE value IS NOT NULL AND value <> ''
    )
  );

  UPDATE classification.tags
  SET usage_count = target_tag.usage_count + source_tag.usage_count,
      synonyms = merged_synonyms,
      updated_at = NOW()
  WHERE tenant_id = p_tenant AND tag_id = p_target;

  UPDATE classification.tag_synonyms
  SET canonical_tag_id = p_target
  WHERE tenant_id = p_tenant AND canonical_tag_id = p_source;

  UPDATE classification.tag_relationships
  SET tag_id = p_target
  WHERE tenant_id = p_tenant AND tag_id = p_source;
  GET DIAGNOSTICS relationships_updated = ROW_COUNT;

  INSERT INTO classification.tag_merges (tenant_id, source_tag_id, target_tag_id, actor, relationships_updated)
  VALUES (p_tenant, p_source, p_target, p_actor, relationships_updated);

  INSERT INTO classification.tag_audit_log (tenant_id, tag_id, event_type, actor, summary, payload)
  VALUES (
    p_tenant,
    p_target,
    'merge',
    p_actor,
    'Tag merge completed',
    jsonb_build_object(
      'sourceTagId', p_source,
      'targetTagId', p_target,
      'relationshipsUpdated', relationships_updated,
      'promotedSynonyms', merged_synonyms
    )
  );

  DELETE FROM classification.tags
  WHERE tenant_id = p_tenant AND tag_id = p_source;

  RETURN relationships_updated;
END;
$$ LANGUAGE plpgsql;

COMMIT;
