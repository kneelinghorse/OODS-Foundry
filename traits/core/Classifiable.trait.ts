import type { TraitDefinition } from '../../src/core/trait-definition.ts';

export const CLASSIFIABLE_TRAIT_VERSION = '1.0.0';

const ClassifiableTrait = {
  trait: {
    name: 'Classifiable',
    version: CLASSIFIABLE_TRAIT_VERSION,
    description:
      'Canonical taxonomy + folksonomy trait supporting taxonomy, tag, and hybrid modes with governance metadata.',
    category: 'core',
    tags: ['taxonomy', 'tags', 'ltree', 'classification', 'governance'],
  },

  parameters: [
    {
      name: 'classification_mode',
      type: 'enum',
      required: true,
      description:
        'Operating mode for the trait: taxonomy (hierarchical), tag (folksonomy), or hybrid (WordPress terms pattern).',
      enumValues: ['taxonomy', 'tag', 'hybrid'],
      default: 'hybrid',
    },
    {
      name: 'hierarchy_storage_model',
      type: 'enum',
      required: false,
      description:
        'Preferred storage model for taxonomy trees. Materialized path defaults to PostgreSQL ltree for <3ms subtree queries.',
      enumValues: ['adjacency_list', 'materialized_path', 'closure_table'],
      default: 'materialized_path',
    },
    {
      name: 'tag_policy',
      type: 'enum',
      required: false,
      description:
        'Governance mode for tag creation. Locked = curated-only, moderated = queue before publish, open = user generated.',
      default: 'moderated',
      enumValues: ['locked', 'moderated', 'open'],
    },
    {
      name: 'max_tags',
      type: 'number',
      required: false,
      description: 'Maximum number of tags that may be assigned to an object (folksonomy guardrail).',
      default: 10,
      validation: {
        minimum: 1,
        maximum: 50,
      },
    },
    {
      name: 'require_primary_category',
      type: 'boolean',
      required: false,
      description: 'Enforce at least one primary taxonomy category for taxonomy/hybrid modes.',
      default: false,
    },
  ] as const,

  schema: {
    classification_metadata: {
      type: 'ClassificationMetadata',
      required: true,
      description: 'Operational metadata describing mode, storage model, governance configuration, and audit timestamps.',
      default: {
        mode: 'hybrid',
        hierarchyStorageModel: 'materialized_path',
        tagPolicy: 'moderated',
        tagLimit: 10,
        primaryCategoryRequired: false,
        governance: {
          synonymsEnabled: true,
          moderationQueue: true,
          spamHeuristics: {
            maxTagsPerItem: 20,
            velocityThreshold: 100,
          },
        },
        source: {},
      },
    },
    categories: {
      type: 'CategoryNode[]',
      required: false,
      description: 'Ordered list of taxonomy nodes attached to the object. Empty unless classification_mode includes taxonomy.',
      default: [],
    },
    primary_category_id: {
      type: 'string',
      required: false,
      description: 'Identifier of the canonical category surfaced for navigation, breadcrumbs, and default filters.',
    },
    primary_category_path: {
      type: 'string',
      required: false,
      description: 'Normalized breadcrumb path for display (e.g., Electronics › Mobile › Android).',
    },
    tags: {
      type: 'Tag[]',
      required: false,
      description: 'Canonical tag collection with governance metadata. Empty when classification_mode excludes tags.',
      default: [],
    },
    tag_count: {
      type: 'number',
      required: false,
      description: 'Derived count of canonical tags applied after synonym collapse.',
      default: 0,
      validation: {
        minimum: 0,
      },
    },
    tag_preview: {
      type: 'string',
      required: false,
      description: 'Denormalized comma-delimited preview for quick list renders and search indexing.',
    },
  },

  semantics: {
    classification_metadata: {
      semantic_type: 'classification.metadata',
      token_mapping: 'tokenMap(classification.metadata)',
      ui_hints: {
        component: 'ClassificationDiagnostics',
      },
    },
    categories: {
      semantic_type: 'classification.categories',
      token_mapping: 'tokenMap(classification.categories.*)',
      ui_hints: {
        component: 'CategoryTree',
      },
    },
    tags: {
      semantic_type: 'classification.tags',
      token_mapping: 'tokenMap(classification.tags.*)',
      ui_hints: {
        component: 'TagTokenCloud',
        policyParameter: 'tag_policy',
      },
    },
    primary_category_id: {
      semantic_type: 'classification.primary',
      token_mapping: 'tokenMap(classification.primary)',
      ui_hints: {
        component: 'CategoryBreadcrumb',
      },
    },
  },

  view_extensions: {
    list: [
      {
        component: 'ClassificationBadge',
        position: 'after',
        props: {
          mode: '{classification_mode}',
          primaryCategoryField: 'primary_category_id',
          tagPreviewField: 'tag_preview',
        },
      },
    ],
    detail: [
      {
        component: 'ClassificationPanel',
        position: 'sidebar',
        priority: 40,
        props: {
          categoriesField: 'categories',
          tagsField: 'tags',
          metadataField: 'classification_metadata',
          modeParameter: 'classification_mode',
        },
      },
    ],
    form: [
      {
        component: 'ClassificationEditor',
        position: 'main',
        props: {
          modeParameter: 'classification_mode',
          tagPolicyParameter: 'tag_policy',
          maxTagsParameter: 'max_tags',
        },
      },
    ],
  },

  tokens: {
    'classification.category.badge.bg': 'var(--sys-surface-raised)',
    'classification.category.badge.border': 'var(--sys-border-strong)',
    'classification.tag.chip.bg': 'var(--sys-surface-muted)',
    'classification.tag.chip.text': 'var(--sys-text-strong)',
  },

  metadata: {
    created: '2025-11-18',
    updated: '2025-11-18',
    owners: ['core@oods.systems', 'taxonomy@oods.systems'],
    maturity: 'draft',
    references: [
      'R21.4_Deep-Dive-Implementation-Research-for-the-Classifiable-Core-Trait.md',
      'Core_Traits_Specification_Draft.md',
    ],
    regionsUsed: ['list', 'detail', 'form'],
  },
} as const satisfies TraitDefinition;

export default ClassifiableTrait;
