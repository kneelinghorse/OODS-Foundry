import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { ConversationThread } from '../../src/components/communication/ConversationThread.js';
import type { Conversation } from '../../src/schemas/communication/conversation.js';
import type { Message } from '../../src/schemas/communication/message.js';

type Story = StoryObj<typeof ConversationThread>;

const meta: Meta<typeof ConversationThread> = {
  title: 'Domain Patterns/Communication/Conversation Thread',
  component: ConversationThread,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

export const Default: Story = {
  render: () => <ConversationThreadStory />,
};

function ConversationThreadStory(): JSX.Element {
  const conversation = buildConversation();

  return (
    <div className="min-h-screen bg-[--cmp-surface-canvas] p-8">
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[--sys-text-muted]">Communication</p>
          <h1 className="text-lg font-semibold text-[--sys-text-primary]">ConversationThread</h1>
          <p className="text-sm text-[--sys-text-muted]">
            Threaded escalation view seeded from a synthetic conversation; replies bubble parent and conversation ids.
          </p>
        </header>
        <ConversationThread
          conversation={conversation}
          maxDepth={3}
          onReply={(parentId, conversationId) => {
            // eslint-disable-next-line no-console
            console.log('Reply requested', { parentId, conversationId });
          }}
        />
      </div>
    </div>
  );
}

function buildConversation(): Conversation {
  const createdAt = '2025-11-19T15:55:00Z';
  const conversationId = 'conv-story';
  const messages: Message[] = [
    {
      id: 'msg-root',
      organization_id: undefined,
      sender_id: 'ops-bot',
      recipient_ids: ['success-team'],
      channel_type: 'email',
      template_id: 'tmpl-communication',
      variables: {},
      metadata: { subject: 'Kickoff: SLA readiness' },
      priority: 'normal',
      status: 'sent',
      status_history: [],
      delivery_policy: undefined,
      conversation_id: conversationId,
      attachments: [],
      created_at: '2025-11-19T16:00:00Z',
      queued_at: undefined,
      sent_at: undefined,
      delivered_at: undefined,
      read_at: undefined,
      failed_at: undefined,
    },
    {
      id: 'msg-reply-1',
      organization_id: undefined,
      sender_id: 'csm-alex',
      recipient_ids: ['success-team'],
      channel_type: 'email',
      template_id: 'tmpl-communication',
      variables: {},
      metadata: { subject: 'Provider selected', parent_message_id: 'msg-root' },
      priority: 'normal',
      status: 'sent',
      status_history: [],
      delivery_policy: undefined,
      conversation_id: conversationId,
      attachments: [],
      created_at: '2025-11-19T16:12:00Z',
      queued_at: undefined,
      sent_at: undefined,
      delivered_at: undefined,
      read_at: undefined,
      failed_at: undefined,
    },
    {
      id: 'msg-reply-2',
      organization_id: undefined,
      sender_id: 'deliverability',
      recipient_ids: ['success-team'],
      channel_type: 'email',
      template_id: 'tmpl-communication',
      variables: {},
      metadata: { subject: 'SPF/DKIM configured', parent_message_id: 'msg-root' },
      priority: 'normal',
      status: 'delivered',
      status_history: [],
      delivery_policy: undefined,
      conversation_id: conversationId,
      attachments: [],
      created_at: '2025-11-19T16:24:00Z',
      queued_at: undefined,
      sent_at: undefined,
      delivered_at: undefined,
      read_at: undefined,
      failed_at: undefined,
    },
  ];

  return {
    id: conversationId,
    subject: 'Notification rollout with CSM',
    participants: [
      { user_id: 'ops-lead', role: 'owner', joined_at: createdAt, last_seen_at: undefined },
      { user_id: 'csm-alex', role: 'member', joined_at: createdAt, last_seen_at: undefined },
      { user_id: 'deliverability', role: 'viewer', joined_at: createdAt, last_seen_at: undefined },
    ],
    messages,
    status: 'active',
    metadata: {},
    created_at: createdAt,
    updated_at: messages[messages.length - 1]?.created_at ?? createdAt,
  };
}

