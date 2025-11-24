/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { ConversationThread } from '@/components/communication/ConversationThread.js';
import type { Conversation } from '@/schemas/communication/conversation.js';
import type { Message } from '@/schemas/communication/message.js';

const BASE_MESSAGES: Message[] = [
  {
    id: 'root-1',
    organization_id: undefined,
    sender_id: 'ops',
    recipient_ids: ['team'],
    channel_type: 'email',
    template_id: 'tmpl',
    variables: {},
    metadata: { subject: 'Kickoff' },
    priority: 'normal',
    status: 'sent',
    status_history: [],
    delivery_policy: undefined,
    conversation_id: 'conv',
    attachments: [],
    created_at: '2025-11-20T10:00:00Z',
    queued_at: undefined,
    sent_at: undefined,
    delivered_at: undefined,
    read_at: undefined,
    failed_at: undefined,
  },
  {
    id: 'reply-1',
    organization_id: undefined,
    sender_id: 'csm',
    recipient_ids: ['team'],
    channel_type: 'email',
    template_id: 'tmpl',
    variables: {},
    metadata: { subject: 'Follow up', parent_message_id: 'root-1' },
    priority: 'normal',
    status: 'sent',
    status_history: [],
    delivery_policy: undefined,
    conversation_id: 'conv',
    attachments: [],
    created_at: '2025-11-20T10:05:00Z',
    queued_at: undefined,
    sent_at: undefined,
    delivered_at: undefined,
    read_at: undefined,
    failed_at: undefined,
  },
];

const CONVERSATION: Conversation = {
  id: 'conv',
  subject: 'Notification rollout',
  participants: [
    { user_id: 'ops', role: 'owner', joined_at: '2025-11-20T09:55:00Z', last_seen_at: undefined },
    { user_id: 'csm', role: 'member', joined_at: '2025-11-20T09:55:00Z', last_seen_at: undefined },
  ],
  messages: BASE_MESSAGES,
  status: 'active',
  metadata: {},
  created_at: '2025-11-20T09:55:00Z',
  updated_at: '2025-11-20T10:05:00Z',
};

describe('ConversationThread', () => {
  it('renders thread with tree semantics', () => {
    const onReply = vi.fn();
    render(<ConversationThread conversation={CONVERSATION} onReply={onReply} maxDepth={3} />);

    expect(screen.getByRole('tree', { name: /Conversation thread/i })).toBeInTheDocument();
    const items = screen.getAllByRole('treeitem');
    expect(items).toHaveLength(2);
  });

  it('bubbles reply events with parent and conversation id', async () => {
    const user = userEvent.setup();
    const onReply = vi.fn();
    render(<ConversationThread conversation={CONVERSATION} onReply={onReply} maxDepth={3} />);

    const replyButtons = screen.getAllByRole('button', { name: /Reply/i });
    await user.click(replyButtons[0]!);

    expect(onReply).toHaveBeenCalledWith('root-1', 'conv');
  });
});

