/* @vitest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { MessageTimeline } from '@/components/communication/MessageTimeline.js';
import type { Message } from '@/schemas/communication/message.js';

const MESSAGES: Message[] = [
  {
    id: 'msg-1',
    sender_id: 'sender-1',
    recipient_ids: ['user-1'],
    channel_type: 'email',
    template_id: 'tmpl-1',
    variables: {},
    metadata: { subject: 'Welcome' },
    priority: 'normal',
    status: 'queued',
    status_history: [],
    created_at: '2025-11-20T10:00:00Z',
  },
  {
    id: 'msg-2',
    sender_id: 'sender-1',
    recipient_ids: ['user-1'],
    channel_type: 'email',
    template_id: 'tmpl-1',
    variables: {},
    metadata: { subject: 'Follow up' },
    priority: 'normal',
    status: 'sent',
    status_history: [],
    created_at: '2025-11-20T11:00:00Z',
  },
];

describe('MessageTimeline', () => {
  it('renders grouped messages and triggers load more near end', async () => {
    const onLoadMore = vi.fn();
    render(<MessageTimeline messages={MESSAGES} onLoadMore={onLoadMore} hasMore itemSize={60} />);

    expect(screen.getByRole('feed')).toBeInTheDocument();
    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.getByText('Follow up')).toBeInTheDocument();

    await waitFor(() => expect(onLoadMore).toHaveBeenCalled());
  });

  it('marks messages as read when clicked', async () => {
    const onMarkAsRead = vi.fn();
    render(<MessageTimeline messages={MESSAGES} onMarkAsRead={onMarkAsRead} />);

    const subject = screen.getByText('Welcome');
    await userEvent.click(subject);
    expect(onMarkAsRead).toHaveBeenCalledWith('msg-1');
  });

  it('handles messages without timestamps gracefully', () => {
    const messages: Message[] = [
      {
        ...MESSAGES[0],
        id: 'msg-untimed',
        created_at: '' as string,
      },
    ];

    render(<MessageTimeline messages={messages} />);

    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.getByText(/Unknown time/i)).toBeInTheDocument();
  });
});
