import { describe, expect, it } from 'vitest';

import {
  CompositionValidator,
  ErrorCodes,
} from '../../src/validation/index.js';
import { createEmptyComposedObject } from '../../src/core/composed-object.js';
import type { ComposedObject } from '../../src/core/composed-object.js';
import type { TraitDefinition, TokenDefinition } from '../../src/core/trait-definition.js';

function buildBaseComposition(): ComposedObject {
  const titleTrait: TraitDefinition = {
    trait: {
      name: 'TitleTrait',
      version: '1.0.0',
    },
    schema: {
      title: {
        type: 'string',
        required: true,
      },
    },
    semantics: {
      title: {
        semantic_type: 'text.title',
        token_mapping: 'tokenMap(text.title.*)',
        ui_hints: {
          component: 'TitleInput',
        },
      },
    },
    view_extensions: {
      detail: [
        {
          component: 'TitleBlock',
          props: {
            field: 'title',
          },
        },
      ],
    },
    tokens: {
      text: {
        title: {
          primary: '#111111',
        },
      },
    } as TokenDefinition,
    dependencies: [],
    actions: [],
  };

  const statusTrait: TraitDefinition = {
    trait: {
      name: 'StatusTrait',
      version: '1.0.0',
    },
    schema: {
      status: {
        type: 'string',
        required: true,
      },
    },
    semantics: {
      status: {
        semantic_type: 'status.state',
        token_mapping: 'tokenMap(status.state.*)',
        ui_hints: {
          component: 'StatusBadge',
        },
      },
    },
    view_extensions: {
      detail: [
        {
          component: 'StatusTimeline',
          props: {
            field: 'status',
          },
        },
      ],
    },
    tokens: {
      status: {
        state: {
          draft: '#cccccc',
          active: '#00ff00',
        },
      },
    } as TokenDefinition,
    dependencies: [],
    actions: [],
  };

  const composed = createEmptyComposedObject('demo', 'Demo Object');
  composed.schema = {
    title: {
      type: 'string',
      required: true,
    },
    status: {
      type: 'string',
      required: true,
    },
  };
  composed.semantics = {
    title: {
      semantic_type: 'text.title',
      token_mapping: 'tokenMap(text.title.*)',
    },
    status: {
      semantic_type: 'status.state',
      token_mapping: 'tokenMap(status.state.*)',
    },
  };

  composed.tokens = {
    text: {
      title: {
        primary: '#111111',
      },
    },
    status: {
      state: {
        draft: '#cccccc',
        active: '#00ff00',
      },
    },
  } as TokenDefinition;

  composed.viewExtensions = {
    detail: [
      {
        component: 'TitleBlock',
        props: {
          field: 'title',
        },
      },
      {
        component: 'StatusTimeline',
        props: {
          field: 'status',
        },
      },
    ],
  };

  composed.actions = [];
  composed.traits = [titleTrait, statusTrait];
  composed.metadata.traitOrder = ['TitleTrait', 'StatusTrait'];
  composed.metadata.traitCount = 2;
  composed.metadata.collisions = [];
  composed.metadata.warnings = [];
  composed.metadata.provenance.set('title', {
    fieldName: 'title',
    source: 'TitleTrait',
    layer: 'trait',
    order: 0,
  });
  composed.metadata.provenance.set('status', {
    fieldName: 'status',
    source: 'StatusTrait',
    layer: 'trait',
    order: 1,
  });

  return composed;
}

describe('CompositionValidator', () => {
  it('passes for a well-formed composition', () => {
    const composed = buildBaseComposition();
    const validator = new CompositionValidator();
    const result = validator.validate(composed);

    expect(result.valid).toBe(true);
    expect(result.summary.errors).toBe(0);
    expect(validator.isWithinPerformanceBudget()).toBe(true);
  });

  it('detects missing required dependencies', () => {
    const composed = buildBaseComposition();

    composed.traits.push({
      trait: {
        name: 'Commentable',
        version: '1.0.0',
      },
      schema: {
        comments_enabled: {
          type: 'boolean',
          required: true,
        },
      },
      semantics: {
        comments_enabled: {
          semantic_type: 'boolean.toggle',
          token_mapping: 'tokenMap(text.title.*)',
        },
      },
      tokens: {
        text: {
          title: {
            primary: '#111111',
          },
        },
      } as TokenDefinition,
      dependencies: ['ReviewableTrait'],
      view_extensions: {
        detail: [
          {
            component: 'CommentToggle',
            props: {
              field: 'comments_enabled',
            },
          },
        ],
      },
      actions: [],
    });

    composed.schema.comments_enabled = {
      type: 'boolean',
      required: true,
    };
    composed.semantics.comments_enabled = {
      semantic_type: 'boolean.toggle',
      token_mapping: 'tokenMap(text.title.*)',
    };
    composed.viewExtensions.detail?.push({
      component: 'CommentToggle',
      props: {
        field: 'comments_enabled',
      },
    });
    composed.metadata.traitOrder.push('Commentable');
    composed.metadata.traitCount += 1;
    composed.metadata.provenance.set('comments_enabled', {
      fieldName: 'comments_enabled',
      source: 'Commentable',
      layer: 'trait',
      order: 2,
    });

    const validator = new CompositionValidator();
    const result = validator.validate(composed);

    expect(result.valid).toBe(false);
    expect(result.summary.errors).toBeGreaterThan(0);
    expect(result.issues[0].code).toBe(ErrorCodes.MISSING_DEPENDENCY);
  });

  it('flags multiple state machine owners', () => {
    const composed = createEmptyComposedObject('stateful', 'Stateful Object');
    const stateTokens: TokenDefinition = {
      lifecycle: {
        status: {
          draft: '#aaaaaa',
          active: '#00ff00',
        },
      },
    };

    const stateKernel = {
      semantics: {
        status: {
          semantic_type: 'status.lifecycle',
          token_mapping: 'tokenMap(lifecycle.status.*)',
        },
      },
      view_extensions: {
        detail: [
          {
            component: 'LifecycleBadge',
            props: {
              field: 'status',
            },
          },
        ],
      },
      tokens: stateTokens,
      actions: [],
    };

    const traitA: TraitDefinition = {
      trait: { name: 'PrimaryStateful', version: '1.0.0' },
      schema: {
        status: { type: 'string', required: true },
      },
      state_machine: {
        states: ['draft', 'active'],
        initial: 'draft',
        transitions: [{ from: 'draft', to: 'active' }],
      },
      ...stateKernel,
      dependencies: [],
    };

    const traitB: TraitDefinition = {
      trait: { name: 'Workflow', version: '1.0.0' },
      schema: {
        workflow_state: { type: 'string', required: true },
      },
      state_machine: {
        states: ['pending', 'approved'],
        initial: 'pending',
        transitions: [{ from: 'pending', to: 'approved' }],
      },
      semantics: {
        workflow_state: {
          semantic_type: 'status.workflow',
          token_mapping: 'tokenMap(lifecycle.status.*)',
        },
      },
      view_extensions: {
        detail: [
          {
            component: 'WorkflowBadge',
            props: {
              field: 'workflow_state',
            },
          },
        ],
      },
      tokens: stateTokens,
      actions: [],
      dependencies: [],
    };

    composed.schema = {
      status: { type: 'string', required: true },
      workflow_state: { type: 'string', required: true },
    };
    composed.semantics = {
      status: stateKernel.semantics.status,
      workflow_state: traitB.semantics!.workflow_state!,
    };
    composed.tokens = stateTokens;
    composed.viewExtensions = {
      detail: [
        { component: 'LifecycleBadge', props: { field: 'status' } },
        { component: 'WorkflowBadge', props: { field: 'workflow_state' } },
      ],
    };
    composed.actions = [];
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
      fieldName: 'status',
      source: 'PrimaryStateful',
      layer: 'trait',
      order: 0,
    });
    composed.metadata.provenance.set('workflow_state', {
      fieldName: 'workflow_state',
      source: 'Workflow',
      layer: 'trait',
      order: 1,
    });

    const validator = new CompositionValidator();
    const result = validator.validate(composed);

    expect(result.valid).toBe(false);
    expect(result.summary.errors).toBeGreaterThan(0);
    expect(result.issues.some((issue) => issue.code === ErrorCodes.STATE_OWNERSHIP_CONFLICT)).toBe(true);
  });

  it('reports token mappings that lack backing tokens', () => {
    const composed = buildBaseComposition();
    composed.tokens = {
      text: {
        title: {
          primary: '#111111',
        },
      },
    } as TokenDefinition; // Drop status tokens intentionally

    const validator = new CompositionValidator();
    const result = validator.validate(composed);

    expect(result.valid).toBe(false);
    expect(result.issues[0].code).toBe(ErrorCodes.TOKEN_MAPPING_MISSING);
    expect(result.issues[0].location.path).toContain('status');
  });

  it('enforces canonical view regions and known field bindings', () => {
    const composed = buildBaseComposition();
    composed.viewExtensions.dashboard = [
      {
        component: 'DashboardCard',
        props: {
          field: 'title',
        },
      },
    ];

    composed.viewExtensions.detail?.push({
      component: 'SecondaryCard',
      props: {
        field: 'unknown_field',
      },
    });

    const validator = new CompositionValidator();
    const result = validator.validate(composed);

    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === ErrorCodes.VIEW_EXTENSION_INVALID)).toBe(true);
  });

  it('surfaces collision metadata as warnings', () => {
    const composed = buildBaseComposition();
    composed.metadata.collisions.push({
      fieldName: 'status',
      conflictingTraits: ['StatusTrait', 'OtherTrait'],
      resolution: 'stricter_type',
      details: 'StatusTrait provided stricter constraints',
      winner: 'StatusTrait',
    });

    const validator = new CompositionValidator();
    const result = validator.validate(composed);

    expect(result.valid).toBe(true);
    expect(result.summary.warnings).toBeGreaterThan(0);
    expect(result.issues[0].code).toBe(ErrorCodes.PROPERTY_COLLISION);
  });
});
