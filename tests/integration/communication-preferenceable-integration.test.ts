import { describe, expect, it } from 'vitest';

import type { Channel } from '@/schemas/communication/channel.js';
import type { Message } from '@/schemas/communication/message.js';
import { PreferenceCache } from '@/traits/preferenceable/cache/preference-cache.js';
import { InMemoryPreferenceCacheTransport } from '@/traits/preferenceable/cache/preference-cache.js';
import type {
  PreferenceDocumentLocator,
  PreferenceDocumentRecord,
  PreferenceDocumentRepository,
} from '@/traits/preferenceable/query/optimized-queries.js';
import { PreferenceableBridge } from '@/traits/communication/bridges/preferenceable-bridge.js';
import { ChannelResolver } from '@/traits/communication/channel-resolver.js';
import { MessageDeliveryService } from '@/traits/communication/delivery-service.js';
import { InMemoryQueueAdapter } from '@/traits/communication/queue/in-memory-adapter.js';
import type { DeliveryQueuePayload } from '@/traits/communication/runtime-types.js';

class StaticPreferenceRepository implements PreferenceDocumentRepository {
  constructor(private readonly record: PreferenceDocumentRecord) {}

  async fetchDocument(_locator: PreferenceDocumentLocator): Promise<PreferenceDocumentRecord | null> {
    return this.record;
  }
}

const EMAIL_CHANNEL: Channel = {
  id: 'email',
  name: 'Email',
  type: 'email',
  enabled: true,
  description: 'SMTP',
  metadata: {},
  tags: [],
  config: {},
};

const SMS_CHANNEL: Channel = {
  id: 'sms',
  name: 'SMS',
  type: 'sms',
  enabled: true,
  description: 'SMS',
  metadata: {},
  tags: [],
  config: {},
};

const message: Message = {
  id: 'msg-pref',
  sender_id: 'system-user',
  organization_id: 'org-1',
  recipient_ids: ['user-1'],
  channel_type: 'email',
  template_id: 'tmpl',
  variables: {},
  metadata: { event_type: 'welcome' },
  status: 'queued',
  status_history: [],
  attachments: [],
  created_at: '2025-11-20T00:00:00Z',
  priority: 'normal',
} as Message;

describe('Communication ↔ Preferenceable integration', () => {
  it('respects notification matrix opt-outs and quiet hours', async () => {
    const repository = new StaticPreferenceRepository({
      document: {
        version: '1.0.0',
        preferences: {
          notifications: {
            matrix: {
              welcome: { email: false, sms: true },
            },
          },
          quietHours: { start: '00:00', end: '08:00', timezone: 'UTC' },
        },
        metadata: {
          schemaVersion: '1.0.0',
          lastUpdated: '2025-11-20T00:00:00Z',
          source: 'user',
          migrationApplied: [],
        },
      },
      preferenceMutations: 0,
      updatedAt: '2025-11-20T00:00:00Z',
    });
    const cache = new PreferenceCache(repository, new InMemoryPreferenceCacheTransport());
    const preferenceBridge = new PreferenceableBridge(cache, {
      systemDefaults: ['email'],
    });
    const channelResolver = new ChannelResolver(preferenceBridge);
    const queue = new InMemoryQueueAdapter<DeliveryQueuePayload>();
    const service = new MessageDeliveryService({
      queue,
      channelResolver,
      authBridge: {
        validateSenderPermission: async () => true,
        validateRecipientPermission: async () => true,
      } as never,
      preferenceBridge,
      clock: () => new Date('2025-11-20T03:00:00Z'),
    });

    const result = await service.sendMessage(message, ['user-1'], {
      availableChannels: [EMAIL_CHANNEL, SMS_CHANNEL],
      organizationId: 'org-1',
    });

    expect(result.queuedRecipients).toHaveLength(1);
    expect(result.queuedRecipients[0]?.channelType).toBe('sms');
    const queued = await queue.peek();
    expect(queued[0]!.scheduledAt.toISOString().startsWith('2025-11-20T08:00:00')).toBe(true);
  });
});
