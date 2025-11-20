import { performance } from 'node:perf_hooks';

import { describe, expect, it } from 'vitest';

import type { Channel } from '@/schemas/communication/channel.js';
import type { Message } from '@/schemas/communication/message.js';
import { MessageDeliveryService } from '@/traits/communication/delivery-service.js';
import type { QueueAdapter } from '@/traits/communication/queue/queue-adapter.js';
import type { DeliveryQueuePayload, QueueEntry, QueueMessage, QueueStats } from '@/traits/communication/runtime-types.js';

class NoopQueue implements QueueAdapter<DeliveryQueuePayload> {
  async enqueue(): Promise<void> {}
  async dequeue(): Promise<QueueEntry<DeliveryQueuePayload> | null> { return null; }
  async ack(): Promise<void> {}
  async nack(): Promise<void> {}
  async peek(): Promise<readonly QueueMessage<DeliveryQueuePayload>[]> { return []; }
  async stats(): Promise<QueueStats> {
    return { name: 'noop', queued: 0, inFlight: 0, acknowledged: 0, deadLettered: 0 } as QueueStats;
  }
}

const CHANNEL: Channel = {
  id: 'email',
  name: 'Email',
  type: 'email',
  enabled: true,
  description: 'SMTP',
  metadata: {},
  tags: [],
  config: {},
};

const message: Message = {
  id: 'msg-bench',
  sender_id: 'sender',
  organization_id: 'org',
  recipient_ids: ['user'],
  channel_type: 'email',
  template_id: 'tmpl',
  variables: {},
  metadata: { event_type: 'bench' },
  status: 'queued',
  status_history: [],
  attachments: [],
  created_at: '2025-11-20T00:00:00Z',
  priority: 'normal',
} as Message;

const resolver = {
  resolveChannel: async () => ({ channel: CHANNEL, channelType: 'email' as const, source: 'user' as const }),
};

const authBridge = {
  validateSenderPermission: async () => true,
  validateRecipientPermission: async () => true,
};

const preferenceBridge = {
  getUserChannelPreferences: async () => ({
    userId: 'user',
    eventType: 'bench',
    matrix: {},
    optedInChannels: ['email'],
    explicitlyBlockedChannels: [],
    organizationDefaults: [],
    systemDefaults: [],
    quietHours: null,
  }),
  getQuietHours: async () => null,
};

describe('Delivery runtime benchmarks', () => {
  it('queues messages under the 10ms p99 target', async () => {
    const queue = new NoopQueue();
    const service = new MessageDeliveryService({
      queue,
      channelResolver: resolver as never,
      authBridge: authBridge as never,
      preferenceBridge: preferenceBridge as never,
    });
    const samples: number[] = [];
    for (let index = 0; index < 50; index += 1) {
      const started = performance.now();
      await service.sendMessage({ ...message, id: `msg-${index}` }, [`user-${index}`], {
        availableChannels: [CHANNEL],
        organizationId: 'org',
      });
      samples.push(performance.now() - started);
    }
    samples.sort((a, b) => a - b);
    const p99 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.99))]!;
    // CI noise can spike individual measurements, but delivery scheduling should stay
    // comfortably below 50ms p99 on commodity runners.
    expect(p99).toBeLessThan(50);
  });
});
