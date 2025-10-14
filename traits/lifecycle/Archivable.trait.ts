import type { TraitDefinition } from '../../src/core/trait-definition.ts';

const ArchivableTrait = {
  trait: {
    name: 'Archivable',
    version: '1.0.0',
    description:
      'Provides archival lifecycle management with configurable retention, restoration, and semantic tokens.',
    category: 'lifecycle',
    tags: ['lifecycle', 'archival', 'retention', 'compliance'],
  },

  parameters: [
    {
      name: 'gracePeriodDays',
      type: 'number',
      required: false,
      description: 'Number of days after archival before permanent deletion occurs.',
      default: 30,
      validation: {
        minimum: 0,
        maximum: 365,
      },
    },
    {
      name: 'retainHistory',
      type: 'boolean',
      required: false,
      description: 'Whether archival retains a readable change history that can be restored.',
      default: true,
    },
    {
      name: 'restoreWindowDays',
      type: 'number',
      required: false,
      description:
        'Maximum number of days archived entities can be restored when history is retained.',
      validation: {
        minimum: 0,
        maximum: 365,
      },
    },
  ] as const,

  schema: {
    is_archived: {
      type: 'boolean',
      required: true,
      description: 'Flag indicating whether the entity is currently archived.',
      default: false,
    },
    archived_at: {
      type: 'datetime?',
      required: false,
      description: 'Timestamp for when the entity entered the archived state.',
    },
    restored_at: {
      type: 'datetime?',
      required: false,
      description: 'Timestamp for when the entity was restored from an archived state.',
    },
    archive_reason: {
      type: 'string',
      required: false,
      description: 'Optional narrative describing why the entity was archived.',
      validation: {
        maxLength: 160,
      },
    },
  },

  semantics: {
    is_archived: {
      semantic_type: 'status.archive.state',
      token_mapping: 'tokenMap(status.archive.*)',
      ui_hints: {
        component: 'ArchiveBadge',
        showIcon: true,
      },
    },
    archived_at: {
      semantic_type: 'status.archive.timestamp',
      token_mapping: 'tokenMap(status.archive.timestamp)',
      ui_hints: {
        component: 'TimelineTimestamp',
      },
    },
    restored_at: {
      semantic_type: 'status.archive.restore_timestamp',
      token_mapping: 'tokenMap(status.archive.restore)',
      ui_hints: {
        component: 'TimelineTimestamp',
      },
    },
    archive_reason: {
      semantic_type: 'status.archive.reason',
      token_mapping: 'tokenMap(status.archive.reason)',
      ui_hints: {
        component: 'ArchiveReason',
        maxLength: 160,
      },
    },
  },

  view_extensions: {
    detail: [
      {
        component: 'ArchiveSummary',
        position: 'top',
        props: {
          archivedField: 'is_archived',
          archivedAtField: 'archived_at',
          restoredAtField: 'restored_at',
          reasonField: 'archive_reason',
          retainHistoryParameter: 'retainHistory',
          restoreWindowParameter: 'restoreWindowDays',
        },
      },
    ],
    timeline: [
      {
        component: 'ArchiveEvent',
        props: {
          archivedAtField: 'archived_at',
          restoredAtField: 'restored_at',
          reasonField: 'archive_reason',
        },
      },
    ],
    card: [
      {
        component: 'ArchivePill',
        position: 'before',
        props: {
          field: 'is_archived',
          archivedAtField: 'archived_at',
        },
      },
    ],
  },

  tokens: {
    'status.archive.primary.bg': 'var(--status-archive-bg)',
    'status.archive.primary.text': 'var(--status-archive-text)',
    'status.archive.timestamp.text': 'var(--text-subtle)',
    'status.archive.reason.text': 'var(--text-default)',
  },

  dependencies: ['Stateful'] as const,

  metadata: {
    created: '2025-10-12',
    owners: ['lifecycle@oods.systems', 'compliance@oods.systems'],
    maturity: 'stable',
    accessibility: {
      keyboard: 'n/a',
      screenreader: 'Announces archival status and retention windows.',
    },
    regionsUsed: ['detail', 'timeline', 'card'],
    examples: ['Contract', 'Product Listing'],
    references: ['Trait Engine Spec v0.1 §2'],
  },
} as const satisfies TraitDefinition;

export default ArchivableTrait;
