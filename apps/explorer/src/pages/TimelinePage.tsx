import '../styles/index.css';
import { useCallback, useMemo, useRef, useState } from 'react';
import { DateTime } from 'luxon';

import { ChannelPlanEditor } from '@/components/communication/ChannelPlanEditor.js';
import { ConversationThread } from '@/components/communication/ConversationThread.js';
import { DeliveryHealthWidget, type DeliveryHealthMetrics } from '@/components/communication/DeliveryHealthWidget.js';
import { MessageTimeline } from '@/components/communication/MessageTimeline.js';
import { useConversations, type ConversationsClient } from '@/hooks/useConversations.js';
import { useDeliveryStatus, type DeliveryStatusClient } from '@/hooks/useDeliveryStatus.js';
import { useMessages } from '@/hooks/useMessages.js';
import type { Conversation } from '@/schemas/communication/conversation.js';
import type { DeliveryPolicy } from '@/schemas/communication/delivery-policy.js';
import type { Message } from '@/schemas/communication/message.js';
import type { MessageState } from '@/schemas/communication/common.js';
import TimeService from '@/services/time/index.js';
import { StatusChip } from '../components/StatusChip';

type TimelineTone = 'success' | 'warning' | 'info' | 'neutral' | 'critical';

type TimelineEvent = {
  id: string;
  tone: TimelineTone;
  time: string;
  displayTime: string;
  title: string;
  description: string;
  status: { domain: 'subscription' | 'invoice'; value: string } | null;
  meta: { label: string; value: string }[];
};

const TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: 'payment-settled',
    tone: 'success',
    time: '2025-07-11T14:26:00Z',
    displayTime: '2:26 PM',
    title: 'Payment settled • Invoice INV-2046',
    description: 'ACH settlement posted; receipt emailed to billing@acmeanalytics.com.',
    status: { domain: 'invoice', value: 'paid' },
    meta: [
      { label: 'Actor', value: 'Finance automation' },
      { label: 'Amount', value: '$2,840.00' }
    ]
  },
  {
    id: 'usage-spike',
    tone: 'info',
    time: '2025-07-10T08:05:00Z',
    displayTime: '8:05 AM',
    title: 'Usage spike detected',
    description:
      'API throughput exceeded baseline by 42% over the last 24 hours. Quota notifications sent to account team.',
    status: { domain: 'subscription', value: 'active' },
    meta: [
      { label: 'Actor', value: 'Usage monitor' },
      { label: 'Threshold', value: '> 120 req/s for 3 hrs' }
    ]
  },
  {
    id: 'renewal-briefing',
    tone: 'neutral',
    time: '2025-07-09T16:20:00Z',
    displayTime: '4:20 PM',
    title: 'Renewal briefing scheduled',
    description: 'Customer success scheduled a renewal preparation briefing with finance and solutions engineering.',
    status: null,
    meta: [
      { label: 'Actor', value: 'Leslie Alexander' },
      { label: 'Meeting', value: 'Jul 18 • 45 minutes' }
    ]
  },
  {
    id: 'dunning-warning',
    tone: 'warning',
    time: '2025-07-07T11:45:00Z',
    displayTime: '11:45 AM',
    title: 'Past-due warning triggered',
    description:
      'Primary card declined twice. Dunning workflow escalated and finance notified to follow up with customer billing.',
    status: { domain: 'invoice', value: 'past_due' },
    meta: [
      { label: 'Actor', value: 'Billing automation' },
      { label: 'Attempts', value: '2 retries' }
    ]
  },
  {
    id: 'pilot-success',
    tone: 'success',
    time: '2025-07-04T09:15:00Z',
    displayTime: '9:15 AM',
    title: 'Pilot expansion approved',
    description: 'Legal approved the premium analytics add-on pilot; rollout staged for August 01 activation.',
    status: { domain: 'subscription', value: 'future' },
    meta: [
      { label: 'Actor', value: 'Legal • Eleanor Pena' },
      { label: 'Effective', value: 'Aug 01, 2025' }
    ]
  }
];

const TimelinePage = () => (
  <div className="explorer-view context-timeline timeline-view" data-context="timeline" data-testid="timeline-page">
    <nav className="timeline-breadcrumbs" data-region="breadcrumbs" aria-label="Timeline trail">
      <ol>
        <li>
          <a href="#accounts">Accounts</a>
        </li>
        <li>
          <a href="#acme">Acme Analytics</a>
        </li>
        <li aria-current="page">
          <span>Activity timeline</span>
        </li>
      </ol>
    </nav>

    <header className="timeline-header" data-region="header">
      <div>
        <p className="view-eyebrow">Lifecycle • SaaS</p>
        <h1 className="view-title">Customer activity timeline</h1>
        <p className="view-caption">
          Timeline context compacts the vertical rhythm while time badges + markers stay legible. No conditional logic—
          classes + data attributes drive surfaces and typography.
        </p>
      </div>

      <dl className="timeline-header__meta" data-region="meta">
        <div>
          <dt>Events (30d)</dt>
          <dd>18</dd>
        </div>
        <div>
          <dt>Escalations</dt>
          <dd>2 open</dd>
        </div>
        <div>
          <dt>Upcoming renewals</dt>
          <dd>1 contract</dd>
        </div>
      </dl>
    </header>

    <div className="timeline-toolbar" data-region="actions" role="toolbar" aria-label="Timeline filters">
      <div className="timeline-toolbar__filters" role="group" aria-label="Event types">
        <button type="button" className="timeline-toolbar__chip timeline-toolbar__chip--active">
          All
        </button>
        <button type="button" className="timeline-toolbar__chip">Billing</button>
        <button type="button" className="timeline-toolbar__chip">Usage</button>
        <button type="button" className="timeline-toolbar__chip">Success</button>
      </div>
      <div className="timeline-toolbar__range">
        <span>Range: <strong>Last 30 days</strong></span>
      </div>
    </div>

    <main className="timeline-main" data-region="body">
      <ol className="timeline-stream" data-region="timeline">
        {TIMELINE_EVENTS.map((event) => (
          <li key={event.id} className="timeline-item" data-tone={event.tone}>
            <div className="timeline-item__marker" aria-hidden>
              <span className="timeline-item__dot" />
            </div>

            <article className="timeline-item__card">
              <header className="timeline-item__header">
                <time className="timeline-item__time" dateTime={event.time}>
                  {event.displayTime}
                </time>
                {event.status ? (
                  <StatusChip status={event.status.value} domain={event.status.domain} context="timeline" />
                ) : null}
              </header>

              <h3 className="timeline-item__title">{event.title}</h3>
              <p className="timeline-item__description">{event.description}</p>

              <dl className="timeline-item__meta">
                {event.meta.map((entry) => (
                  <div key={`${event.id}-${entry.label.toLowerCase().replace(/\s+/g, '-')}`}>
                    <dt>{entry.label}</dt>
                    <dd>{entry.value}</dd>
                  </div>
                ))}
              </dl>
            </article>
          </li>
        ))}
      </ol>
    </main>

    <aside className="timeline-sidebar" data-region="sidebar" aria-label="Timeline analytics">
      <section className="timeline-sidebar__section">
        <h2>Event composition</h2>
        <ul>
          <li>
            <span>Billing</span>
            <strong>8</strong>
          </li>
          <li>
            <span>Usage</span>
            <strong>4</strong>
          </li>
          <li>
            <span>Success</span>
            <strong>6</strong>
          </li>
        </ul>
      </section>
      <section className="timeline-sidebar__section">
        <h2>Highlights</h2>
        <p>
          Timeline defaults keep badges compact (<code>timeline:timeline:gap-2</code>) and align metadata with the same
          rhythm as stream items—no bespoke component overrides required.
        </p>
      </section>
    </aside>

    <CommunicationPanel />
  </div>
);

function CommunicationPanel(): JSX.Element {
  const seedMessages = useMemo(() => buildDemoMessages(), []);
  const statusStore = useRef<Map<string, { status: MessageState; retryCount: number }>>(
    new Map(seedMessages.map((message) => [message.id, { status: message.status, retryCount: message.status === 'queued' ? 1 : 0 }]))
  );

  const fetchPage = useCallback(
    async (cursor?: string) => {
      const startIndex = cursor ? Math.max(seedMessages.findIndex((message) => message.created_at === cursor) + 1, 0) : 0;
      const slice = seedMessages.slice(startIndex, startIndex + 8);
      return {
        messages: slice,
        hasMore: startIndex + slice.length < seedMessages.length,
      };
    },
    [seedMessages]
  );

  const handleRemoteRead = useCallback(async (id: string) => {
    const existing = statusStore.current.get(id);
    if (existing) {
      statusStore.current.set(id, { ...existing, status: 'read' });
    }
  }, []);

  const { messages, loadMore, hasMore, markAsRead, isLoading } = useMessages({
    fetchPage,
    markAsRead: handleRemoteRead,
  });

  const deliveryStatusClient = useMemo<DeliveryStatusClient>(
    () => ({
      async fetchStatus(messageId: string) {
        const existing = statusStore.current.get(messageId) ?? { status: 'queued' as MessageState, retryCount: 0 };
        const nextStatus: MessageState =
          existing.status === 'queued' ? 'sent' : existing.status === 'sent' ? 'delivered' : existing.status;
        const snapshot = {
          status: nextStatus,
          retryCount: existing.retryCount,
          updatedAt: TimeService.nowSystem().toISO(),
        };
        statusStore.current.set(messageId, snapshot);
        return snapshot;
      },
    }),
    []
  );

  const watchedMessageId = messages[0]?.id ?? seedMessages[0]?.id;
  const deliveryStatus = useDeliveryStatus({
    messageId: watchedMessageId,
    client: deliveryStatusClient,
    pollIntervalMs: 12_000,
  });

  const [policy, setPolicy] = useState<DeliveryPolicy>(() => buildBasePolicy());
  const channelTypes = useMemo(() => ['email', 'sms', 'push'], []);

  const conversationStore = useRef<Conversation[]>(seedConversations(seedMessages));
  const conversationClient = useMemo<ConversationsClient>(
    () => ({
      async listConversations() {
        return conversationStore.current.map(cloneConversation);
      },
      async createConversation(conversation) {
        const created = { ...conversation, created_at: conversation.created_at ?? TimeService.nowSystem().toISO() };
        conversationStore.current = [created, ...conversationStore.current];
        return cloneConversation(created);
      },
      async addReply(conversationId, reply) {
        const enriched = { ...reply, conversation_id: conversationId };
        conversationStore.current = conversationStore.current.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, messages: [...conversation.messages, enriched], updated_at: enriched.created_at }
            : conversation
        );
        return enriched;
      },
    }),
    []
  );

  const { conversations, addReply, isLoading: conversationsLoading } = useConversations({
    client: conversationClient,
    autoRefreshIntervalMs: 0,
  });
  const activeConversation = conversations[0] ?? conversationStore.current[0];

  const handleReply = useCallback(
    async (parentId: string, conversationId?: string) => {
      const targetConversationId = conversationId ?? activeConversation?.id;
      if (!targetConversationId) {
        return;
      }
      const reply = buildThreadReply(targetConversationId, parentId);
      await addReply(targetConversationId, reply);
    },
    [activeConversation?.id, addReply]
  );

  return (
    <section
      className="space-y-4 rounded-2xl border border-[--cmp-border-strong] bg-[--cmp-surface-panel] p-6"
      aria-label="Communication UI integration"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[--sys-text-muted]">Communication surfaces</p>
          <h2 className="text-lg font-semibold text-[--sys-text-primary]">Live wiring with hooks</h2>
          <p className="text-sm text-[--sys-text-muted]">
            MessageTimeline + ChannelPlanEditor now sit on an Explorer surface, backed by the communication hooks and
            tokenized styles.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[--sys-text-primary]" role="status" aria-live="polite">
          <span className="rounded-full border border-[--cmp-border-subtle] bg-[--cmp-surface] px-3 py-1 font-semibold">
            Delivery: {deliveryStatus.status}
          </span>
          <span className="rounded-full border border-[--cmp-border-subtle] bg-[--cmp-surface] px-3 py-1 font-semibold">
            Retries: {deliveryStatus.retryCount}
          </span>
        </div>
      </header>
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <MessageTimeline
            messages={messages}
            onLoadMore={loadMore}
            hasMore={hasMore}
            onMarkAsRead={markAsRead}
            isLoading={isLoading}
            groupByDate
          />
          <div className="rounded-2xl border border-[--cmp-border-subtle] bg-[--cmp-surface] p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[--sys-text-muted]">Threaded escalation</p>
                <h3 className="text-sm font-semibold text-[--sys-text-primary]">ConversationThread</h3>
              </div>
              <span className="text-xs text-[--sys-text-muted]">
                {conversationsLoading ? 'Loading conversation…' : `${activeConversation?.messages.length ?? 0} messages`}
              </span>
            </div>
            {activeConversation ? (
              <ConversationThread conversation={activeConversation} onReply={handleReply} maxDepth={3} />
            ) : (
              <p className="text-sm text-[--sys-text-muted]">No conversation seeded.</p>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <ChannelPlanEditor policy={policy} channelTypes={channelTypes} onChange={(next) => setPolicy(next)} />
          <DeliveryHealthWidget metrics={buildHealthMetrics(seedMessages)} timeWindow="24h" />
        </div>
      </div>
    </section>
  );
}

function buildDemoMessages(): Message[] {
  const base = DateTime.fromISO('2025-11-20T08:00:00Z');
  return Array.from({ length: 14 }).map((_, index) => {
    const created_at = base.plus({ minutes: index * 12 }).toISO() ?? TimeService.nowSystem().toISO();
    return {
      id: `comm-msg-${index + 1}`,
      sender_id: index % 3 === 0 ? 'ops-bot' : 'notifications',
      recipient_ids: ['success-team'],
      channel_type: index % 2 === 0 ? 'email' : 'sms',
      template_id: 'tmpl-communication',
      variables: {},
      metadata: { subject: `Outbound notice ${index + 1}` },
      priority: index % 5 === 0 ? 'urgent' : 'normal',
      status: index % 4 === 0 ? 'queued' : 'sent',
      status_history: [],
      created_at,
    };
  });
}

function buildBasePolicy(): DeliveryPolicy {
  return {
    id: 'policy-standard',
    name: 'Standard communication',
    retry: { max_attempts: 3, backoff_strategy: 'exponential', initial_delay_seconds: 30 },
    throttling: { max_per_minute: 60, max_per_hour: 480, max_per_day: 4800 },
    priority: 'normal',
    metadata: { channel_types: ['email', 'sms', 'push'] },
  };
}

function seedConversations(messages: readonly Message[]): Conversation[] {
  const createdAt = DateTime.fromISO('2025-11-19T15:55:00Z').toISO() ?? TimeService.nowSystem().toISO();
  const conversationId = 'conv-seed';
  const threadMessages: Message[] = [
    {
      ...messages[0],
      id: 'conv-seed-1',
      metadata: { ...messages[0].metadata, subject: 'Kickoff: SLA readiness' },
      conversation_id: conversationId,
      created_at: DateTime.fromISO('2025-11-19T16:00:00Z').toISO() ?? createdAt,
      status: 'sent',
    },
    {
      ...messages[1],
      id: 'conv-seed-2',
      metadata: { ...messages[1].metadata, subject: 'Provider selected', parent_message_id: 'conv-seed-1' },
      conversation_id: conversationId,
      created_at: DateTime.fromISO('2025-11-19T16:12:00Z').toISO() ?? createdAt,
      status: 'sent',
    },
    {
      ...messages[2],
      id: 'conv-seed-3',
      metadata: { ...messages[2].metadata, subject: 'SPF/DKIM configured', parent_message_id: 'conv-seed-1' },
      conversation_id: conversationId,
      created_at: DateTime.fromISO('2025-11-19T16:24:00Z').toISO() ?? createdAt,
      status: 'delivered',
    },
  ];
  return [
    {
      id: conversationId,
      subject: 'Notification rollout with CSM',
      participants: [
        { user_id: 'ops-lead', role: 'owner', joined_at: createdAt },
        { user_id: 'csm-alex', role: 'member', joined_at: createdAt },
        { user_id: 'deliverability', role: 'viewer', joined_at: createdAt },
      ],
      messages: threadMessages,
      status: 'active',
      metadata: {},
      created_at: createdAt,
      updated_at: threadMessages.at(-1)?.created_at ?? createdAt,
    },
  ];
}

function cloneConversation(conversation: Conversation): Conversation {
  return {
    ...conversation,
    participants: conversation.participants.map((participant) => ({ ...participant })),
    messages: conversation.messages.map((message) => ({ ...message, metadata: { ...(message.metadata ?? {}) } })),
  };
}

function buildThreadReply(conversationId: string, parentId: string): Message {
  return {
    id: `conv-reply-${Date.now()}`,
    sender_id: 'ops-liaison',
    recipient_ids: ['success-team'],
    channel_type: 'email',
    template_id: 'tmpl-thread-reply',
    variables: {},
    metadata: { subject: 'Follow-up on delivery health', parent_message_id: parentId },
    priority: 'normal',
    status: 'sent',
    status_history: [],
    conversation_id: conversationId,
    created_at: TimeService.nowSystem().toISO(),
  };
}

function buildHealthMetrics(messages: readonly Message[]): DeliveryHealthMetrics {
  const now = TimeService.nowSystem();
  const delivered = messages.filter(
    (message) => message.status === 'sent' || message.status === 'delivered' || message.status === 'read'
  ).length;
  const total = Math.max(messages.length, 1);
  const successRate = (delivered / total) * 100;
  const retryExhaustionRate =
    (messages.filter((message) => message.status === 'failed').length / total) * 100;
  const trend = [120_000, 95_000, 110_000, 90_000, 132_000];

  return {
    timeToSend: {
      value: trend[trend.length - 1] ?? 110_000,
      p50: 95_000,
      p95: 150_000,
      p99: 220_000,
      count: total,
      windowStart: now.minus({ hours: 24 }).toJSDate(),
      windowEnd: now.toJSDate(),
    },
    successRate: {
      value: Number(successRate.toFixed(1)),
      p50: Number(Math.max(successRate - 0.6, 0).toFixed(1)),
      p95: Number(Math.max(successRate - 1.2, 0).toFixed(1)),
      p99: Number(Math.max(successRate - 2, 0).toFixed(1)),
      count: total,
      windowStart: now.minus({ hours: 24 }).toJSDate(),
      windowEnd: now.toJSDate(),
    },
    retryExhaustionRate: Number(retryExhaustionRate.toFixed(1)),
    trend,
  };
}

export default TimelinePage;
