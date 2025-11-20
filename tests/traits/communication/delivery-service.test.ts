import { describe, expect, it } from 'vitest';

import type { Channel } from '@/schemas/communication/channel.js';
import type { Message } from '@/schemas/communication/message.js';
import { MessageDeliveryService } from '@/traits/communication/delivery-service.js';
import { InMemoryQueueAdapter } from '@/traits/communication/queue/in-memory-adapter.js';
import type { DeliveryQueuePayload } from '@/traits/communication/runtime-types.js';

const CHANNEL: Channel = {
  id: 'email-channel',
  name: 'Email',
  type: 'email',
  enabled: true,
  description: 'SMTP',
  metadata: {},
  tags: [],
  config: {},
};

function buildMessage(): Message {
  return {
    id: 'msg-123',
    sender_id: 'sender-1',
    organization_id: 'org-1',
    recipient_ids: ['user-1'],
    channel_type: 'email',
    template_id: 'tmpl-1',
    variables: {},
    metadata: { event_type: 'welcome' },
    status: 'queued',
    status_history: [],
    attachments: [],
    created_at: '2025-11-20T00:00:00Z',
    priority: 'normal',
  } as Message;
}

class ResolverStub {
  constructor(private readonly channel: Channel | null) {}

  async resolveChannel() {
    if (!this.channel) {
      return null;
    }
    return {
      channel: this.channel,
      channelType: this.channel.type,
      source: 'user' as const,
    };
  }
}

const authBridge = {
  validateSenderPermission: async () => true,
  validateRecipientPermission: async () => true,
} as const;

const preferenceBridge = {
  getUserChannelPreferences: async () => ({
    userId: 'user-1',
    eventType: 'welcome',
    matrix: {},
    optedInChannels: ['email'],
    explicitlyBlockedChannels: [],
    organizationDefaults: [],
    systemDefaults: [],
    quietHours: null,
  }),
  getQuietHours: async () => null,
} as const;

describe('MessageDeliveryService', () => {
  it('queues messages when permissions and channels are valid', async () => {
    const queue = new InMemoryQueueAdapter<DeliveryQueuePayload>({ clock: () => new Date('2025-11-20T10:00:00Z') });
    const service = new MessageDeliveryService({
      queue,
      channelResolver: new ResolverStub(CHANNEL) as never,
      authBridge: authBridge as never,
      preferenceBridge: preferenceBridge as never,
      clock: () => new Date('2025-11-20T10:00:00Z'),
    });

    const result = await service.sendMessage(buildMessage(), ['user-1'], {
      availableChannels: [CHANNEL],
      organizationId: 'org-1',
    });

    expect(result.queuedRecipients).toHaveLength(1);
    const queued = await queue.peek();
    expect(queued).toHaveLength(1);
    expect(queued[0]?.payload.recipientId).toBe('user-1');
  });

  it('blocks when sender lacks permission', async () => {
    const queue = new InMemoryQueueAdapter<DeliveryQueuePayload>();
    const service = new MessageDeliveryService({
      queue,
      channelResolver: new ResolverStub(CHANNEL) as never,
      authBridge: {
        validateSenderPermission: async () => false,
        validateRecipientPermission: async () => true,
      } as never,
      preferenceBridge: preferenceBridge as never,
    });
    const result = await service.sendMessage(buildMessage(), ['user-1'], {
      availableChannels: [CHANNEL],
      organizationId: 'org-1',
    });
    expect(result.queuedRecipients).toHaveLength(0);
    expect(result.blockedRecipients[0]?.reason).toBe('sender-permission');
  });

  it('reschedules deliveries during quiet hours', async () => {
    const queue = new InMemoryQueueAdapter<DeliveryQueuePayload>({ clock: () => new Date('2025-11-20T02:00:00Z') });
    const service = new MessageDeliveryService({
      queue,
      channelResolver: new ResolverStub(CHANNEL) as never,
      authBridge: authBridge as never,
      preferenceBridge: {
        ...preferenceBridge,
        getQuietHours: async () => ({ start_time: '00:00', end_time: '08:00', timezone: 'UTC' }),
      } as never,
      clock: () => new Date('2025-11-20T02:00:00Z'),
    });
    const result = await service.sendMessage(buildMessage(), ['user-1'], {
      availableChannels: [CHANNEL],
      organizationId: 'org-1',
    });
    expect(result.queuedRecipients[0]?.scheduledAt.startsWith('2025-11-20T08:00:00')).toBe(true);
  });

  it('blocks recipients when channel resolver cannot find a match', async () => {
    const service = new MessageDeliveryService({
      queue: new InMemoryQueueAdapter<DeliveryQueuePayload>(),
      channelResolver: new ResolverStub(null) as never,
      authBridge: authBridge as never,
      preferenceBridge: preferenceBridge as never,
    });
    const result = await service.sendMessage(buildMessage(), ['user-1'], {
      availableChannels: [CHANNEL],
      organizationId: 'org-1',
    });
    expect(result.blockedRecipients[0]?.reason).toBe('no-channel');
  });
});
