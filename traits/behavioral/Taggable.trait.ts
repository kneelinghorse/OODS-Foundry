import type { TraitDefinition } from '../../src/core/trait-definition.ts';

export const TAGGABLE_DEFAULT_MAX_TAGS = 10 as const;

export type SynonymResolution = 'none' | 'suggest' | 'auto';

const TaggableTrait = {
  trait: {
    name: 'Taggable',
    version: '2.0.0',
    description:
      'Adds configurable tag management with guardrails for custom authoring, taxonomy alignment, ' +
      'and tag governance. Supports moderation workflows and synonym resolution.',
    category: 'behavioral',
    tags: ['tagging', 'classification', 'metadata', 'discovery', 'governance', 'taxonomy'],
  },

  parameters: [
    {
      name: 'maxTags',
      type: 'number',
      required: false,
      description: 'Maximum number of tags that can be attached to an entity.',
      default: TAGGABLE_DEFAULT_MAX_TAGS,
      validation: {
        minimum: 1,
        maximum: 64,
      },
    },
    {
      name: 'allowCustomTags',
      type: 'boolean',
      required: false,
      description:
        'Whether editors may author tags outside of the approved allow list.',
      default: true,
    },
    {
      name: 'allowedTags',
      type: 'string[]',
      required: false,
      description:
        'Curated allow list of permitted tags. Strict when allowCustomTags=false, suggestive otherwise.',
      validation: {
        minItems: 1,
        uniqueItems: true,
        items: {
          minLength: 1,
          maxLength: 64,
        },
      },
    },
    {
      name: 'caseSensitive',
      type: 'boolean',
      required: false,
      description: 'Whether tag comparisons should treat casing as significant.',
      default: false,
    },
    {
      name: 'tagMinLength',
      type: 'number',
      required: false,
      description: 'Minimum character length for a tag value.',
      default: 2,
      validation: {
        minimum: 1,
        maximum: 32,
      },
    },
    {
      name: 'tagMaxLength',
      type: 'number',
      required: false,
      description: 'Maximum character length for a tag value.',
      default: 64,
      validation: {
        minimum: 1,
        maximum: 256,
      },
    },
    {
      name: 'allowTagModeration',
      type: 'boolean',
      required: false,
      description:
        'When true, custom tags enter "pending" state and require moderator approval.',
      default: false,
    },
    {
      name: 'synonymResolution',
      type: 'string',
      required: false,
      description:
        'Synonym handling mode: "none", "suggest" (suggest canonical form), or "auto" (auto-replace).',
      default: 'none',
      validation: {
        enum: ['none', 'suggest', 'auto'],
      },
    },
  ] as const,

  schema: {
    tags: {
      type: 'string[]',
      required: false,
      description: 'Ordered list of tags assigned to the entity.',
      default: [],
      validation: {
        maxItems: 64,
      },
    },
    tag_count: {
      type: 'number',
      required: true,
      description: 'Computed number of tags assigned to the entity.',
      default: 0,
      validation: {
        minimum: 0,
      },
    },
    tag_metadata: {
      type: 'string',
      required: false,
      description:
        'Per-tag governance metadata (JSON array). Entries: tag, created_at, created_by, usage_count, ' +
        'moderation_status, canonical_form.',
      default: '[]',
    },
  },

  semantics: {
    tags: {
      semantic_type: 'taxonomy.tag.collection',
      token_mapping: 'tokenMap(taxonomy.tag.*)',
      ui_hints: {
        component: 'TagCollection',
        allowCreateParameter: 'allowCustomTags',
        allowListParameter: 'allowedTags',
        caseSensitiveParameter: 'caseSensitive',
      },
    },
    tag_count: {
      semantic_type: 'metric.collection.count',
      token_mapping: 'tokenMap(taxonomy.tag.count)',
      ui_hints: {
        component: 'MetricBadge',
        format: 'integer',
      },
    },
    tag_metadata: {
      semantic_type: 'taxonomy.tag.governance',
      token_mapping: 'computed',
      ui_hints: {
        component: 'TagGovernancePanel',
      },
    },
  },

  view_extensions: {
    list: [
      {
        component: 'TagPills',
        props: {
          field: 'tags',
          maxVisible: 3,
          overflowLabel: '+{{ tag_count }}',
        },
      },
    ],
    detail: [
      {
        component: 'TagManager',
        position: 'top',
        props: {
          field: 'tags',
          allowCustomParameter: 'allowCustomTags',
          allowListParameter: 'allowedTags',
          maxTagsParameter: 'maxTags',
          moderationParameter: 'allowTagModeration',
          synonymParameter: 'synonymResolution',
        },
      },
    ],
    form: [
      {
        component: 'TagInput',
        position: 'top',
        props: {
          field: 'tags',
          maxTagsParameter: 'maxTags',
          allowCustomParameter: 'allowCustomTags',
          allowListParameter: 'allowedTags',
          minLengthParameter: 'tagMinLength',
          maxLengthParameter: 'tagMaxLength',
          synonymParameter: 'synonymResolution',
        },
      },
    ],
    card: [
      {
        component: 'TagSummary',
        position: 'after',
        props: {
          field: 'tags',
          countField: 'tag_count',
        },
      },
    ],
  },

  tokens: {
    'taxonomy.tag.chip.bg': 'var(--surface-tag-bg)',
    'taxonomy.tag.chip.text': 'var(--surface-tag-text)',
    'taxonomy.tag.chip.border': 'var(--sys-border-default)',
    'taxonomy.tag.chip.hover.bg': 'var(--sys-surface-hover)',
    'taxonomy.tag.chip.pending.bg': 'var(--sys-status-warning-surface)',
    'taxonomy.tag.chip.pending.text': 'var(--sys-status-warning-text)',
    'taxonomy.tag.summary.count': 'var(--text-subtle)',
    'taxonomy.tag.input.border': 'var(--sys-border-default)',
    'taxonomy.tag.input.focus.border': 'var(--sys-border-focus)',
  },

  dependencies: [] as const,

  metadata: {
    created: '2025-10-12',
    updated: '2026-02-28',
    owners: ['design@oods.systems', 'taxonomy@oods.systems'],
    maturity: 'stable',
    accessibility: {
      keyboard:
        'TagInput: Type to filter, Enter to confirm, Backspace to remove last, ' +
        'Arrow keys for autocomplete, Escape to dismiss, Tab to exit.',
      screenreader:
        'Tag list announced as group with count. Pending tags announce moderation status. ' +
        'TagInput announces suggestion count on keystroke.',
    },
    regionsUsed: ['list', 'detail', 'form', 'card'],
    examples: ['Knowledge Article', 'Incident', 'Product', 'Media'],
    references: ['Trait Engine Spec v0.1 section 2'],
  },
} as const satisfies TraitDefinition;

export default TaggableTrait;
