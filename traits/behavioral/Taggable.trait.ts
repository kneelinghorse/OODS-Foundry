import type { TraitDefinition } from '../../src/core/trait-definition.ts';

export const TAGGABLE_DEFAULT_MAX_TAGS = 10 as const;

const TaggableTrait = {
  trait: {
    name: 'Taggable',
    version: '1.0.0',
    description:
      'Adds configurable tag management with guardrails for custom authoring and taxonomy alignment.',
    category: 'behavioral',
    tags: ['tagging', 'classification', 'metadata', 'discovery'],
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
      description: 'Whether editors may author tags outside of the approved allow list.',
      default: true,
    },
    {
      name: 'allowedTags',
      type: 'string[]',
      required: false,
      description:
        'Curated allow list of permitted tags when custom creation is disabled.',
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
    'taxonomy.tag.summary.count': 'var(--text-subtle)',
  },

  dependencies: [] as const,

  metadata: {
    created: '2025-10-12',
    owners: ['design@oods.systems', 'taxonomy@oods.systems'],
    maturity: 'stable',
    accessibility: {
      keyboard: 'n/a',
      screenreader: 'Tag list announced with counts.',
    },
    regionsUsed: ['list', 'detail', 'forms', 'card'],
    examples: ['Knowledge Article', 'Incident'],
    references: ['Trait Engine Spec v0.1 §2'],
  },
} as const satisfies TraitDefinition;

export default TaggableTrait;
