/**
 * Content domain pack (Article / Author / Comment) — domain-pack contract tests.
 *
 * Mirrors the gate structure of gates.test.ts (G1/G2/G3) but applied to the
 * content/publishing pack. Adds cross-entity URN-resolution checks against the
 * multi-entity content-pack manifest (matches s98-m04 billing-multi-entity
 * intra-manifest reference pattern) and variant-selection checks via
 * runPreEmit() to verify the s100-m03 selectVariant() pathway resolves each
 * declared variant to a distinct slot set.
 */

import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { createHash } from 'node:crypto';

import schema from './schema.json' with { type: 'json' };
import articleFixture from './fixtures/content/article.json' with { type: 'json' };
import authorFixture from './fixtures/content/author.json' with { type: 'json' };
import commentFixture from './fixtures/content/comment.json' with { type: 'json' };
import contentPackFixture from '../../test/fixtures/object-catalog/content-pack.json' with { type: 'json' };
import type { ObjectCatalogManifest, SemanticEntity } from './types.js';
import { validateManifest } from './manifest-validator.js';
import { runPreEmit } from '../codegen/pre-emit.js';

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(schema);

const oodsExtensionValidator = ajv.getSchema(`${schema.$id}#/$defs/OodsExtension`)!;

const singleEntityFixtures: ReadonlyArray<[string, ObjectCatalogManifest]> = [
  ['article', articleFixture as ObjectCatalogManifest],
  ['author', authorFixture as ObjectCatalogManifest],
  ['comment', commentFixture as ObjectCatalogManifest],
];

const contentPack = contentPackFixture as ObjectCatalogManifest;

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + canonicalize((value as Record<string, unknown>)[k]))
      .join(',') +
    '}'
  );
}

function fixtureHash(fixture: unknown): string {
  return createHash('sha256').update(canonicalize(fixture)).digest('hex');
}

function reverseKeys<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(reverseKeys) as unknown as T;
  const entries = Object.entries(value as Record<string, unknown>).reverse();
  const out: Record<string, unknown> = {};
  for (const [k, v] of entries) {
    out[k] = reverseKeys(v);
  }
  return out as T;
}

function findEntity(manifest: ObjectCatalogManifest, urn: string): SemanticEntity | undefined {
  return manifest.entities.find((e) => e.urn === urn);
}

describe('content pack G1 — each single-entity fixture passes the Forge-owned manifest schema', () => {
  for (const [name, fixture] of singleEntityFixtures) {
    it(`${name} fixture validates against the Forge-owned manifest schema`, () => {
      const result = validateManifest(fixture);
      if (!result.valid) {
        throw new Error(
          `${name} failed G1: ${JSON.stringify(result.errors, null, 2)}`,
        );
      }
      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual([]);
    });
  }

  it('multi-entity content-pack manifest validates against the Forge-owned manifest schema', () => {
    const result = validateManifest(contentPack);
    if (!result.valid) {
      throw new Error(
        `content-pack failed G1: ${JSON.stringify(result.errors, null, 2)}`,
      );
    }
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });
});

describe('content pack G2 — oods.* extension validates on every entity', () => {
  for (const [name, fixture] of singleEntityFixtures) {
    it(`${name} fixture entities[].oods all validate`, () => {
      for (const entity of fixture.entities) {
        if (!entity.oods) continue;
        const ok = oodsExtensionValidator(entity.oods);
        if (!ok) {
          throw new Error(
            `${name} entity ${entity.urn} failed G2: ${JSON.stringify(
              oodsExtensionValidator.errors,
              null,
              2,
            )}`,
          );
        }
        expect(ok).toBe(true);
      }
    });
  }

  it('content-pack multi-entity manifest: every entity oods.* extension validates', () => {
    for (const entity of contentPack.entities) {
      if (!entity.oods) continue;
      const ok = oodsExtensionValidator(entity.oods);
      if (!ok) {
        throw new Error(
          `content-pack entity ${entity.urn} failed G2: ${JSON.stringify(
            oodsExtensionValidator.errors,
            null,
            2,
          )}`,
        );
      }
      expect(ok).toBe(true);
    }
  });
});

describe('content pack G3 — fixture hash stability across clone and key reordering', () => {
  for (const [name, fixture] of singleEntityFixtures) {
    it(`${name} fixture hash is stable across deep-clone and key reordering`, () => {
      const baselineHash = fixtureHash(fixture);
      const cloned = JSON.parse(JSON.stringify(fixture));
      expect(fixtureHash(cloned)).toBe(baselineHash);
      const reversed = reverseKeys(fixture);
      expect(fixtureHash(reversed)).toBe(baselineHash);
    });
  }

  it('content-pack multi-entity manifest hash is stable across clone and key reordering', () => {
    const baselineHash = fixtureHash(contentPack);
    const cloned = JSON.parse(JSON.stringify(contentPack));
    expect(fixtureHash(cloned)).toBe(baselineHash);
    const reversed = reverseKeys(contentPack);
    expect(fixtureHash(reversed)).toBe(baselineHash);
  });
});

describe('content pack — cross-entity references resolve intra-manifest in content-pack', () => {
  it('Article.authored_by edge points to an Author URN present in the same manifest', () => {
    const article = findEntity(contentPack, 'urn:proto:semantic:article-detail@1.0.0');
    expect(article).toBeDefined();
    const edge = article!.relationships?.edges?.find((e) => e.type === 'authored_by');
    expect(edge).toBeDefined();
    expect(edge!.to).toBe('urn:proto:semantic:author-profile@1.0.0');
    expect(findEntity(contentPack, edge!.to)).toBeDefined();
  });

  it('Comment.authored_by edge points to an Author URN present in the same manifest', () => {
    const comment = findEntity(contentPack, 'urn:proto:semantic:comment-threaded@1.0.0');
    expect(comment).toBeDefined();
    const edge = comment!.relationships?.edges?.find((e) => e.type === 'authored_by');
    expect(edge).toBeDefined();
    expect(edge!.to).toBe('urn:proto:semantic:author-profile@1.0.0');
    expect(findEntity(contentPack, edge!.to)).toBeDefined();
  });

  it('Comment.reply_to edge is a self-reference to the Comment URN', () => {
    const comment = findEntity(contentPack, 'urn:proto:semantic:comment-threaded@1.0.0');
    expect(comment).toBeDefined();
    const edge = comment!.relationships?.edges?.find((e) => e.type === 'reply_to');
    expect(edge).toBeDefined();
    expect(edge!.from).toBe(edge!.to);
    expect(edge!.to).toBe('urn:proto:semantic:comment-threaded@1.0.0');
  });

  it('Article.has_comments edge points to the Comment URN present in the same manifest', () => {
    const article = findEntity(contentPack, 'urn:proto:semantic:article-detail@1.0.0');
    const edge = article!.relationships?.edges?.find((e) => e.type === 'has_comments');
    expect(edge).toBeDefined();
    expect(edge!.to).toBe('urn:proto:semantic:comment-threaded@1.0.0');
    expect(findEntity(contentPack, edge!.to)).toBeDefined();
  });
});

describe('content pack — runPreEmit selects each declared projection variant distinctly', () => {
  const variantCases: ReadonlyArray<{
    entityUrn: string;
    variants: ReadonlyArray<{ surface: string; expectedSlotNames: string[] }>;
  }> = [
    {
      entityUrn: 'urn:proto:semantic:article-detail@1.0.0',
      variants: [
        { surface: 'detail', expectedSlotNames: ['hero', 'title', 'byline', 'body', 'related'] },
        { surface: 'list-card', expectedSlotNames: ['thumb', 'title', 'excerpt', 'byline'] },
        { surface: 'hero-feature', expectedSlotNames: ['hero', 'title', 'byline'] },
      ],
    },
    {
      entityUrn: 'urn:proto:semantic:author-profile@1.0.0',
      variants: [
        { surface: 'profile', expectedSlotNames: ['avatar', 'title', 'subtitle', 'body'] },
        { surface: 'byline', expectedSlotNames: ['avatar', 'title', 'subtitle'] },
        { surface: 'mini', expectedSlotNames: ['title'] },
      ],
    },
    {
      entityUrn: 'urn:proto:semantic:comment-threaded@1.0.0',
      variants: [
        { surface: 'threaded', expectedSlotNames: ['avatar', 'byline', 'body', 'timestamp', 'replies'] },
        { surface: 'flat', expectedSlotNames: ['byline', 'body', 'timestamp'] },
        { surface: 'nested', expectedSlotNames: ['avatar', 'byline', 'body', 'timestamp', 'replies', 'nested_depth_indicator'] },
      ],
    },
  ];

  for (const { entityUrn, variants } of variantCases) {
    it(`${entityUrn} resolves each declared surface to its declared slot set`, () => {
      const entity = findEntity(contentPack, entityUrn);
      expect(entity).toBeDefined();

      for (const { surface, expectedSlotNames } of variants) {
        const ctx = runPreEmit(entity as SemanticEntity, { variant: surface });
        const actualSlotNames = (ctx.catalog?.slots ?? []).map((s) => s.name);
        expect(actualSlotNames).toEqual(expectedSlotNames);
      }
    });
  }

  it('runPreEmit with no variant falls back to oods.render.slots for each content entity', () => {
    for (const entity of contentPack.entities) {
      const ctx = runPreEmit(entity);
      const renderSlotNames = (entity.oods?.render?.slots ?? []).map((s) => s.name);
      const ctxSlotNames = (ctx.catalog?.slots ?? []).map((s) => s.name);
      expect(ctxSlotNames).toEqual(renderSlotNames);
    }
  });
});

describe('content pack — confidence_decomposition is author-supplied at high tier', () => {
  for (const [name, fixture] of singleEntityFixtures) {
    it(`${name} fixture entity declares total >= 0.8 (high tier)`, () => {
      const entity = fixture.entities[0];
      const total = entity.oods?.confidence_decomposition?.total;
      expect(total).toBeDefined();
      expect(total!).toBeGreaterThanOrEqual(0.8);
      const signals = entity.oods?.confidence_decomposition?.signals ?? [];
      expect(signals.length).toBeGreaterThan(0);
    });
  }
});

describe('content pack — Schema.org alignment is captured on each entity', () => {
  const schemaOrgByUrn: Record<string, string> = {
    'urn:proto:semantic:article-detail@1.0.0': 'https://schema.org/Article',
    'urn:proto:semantic:author-profile@1.0.0': 'https://schema.org/Person',
    'urn:proto:semantic:comment-threaded@1.0.0': 'https://schema.org/Comment',
  };

  for (const [name, fixture] of singleEntityFixtures) {
    it(`${name} entity carries the expected Schema.org URI in context.schemaorg`, () => {
      const entity = fixture.entities[0];
      const expected = schemaOrgByUrn[entity.urn];
      expect(expected).toBeDefined();
      expect(entity.context).toBeDefined();
      expect((entity.context as Record<string, unknown>).schemaorg).toBe(expected);
    });
  }

  it('content-pack entities all carry the expected Schema.org URI', () => {
    for (const entity of contentPack.entities) {
      const expected = schemaOrgByUrn[entity.urn];
      expect(expected).toBeDefined();
      expect((entity.context as Record<string, unknown>).schemaorg).toBe(expected);
    }
  });
});
