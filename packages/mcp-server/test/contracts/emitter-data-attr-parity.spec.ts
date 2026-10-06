/**
 * Cross-emitter data-* contract parity test.
 *
 * All three C-track fidelity emitters (C1 boxes-arrows, C2 wireframe,
 * C-branded-mockup) consume runPreEmit() and emit HTML for the same Object
 * Catalog manifest. Their visual layers differ; their semantic data-*
 * attribute contract does NOT. A future interactive editor or canvas tool
 * must be able to consume any of the three outputs without re-parsing the
 * visual layer.
 *
 * The load-bearing contract (per s102-m02 mission spec):
 *   - data-entity-urn   (on each .entity element)
 *   - data-element-type (on each .entity element)
 *   - data-role         (on each .entity element when pragmatic_role is set)
 *   - data-slot-name    (on each .slot element)
 *   - data-slot-field   (on each .slot element)
 *
 * This test runs all three emitters against a single multi-entity fixture
 * (content-pack — covers informational entities + cross-entity refs + 3 entity
 * shapes) and asserts the contract holds verbatim across all three outputs.
 */

import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import contentPackFixture from '../fixtures/object-catalog/content-pack.json' with { type: 'json' };
import billingFixture from '../fixtures/object-catalog/billing-multi-entity.json' with { type: 'json' };

import type { ObjectCatalogManifest, OodsSlot } from '../../src/object-catalog/types.js';
import { emit as emitBoxesArrows } from '../../src/codegen/boxes-arrows-emitter.js';
import { emit as emitWireframe } from '../../src/codegen/wireframe-emitter.js';
import { emit as emitBrandedMockup } from '../../src/codegen/branded-mockup-emitter.js';

const CONTRACT_ENTITY_ATTRS = [
  'data-entity-urn',
  'data-element-type',
  'data-role',
] as const;

const CONTRACT_SLOT_ATTRS = ['data-slot-name', 'data-slot-field'] as const;

type Emitter = {
  name: string;
  render: (m: ObjectCatalogManifest) => string;
};

const emitters: Emitter[] = [
  { name: 'boxes-arrows', render: (m) => emitBoxesArrows(m).code },
  { name: 'wireframe', render: (m) => emitWireframe(m).code },
  // This suite proves semantic attribute parity with a supported render scope.
  // The historical billing manifest's brand-default is intentionally refused by
  // the separate unknown-brand contract; do not depend on silent fallback here.
  { name: 'branded-mockup', render: (m) => {
    const result = emitBrandedMockup(m, { brandOverlay: 'A' });
    expect(result.status).toBe('ok');
    expect(result.errors ?? []).toEqual([]);
    return result.code;
  } },
];

function entitySelector(urn: string): string {
  return `.entity[data-entity-urn="${urn.replace(/"/g, '\\"')}"]`;
}

function expectedSlotsByUrn(manifest: ObjectCatalogManifest): Map<string, OodsSlot[]> {
  const map = new Map<string, OodsSlot[]>();
  for (const e of manifest.entities) {
    map.set(e.urn, e.oods?.render?.slots ?? []);
  }
  return map;
}

const fixtures: ReadonlyArray<readonly [string, ObjectCatalogManifest]> = [
  ['content-pack', contentPackFixture as ObjectCatalogManifest],
  ['billing-multi-entity', billingFixture as ObjectCatalogManifest],
];

describe('Cross-emitter data-* contract parity', () => {
  for (const [fixtureName, manifest] of fixtures) {
    describe(`fixture: ${fixtureName}`, () => {
      const docsByEmitter = new Map<string, Document>();
      for (const e of emitters) {
        docsByEmitter.set(e.name, new JSDOM(e.render(manifest)).window.document);
      }

      it('every emitter renders the same set of entity URNs', () => {
        const expectedUrns = manifest.entities.map((e) => e.urn);
        for (const [name, doc] of docsByEmitter) {
          const renderedUrns = Array.from(doc.querySelectorAll('.entity[data-entity-urn]'))
            .map((n) => n.getAttribute('data-entity-urn'));
          expect(renderedUrns, `emitter ${name}`).toEqual(expectedUrns);
        }
      });

      it('every emitter preserves the three contract attrs on every entity element', () => {
        for (const entity of manifest.entities) {
          for (const [name, doc] of docsByEmitter) {
            const node = doc.querySelector(entitySelector(entity.urn));
            expect(node, `${name} ${entity.urn}`).not.toBeNull();
            for (const attr of CONTRACT_ENTITY_ATTRS) {
              if (attr === 'data-role' && !entity.pragmatic_role) continue;
              expect(node!.hasAttribute(attr), `${name} ${entity.urn} ${attr}`).toBe(true);
            }
            // value equality on entity-urn + element-type
            expect(node!.getAttribute('data-entity-urn')).toBe(entity.urn);
            expect(node!.getAttribute('data-element-type')).toBe(entity.element.type);
            if (entity.pragmatic_role) {
              expect(node!.getAttribute('data-role')).toBe(entity.pragmatic_role);
            }
          }
        }
      });

      it('every emitter preserves data-slot-name + data-slot-field on every declared slot', () => {
        const expected = expectedSlotsByUrn(manifest);
        for (const entity of manifest.entities) {
          const slots = expected.get(entity.urn) ?? [];
          if (slots.length === 0) continue;
          for (const [name, doc] of docsByEmitter) {
            const node = doc.querySelector(entitySelector(entity.urn));
            const renderedSlots = Array.from(node!.querySelectorAll('.slot'));
            const renderedNames = renderedSlots.map((s) => s.getAttribute('data-slot-name'));
            const renderedFields = renderedSlots.map((s) => s.getAttribute('data-slot-field'));
            const expectedNames = slots.map((s) => s.name);
            const expectedFields = slots.map((s) => s.binding.field);
            expect(renderedNames, `${name} ${entity.urn} slot names`).toEqual(expectedNames);
            expect(renderedFields, `${name} ${entity.urn} slot fields`).toEqual(expectedFields);
            for (const attr of CONTRACT_SLOT_ATTRS) {
              for (const slotNode of renderedSlots) {
                expect(slotNode.hasAttribute(attr), `${name} ${entity.urn} ${attr}`).toBe(true);
              }
            }
          }
        }
      });
    });
  }
});
