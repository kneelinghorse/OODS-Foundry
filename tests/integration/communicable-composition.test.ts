import { describe, expect, it } from 'vitest';

import { generateObjectInterface } from '@/generators/object-type-generator.js';
import { ObjectRegistry } from '@/registry/registry.js';
import type { Channel } from '@/schemas/communication/channel.js';
import type { Message } from '@/schemas/communication/message.js';
import { AuthableBridge } from '@/traits/communication/bridges/authable-bridge.js';
import { ChannelResolver } from '@/traits/communication/channel-resolver.js';
import { MessageDeliveryService } from '@/traits/communication/delivery-service.js';
import { InMemoryQueueAdapter } from '@/traits/communication/queue/in-memory-adapter.js';
import type { PreferenceableBridge } from '@/traits/communication/bridges/preferenceable-bridge.js';
import type { DeliveryQueuePayload } from '@/traits/communication/runtime-types.js';
import { cloneDataset, SAMPLE_COMMUNICATION_DATASET } from '../../src/cli/communication-shared';

const EMAIL_CHANNEL: Channel = cloneDataset(SAMPLE_COMMUNICATION_DATASET).channels[0];

function message(senderId: string, recipientId: string, organizationId: string): Message {
  return {
    id: 'msg-integration',
    sender_id: senderId,
    organization_id: organizationId,
    recipient_ids: [recipientId],
    channel_type: EMAIL_CHANNEL.type,
    template_id: 'tmpl-welcome',
    variables: {},
    metadata: { event_type: 'welcome' },
    priority: 'normal',
    status: 'queued',
    status_history: [],
    attachments: [],
    created_at: '2025-11-20T00:00:00Z',
  } as Message;
}

describe('Communicable composition and helpers', () => {
  it('generates helper methods for User and Organization interfaces', async () => {
    const registry = new ObjectRegistry({ roots: ['objects'], watch: false });
    await registry.waitUntilReady();

    const userResolved = await registry.resolve('User', { traitRoots: ['traits'] });
    const orgResolved = await registry.resolve('Organization', { traitRoots: ['traits'] });
    registry.close();

    const userInterface = generateObjectInterface(userResolved);
    const orgInterface = generateObjectInterface(orgResolved);

    expect(userInterface.traits).toContain('Communicable');
    expect(userInterface.code).toContain('sendMessage?');
    expect(userInterface.code).toContain('markAllAsRead?');

    expect(orgInterface.traits).toContain('Communicable');
    expect(orgInterface.code).toContain('broadcastMessage?');
    expect(orgInterface.code).toContain('getDeliveryPolicies?');
  });

  it('blocks sendMessage when Authable permissions fail', async () => {
    const preferenceBridge = buildPreferenceBridge([], []);
    const authBridge = new AuthableBridge(
      { hasPermission: async () => false } as any,
      { permissionNamespace: 'messages' }
    );
    const service = new MessageDeliveryService({
      queue: new InMemoryQueueAdapter<DeliveryQueuePayload>(),
      channelResolver: new ChannelResolver(preferenceBridge),
      authBridge,
      preferenceBridge,
    });

    const outcome = await service.sendMessage(
      message('user-sender', 'user-recipient', 'org-comm-001'),
      ['user-recipient'],
      {
        availableChannels: [EMAIL_CHANNEL],
        organizationId: 'org-comm-001',
      }
    );

    expect(outcome.queuedRecipients).toHaveLength(0);
    expect(outcome.blockedRecipients[0]?.reason).toBe('sender-permission');
  });

  it('respects Preferenceable bridge when channel is opted out', async () => {
    const preferenceBridge = buildPreferenceBridge([], ['email']);
    const authBridge = new AuthableBridge(
      { hasPermission: async () => true } as any,
      { permissionNamespace: 'messages' }
    );
    const service = new MessageDeliveryService({
      queue: new InMemoryQueueAdapter<DeliveryQueuePayload>(),
      channelResolver: new ChannelResolver(preferenceBridge),
      authBridge,
      preferenceBridge,
    });

    const result = await service.sendMessage(
      message('user-sender', 'user-recipient', 'org-comm-001'),
      ['user-recipient'],
      {
        availableChannels: [EMAIL_CHANNEL],
        organizationId: 'org-comm-001',
      }
    );

    expect(result.queuedRecipients).toHaveLength(0);
    expect(result.blockedRecipients[0]?.reason).toBe('no-channel');
  });
});

function buildPreferenceBridge(
  optedIn: readonly string[],
  blocked: readonly string[]
): PreferenceableBridge {
  return {
    getUserChannelPreferences: async (userId: string, eventType: string) => ({
      userId,
      eventType,
      matrix: {},
      optedInChannels: optedIn as string[],
      explicitlyBlockedChannels: blocked as string[],
      organizationDefaults: [],
      systemDefaults: [],
      quietHours: null,
    }),
    getQuietHours: async () => null,
  } as PreferenceableBridge;
}
