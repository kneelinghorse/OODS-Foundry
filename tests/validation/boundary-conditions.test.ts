import { describe, expect, it } from 'vitest';

import {
  CompositionValidator,
} from '../../src/validation/index.js';
import { createEmptyComposedObject } from '../../src/core/composed-object.js';
import type { ComposedObject } from '../../src/core/composed-object.js';
import type { TraitDefinition, TokenDefinition } from '../../src/core/trait-definition.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTrait(
  name: string,
  overrides: Partial<TraitDefinition> = {}
): TraitDefinition {
  return {
    trait: { name, version: '1.0.0' },
    schema: {},
    semantics: {},
    view_extensions: {},
    tokens: {} as TokenDefinition,
    dependencies: [],
    actions: [],
    ...overrides,
  };
}

function validate(composed: ComposedObject) {
  return new CompositionValidator().validate(composed);
}

// ---------------------------------------------------------------------------
// Empty / minimal schemas
// ---------------------------------------------------------------------------

describe('boundary conditions: empty and minimal schemas', () => {
  it('empty composed object passes validation', () => {
    const composed = createEmptyComposedObject('empty', 'Empty');
    const result = validate(composed);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('composed object with zero traits passes', () => {
    const composed = createEmptyComposedObject('zero', 'Zero');
    composed.traits = [];
    composed.metadata.traitOrder = [];
    composed.metadata.traitCount = 0;
    const result = validate(composed);
    expect(result.valid).toBe(true);
  });

  it('composed object with empty schema and empty semantics passes', () => {
    const composed = createEmptyComposedObject('bare', 'Bare');
    composed.traits = [makeTrait('MinimalTrait')];
    composed.schema = {};
    composed.semantics = {};
    composed.metadata.traitOrder = ['MinimalTrait'];
    composed.metadata.traitCount = 1;
    const result = validate(composed);
    expect(result.valid).toBe(true);
  });

  it('composed object with empty tokens passes', () => {
    const composed = createEmptyComposedObject('no-tokens', 'No Tokens');
    composed.traits = [makeTrait('T')];
    composed.tokens = {} as TokenDefinition;
    composed.metadata.traitOrder = ['T'];
    composed.metadata.traitCount = 1;
    const result = validate(composed);
    expect(result.valid).toBe(true);
  });

  it('composed object with empty viewExtensions passes', () => {
    const composed = createEmptyComposedObject('no-views', 'No Views');
    composed.traits = [makeTrait('T')];
    composed.viewExtensions = {};
    composed.metadata.traitOrder = ['T'];
    composed.metadata.traitCount = 1;
    const result = validate(composed);
    expect(result.valid).toBe(true);
  });

  it('composed object with empty actions passes', () => {
    const composed = createEmptyComposedObject('no-actions', 'No Actions');
    composed.traits = [makeTrait('T')];
    composed.actions = [];
    composed.metadata.traitOrder = ['T'];
    composed.metadata.traitCount = 1;
    const result = validate(composed);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Single-node / minimal compositions
// ---------------------------------------------------------------------------

describe('boundary conditions: single-trait compositions', () => {
  it('single trait with one schema field and matching semantics passes', () => {
    const composed = createEmptyComposedObject('single', 'Single');
    composed.traits = [makeTrait('OnlyTrait', {
      schema: { name: { type: 'string', required: true } },
      semantics: { name: { semantic_type: 'text.label', token_mapping: 'tokenMap(text.label.*)' } },
      tokens: { text: { label: { primary: '#000' } } } as TokenDefinition,
    })];
    composed.schema = { name: { type: 'string', required: true } };
    composed.semantics = { name: { semantic_type: 'text.label', token_mapping: 'tokenMap(text.label.*)' } };
    composed.tokens = { text: { label: { primary: '#000' } } } as TokenDefinition;
    composed.metadata.traitOrder = ['OnlyTrait'];
    composed.metadata.traitCount = 1;
    composed.metadata.provenance.set('name', {
      fieldName: 'name', source: 'OnlyTrait', layer: 'trait', order: 0,
    });
    const result = validate(composed);
    expect(result.valid).toBe(true);
  });

  it('single trait with view extension in every valid context passes', () => {
    const contexts = ['list', 'detail', 'form', 'timeline', 'card', 'inline'];
    const composed = createEmptyComposedObject('views', 'Views');
    composed.traits = [makeTrait('ViewTrait')];
    composed.schema = { field: { type: 'string', required: true } };
    for (const ctx of contexts) {
      composed.viewExtensions[ctx] = [{ component: 'Comp', props: { field: 'field' } }];
    }
    composed.metadata.traitOrder = ['ViewTrait'];
    composed.metadata.traitCount = 1;
    const result = validate(composed);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Maximum-depth / stress compositions
// ---------------------------------------------------------------------------

describe('boundary conditions: large compositions', () => {
  it('composition with 50 traits and no errors passes', () => {
    const composed = createEmptyComposedObject('fifty', 'Fifty');
    const traitNames: string[] = [];
    for (let i = 0; i < 50; i++) {
      const name = `Trait${i}`;
      traitNames.push(name);
      composed.traits.push(makeTrait(name, {
        schema: { [`field_${i}`]: { type: 'string', required: false } },
      }));
      composed.schema[`field_${i}`] = { type: 'string', required: false };
    }
    composed.metadata.traitOrder = traitNames;
    composed.metadata.traitCount = 50;
    const result = validate(composed);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('composition with 50 traits runs within performance budget', () => {
    const composed = createEmptyComposedObject('perf', 'Perf');
    for (let i = 0; i < 50; i++) {
      const name = `Trait${i}`;
      composed.traits.push(makeTrait(name));
    }
    composed.metadata.traitOrder = composed.traits.map((t) => t.trait.name);
    composed.metadata.traitCount = 50;
    const validator = new CompositionValidator({ performanceTargetMs: 200 });
    validator.validate(composed);
    expect(validator.isWithinPerformanceBudget()).toBe(true);
  });

  it('composition with many collisions produces one issue per collision', () => {
    const composed = createEmptyComposedObject('collisions', 'Collisions');
    composed.traits = [makeTrait('A'), makeTrait('B')];
    composed.metadata.traitOrder = ['A', 'B'];
    composed.metadata.traitCount = 2;

    const count = 20;
    for (let i = 0; i < count; i++) {
      composed.metadata.collisions.push({
        fieldName: `field_${i}`,
        conflictingTraits: ['A', 'B'],
        resolution: 'stricter_type',
        details: 'test',
        winner: 'A',
      });
    }

    const result = validate(composed);
    const collisionIssues = result.issues.filter((i) => i.code === 'TE-0301');
    expect(collisionIssues).toHaveLength(count);
  });

  it('composition with many missing dependencies reports each one', () => {
    const composed = createEmptyComposedObject('deps', 'Deps');
    const deps = Array.from({ length: 10 }, (_, i) => `MissingDep${i}`);
    composed.traits = [makeTrait('NeedyTrait', { dependencies: deps })];
    composed.metadata.traitOrder = ['NeedyTrait'];
    composed.metadata.traitCount = 1;

    const result = validate(composed);
    const depIssues = result.issues.filter((i) => i.code === 'TE-0303');
    expect(depIssues).toHaveLength(10);
  });
});

// ---------------------------------------------------------------------------
// Filtering options
// ---------------------------------------------------------------------------

describe('boundary conditions: validation options', () => {
  it('includeWarnings=false suppresses warnings', () => {
    const composed = createEmptyComposedObject('warn', 'Warn');
    composed.traits = [makeTrait('A'), makeTrait('B')];
    composed.metadata.traitOrder = ['A', 'B'];
    composed.metadata.traitCount = 2;
    composed.metadata.collisions = [{
      fieldName: 'x',
      conflictingTraits: ['A', 'B'],
      resolution: 'stricter_type',
      details: 'test',
      winner: 'A',
    }];

    const withWarnings = new CompositionValidator().validate(composed);
    const withoutWarnings = new CompositionValidator().validate(composed, { includeWarnings: false });

    expect(withWarnings.issues.some((i) => i.severity === 'warning')).toBe(true);
    expect(withoutWarnings.issues.some((i) => i.severity === 'warning')).toBe(false);
  });

  it('includeInfo=false suppresses info-level issues', () => {
    const composed = createEmptyComposedObject('info', 'Info');
    composed.traits = [makeTrait('A'), makeTrait('B')];
    composed.metadata.traitOrder = ['A', 'B'];
    composed.metadata.traitCount = 2;
    composed.metadata.collisions = [{
      fieldName: 'x',
      conflictingTraits: ['A', 'B'],
      resolution: 'manual',
      details: 'manual resolution',
      winner: 'A',
    }];

    const withInfo = new CompositionValidator().validate(composed);
    const withoutInfo = new CompositionValidator().validate(composed, { includeInfo: false });

    expect(withInfo.issues.some((i) => i.severity === 'info')).toBe(true);
    expect(withoutInfo.issues.some((i) => i.severity === 'info')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Edge case: null / undefined resilience
// ---------------------------------------------------------------------------

describe('boundary conditions: null/undefined resilience in composition', () => {
  it('traits with undefined schema fields do not crash validation', () => {
    const composed = createEmptyComposedObject('null', 'Null');
    composed.traits = [makeTrait('NullTrait', {
      schema: undefined as unknown as Record<string, any>,
    })];
    composed.metadata.traitOrder = ['NullTrait'];
    composed.metadata.traitCount = 1;
    expect(() => validate(composed)).not.toThrow();
  });

  it('traits with null semantics do not crash validation', () => {
    const composed = createEmptyComposedObject('null-sem', 'Null Sem');
    composed.traits = [makeTrait('NullSem', {
      semantics: null as unknown as Record<string, any>,
    })];
    composed.metadata.traitOrder = ['NullSem'];
    composed.metadata.traitCount = 1;
    expect(() => validate(composed)).not.toThrow();
  });

  it('empty provenance map does not crash validation', () => {
    const composed = createEmptyComposedObject('no-prov', 'No Provenance');
    composed.traits = [makeTrait('T')];
    composed.metadata.traitOrder = ['T'];
    composed.metadata.traitCount = 1;
    composed.metadata.provenance = new Map();
    expect(() => validate(composed)).not.toThrow();
  });
});
