/* @vitest-environment jsdom */

import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useConversations } from '@/hooks/useConversations.js';
import type { ConversationsClient } from '@/hooks/useConversations.js';
import type { Conversation } from '@/schemas/communication/conversation.js';
import type { Message } from '@/schemas/communication/message.js';

describe('useConversations', () => {
  it('loads conversations and supports adding replies', async () => {
    const baseMessages: Message[] = [
      {
        id: 'm-1',
        organization_id: undefined,
        sender_id: 'ops',
        recipient_ids: ['team'],
        channel_type: 'email',
        template_id: 'tmpl',
        variables: {},
        metadata: { subject: 'Root' },
        priority: 'normal',
        status: 'sent',
        status_history: [],
        delivery_policy: undefined,
        conversation_id: 'conv-1',
        attachments: [],
        created_at: '2025-11-20T10:00:00Z',
        queued_at: undefined,
        sent_at: undefined,
        delivered_at: undefined,
        read_at: undefined,
        failed_at: undefined,
      },
    ];

    const baseConversation: Conversation = {
      id: 'conv-1',
      subject: 'Test conversation',
      participants: [
        { user_id: 'ops', role: 'owner', joined_at: '2025-11-20T09:55:00Z', last_seen_at: undefined },
        { user_id: 'team', role: 'member', joined_at: '2025-11-20T09:55:00Z', last_seen_at: undefined },
      ],
      messages: baseMessages,
      status: 'active',
      metadata: {},
      created_at: '2025-11-20T09:55:00Z',
      updated_at: '2025-11-20T10:00:00Z',
    };

    const client: ConversationsClient = {
      async listConversations() {
        return [baseConversation];
      },
      async createConversation(conversation) {
        return conversation;
      },
      async addReply(_conversationId, message) {
        return message;
      },
    };

    const { result } = renderHook(() =>
      useConversations({ client })
    );

    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.conversations).toHaveLength(1);

    const reply: Message = {
      ...baseMessages[0]!,
      id: 'm-2',
      metadata: { subject: 'Reply', parent_message_id: 'm-1' },
      created_at: '2025-11-20T10:05:00Z',
    };

    await act(async () => {
      await result.current.addReply('conv-1', reply);
    });

    expect(result.current.conversations[0]?.messages).toHaveLength(2);
  });
});

