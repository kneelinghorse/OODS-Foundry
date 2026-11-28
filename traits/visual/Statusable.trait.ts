import type { TraitDefinition } from '../../src/core/trait-definition.ts';

export const STATUS_TONES = [
  'neutral',
  'info',
  'accent',
  'success',
  'warning',
  'critical',
] as const;

export type StatusTone = (typeof STATUS_TONES)[number];

const StatusableTrait = {
  trait: {
    name: 'Statusable',
    version: '1.0.2',
    description:
      'Semantic status presentation layer that maps business statuses to visual tones, ' +
      'design tokens, and badge/banner rendering. Distinct from Stateful — Stateful governs ' +
      'state machine transitions; Statusable governs how status looks.',
    category: 'visual',
    tags: ['status', 'presentation', 'registry', 'badge', 'banner', 'tone', 'semantic', 'saas'],
  },

  parameters: [
    {
      name: 'domains',
      type: 'string[]',
      required: true,
      description:
        'Domain identifiers whose statuses this object participates in ' +
        '(e.g., "subscription", "invoice", "ticket").',
      default: ['subscription'],
    },
    {
      name: 'toneAliases',
      type: 'object',
      required: false,
      description:
        'Custom alias map for inferring tones from token path segments. ' +
        'Merged with built-in aliases.',
      default: {},
    },
    {
      name: 'defaultTone',
      type: 'string',
      required: false,
      description: 'Fallback tone when a status cannot be resolved in the registry.',
      default: 'neutral' as StatusTone,
      validation: { enum: STATUS_TONES },
    },
  ] as const,

  schema: {
    status: {
      type: 'string',
      required: true,
      description: 'Raw business status string resolved against the domain status map.',
    },
    domain: {
      type: 'string',
      required: true,
      description: 'Domain scope for registry lookup.',
      validation: { enumFromParameter: 'domains' },
    },
    tone: {
      type: 'string',
      required: false,
      description: 'Semantic tone derived from the registry or inferred from token paths.',
      validation: { enum: STATUS_TONES },
    },
    badge_tokens: {
      type: 'object',
      required: false,
      description: 'Resolved badge token sets with subtle and solid emphasis variants.',
    },
    banner_tokens: {
      type: 'object',
      required: false,
      description: 'Resolved banner token sets with subtle and solid emphasis variants.',
    },
  },

  semantics: {
    status: {
      semantic_type: 'status.presentation.status',
      token_mapping: 'tokenMap(status.registry.*)',
      ui_hints: {
        component: 'StatusBadge',
        registryLookup: 'getStatusPresentation(domain, status)',
      },
    },
    domain: {
      semantic_type: 'status.presentation.domain',
      token_mapping: 'tokenMap(status.domains.*)',
      ui_hints: { component: 'DomainSelector', scopedTo: 'domains' },
    },
    tone: {
      semantic_type: 'status.presentation.tone',
      token_mapping: 'tokenMap(status.tone.*)',
      ui_hints: { component: 'ToneBadge' },
    },
    badge_tokens: {
      semantic_type: 'status.presentation.badge',
      token_mapping: 'tokenMap(cmp.status.{tone}.*)',
      ui_hints: { component: 'Badge' },
    },
    banner_tokens: {
      semantic_type: 'status.presentation.banner',
      token_mapping: 'tokenMap(cmp.status.{tone}.*)',
      ui_hints: { component: 'Banner' },
    },
  },

  view_extensions: {
    list: [
      {
        component: 'Badge',
        position: 'after',
        props: {
          statusField: 'status',
          domainField: 'domain',
          emphasis: 'subtle',
          showIcon: true,
        },
      },
    ],
    detail: [
      {
        component: 'StatusBadge',
        position: 'main',
        priority: 80,
        props: {
          statusField: 'status',
          domainField: 'domain',
          emphasis: 'subtle',
          showIcon: true,
        },
      },
    ],
    form: [
      {
        component: 'StatusBadge',
        position: 'top',
        props: {
          statusField: 'status',
          domainField: 'domain',
          emphasis: 'subtle',
          readOnly: true,
        },
      },
    ],
    timeline: [
      {
        component: 'StatusBadge',
        props: {
          statusField: 'status',
          domainField: 'domain',
          emphasis: 'subtle',
          showIcon: true,
          compact: true,
        },
      },
    ],
  },

  tokens: {
    'cmp.status.neutral.surface': 'var(--sys-surface-neutral)',
    'cmp.status.neutral.border': 'var(--sys-border-neutral)',
    'cmp.status.neutral.text': 'var(--sys-text-neutral)',
    'cmp.status.info.surface': 'var(--sys-surface-info)',
    'cmp.status.info.border': 'var(--sys-border-info)',
    'cmp.status.info.text': 'var(--sys-text-info)',
    'cmp.status.accent.surface': 'var(--sys-surface-accent)',
    'cmp.status.accent.border': 'var(--sys-border-accent)',
    'cmp.status.accent.text': 'var(--sys-text-accent)',
    'cmp.status.success.surface': 'var(--sys-surface-success)',
    'cmp.status.success.border': 'var(--sys-border-success)',
    'cmp.status.success.text': 'var(--sys-text-success)',
    'cmp.status.warning.surface': 'var(--sys-surface-warning)',
    'cmp.status.warning.border': 'var(--sys-border-warning)',
    'cmp.status.warning.text': 'var(--sys-text-warning)',
    'cmp.status.critical.surface': 'var(--sys-surface-critical)',
    'cmp.status.critical.border': 'var(--sys-border-critical)',
    'cmp.status.critical.text': 'var(--sys-text-critical)',
    'cmp.banner.background': 'var(--sys-surface-raised)',
    'cmp.banner.border': 'var(--sys-border-default)',
    'cmp.banner.text': 'var(--sys-text-default)',
  },

  // Stateful is optional — not listed to avoid required-dep enforcement in dependency-graph.
  dependencies: [] as const,

  metadata: {
    changelog: [
      { version: '1.0.2', date: '2026-11-27', description: 'Records 1.0.1 in its change history.' },
      { version: '1.0.1', date: '2026-11-23', description: 'Describes how its badge presents state and how its Banner announces a message.' },
    ],
    created: '2026-02-28',
    owners: ['Design team', 'Engineering team'],
    maturity: 'experimental',
    accessibility: {
      keyboard: 'The badge has no keyboard action. Tab reaches the Banner dismiss button when React receives onDismiss or Vue receives dismissLabel. The HTML Banner renders its text without a dismiss button.',
      screenreader: 'StatusBadge shows the state as text alongside its color. By default the badge is a span and its visible text is available to screen readers. A critical or danger Banner defaults to an assertive alert. Other tones default to a polite status. An explicit role takes precedence. React and Vue still set aria-live from the tone unless it is overridden. HTML supplies aria-live from the tone only when it also supplies the role.',
    },
    regionsUsed: ['list', 'detail', 'form', 'timeline'],
    examples: ['Subscription', 'Invoice', 'Ticket', 'User'],
    references: ['Trait Engine Spec v0.1 §2'],
  },
} as const satisfies TraitDefinition;

export default StatusableTrait;
