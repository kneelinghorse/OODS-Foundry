import { describe, expect, it } from 'vitest';

import type { Channel } from '@/schemas/communication/channel.js';
import type { Message } from '@/schemas/communication/message.js';
import { AuthableBridge } from '@/traits/communication/bridges/authable-bridge.js';
import { ChannelResolver } from '@/traits/communication/channel-resolver.js';
import { MessageDeliveryService } from '@/traits/communication/delivery-service.js';
import { InMemoryQueueAdapter } from '@/traits/communication/queue/in-memory-adapter.js';
import type { PreferenceableBridge } from '@/traits/communication/bridges/preferenceable-bridge.js';
import type { DeliveryQueuePayload } from '@/traits/communication/runtime-types.js';
import { EntitlementService } from '@/traits/authz/entitlement-service.js';

import { createAuthzTestContext } from '../traits/authz/test-helpers.ts';

function buildPreferenceBridge() {
  return {
    getUserChannelPreferences: async (userId: string, eventType: string) => ({
      userId,
      eventType,
      matrix: {},
      optedInChannels: ['email'],
      explicitlyBlockedChannels: [],
      organizationDefaults: [],
      systemDefaults: [],
      quietHours: null,
    }),
    getQuietHours: async () => null,
  } as PreferenceableBridge;
}

const EMAIL_CHANNEL: Channel = {
  id: 'email-primary',
  name: 'Email',
  type: 'email',
  enabled: true,
  description: 'SMTP',
  metadata: {},
  tags: [],
  config: {},
};

function buildMessage(senderId: string, orgId: string, recipientId: string = 'user-recipient'): Message {
  return {
    id: 'msg-1',
    sender_id: senderId,
    organization_id: orgId,
    recipient_ids: [recipientId],
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

describe('Communication ↔ Authable integration', () => {
  it('queues messages only when permission checks succeed', async () => {
    const context = createAuthzTestContext();
    const entitlements = new EntitlementService(context.executor);
    context.grantPermission(context.roles.editor, 'messages:send-email');
    context.grantPermission(context.roles.manager, 'messages:receive-email');
    const authBridge = new AuthableBridge(entitlements, {
      permissionBuilder: (direction, channelType) => `messages:${direction}-${channelType}`,
    });
    const preferenceBridge = buildPreferenceBridge();
    const channelResolver = new ChannelResolver(preferenceBridge);
    const queue = new InMemoryQueueAdapter<DeliveryQueuePayload>({ name: 'integration' });
    const service = new MessageDeliveryService({
      queue,
      channelResolver,
      authBridge,
      preferenceBridge,
      clock: () => new Date('2025-11-20T12:00:00Z'),
    });

    const message = buildMessage(context.users.alpha, context.organizations.northwind, context.users.beta);
    const result = await service.sendMessage(message, [context.users.beta], {
      availableChannels: [EMAIL_CHANNEL],
      organizationId: context.organizations.northwind,
    });

    expect(result.queuedRecipients).toHaveLength(1);
    const queued = await queue.peek();
    expect(queued).toHaveLength(1);
    await context.dispose();

    const failureContext = createAuthzTestContext();
    const failureService = new MessageDeliveryService({
      queue: new InMemoryQueueAdapter<DeliveryQueuePayload>(),
      channelResolver,
      authBridge: new AuthableBridge(new EntitlementService(failureContext.executor), {
        permissionBuilder: (direction, channelType) => `messages:${direction}-${channelType}`,
      }),
      preferenceBridge,
    });
    const failureMessage = buildMessage(
      failureContext.users.alpha,
      failureContext.organizations.northwind,
      failureContext.users.beta
    );
    const blocked = await failureService.sendMessage(failureMessage, [failureContext.users.beta], {
      availableChannels: [EMAIL_CHANNEL],
      organizationId: failureContext.organizations.northwind,
    });
    expect(blocked.queuedRecipients).toHaveLength(0);
    expect(blocked.blockedRecipients[0]?.reason).toBe('sender-permission');
    await failureContext.dispose();
  });
});
