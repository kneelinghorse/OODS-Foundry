import type { TraitDefinition } from '../../src/core/trait-definition.ts';

export type ArchiveMethod = 'manual' | 'automated' | 'policy';

const ArchivableTrait = {
  trait: {
    name: 'Archivable',
    version: '2.0.0',
    description:
      'Provides archival lifecycle management with configurable retention, restoration, ' +
      'audit tracking, and compliance metadata. Manages archive-restore-purge lifecycle.',
    category: 'lifecycle',
    tags: ['lifecycle', 'archival', 'retention', 'compliance', 'audit', 'soft-delete'],
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
        'Maximum days archived entities can be restored when history is retained.',
      validation: {
        minimum: 0,
        maximum: 365,
      },
    },
    {
      name: 'softDeleteDuration',
      type: 'number',
      required: false,
      description:
        'Days in soft-deleted state before automatic hard deletion. Total retention period.',
      default: 90,
      validation: {
        minimum: 0,
        maximum: 3650,
      },
    },
    {
      name: 'allowPartialRestore',
      type: 'boolean',
      required: false,
      description:
        'When true, archived entities can be partially restored — selecting which fields to recover.',
      default: false,
    },
  ] as const,

  schema: {
    is_archived: {
      type: 'boolean',
      required: true,
      description: 'Flag indicating whether the entity is currently archived (soft-deleted).',
      default: false,
    },
    archived_at: {
      type: 'string',
      required: false,
      description: 'ISO 8601 timestamp for when the entity entered the archived state.',
    },
    restored_at: {
      type: 'string',
      required: false,
      description: 'ISO 8601 timestamp for when the entity was most recently restored.',
    },
    archive_reason: {
      type: 'string',
      required: false,
      description: 'Human-readable narrative describing why the entity was archived.',
      validation: {
        maxLength: 500,
      },
    },
    archived_by: {
      type: 'string',
      required: false,
      description:
        'User ID or "system" identifier of the actor who archived this entity.',
    },
    archive_metadata: {
      type: 'string',
      required: false,
      description:
        'JSON object: method (manual/automated/policy), compliance_tags, retention_policy_id, ' +
        'original_status, related_entity_count.',
    },
    restoration_metadata: {
      type: 'string',
      required: false,
      description:
        'JSON object: restored_by, restored_fields, restoration_reason, restored_from_snapshot.',
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
        maxLength: 500,
      },
    },
    archived_by: {
      semantic_type: 'status.archive.actor',
      token_mapping: 'tokenMap(status.archive.actor)',
      ui_hints: {
        component: 'ActorLabel',
      },
    },
    archive_metadata: {
      semantic_type: 'status.archive.compliance',
      token_mapping: 'computed',
      ui_hints: {
        component: 'ArchiveCompliancePanel',
      },
    },
    restoration_metadata: {
      semantic_type: 'status.archive.restoration',
      token_mapping: 'computed',
      ui_hints: {
        component: 'RestorationSummary',
      },
    },
  },

  view_extensions: {
    list: [
      {
        component: 'ArchivedRowOverlay',
        props: {
          archivedField: 'is_archived',
          style: 'grayed',
          showBadge: true,
          separateTab: true,
          tabLabel: 'Archived',
        },
      },
    ],
    detail: [
      {
        component: 'ArchiveSummary',
        position: 'top',
        props: {
          archivedField: 'is_archived',
          archivedAtField: 'archived_at',
          restoredAtField: 'restored_at',
          reasonField: 'archive_reason',
          archivedByField: 'archived_by',
          metadataField: 'archive_metadata',
          retainHistoryParameter: 'retainHistory',
          restoreWindowParameter: 'restoreWindowDays',
          allowPartialRestoreParameter: 'allowPartialRestore',
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
          archivedByField: 'archived_by',
          metadataField: 'archive_metadata',
          restorationMetadataField: 'restoration_metadata',
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
    'status.archive.primary.border': 'var(--sys-border-default)',
    'status.archive.timestamp.text': 'var(--text-subtle)',
    'status.archive.reason.text': 'var(--text-default)',
    'status.archive.reason.bg': 'var(--sys-surface-neutral)',
    'status.archive.overlay.bg': 'var(--sys-surface-disabled)',
    'status.archive.overlay.opacity': '0.6',
    'status.archive.actor.text': 'var(--sys-text-secondary)',
    'status.archive.compliance.badge.bg': 'var(--sys-status-info-surface)',
    'status.archive.compliance.badge.text': 'var(--sys-status-info-text)',
  },

  dependencies: [
    {
      trait: 'Stateful',
      optional: false,
    },
  ] as const,

  metadata: {
    created: '2025-10-12',
    updated: '2026-02-28',
    owners: ['lifecycle@oods.systems', 'compliance@oods.systems'],
    maturity: 'stable',
    accessibility: {
      keyboard:
        'Archive/Restore buttons are focusable, activated with Enter/Space. Confirmation dialogs trap focus.',
      screenreader:
        'ArchiveBadge announces archived/active state. ArchiveSummary announces date, reason, actor, restore window. ' +
        'ArchivedRowOverlay announced as "Archived: [entity name]".',
    },
    regionsUsed: ['list', 'detail', 'timeline', 'card'],
    examples: ['Contract', 'Product Listing', 'User Account', 'Subscription'],
    references: [
      'Trait Engine Spec v0.1 section 2',
      'GDPR Article 17 — Right to Erasure',
    ],
  },
} as const satisfies TraitDefinition;

export default ArchivableTrait;
