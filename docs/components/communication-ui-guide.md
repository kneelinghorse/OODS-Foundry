# Communication UI & Hooks Guide

Messaging surfaces ship as token-first React components with matching hooks for data access. Everything uses strict TypeScript types, WCAG 2.2 AA semantics, and the communication token slots introduced in Sprint 29.

## Components

### MessageTimeline
```tsx
import { MessageTimeline } from '@/components/communication/MessageTimeline';
import { useMessages } from '@/hooks/useMessages';

const { messages, loadMore, hasMore, markAsRead, isLoading } = useMessages({ fetchPage, markAsRead: api.markRead });

<MessageTimeline
  messages={messages}
  groupByDate
  hasMore={hasMore}
  onLoadMore={loadMore}
  onMarkAsRead={markAsRead}
  isLoading={isLoading}
/>;
```
- Virtualized with `react-window`; handles 1k+ rows.
- `role="feed"` with `aria-live="polite"` for new arrivals; Enter/Space marks messages read.
- Unread rows use `--cmp-communication-unread-bg`; headers use `--cmp-communication-date-header-fg`.

### ChannelPlanEditor
```tsx
<ChannelPlanEditor
  policy={policy}
  channelTypes={['email', 'sms', 'push']}
  onChange={(next, validation) => save(next, validation)}
/>;
```
- Fieldsets for retry, throttling, and quiet hours; presets: Standard, Urgent, Low.
- Validation runs on every change; `onChange` receives the normalized policy plus validation result.
- Borders and form chrome use `--cmp-communication-policy-editor-border`.

### DeliveryHealthWidget
```tsx
<DeliveryHealthWidget metrics={slaMetrics} timeWindow="24h" />;
```
- Displays success rate, p95 latency, retry exhaustion, and a sparkline.
- Health colors map to `--cmp-communication-health-{success|warning|critical}`.
- Each metric card exposes `aria-label` and `role="progressbar"` for screen readers.

### ConversationThread
```tsx
<ConversationThread
  conversation={conversation}
  onReply={(parentId, conversationId) => openComposer(parentId, conversationId)}
  maxDepth={3}
/>;
```
- Renders threaded replies (collapses after 5 replies per branch).
- Indentation driven by `--cmp-communication-thread-indent`; respects `aria-level` and `aria-expanded`.
- Reply buttons bubble the parent id and conversation id.

## Hooks

### useMessages
- API: `{ messages, isLoading, error, hasMore, loadMore, markAsRead }`.
- Expects `fetchPage(cursor?) => Promise<{ messages, hasMore }>` and optional `markAsRead(id)`.
- Optimistic read state updates; pagination cursor defaults to the last message timestamp.

### useConversations
- API: `{ conversations, isLoading, error, createConversation, addReply, refetch }`.
- Supply a `ConversationsClient` with `listConversations`, `createConversation`, and `addReply`.
- Sorted by `updated_at`/`created_at`; includes optimistic reply insertion.

### useDeliveryStatus
- API: `{ status, retryCount, updatedAt, loading, error, refresh }`.
- Polls via `DeliveryStatusClient.fetchStatus(messageId)`; minimum interval 5s.
- Supports optimistic transitions (queued → sent → delivered) for UI feedback loops.

## Accessibility Notes
- MessageTimeline: `role="feed"`, row `role="article"`, Enter/Space to mark read, focusable rows, `aria-live="polite"`.
- ChannelPlanEditor: each section wrapped in `fieldset`/`legend`; inputs have labels; validation messages linked via `aria-describedby`.
- DeliveryHealthWidget: progress bars use `role="progressbar"` and `aria-valuenow`; metric badges labeled (`aria-label="Success rate"` etc.).
- ConversationThread: tree semantics (`role="tree"`), `aria-level` per depth, expand/collapse buttons with `aria-expanded`.
- Keyboard: all interactive controls are tabbable; focus rings derive from tokenized focus variables.

## Theming
- Component tokens: `--cmp-communication-timeline-bg`, `--cmp-communication-timeline-fg`, `--cmp-communication-unread-bg`, `--cmp-communication-date-header-fg`, `--cmp-communication-policy-editor-border`, `--cmp-communication-health-success`, `--cmp-communication-health-warning`, `--cmp-communication-health-critical`, `--cmp-communication-thread-indent`.
- System slots: `--sys-communication-accent`, `--sys-communication-muted`, `--sys-communication-success`, `--sys-communication-error`.
- All communication components read only `--cmp-*` / `--sys-*` tokens—no raw hex literals.

## Integration Examples
- **Explorer surface wiring** (`apps/explorer/src/pages/TimelinePage.tsx`): embeds MessageTimeline + ConversationThread + ChannelPlanEditor + DeliveryHealthWidget, all powered by `useMessages`, `useConversations`, and `useDeliveryStatus`. Demonstrates pagination, optimistic reads, threaded replies, and SLA status badges.
- **Policy registry**: pass presets or org-level defaults through `policy.metadata.channel_types`; persist via `onChange(nextPolicy, validation)`.
- **Backend hooks**: map `useMessages.fetchPage` to `/communication/messages?cursor=...`, pipe `markAsRead` to `PATCH /communication/messages/:id/read`, and map `useDeliveryStatus` to `/communication/delivery-status/:messageId` for live state.
- **Token overrides**: adjust communication colors by setting the component tokens in brand CSS; timeline + widget colors respond immediately without component changes.
