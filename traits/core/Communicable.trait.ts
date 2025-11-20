import type { TraitDefinition } from '../../src/core/trait-definition.ts';

export const COMMUNICABLE_TRAIT_VERSION = '1.0.0';

const CommunicableTrait = {
  trait: {
    name: 'Communicable',
    version: COMMUNICABLE_TRAIT_VERSION,
    description:
      'Canonical messaging trait providing channel orchestration, template governance, delivery policy, and conversation abstractions derived from R20.1 and R20.6 research.',
    category: 'communication',
    tags: ['notification', 'messaging', 'channel', 'template', 'delivery'],
  },

  parameters: [
    {
      name: 'channelTypes',
      type: 'string[]',
      required: false,
      default: ['email', 'sms', 'push', 'in_app', 'webhook'],
      description: 'Channels enabled for the tenant. Extend to add custom transports (R20.1 Part 2.1).',
    },
    {
      name: 'supportConversations',
      type: 'boolean',
      required: false,
      default: true,
      description: 'Whether threaded conversations are available in addition to atomic messages.',
    },
  ] as const,

  schema: {
    channel_catalog: {
      type: 'Channel[]',
      required: true,
      description: 'Registered delivery channels with provider configuration (email/SMS/push/in_app/webhook).',
      default: [],
    },
    template_catalog: {
      type: 'Template[]',
      required: true,
      description: 'Localized message templates with subject/body/variable metadata.',
      default: [],
    },
    delivery_policies: {
      type: 'DeliveryPolicy[]',
      required: true,
      description: 'Retry/throttling/quiet-hour policies derived from R20.1 Part 3.1 lifecycle.',
      default: [],
    },
    messages: {
      type: 'Message[]',
      required: false,
      description: 'Atomic messages queued for orchestration (R20.6 Part 1.2).',
      default: [],
    },
    conversations: {
      type: 'Conversation[]',
      required: false,
      description: 'Threaded conversations with participant membership (R20.6 Part 3.3).',
      default: [],
    },
    message_statuses: {
      type: 'MessageStatusEntry[]',
      required: false,
      description: 'Delivery state machine entries (queued → sent → delivered → failed → retried → read).',
      default: [],
    },
  },

  semantics: {
    channel_catalog: {
      semantic_type: 'communication.channels',
      token_mapping: '--sys-communication-accent',
      ui_hints: {
        component: 'ChannelGrid',
        badges: 'channel_catalog[].type',
      },
    },
    template_catalog: {
      semantic_type: 'communication.templates',
      token_mapping: '--sys-communication-muted',
      ui_hints: {
        component: 'TemplateDrawer',
        variableBadge: 'template_catalog[].variables',
      },
    },
    delivery_policies: {
      semantic_type: 'communication.delivery_policy',
      token_mapping: '--sys-communication-accent',
      ui_hints: {
        component: 'DeliveryPolicyCapsule',
      },
    },
    messages: {
      semantic_type: 'communication.messages',
      token_mapping: '--sys-communication-success',
      ui_hints: {
        component: 'MessageTimeline',
      },
    },
    conversations: {
      semantic_type: 'communication.conversations',
      token_mapping: '--sys-communication-accent',
      ui_hints: {
        component: 'ConversationViewer',
      },
    },
  },

  view_extensions: {
    list: [
      {
        component: 'MessageStatusBadge',
        position: 'before',
        priority: 90,
        props: {
          statusesField: 'message_statuses',
        },
      },
    ],
    detail: [
      {
        component: 'CommunicationDetailPanel',
        position: 'main',
        priority: 80,
        props: {
          channelsField: 'channel_catalog',
          templatesField: 'template_catalog',
          policiesField: 'delivery_policies',
          conversationsField: 'conversations',
        },
      },
    ],
    form: [
      {
        component: 'TemplatePicker',
        position: 'main',
        props: {
          templatesField: 'template_catalog',
          channelsField: 'channel_catalog',
        },
      },
    ],
    timeline: [
      {
        component: 'MessageEventTimeline',
        props: {
          messagesField: 'messages',
          statusesField: 'message_statuses',
        },
      },
    ],
  },

  tokens: {
    'communication.card.bg': 'var(--sys-surface-raised)',
    'communication.card.border': 'var(--sys-communication-muted)',
    'communication.status.success': 'var(--sys-communication-success)',
    'communication.status.error': 'var(--sys-communication-error)',
  },

  dependencies: [
    { trait: 'Preferenceable', version: '>=1.0.0' },
    { trait: 'Authable', version: '>=1.0.0' },
    { trait: 'Classifiable', version: '>=1.0.0', optional: true },
  ] as const,

  metadata: {
    created: '2025-11-20',
    owners: ['notifications@oods.systems'],
    maturity: 'experimental',
    accessibility: {
      keyboard: 'ChannelGrid arranges buttons in linear tab order with roving focus for template previews.',
      screenreader:
        'CommunicationDetailPanel exposes ARIA live regions for delivery status transitions referencing R20.6 guidance.',
    },
    references: ['R20.1 Canonical Notification Model', 'R20.6 Modern Messaging Systems'],
  },
} as const satisfies TraitDefinition;

export default CommunicableTrait;
