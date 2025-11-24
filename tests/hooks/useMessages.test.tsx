/* @vitest-environment jsdom */

import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useMessages } from '@/hooks/useMessages.js';
import type { Message } from '@/schemas/communication/message.js';

describe('useMessages', () => {
  it('loads initial page and supports optimistic markAsRead', async () => {
    const messages: Message[] = [
      {
        id: 'm-1',
        organization_id: undefined,
        sender_id: 'sender',
        recipient_ids: ['r-1'],
        channel_type: 'email',
        template_id: 'tmpl',
        variables: {},
        metadata: { subject: 'Hello' },
        priority: 'normal',
        status: 'queued',
        status_history: [],
        delivery_policy: undefined,
        conversation_id: undefined,
        attachments: [],
        created_at: '2025-11-20T10:00:00Z',
        queued_at: undefined,
        sent_at: undefined,
        delivered_at: undefined,
        read_at: undefined,
        failed_at: undefined,
      },
    ];

    const fetchPage = async () => ({
      messages,
      hasMore: false,
    });

    const { result } = renderHook(() =>
      useMessages({ fetchPage })
    );

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.messages).toHaveLength(1);

    await act(async () => {
      await result.current.markAsRead('m-1');
    });

    expect(result.current.messages[0]?.status).toBe('read');
  });
});

