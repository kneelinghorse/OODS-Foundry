import type { JSX, KeyboardEvent } from 'react';
import { forwardRef, memo, useMemo, useRef } from 'react';
import { FixedSizeList, type ListChildComponentProps, type ListOnItemsRenderedProps } from 'react-window';
import { DateTime } from 'luxon';

import type { Message } from '@/schemas/communication/message.js';

export interface MessageTimelineItemProps {
  readonly event: Message;
  readonly unread: boolean;
  readonly onMarkAsRead?: (id: string) => void;
}

export interface MessageTimelineProps {
  readonly messages: readonly Message[];
  readonly onLoadMore?: () => void;
  readonly onMarkAsRead?: (id: string) => void;
  readonly groupByDate?: boolean;
  readonly hasMore?: boolean;
  readonly isLoading?: boolean;
  readonly itemSize?: number;
}

type TimelineRow = { type: 'header'; key: string; label: string } | { type: 'message'; key: string; message: Message };
type TimelineData = { rows: TimelineRow[]; onMarkAsRead?: (id: string) => void };

const DEFAULT_ITEM_SIZE = 84;
const LOAD_THRESHOLD = 5;

const MessageRow = memo(({ data, index, style }: ListChildComponentProps<TimelineData>) => {
  const row = data.rows[index]!;
  if (row.type === 'header') {
    return (
      <div
        style={style}
        className="px-3 py-2 text-xs font-semibold text-[--cmp-communication-date-header-fg]"
        aria-label={row.label}
        role="presentation"
        aria-hidden="true"
      >
        {row.label}
      </div>
    );
  }
  const { message } = row;
  const unread = message.status === 'queued' || message.status === 'sent';
  const handleActivate = () => {
    data.onMarkAsRead?.(message.id);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleActivate();
    }
  };
  return (
    <div
      style={style}
      className={`px-4 py-3 border-b border-[--cmp-communication-policy-editor-border] flex flex-col gap-1 ${
        unread ? 'bg-[--cmp-communication-unread-bg] font-semibold' : 'bg-[--cmp-communication-timeline-bg]'
      }`}
      role="article"
      aria-live="polite"
      aria-label={`Message from ${message.sender_id}`}
      data-message-id={message.id}
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="text-[--sys-text-subtle]">{formatTimestamp(message.created_at)}</span>
        {message.priority === 'urgent' ? <span className="text-[--sys-status-warning-fg]">urgent</span> : null}
      </div>
      <div className="text-sm text-[--sys-text-primary] truncate">{renderSubject(message.metadata?.subject ?? message.id)}</div>
      <div className="text-xs text-[--sys-text-subtle]">Status: {message.status}</div>
    </div>
  );
});

MessageRow.displayName = 'MessageRow';

export function MessageTimeline({
  messages,
  onLoadMore,
  onMarkAsRead,
  groupByDate = true,
  hasMore = false,
  isLoading = false,
  itemSize = DEFAULT_ITEM_SIZE,
}: MessageTimelineProps): JSX.Element {
  const listRef = useRef<FixedSizeList<TimelineData> | null>(null);

  const rows = useMemo(() => buildRows(messages, groupByDate), [groupByDate, messages]);
  const itemData = useMemo(
    () =>
      ({
        rows,
        onMarkAsRead,
      }) as TimelineData,
    [rows, onMarkAsRead]
  );
  const FeedInner = useMemo(
    () =>
      forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
        <div ref={ref} role="feed" aria-live="polite" aria-busy={isLoading} aria-label="Message timeline" {...props} />
      )),
    [isLoading]
  );

  const handleItemsRendered = ({ visibleStopIndex }: ListOnItemsRenderedProps) => {
    const nearEnd = visibleStopIndex >= rows.length - LOAD_THRESHOLD;
    if (nearEnd && hasMore && onLoadMore) {
      void onLoadMore();
    }
  };

  const handleClick = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const article = target.closest('[data-message-id]') as HTMLElement | null;
    const messageId = article?.dataset.messageId;
    if (messageId && onMarkAsRead) {
      void onMarkAsRead(messageId);
    }
  };

  return (
    <div
      className="w-full min-w-[360px] h-full min-h-[320px] border border-[--cmp-communication-policy-editor-border] rounded-md bg-[--cmp-communication-timeline-bg] text-[--cmp-communication-timeline-fg]"
      role="region"
      aria-label="Message timeline container"
      onClick={(event) => handleClick(event.target)}
    >
      {rows.length === 0 ? (
        <div className="p-6 text-sm text-[--sys-text-muted]">No messages to display.</div>
      ) : null}
      <FixedSizeList
        height={Math.max(itemSize * 3, 360)}
        itemCount={rows.length}
        itemData={itemData}
        itemSize={itemSize}
        width="100%"
        onItemsRendered={(meta) => handleItemsRendered(meta)}
        ref={listRef}
        innerElementType={FeedInner}
      >
        {MessageRow as never}
      </FixedSizeList>
    </div>
  );
}

function buildRows(messages: readonly Message[], groupByDate: boolean): TimelineRow[] {
  const normalizeTimestamp = (timestamp?: string): string => (typeof timestamp === 'string' ? timestamp : '');
  const sorted = [...messages].sort((a, b) => normalizeTimestamp(a.created_at).localeCompare(normalizeTimestamp(b.created_at)));
  if (!groupByDate) {
    return sorted.map((message) => ({ type: 'message', key: message.id, message }));
  }
  const rows: TimelineRow[] = [];
  let currentLabel: string | null = null;
  for (const message of sorted) {
    const label = formatDateLabel(message.created_at);
    if (label !== currentLabel) {
      rows.push({ type: 'header', key: `header-${label}`, label });
      currentLabel = label;
    }
    rows.push({ type: 'message', key: message.id, message });
  }
  return rows;
}

function formatDateLabel(timestamp: string): string {
  const dt = DateTime.fromISO(timestamp, { zone: 'utc' });
  if (!dt.isValid) {
    return 'Unknown date';
  }
  const now = DateTime.now().setZone('utc');
  if (dt.hasSame(now, 'day')) {
    return 'Today';
  }
  if (dt.hasSame(now.minus({ days: 1 }), 'day')) {
    return 'Yesterday';
  }
  return dt.toFormat('LLL dd');
}

function formatTimestamp(timestamp: string): string {
  const dt = DateTime.fromISO(timestamp, { zone: 'utc' });
  if (!dt.isValid) {
    return 'Unknown time';
  }
  return dt.toFormat('LLL dd, HH:mm');
}

function renderSubject(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value === null || value === undefined) {
    return 'Message';
  }
  if (Array.isArray(value)) {
    return value.map((item) => renderSubject(item)).join(', ');
  }
  return '[object]';
}
