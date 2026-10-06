import { describe, expect, it } from 'vitest';

import {
  CompositionValidator,
  ErrorCodes,
} from '../../src/validation/index.js';
import { createEmptyComposedObject } from '../../src/core/composed-object.js';
import type { ComposedObject } from '../../src/core/composed-object.js';
import type { TraitDefinition, TokenDefinition } from '../../src/core/trait-definition.js';
import type { ValidationIssue } from '../../src/validation/types.js';

// ---------------------------------------------------------------------------
// Fixture helpers
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

function buildBaseComposition(): ComposedObject {
  const titleTrait = makeTrait('TitleTrait', {
    schema: { title: { type: 'string', required: true } },
    semantics: {
      title: {
        semantic_type: 'text.title',
        token_mapping: 'tokenMap(text.title.*)',
        ui_hints: { component: 'TitleInput' },
      },
    },
    view_extensions: {
      detail: [{ component: 'TitleBlock', props: { field: 'title' } }],
    },
    tokens: { text: { title: { primary: '#111111' } } } as TokenDefinition,
  });

  const statusTrait = makeTrait('StatusTrait', {
    schema: { status: { type: 'string', required: true } },
    semantics: {
      status: {
        semantic_type: 'status.state',
        token_mapping: 'tokenMap(status.state.*)',
        ui_hints: { component: 'StatusBadge' },
      },
    },
    view_extensions: {
      detail: [{ component: 'StatusTimeline', props: { field: 'status' } }],
    },
    tokens: { status: { state: { draft: '#ccc', active: '#0f0' } } } as TokenDefinition,
  });

  const composed = createEmptyComposedObject('enriched-test', 'Enriched Test');
  composed.schema = {
    title: { type: 'string', required: true },
    status: { type: 'string', required: true },
  };
  composed.semantics = {
    title: { semantic_type: 'text.title', token_mapping: 'tokenMap(text.title.*)' },
    status: { semantic_type: 'status.state', token_mapping: 'tokenMap(status.state.*)' },
  };
  composed.tokens = {
    text: { title: { primary: '#111111' } },
    status: { state: { draft: '#ccc', active: '#0f0' } },
  } as TokenDefinition;
  composed.viewExtensions = {
    detail: [
      { component: 'TitleBlock', props: { field: 'title' } },
      { component: 'StatusTimeline', props: { field: 'status' } },
    ],
  };
  composed.actions = [];
  composed.traits = [titleTrait, statusTrait];
  composed.metadata.traitOrder = ['TitleTrait', 'StatusTrait'];
  composed.metadata.traitCount = 2;
  composed.metadata.collisions = [];
  composed.metadata.warnings = [];
  composed.metadata.provenance.set('title', {
    fieldName: 'title', source: 'TitleTrait', layer: 'trait', order: 0,
  });
  composed.metadata.provenance.set('status', {
    fieldName: 'status', source: 'StatusTrait', layer: 'trait', order: 1,
  });
  return composed;
}

function validate(composed: ComposedObject): ValidationIssue[] {
  return new CompositionValidator().validate(composed).issues;
}

function findByCode(issues: ValidationIssue[], code: string): ValidationIssue[] {
  return issues.filter((i) => i.code === code);
}

// ---------------------------------------------------------------------------
// Contract: new fields are additive — a clean composition has no extra fields
// ---------------------------------------------------------------------------

describe('error context enrichment — backward compatibility', () => {
  it('well-formed composition produces no issues and no new fields appear', () => {
    const composed = buildBaseComposition();
    const result = new CompositionValidator().validate(composed);

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('traitPath and impactedTraits are optional — absent on non-composition issues', () => {
    const composed = buildBaseComposition();
    const result = new CompositionValidator().validate(composed);

    for (const issue of result.issues) {
      // They should be undefined or an array — never a non-array truthy value
      if (issue.traitPath !== undefined) expect(Array.isArray(issue.traitPath)).toBe(true);
      if (issue.impactedTraits !== undefined) expect(Array.isArray(issue.impactedTraits)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Contract: traitPath populated for each error category
// ---------------------------------------------------------------------------

describe('error context enrichment — traitPath', () => {
  it('MISSING_DEPENDENCY: traitPath includes the dependent trait and the missing trait', () => {
    const composed = buildBaseComposition();
    composed.traits.push(
      makeTrait('Commentable', {
        schema: { comments_enabled: { type: 'boolean', required: true } },
        semantics: {
          comments_enabled: {
            semantic_type: 'boolean.toggle',
            token_mapping: 'tokenMap(text.title.*)',
          },
        },
        dependencies: ['ReviewableTrait'],
        view_extensions: {
          detail: [{ component: 'CommentToggle', props: { field: 'comments_enabled' } }],
        },
        tokens: { text: { title: { primary: '#111' } } } as TokenDefinition,
      })
    );
    composed.schema.comments_enabled = { type: 'boolean', required: true };
    composed.semantics.comments_enabled = {
      semantic_type: 'boolean.toggle',
      token_mapping: 'tokenMap(text.title.*)',
    };
    composed.metadata.traitOrder.push('Commentable');
    composed.metadata.traitCount += 1;
    composed.metadata.provenance.set('comments_enabled', {
      fieldName: 'comments_enabled', source: 'Commentable', layer: 'trait', order: 2,
    });

    const issues = findByCode(validate(composed), ErrorCodes.MISSING_DEPENDENCY);
    expect(issues.length).toBeGreaterThan(0);

    const issue = issues[0];
    expect(issue.traitPath).toBeDefined();
    expect(issue.traitPath).toContain('Commentable');
    expect(issue.traitPath).toContain('ReviewableTrait');
  });

  it('PROPERTY_COLLISION: traitPath lists the conflicting traits', () => {
    const composed = buildBaseComposition();
    composed.metadata.collisions.push({
      fieldName: 'status',
      conflictingTraits: ['StatusTrait', 'WorkflowTrait'],
      resolution: 'stricter_type',
      details: 'StatusTrait provided stricter constraints',
      winner: 'StatusTrait',
    });

    const issues = findByCode(validate(composed), ErrorCodes.PROPERTY_COLLISION);
    expect(issues.length).toBeGreaterThan(0);

    const issue = issues[0];
    expect(issue.traitPath).toBeDefined();
    expect(issue.traitPath).toEqual(['StatusTrait', 'WorkflowTrait']);
  });

  it('STATE_OWNERSHIP_CONFLICT: traitPath lists all state machine providers', () => {
    const composed = createEmptyComposedObject('state-test', 'State Test');
    const stateTokens = { lifecycle: { status: { draft: '#aaa', active: '#0f0' } } } as TokenDefinition;

    const traitA = makeTrait('PrimaryStateful', {
      schema: { status: { type: 'string', required: true } },
      state_machine: {
        states: ['draft', 'active'],
        initial: 'draft',
        transitions: [{ from: 'draft', to: 'active' }],
      },
      semantics: { status: { semantic_type: 'status.lifecycle', token_mapping: 'tokenMap(lifecycle.status.*)' } },
      view_extensions: { detail: [{ component: 'LifecycleBadge', props: { field: 'status' } }] },
      tokens: stateTokens,
    });

    const traitB = makeTrait('Workflow', {
      schema: { workflow_state: { type: 'string', required: true } },
      state_machine: {
        states: ['pending', 'approved'],
        initial: 'pending',
        transitions: [{ from: 'pending', to: 'approved' }],
      },
      semantics: { workflow_state: { semantic_type: 'status.workflow', token_mapping: 'tokenMap(lifecycle.status.*)' } },
      view_extensions: { detail: [{ component: 'WorkflowBadge', props: { field: 'workflow_state' } }] },
      tokens: stateTokens,
    });

    composed.schema = {
      status: { type: 'string', required: true },
      workflow_state: { type: 'string', required: true },
    };
    composed.semantics = {
      status: { semantic_type: 'status.lifecycle', token_mapping: 'tokenMap(lifecycle.status.*)' },
      workflow_state: { semantic_type: 'status.workflow', token_mapping: 'tokenMap(lifecycle.status.*)' },
    };
    composed.tokens = stateTokens;
    composed.viewExtensions = {
      detail: [
        { component: 'LifecycleBadge', props: { field: 'status' } },
        { component: 'WorkflowBadge', props: { field: 'workflow_state' } },
      ],
    };
    composed.traits = [traitA, traitB];
    composed.stateMachine = {
      ownerTrait: 'PrimaryStateful',
      definition: traitA.state_machine!,
    };
    composed.metadata.traitOrder = ['PrimaryStateful', 'Workflow'];
    composed.metadata.traitCount = 2;
    composed.metadata.collisions = [];
    composed.metadata.warnings = [];
    composed.metadata.provenance.set('status', {
      fieldName: 'status', source: 'PrimaryStateful', layer: 'trait', order: 0,
    });
    composed.metadata.provenance.set('workflow_state', {
      fieldName: 'workflow_state', source: 'Workflow', layer: 'trait', order: 1,
    });

    const issues = findByCode(validate(composed), ErrorCodes.STATE_OWNERSHIP_CONFLICT);
    expect(issues.length).toBeGreaterThan(0);

    const conflict = issues[0];
    expect(conflict.traitPath).toBeDefined();
    expect(conflict.traitPath).toContain('PrimaryStateful');
    expect(conflict.traitPath).toContain('Workflow');
  });

  it('TOKEN_MAPPING_MISSING: traitPath includes the source trait from provenance', () => {
    const composed = buildBaseComposition();
    // Drop status tokens so the status semantic mapping fails
    composed.tokens = { text: { title: { primary: '#111' } } } as TokenDefinition;

    const issues = findByCode(validate(composed), ErrorCodes.TOKEN_MAPPING_MISSING);
    expect(issues.length).toBeGreaterThan(0);

    const issue = issues[0];
    expect(issue.traitPath).toBeDefined();
    expect(issue.traitPath).toContain('StatusTrait');
  });

  it('VIEW_EXTENSION_INVALID (bad field binding): traitPath identifies the contributing trait', () => {
    const composed = buildBaseComposition();
    composed.viewExtensions.detail?.push({
      component: 'TitleBlock',
      props: { field: 'nonexistent_field' },
    });

    const issues = findByCode(validate(composed), ErrorCodes.VIEW_EXTENSION_INVALID);
    expect(issues.length).toBeGreaterThan(0);

    const issue = issues[0];
    expect(issue.traitPath).toBeDefined();
    expect(issue.traitPath).toContain('TitleTrait');
  });

  it('VIEW_EXTENSION_INVALID (bad context): traitPath lists traits emitting to that context', () => {
    const composed = buildBaseComposition();
    // Add a trait that contributes to an unsupported view context
    composed.traits.push(
      makeTrait('DashboardTrait', {
        view_extensions: { dashboard: [{ component: 'DashCard', props: {} }] },
      })
    );
    composed.viewExtensions.dashboard = [{ component: 'DashCard', props: {} }];

    const issues = findByCode(validate(composed), ErrorCodes.VIEW_EXTENSION_INVALID);
    const contextIssue = issues.find((i) => i.message.includes('dashboard'));
    expect(contextIssue).toBeDefined();
    expect(contextIssue!.traitPath).toBeDefined();
    expect(contextIssue!.traitPath).toContain('DashboardTrait');
  });
});

// ---------------------------------------------------------------------------
// Contract: impactedTraits populated where downstream effects exist
// ---------------------------------------------------------------------------

describe('error context enrichment — impactedTraits', () => {
  it('MISSING_DEPENDENCY: impactedTraits includes other traits that share the same dependency', () => {
    const composed = buildBaseComposition();
    composed.traits.push(
      makeTrait('Commentable', {
        dependencies: ['SharedDep'],
        schema: { comments: { type: 'boolean', required: true } },
        semantics: { comments: { semantic_type: 'bool', token_mapping: 'tokenMap(text.title.*)' } },
        tokens: { text: { title: { primary: '#111' } } } as TokenDefinition,
      }),
      makeTrait('Reviewable', {
        dependencies: ['SharedDep'],
        schema: { reviews: { type: 'boolean', required: true } },
        semantics: { reviews: { semantic_type: 'bool', token_mapping: 'tokenMap(text.title.*)' } },
        tokens: { text: { title: { primary: '#111' } } } as TokenDefinition,
      })
    );
    composed.schema.comments = { type: 'boolean', required: true };
    composed.schema.reviews = { type: 'boolean', required: true };
    composed.semantics.comments = { semantic_type: 'bool', token_mapping: 'tokenMap(text.title.*)' };
    composed.semantics.reviews = { semantic_type: 'bool', token_mapping: 'tokenMap(text.title.*)' };
    composed.metadata.traitOrder.push('Commentable', 'Reviewable');
    composed.metadata.traitCount += 2;

    const issues = findByCode(validate(composed), ErrorCodes.MISSING_DEPENDENCY);
    expect(issues.length).toBe(2); // One per trait

    // Each issue should list the other trait as impacted
    const commentableIssue = issues.find((i) => i.traitPath?.includes('Commentable'));
    expect(commentableIssue?.impactedTraits).toContain('Reviewable');

    const reviewableIssue = issues.find((i) => i.traitPath?.includes('Reviewable'));
    expect(reviewableIssue?.impactedTraits).toContain('Commentable');
  });

  it('STATE_OWNERSHIP_CONFLICT: impactedTraits lists non-provider traits in the composition', () => {
    const composed = createEmptyComposedObject('impact-state', 'Impact State');
    const tokens = { lifecycle: { status: { draft: '#aaa' } } } as TokenDefinition;

    composed.traits = [
      makeTrait('StatefulA', {
        state_machine: { states: ['a'], initial: 'a', transitions: [] },
        tokens,
      }),
      makeTrait('StatefulB', {
        state_machine: { states: ['b'], initial: 'b', transitions: [] },
        tokens,
      }),
      makeTrait('Observer', { tokens }),
    ];
    composed.tokens = tokens;
    composed.metadata.traitOrder = ['StatefulA', 'StatefulB', 'Observer'];
    composed.metadata.traitCount = 3;
    composed.metadata.collisions = [];
    composed.metadata.warnings = [];

    const issues = findByCode(validate(composed), ErrorCodes.STATE_OWNERSHIP_CONFLICT);
    const multiOwner = issues.find((i) => i.message.includes('Multiple'));
    expect(multiOwner).toBeDefined();
    expect(multiOwner!.impactedTraits).toBeDefined();
    expect(multiOwner!.impactedTraits).toContain('Observer');
    expect(multiOwner!.impactedTraits).not.toContain('StatefulA');
    expect(multiOwner!.impactedTraits).not.toContain('StatefulB');
  });

  it('PROPERTY_COLLISION: impactedTraits lists traits referencing the collided field', () => {
    const composed = buildBaseComposition();
    // Add a third trait that references 'status' in its view extensions
    composed.traits.push(
      makeTrait('DerivedTrait', {
        view_extensions: {
          detail: [{ component: 'DerivedView', props: { field: 'status' } }],
        },
      })
    );
    composed.metadata.collisions.push({
      fieldName: 'status',
      conflictingTraits: ['StatusTrait', 'WorkflowTrait'],
      resolution: 'stricter_type',
      details: 'test collision',
      winner: 'StatusTrait',
    });

    const issues = findByCode(validate(composed), ErrorCodes.PROPERTY_COLLISION);
    expect(issues.length).toBeGreaterThan(0);

    const issue = issues[0];
    expect(issue.impactedTraits).toBeDefined();
    expect(issue.impactedTraits).toContain('DerivedTrait');
    // The colliders themselves should NOT be in impactedTraits
    expect(issue.impactedTraits).not.toContain('StatusTrait');
    expect(issue.impactedTraits).not.toContain('WorkflowTrait');
  });
});

// ---------------------------------------------------------------------------
// Contract: fixHint is always a string or null, never undefined
// ---------------------------------------------------------------------------

describe('error context enrichment — fixHint contract', () => {
  it('every composition issue has a non-undefined fixHint', () => {
    const composed = buildBaseComposition();
    // Trigger multiple error types
    composed.tokens = {} as TokenDefinition; // token mapping missing
    composed.viewExtensions.dashboard = [{ component: 'X', props: { field: 'title' } }]; // bad context

    const issues = validate(composed);
    expect(issues.length).toBeGreaterThan(0);

    for (const issue of issues) {
      expect(issue.fixHint).not.toBeUndefined();
      expect(typeof issue.fixHint === 'string' || issue.fixHint === null).toBe(true);
    }
  });

  it('MISSING_DEPENDENCY fixHint names the missing trait', () => {
    const composed = buildBaseComposition();
    composed.traits.push(
      makeTrait('NeedsDep', {
        dependencies: ['MissingTrait'],
        schema: { x: { type: 'string', required: true } },
        semantics: { x: { semantic_type: 'text', token_mapping: 'tokenMap(text.title.*)' } },
        tokens: { text: { title: { primary: '#111' } } } as TokenDefinition,
      })
    );
    composed.schema.x = { type: 'string', required: true };
    composed.semantics.x = { semantic_type: 'text', token_mapping: 'tokenMap(text.title.*)' };
    composed.metadata.traitOrder.push('NeedsDep');
    composed.metadata.traitCount += 1;

    const issues = findByCode(validate(composed), ErrorCodes.MISSING_DEPENDENCY);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].fixHint).toContain('MissingTrait');
  });

  it('TOKEN_MAPPING_MISSING fixHint names the source trait when available', () => {
    const composed = buildBaseComposition();
    composed.tokens = { text: { title: { primary: '#111' } } } as TokenDefinition;

    const issues = findByCode(validate(composed), ErrorCodes.TOKEN_MAPPING_MISSING);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].fixHint).toContain('StatusTrait');
  });
});

// ---------------------------------------------------------------------------
// Contract: traitPath and impactedTraits are arrays of strings
// ---------------------------------------------------------------------------

describe('error context enrichment — type safety', () => {
  it('traitPath entries are all strings when present', () => {
    const composed = buildBaseComposition();
    composed.metadata.collisions.push({
      fieldName: 'status',
      conflictingTraits: ['StatusTrait', 'OtherTrait'],
      resolution: 'stricter_type',
      details: 'test',
      winner: 'StatusTrait',
    });

    const issues = validate(composed);
    for (const issue of issues) {
      if (issue.traitPath) {
        expect(Array.isArray(issue.traitPath)).toBe(true);
        for (const entry of issue.traitPath) {
          expect(typeof entry).toBe('string');
        }
      }
    }
  });

  it('impactedTraits entries are all strings when present', () => {
    const composed = buildBaseComposition();
    composed.traits.push(
      makeTrait('DerivedTrait', {
        view_extensions: {
          detail: [{ component: 'DerivedView', props: { field: 'status' } }],
        },
      })
    );
    composed.metadata.collisions.push({
      fieldName: 'status',
      conflictingTraits: ['StatusTrait', 'WorkflowTrait'],
      resolution: 'stricter_type',
      details: 'test',
      winner: 'StatusTrait',
    });

    const issues = validate(composed);
    for (const issue of issues) {
      if (issue.impactedTraits) {
        expect(Array.isArray(issue.impactedTraits)).toBe(true);
        for (const entry of issue.impactedTraits) {
          expect(typeof entry).toBe('string');
        }
      }
    }
  });
});
