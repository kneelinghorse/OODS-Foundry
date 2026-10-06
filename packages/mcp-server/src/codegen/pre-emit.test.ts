/**
 * runPreEmit() unit + contract tests.
 *
 * Two coverage tracks:
 *
 * 1. UiSchema legacy path — verifies the shared pre-emit pass collects the
 *    same components/handlers/propDefaults that the per-emitter walks used to
 *    produce. This is the byte-identical guarantee for existing emitters.
 *
 * 2. Object Catalog path — exercises runPreEmit against the three fixtures
 *    landed in sprint-97 m01 (user/product/subscription). Asserts that
 *    PreEmitContext.catalog surfaces pragmatic_role, traits, relationships,
 *    slots, brand_overlay, projection_variants, evidence_refs, and the
 *    semantics summary as documented in D2 — the inputs new fidelities
 *    (boxes-and-arrows in s98-m02, wireframe + A2UI later) project from.
 */

import { describe, expect, it } from 'vitest';

import userFixture from '../object-catalog/fixtures/user.json' with { type: 'json' };
import productFixture from '../object-catalog/fixtures/product.json' with { type: 'json' };
import subscriptionFixture from '../object-catalog/fixtures/subscription.json' with { type: 'json' };

import type { ObjectCatalogManifest, SemanticEntity } from '../object-catalog/types.js';
import type { UiSchema } from '../schemas/generated.js';

import { runPreEmit } from './pre-emit.js';

const userEntity = (userFixture as ObjectCatalogManifest).entities[0] as SemanticEntity;
const productEntity = (productFixture as ObjectCatalogManifest).entities[0] as SemanticEntity;
const subscriptionEntity = (subscriptionFixture as ObjectCatalogManifest).entities[0] as SemanticEntity;

describe('runPreEmit — UiSchema legacy path', () => {
  const schema: UiSchema = {
    version: '1.0',
    screens: [
      {
        id: 'root',
        component: 'Card',
        layout: { type: 'stack', gapToken: 'sm' },
        children: [
          {
            id: 'title',
            component: 'Text',
            props: { field: 'name' },
          },
          {
            id: 'submit',
            component: 'Button',
            bindings: { onClick: 'handleSubmit' },
          },
        ],
      },
    ],
    objectSchema: {
      name: { type: 'string', required: true },
    },
  };

  it('returns source=ui-schema and the original schema tree', () => {
    const ctx = runPreEmit(schema);
    expect(ctx.source).toBe('ui-schema');
    expect(ctx.schema).toBe(schema);
    expect(ctx.tree).toBe(schema.screens);
  });

  it('collects distinct component names from the tree', () => {
    const ctx = runPreEmit(schema);
    expect(Array.from(ctx.components).sort()).toEqual(['Button', 'Card', 'Text']);
  });

  it('collects handler bindings', () => {
    const ctx = runPreEmit(schema);
    expect(ctx.handlers.get('handleSubmit')).toBe('onClick');
  });

  it('returns empty tailwindVariants when styling is not tailwind', () => {
    const ctx = runPreEmit(schema, { options: { typescript: false, styling: 'inline' } });
    expect(ctx.tailwindVariants.size).toBe(0);
  });

  it('does not enrich catalog when no entity is supplied', () => {
    const ctx = runPreEmit(schema);
    expect(ctx.catalog).toBeUndefined();
  });

  it('enriches catalog when entity is passed via options', () => {
    const ctx = runPreEmit(schema, { entity: userEntity });
    expect(ctx.source).toBe('ui-schema');
    expect(ctx.catalog?.urn).toBe(userEntity.urn);
    expect(ctx.catalog?.pragmaticRole).toBe('informational');
  });
});

describe('runPreEmit — Object Catalog path (sprint-97 fixtures)', () => {
  it('surfaces pragmatic role labels on every fixture', () => {
    expect(runPreEmit(userEntity).catalog?.pragmaticRole).toBe('informational');
    expect(runPreEmit(productEntity).catalog?.pragmaticRole).toBe('primary_action');
    expect(runPreEmit(subscriptionEntity).catalog?.pragmaticRole).toBe('informational');
  });

  it('surfaces trait annotations on every fixture', () => {
    expect(runPreEmit(userEntity).catalog?.traits).toEqual(['Identifiable', 'Avatarable']);
    expect(runPreEmit(productEntity).catalog?.traits).toEqual(['Actionable', 'Pricable']);
    expect(runPreEmit(subscriptionEntity).catalog?.traits).toEqual(['Identifiable', 'Datable']);
  });

  it('surfaces relationships.edges when present (subscription fixture)', () => {
    const ctx = runPreEmit(subscriptionEntity);
    expect(ctx.catalog?.relationships).toHaveLength(2);
    const [renew, depend] = ctx.catalog!.relationships;
    expect(renew.type).toBe('renews_to');
    expect(renew.direction).toBe('out');
    expect(depend.type).toBe('depends_on');
    expect(depend.via).toBe('billing');
  });

  it('exposes empty relationships array when the entity has none', () => {
    expect(runPreEmit(userEntity).catalog?.relationships).toEqual([]);
    expect(runPreEmit(productEntity).catalog?.relationships).toEqual([]);
  });

  it('surfaces brand overlay + projection variants from oods.render', () => {
    const userCtx = runPreEmit(userEntity);
    expect(userCtx.catalog?.brandOverlay).toBe('brand-a');
    expect(userCtx.catalog?.projectionVariants).toHaveLength(2);
    expect(userCtx.catalog!.projectionVariants.map((v) => v.surface)).toEqual(['desktop', 'mobile']);
  });

  it('surfaces slot bindings from oods.render', () => {
    const productCtx = runPreEmit(productEntity);
    const slotNames = productCtx.catalog?.slots.map((s) => s.name) ?? [];
    expect(slotNames).toEqual(['media', 'title', 'price', 'primary_action']);
  });

  it('surfaces semantics summary (purpose + human_meaning + tags)', () => {
    const ctx = runPreEmit(productEntity);
    expect(ctx.catalog?.semantics.purpose).toBe('present product and add to cart');
    expect(ctx.catalog?.semantics.humanMeaning).toContain('Shows product imagery');
    expect(ctx.catalog?.semantics.tags).toEqual(['catalog', 'commerce', 'primary']);
  });

  it('surfaces evidence_refs and evidence_chain', () => {
    const ctx = runPreEmit(userEntity);
    expect(ctx.catalog?.evidenceRefs).toHaveLength(1);
    expect(ctx.catalog?.evidenceRefs[0].protocol).toBe('pragmatic');
    expect(ctx.catalog?.evidenceChain).toHaveLength(2);
    expect(ctx.catalog?.evidenceChain[0].source).toBe('stage1');
  });

  it('surfaces confidence_decomposition when present', () => {
    const ctx = runPreEmit(productEntity);
    expect(ctx.catalog?.confidenceDecomposition?.total).toBe(0.92);
    expect(ctx.catalog?.confidenceDecomposition?.signals).toHaveLength(2);
  });

  it('synthesizes a walkable UiSchema tree from oods.render.slots', () => {
    const ctx = runPreEmit(userEntity);
    expect(ctx.source).toBe('object-catalog');
    expect(ctx.tree).toHaveLength(1);
    const root = ctx.tree[0];
    expect(root.component).toBe('ui.surface.card');
    expect((root.props as Record<string, unknown>)['data-entity-urn']).toBe(userEntity.urn);
    expect(root.children).toHaveLength(3);
    const slotFields = root.children!.map(
      (c) => (c.props as Record<string, unknown>)['data-field'],
    );
    expect(slotFields).toEqual(['user.photo_url', 'user.display_name', 'user.email']);
  });

  it('selects the requested projection variant when variant is supplied', () => {
    const ctx = runPreEmit(userEntity, { variant: 'mobile' });
    const root = ctx.tree[0];
    expect(root.children).toHaveLength(2);
    const slotFields = root.children!.map(
      (c) => (c.props as Record<string, unknown>)['data-field'],
    );
    expect(slotFields).toEqual(['user.photo_url', 'user.display_name']);
  });

  it('falls back to oods.render when variant does not match a projection', () => {
    const ctx = runPreEmit(userEntity, { variant: 'nonexistent-surface' });
    const root = ctx.tree[0];
    expect(root.children).toHaveLength(3);
  });
});
