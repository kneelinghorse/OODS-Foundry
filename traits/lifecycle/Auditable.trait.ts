import type { TraitDefinition } from '../../src/core/trait-definition.ts';

const AuditableTrait = {
  trait: {
    name: 'Auditable',
    version: '1.0.0',
    description:
      'Compliance-grade audit trail trait that captures state transitions with actor, ' +
      'reason, and timestamp metadata. Auditable observes Stateful transitions and ' +
      'records them as an append-only audit log.',
    category: 'lifecycle',
    tags: ['audit', 'compliance', 'trail', 'lifecycle', 'transition', 'accountability'],
  },

  parameters: [
    {
      name: 'retentionDays',
      type: 'number',
      required: false,
      description:
        'Number of days to retain audit log entries before archival eligibility. ' +
        '0 means indefinite retention.',
      default: 0,
      validation: { minimum: 0 },
    },
    {
      name: 'requireTransitionReason',
      type: 'boolean',
      required: false,
      description: 'When true, every state transition must include a reason string.',
      default: false,
    },
    {
      name: 'trackActorId',
      type: 'boolean',
      required: false,
      description: 'When true, actor_id is captured on each transition.',
      default: true,
    },
  ] as const,

  schema: {
    audit_log: {
      type: 'AuditEntry[]',
      required: true,
      description: 'Append-only chronological log of state transition events.',
      default: [],
    },
  },

  semantics: {
    audit_log: {
      semantic_type: 'timeline.audit',
      token_mapping: 'tokenMap(audit.timeline.*)',
      ui_hints: {
        component: 'AuditTimeline',
        maxVisible: 7,
        collapseWhenEmpty: true,
      },
    },
    'audit_log.from_state': {
      semantic_type: 'audit.transition.from',
      token_mapping: 'tokenMap(audit.state.from)',
      ui_hints: { component: 'StatusBadge', emphasis: 'subtle' },
    },
    'audit_log.to_state': {
      semantic_type: 'audit.transition.to',
      token_mapping: 'tokenMap(audit.state.to)',
      ui_hints: { component: 'StatusBadge', emphasis: 'subtle' },
    },
    'audit_log.transitioned_at': {
      semantic_type: 'audit.transition.timestamp',
      token_mapping: 'tokenMap(audit.timestamp.*)',
      ui_hints: { component: 'RelativeTimestamp' },
    },
    'audit_log.actor_id': {
      semantic_type: 'audit.transition.actor',
      token_mapping: 'tokenMap(audit.actor.*)',
      ui_hints: { component: 'ActorBadge' },
    },
    'audit_log.reason': {
      semantic_type: 'audit.transition.reason',
      token_mapping: 'tokenMap(audit.reason.*)',
      ui_hints: { component: 'TextBody' },
    },
  },

  view_extensions: {
    timeline: [
      {
        component: 'AuditTimeline',
        position: 'main',
        priority: 60,
        props: {
          auditLogField: 'audit_log',
          maxVisible: 7,
          showFromState: true,
          showActorId: true,
          showReason: true,
        },
      },
    ],
    detail: [
      {
        component: 'AuditSummaryCard',
        position: 'main',
        priority: 50,
        props: {
          auditLogField: 'audit_log',
          lastN: 5,
          showTransitionCount: true,
          showLastTransitionTime: true,
          showLastActor: true,
        },
      },
    ],
  },

  tokens: {
    'cmp.audit.timeline.connector.color': 'var(--sys-border-default)',
    'cmp.audit.timeline.connector.width': 'var(--space-px)',
    'cmp.audit.timeline.dot.color': 'var(--sys-surface-accent)',
    'cmp.audit.timeline.dot.size': 'var(--space-2)',
    'cmp.audit.entry.bg': 'var(--sys-surface-raised)',
    'cmp.audit.entry.border': 'var(--sys-border-default)',
    'cmp.audit.entry.radius': 'var(--radius-md)',
    'cmp.audit.entry.padding': 'var(--space-3)',
    'cmp.audit.entry.state.text': 'var(--sys-text-strong)',
    'cmp.audit.entry.reason.text': 'var(--sys-text-default)',
    'cmp.audit.entry.timestamp.text': 'var(--sys-text-subtle)',
    'cmp.audit.entry.actor.text': 'var(--sys-text-subtle)',
    'cmp.audit.summary.count.text': 'var(--sys-text-strong)',
    'cmp.audit.summary.label.text': 'var(--sys-text-subtle)',
  },

  dependencies: ['Stateful'] as const,

  metadata: {
    created: '2026-02-28',
    owners: ['compliance@oods.systems', 'engineering@oods.systems'],
    maturity: 'experimental',
    accessibility: {
      keyboard: 'AuditTimeline entries are not interactive. Summary card expand/collapse is keyboard navigable.',
      screenreader:
        'AuditTimeline uses role="log" with aria-label="Audit trail". ' +
        'Each entry announces transition direction, timestamp, actor, and reason.',
    },
    regionsUsed: ['timeline', 'detail'],
    examples: ['Subscription', 'Invoice'],
    references: ['Trait Engine Spec v0.1 §2'],
  },
} as const satisfies TraitDefinition;

export default AuditableTrait;
