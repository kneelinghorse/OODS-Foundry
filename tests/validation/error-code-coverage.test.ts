import { describe, expect, it } from 'vitest';

import {
  CompositionValidator,
  ErrorCodes,
  ParameterValidator,
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

function compositionIssues(composed: ComposedObject) {
  return new CompositionValidator().validate(composed).issues;
}

function issuesByCode(composed: ComposedObject, code: string) {
  return compositionIssues(composed).filter((i) => i.code === code);
}

// ---------------------------------------------------------------------------
// TE-01XX — Structure errors
// ---------------------------------------------------------------------------

describe('error code coverage: TE-01XX structure errors', () => {
  it('TE-0101 INVALID_TRAIT_FORMAT: triggered when parameter schema is missing', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('CompletelyFakeTrait', {});
    expect(result.valid).toBe(false);
    expect(result.issues[0].code).toBe(ErrorCodes.INVALID_TRAIT_FORMAT);
    expect(result.issues[0].code).toBe('TE-0101');
  });

  it('TE-0102 MISSING_REQUIRED_FIELD: constant is defined', () => {
    expect(ErrorCodes.MISSING_REQUIRED_FIELD).toBe('TE-0102');
  });

  it('TE-0103 INVALID_FIELD_TYPE: constant is defined', () => {
    expect(ErrorCodes.INVALID_FIELD_TYPE).toBe('TE-0103');
  });

  it('TE-0104 NO_TRAIT_FILES: constant is defined', () => {
    expect(ErrorCodes.NO_TRAIT_FILES).toBe('TE-0104');
  });
});

// ---------------------------------------------------------------------------
// TE-02XX — Parameter errors
// ---------------------------------------------------------------------------

describe('error code coverage: TE-02XX parameter errors', () => {
  it('TE-0201 INVALID_PARAMETER_TYPE: triggered by wrong type for a required param', () => {
    const validator = new ParameterValidator();
    // Stateful expects initialState: string — pass a number to trigger type error
    const result = validator.validate('Stateful', {
      states: ['draft', 'active'],
      initialState: 42,
    });
    expect(result.valid).toBe(false);
    const typeIssue = result.issues.find((i) => i.code === ErrorCodes.INVALID_PARAMETER_TYPE);
    expect(typeIssue).toBeDefined();
    expect(typeIssue!.code).toBe('TE-0201');
  });

  it('TE-0202 MISSING_REQUIRED_PARAMETER: triggered by omitting a required param', () => {
    const validator = new ParameterValidator();
    // Stateful requires both states and initialState
    const result = validator.validate('Stateful', {});
    expect(result.valid).toBe(false);
    const missingIssue = result.issues.find((i) => i.code === ErrorCodes.MISSING_REQUIRED_PARAMETER);
    expect(missingIssue).toBeDefined();
    expect(missingIssue!.code).toBe('TE-0202');
  });

  it('TE-0203 INVALID_PARAMETER_VALUE: triggered by an out-of-spec value', () => {
    const validator = new ParameterValidator();
    // Colorized requires uniqueItems — duplicates trigger INVALID_PARAMETER_VALUE
    const result = validator.validate('Colorized', {
      colorStates: ['neutral', 'neutral'],
    });
    expect(result.valid).toBe(false);
    const valueIssue = result.issues.find((i) => i.code === ErrorCodes.INVALID_PARAMETER_VALUE);
    expect(valueIssue).toBeDefined();
    expect(valueIssue!.code).toBe('TE-0203');
  });

  it('TE-0204 UNKNOWN_PARAMETER: triggered by an extra property with additionalProperties:false', () => {
    const validator = new ParameterValidator();
    // Stateful has additionalProperties: false
    const result = validator.validate('Stateful', {
      states: ['draft', 'active'],
      initialState: 'draft',
      bogusProperty: true,
    });
    expect(result.valid).toBe(false);
    const unknownIssue = result.issues.find((i) => i.code === ErrorCodes.UNKNOWN_PARAMETER);
    expect(unknownIssue).toBeDefined();
    expect(unknownIssue!.code).toBe('TE-0204');
  });
});

// ---------------------------------------------------------------------------
// TE-03XX — Composition errors
// ---------------------------------------------------------------------------

describe('error code coverage: TE-03XX composition errors', () => {
  it('TE-0301 PROPERTY_COLLISION: triggered by collision metadata', () => {
    const composed = createEmptyComposedObject('test', 'Test');
    composed.traits = [makeTrait('A'), makeTrait('B')];
    composed.metadata.traitOrder = ['A', 'B'];
    composed.metadata.traitCount = 2;
    composed.metadata.collisions = [{
      fieldName: 'name',
      conflictingTraits: ['A', 'B'],
      resolution: 'stricter_type',
      details: 'test',
      winner: 'A',
    }];

    const issues = issuesByCode(composed, ErrorCodes.PROPERTY_COLLISION);
    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe('TE-0301');
  });

  it('TE-0302 CIRCULAR_DEPENDENCY: constant is defined (no producing rule yet)', () => {
    expect(ErrorCodes.CIRCULAR_DEPENDENCY).toBe('TE-0302');
  });

  it('TE-0303 MISSING_DEPENDENCY: triggered by an unsatisfied required dependency', () => {
    const composed = createEmptyComposedObject('test', 'Test');
    composed.traits = [makeTrait('NeedyTrait', { dependencies: ['MissingTrait'] })];
    composed.metadata.traitOrder = ['NeedyTrait'];
    composed.metadata.traitCount = 1;

    const issues = issuesByCode(composed, ErrorCodes.MISSING_DEPENDENCY);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].code).toBe('TE-0303');
  });

  it('TE-0304 INCOMPATIBLE_TRAITS: constant is defined (no producing rule yet)', () => {
    expect(ErrorCodes.INCOMPATIBLE_TRAITS).toBe('TE-0304');
  });

  it('TE-0305 STATE_OWNERSHIP_CONFLICT: triggered by multiple state machine owners', () => {
    const composed = createEmptyComposedObject('test', 'Test');
    composed.traits = [
      makeTrait('A', { state_machine: { states: ['x'], initial: 'x', transitions: [] } }),
      makeTrait('B', { state_machine: { states: ['y'], initial: 'y', transitions: [] } }),
    ];
    composed.metadata.traitOrder = ['A', 'B'];
    composed.metadata.traitCount = 2;

    const issues = issuesByCode(composed, ErrorCodes.STATE_OWNERSHIP_CONFLICT);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].code).toBe('TE-0305');
  });

  it('TE-0306 TOKEN_MAPPING_MISSING: triggered by semantic referencing absent tokens', () => {
    const composed = createEmptyComposedObject('test', 'Test');
    composed.traits = [makeTrait('A')];
    composed.schema = { title: { type: 'string', required: true } };
    composed.semantics = {
      title: { semantic_type: 'text', token_mapping: 'tokenMap(missing.namespace.*)' },
    };
    composed.tokens = {} as TokenDefinition;
    composed.metadata.traitOrder = ['A'];
    composed.metadata.traitCount = 1;

    const issues = issuesByCode(composed, ErrorCodes.TOKEN_MAPPING_MISSING);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].code).toBe('TE-0306');
  });

  it('TE-0307 VIEW_EXTENSION_INVALID: triggered by unsupported view context', () => {
    const composed = createEmptyComposedObject('test', 'Test');
    composed.traits = [makeTrait('A')];
    composed.viewExtensions = {
      unsupported_context: [{ component: 'X', props: {} }],
    };
    composed.metadata.traitOrder = ['A'];
    composed.metadata.traitCount = 1;

    const issues = issuesByCode(composed, ErrorCodes.VIEW_EXTENSION_INVALID);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].code).toBe('TE-0307');
  });

  it('TE-0308 SEMANTIC_MAPPING_INCOMPLETE: triggered by orphaned semantic mapping', () => {
    const composed = createEmptyComposedObject('test', 'Test');
    composed.traits = [makeTrait('A')];
    composed.schema = {}; // Empty schema — no fields
    composed.semantics = {
      ghost_field: { semantic_type: 'text', token_mapping: '' },
    };
    composed.metadata.traitOrder = ['A'];
    composed.metadata.traitCount = 1;

    const issues = issuesByCode(composed, ErrorCodes.SEMANTIC_MAPPING_INCOMPLETE);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].code).toBe('TE-0308');
  });
});

// ---------------------------------------------------------------------------
// TE-04XX — Runtime errors
// ---------------------------------------------------------------------------

describe('error code coverage: TE-04XX runtime errors', () => {
  it('TE-0401 INVALID_STATE_TRANSITION: constant is defined (no producing rule yet)', () => {
    expect(ErrorCodes.INVALID_STATE_TRANSITION).toBe('TE-0401');
  });

  it('TE-0402 MISSING_STATE: constant is defined (no producing rule yet)', () => {
    expect(ErrorCodes.MISSING_STATE).toBe('TE-0402');
  });
});

// ---------------------------------------------------------------------------
// Summary: all 18 codes are accounted for
// ---------------------------------------------------------------------------

describe('error code registry completeness', () => {
  it('ErrorCodes has exactly 18 entries', () => {
    const codeCount = Object.keys(ErrorCodes).length;
    expect(codeCount).toBe(18);
  });

  it('all code values match TE-XXYY pattern', () => {
    for (const [key, value] of Object.entries(ErrorCodes)) {
      expect(value).toMatch(/^TE-\d{4}$/);
    }
  });
});
