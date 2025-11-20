import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ObjectRegistry } from '../../src/registry/registry.ts';
import { generateObjectInterface } from '../../src/generators/object-type-generator.ts';

type FieldLayer = 'foundation' | 'base' | 'trait' | 'object' | 'context';

interface ExpectedField {
  name: string;
  layer?: FieldLayer;
}

type FieldExpectation = ExpectedField | string;

interface CanonicalObjectCase {
  name: string;
  expectedFields: FieldExpectation[];
  expectedTraits: string[];
  unionSnippet?: string;
}

const OBJECTS_ROOT = path.resolve('objects', 'core');
const TRAIT_ROOTS = [path.resolve('traits'), path.resolve('examples/traits')];

describe('Canonical object registry integration', () => {
  let registry: ObjectRegistry;

  const cases: CanonicalObjectCase[] = [
    {
      name: 'User',
      expectedFields: [
        { name: 'primary_email' },
        { name: 'role' },
        { name: 'user_id' },
        { name: 'address_roles', layer: 'trait' },
        { name: 'preference_document', layer: 'trait' },
        { name: 'preference_version', layer: 'trait' },
      ],
      expectedTraits: [
        'Addressable',
        'Stateful',
        'Timestampable',
        'Taggable',
        'Preferenceable',
        'Authable',
        'Communicable',
      ],
      unionSnippet: "role: 'end_user' | 'admin' | 'owner' | 'billing';",
    },
    {
      name: 'Organization',
      expectedFields: [
        { name: 'plan_tier' },
        { name: 'billing_status' },
        { name: 'organization_id' },
        { name: 'address_roles', layer: 'trait' },
      ],
      expectedTraits: [
        'Addressable',
        'Labelled',
        'Stateful',
        'Ownerable',
        'Timestampable',
        'Taggable',
        'Authable',
        'Preferenceable',
        'Communicable',
      ],
      unionSnippet: "plan_tier: 'free' | 'growth' | 'enterprise';",
    },
    {
      name: 'Product',
      expectedFields: ['product_id', 'sku', 'inventory_status'],
      expectedTraits: ['Labelled', 'Stateful', 'Timestampable', 'Priceable', 'Classifiable'],
      unionSnippet: "inventory_status: 'in_stock' | 'low_stock' | 'backorder' | 'discontinued';",
    },
    {
      name: 'Transaction',
      expectedFields: ['transaction_id', 'payment_method', 'channel'],
      expectedTraits: ['Stateful', 'Timestampable', 'Priceable', 'Cancellable', 'Archivable'],
      unionSnippet: "payment_method: 'card' | 'bank_transfer' | 'digital_wallet' | 'invoice';",
    },
    {
      name: 'Relationship',
      expectedFields: ['relationship_type', 'source_id', 'direction'],
      expectedTraits: ['Labelled', 'Stateful', 'Timestampable', 'Ownerable', 'Taggable'],
      unionSnippet: "relationship_type: 'membership' | 'ownership' | 'follows' | 'depends_on' | 'references';",
    },
    {
      name: 'Subscription',
      expectedFields: ['subscription_id', 'status', 'current_period_end'],
      expectedTraits: ['Stateful', 'Cancellable', 'Timestampable', 'Billable'],
      unionSnippet:
        "status: 'future' | 'trialing' | 'active' | 'paused' | 'pending_cancellation' | 'delinquent' | 'terminated';",
    },
  ];

  beforeAll(async () => {
    registry = new ObjectRegistry({
      roots: [OBJECTS_ROOT],
      watch: false,
    });
    await registry.waitUntilReady();
  });

  afterAll(() => {
    registry.close();
  });

  for (const testCase of cases) {
    it(`resolves, composes, and generates types for ${testCase.name}`, async () => {
      const resolved = await registry.resolve(testCase.name, {
        traitRoots: TRAIT_ROOTS,
      });

      const resolvedTraits = new Set(resolved.composed.metadata.traitOrder);
      for (const trait of testCase.expectedTraits) {
        expect(resolvedTraits.has(trait)).toBe(true);
      }

      for (const fieldExpectation of testCase.expectedFields) {
        const fieldName = typeof fieldExpectation === 'string' ? fieldExpectation : fieldExpectation.name;
        const expectedLayer = typeof fieldExpectation === 'string'
          ? 'object'
          : fieldExpectation.layer ?? 'object';
        expect(resolved.composed.schema[fieldName], `${fieldName} missing on ${testCase.name}`).toBeDefined();
        const provenance = resolved.composed.metadata.provenance.get(fieldName);
        expect(provenance?.layer, `${fieldName} should originate from ${expectedLayer} layer`).toBe(
          expectedLayer
        );
      }

      const generated = generateObjectInterface(resolved, { includeJsDoc: false });

      expect(generated.interfaceName).toBe(testCase.name);
      const generatedTraits = new Set(generated.traits);
      for (const trait of testCase.expectedTraits) {
        expect(generatedTraits.has(trait)).toBe(true);
      }
      if (testCase.unionSnippet) {
        expect(
          generated.code.includes(testCase.unionSnippet),
          `Expected union snippet missing for ${testCase.name}`
        ).toBe(true);
      }
    });
  }
});
