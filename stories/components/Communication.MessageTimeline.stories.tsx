import React, { useCallback, useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { MessageTimeline } from '../../src/components/communication/MessageTimeline.js';
import type { Message } from '../../src/schemas/communication/message.js';
import { useMessages } from '../../src/hooks/useMessages.js';

type Story = StoryObj<typeof MessageTimeline>;

const meta: Meta<typeof MessageTimeline> = {
  title: 'Domain Patterns/Communication/Message Timeline',
  component: MessageTimeline,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

export const Default: Story = {
  render: () => <MessageTimelineStory />,
};

function MessageTimelineStory(): JSX.Element {
  const seedMessages = useMemo(() => buildDemoMessages(), []);

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

  const { messages, loadMore, hasMore, markAsRead, isLoading } = useMessages({
    fetchPage,
    markAsRead: async () => undefined,
  });

  return (
    <div className="min-h-screen bg-[--cmp-surface-canvas] p-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[--sys-text-muted]">Communication</p>
          <h1 className="text-lg font-semibold text-[--sys-text-primary]">MessageTimeline</h1>
          <p className="text-sm text-[--sys-text-muted]">
            Virtualised feed showing queued, sent, and delivered messages grouped by day. Enter/Space marks messages as read.
          </p>
        </header>
        <MessageTimeline
          messages={messages}
          onLoadMore={loadMore}
          hasMore={hasMore}
          onMarkAsRead={markAsRead}
          isLoading={isLoading}
          groupByDate
        />
      </div>
    </div>
  );
}

function buildDemoMessages(): Message[] {
  const baseTimestamp = '2025-11-20T08:00:00Z';
  const baseDate = new Date(baseTimestamp);

  const makeTimestamp = (offsetMinutes: number): string => {
    const next = new Date(baseDate.getTime() + offsetMinutes * 60_000);
    return next.toISOString();
  };

  const messages: Message[] = [];

  for (let index = 0; index < 16; index += 1) {
    messages.push({
      id: `msg-${index + 1}`,
      organization_id: undefined,
      sender_id: index % 3 === 0 ? 'ops-bot' : 'notifications',
      recipient_ids: ['success-team'],
      channel_type: index % 2 === 0 ? 'email' : 'sms',
      template_id: 'tmpl-communication',
      variables: {},
      metadata: { subject: `Outbound notice ${index + 1}` },
      priority: index % 5 === 0 ? 'urgent' : 'normal',
      status: index % 4 === 0 ? 'queued' : 'sent',
      status_history: [],
      delivery_policy: undefined,
      conversation_id: undefined,
      attachments: [],
      created_at: makeTimestamp(index * 12),
      queued_at: undefined,
      sent_at: undefined,
      delivered_at: undefined,
      read_at: undefined,
      failed_at: undefined,
    });
  }

  return messages;
}

