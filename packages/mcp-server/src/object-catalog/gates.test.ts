/**
 * Object Catalog v1.0.0 — Named gate tests (G1, G2, G3).
 *
 * G1 — Manifest envelope validation. Validates each fixture against the
 *      Forge-owned manifest.schema.json (frozen SemanticManifest envelope,
 *      re-homed under object-catalog/protocol/ in s106-m02). Uses
 *      validateManifest() which applies the schema_version policy and then
 *      runs strict AJV. The negative case enforces additionalProperties
 *      at the manifest root — a Forge-only key MUST fail.
 *
 * G2 — Forge extension validation. AJV against the OodsExtension $def in
 *      Forge's own schema.json. Enforces ui_schema_ref + slots[] on any entity
 *      with oods.render, and surface + ui_schema_ref + slots on each
 *      oods.projection_variants[] entry.
 *
 * G3 — Round-trip fixture hash stability. Canonical SHA-256 over each fixture is
 *      stable across deep-clone and key reordering — catches non-determinism in
 *      property ordering or normalization.
 */

import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { createHash } from 'node:crypto';

import schema from './schema.json' with { type: 'json' };
import userFixture from './fixtures/user.json' with { type: 'json' };
import productFixture from './fixtures/product.json' with { type: 'json' };
import subscriptionFixture from './fixtures/subscription.json' with { type: 'json' };
import type { ObjectCatalogManifest } from './types.js';
import { validateManifest } from './manifest-validator.js';

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(schema);

const oodsExtensionValidator = ajv.getSchema(`${schema.$id}#/$defs/OodsExtension`)!;

const fixtures: ReadonlyArray<[string, ObjectCatalogManifest]> = [
  ['user', userFixture as ObjectCatalogManifest],
  ['product', productFixture as ObjectCatalogManifest],
  ['subscription', subscriptionFixture as ObjectCatalogManifest],
];

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

describe('G1 — Forge-emitted catalog passes the Forge-owned manifest.schema.json', () => {
  for (const [name, fixture] of fixtures) {
    it(`${name} fixture validates against the Forge-owned manifest schema`, () => {
      const result = validateManifest(fixture);
      if (!result.valid) {
        throw new Error(
          `${name} failed G1: ${JSON.stringify(result.errors, null, 2)}`,
        );
      }
      expect(result.valid).toBe(true);
      // Forge pins schema_version to 1.1.0 → exact match → no warnings.
      expect(result.warnings).toEqual([]);
    });
  }

  it('NEGATIVE: a Forge-only key at the manifest root MUST fail with additionalProperties', () => {
    const bad = { ...(userFixture as Record<string, unknown>), catalog_version: '1.0.0' };
    const result = validateManifest(bad);
    expect(result.valid).toBe(false);
    const codes = result.errors.map((e) => e.keyword);
    expect(codes).toContain('additionalProperties');
  });
});

describe('G2 — oods.* extension on each entity passes Forge extension validation', () => {
  for (const [name, fixture] of fixtures) {
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

  it('NEGATIVE: oods.render missing ui_schema_ref MUST fail', () => {
    const bad = {
      render: {
        slots: [{ name: 'title', binding: { field: 'x.y' } }],
      },
    };
    const ok = oodsExtensionValidator(bad);
    expect(ok).toBe(false);
    const missing = (oodsExtensionValidator.errors ?? [])
      .filter((e) => e.keyword === 'required')
      .flatMap((e) => Object.values(e.params ?? {}));
    expect(missing).toContain('ui_schema_ref');
  });

  it('NEGATIVE: oods.projection_variants[].surface missing MUST fail', () => {
    const bad = {
      projection_variants: [
        {
          ui_schema_ref: 'compose-x',
          slots: [{ name: 'title', binding: { field: 'x.y' } }],
        },
      ],
    };
    const ok = oodsExtensionValidator(bad);
    expect(ok).toBe(false);
    const missing = (oodsExtensionValidator.errors ?? [])
      .filter((e) => e.keyword === 'required')
      .flatMap((e) => Object.values(e.params ?? {}));
    expect(missing).toContain('surface');
  });
});

describe('G3 — Round-trip fixture hash stability', () => {
  for (const [name, fixture] of fixtures) {
    it(`${name} fixture hash is stable across deep-clone and key reordering`, () => {
      const baselineHash = fixtureHash(fixture);
      const cloned = JSON.parse(JSON.stringify(fixture));
      expect(fixtureHash(cloned)).toBe(baselineHash);
      const reversed = reverseKeys(fixture);
      expect(fixtureHash(reversed)).toBe(baselineHash);
    });
  }

  it('NEGATIVE: removing a property changes the hash', () => {
    const original = userFixture as ObjectCatalogManifest;
    const mutated = JSON.parse(JSON.stringify(original)) as ObjectCatalogManifest;
    delete (mutated.entities[0] as { oods?: unknown }).oods;
    expect(fixtureHash(mutated)).not.toBe(fixtureHash(original));
  });
});
