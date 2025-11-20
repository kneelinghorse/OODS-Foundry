import { randomUUID } from 'node:crypto';

import type { Channel } from '@/schemas/communication/channel.js';
import type { DeliveryPolicy } from '@/schemas/communication/delivery-policy.js';
import type { Message } from '@/schemas/communication/message.js';
import TimeService from '@/services/time/index.js';
import type { RuntimeLogger } from '@/traits/authz/runtime-types.js';

import { AuthableBridge } from './bridges/authable-bridge.js';
import { PreferenceableBridge } from './bridges/preferenceable-bridge.js';
import { ChannelResolver } from './channel-resolver.js';
import { calculateNextDeliveryWindow, isInQuietHours } from './quiet-hours-checker.js';
import type {
  BlockedRecipient,
  DeliveryQueuePayload,
  DeliveryRecipientResult,
  MessageDeliveryResult,
  QueueMessage,
} from './runtime-types.js';
import { deriveRetryPolicyFromDeliveryPolicy } from './runtime-types.js';
import type { QueueAdapter } from './queue/queue-adapter.js';

export interface SendMessageOptions {
  readonly policy?: DeliveryPolicy;
  readonly availableChannels: readonly Channel[];
  readonly eventType?: string;
  readonly organizationId?: string;
}

export interface MessageDeliveryServiceOptions {
  readonly queue: QueueAdapter<DeliveryQueuePayload>;
  readonly channelResolver: ChannelResolver;
  readonly authBridge: AuthableBridge;
  readonly preferenceBridge: PreferenceableBridge;
  readonly logger?: RuntimeLogger;
  readonly idFactory?: () => string;
  readonly clock?: () => Date;
}

export class MessageDeliveryService {
  private readonly queue: QueueAdapter<DeliveryQueuePayload>;
  private readonly channelResolver: ChannelResolver;
  private readonly authBridge: AuthableBridge;
  private readonly preferenceBridge: PreferenceableBridge;
  private readonly logger?: RuntimeLogger;
  private readonly idFactory: () => string;
  private readonly clock: () => Date;

  constructor(options: MessageDeliveryServiceOptions) {
    this.queue = options.queue;
    this.channelResolver = options.channelResolver;
    this.authBridge = options.authBridge;
    this.preferenceBridge = options.preferenceBridge;
    this.logger = options.logger;
    this.idFactory = options.idFactory ?? randomUUID;
    this.clock = options.clock ?? (() => TimeService.nowSystem().toJSDate());
  }

  async sendMessage(message: Message, recipients: readonly string[], options: SendMessageOptions): Promise<MessageDeliveryResult> {
    if (!recipients.length) {
      throw new Error('MessageDeliveryService.sendMessage requires at least one recipient.');
    }
    if (!options.availableChannels || options.availableChannels.length === 0) {
      throw new Error('availableChannels must include at least one channel definition.');
    }
    const eventType = options.eventType ?? (typeof message.metadata?.event_type === 'string' ? message.metadata.event_type : 'default');
    const organizationId = options.organizationId ?? message.organization_id;
    if (!organizationId) {
      throw new Error('organizationId is required to perform permission checks.');
    }
    const policy = options.policy ?? message.delivery_policy ?? null;
    const retryPolicy = deriveRetryPolicyFromDeliveryPolicy(policy);
    const queuedRecipients: DeliveryRecipientResult[] = [];
    const blockedRecipients: BlockedRecipient[] = [];

    for (const recipientId of recipients) {
      try {
        const resolution = await this.channelResolver.resolveChannel(recipientId, eventType, options.availableChannels);
        if (!resolution) {
          blockedRecipients.push({ recipientId, reason: 'no-channel' });
          continue;
        }
        const canSend = await this.authBridge.validateSenderPermission(message.sender_id, organizationId, resolution.channelType);
        if (!canSend) {
          blockedRecipients.push({ recipientId, reason: 'sender-permission' });
          continue;
        }
        const canReceive = await this.authBridge.validateRecipientPermission(recipientId, organizationId, resolution.channelType);
        if (!canReceive) {
          blockedRecipients.push({ recipientId, reason: 'recipient-permission' });
          continue;
        }

        const quietHours = await this.preferenceBridge.getQuietHours(recipientId);
        const now = this.clock();
        let scheduledAt = now;
        if (quietHours && isInQuietHours(quietHours, quietHours.timezone, now)) {
          scheduledAt = calculateNextDeliveryWindow(quietHours, quietHours.timezone, now);
        }

        const payload: DeliveryQueuePayload = {
          message,
          recipientId,
          channel: resolution.channel,
          organizationId,
          attempt: 0,
          policy: policy ?? undefined,
          retryPolicy,
          scheduledAt: scheduledAt.toISOString(),
          metadata: message.metadata,
          eventType,
        } satisfies DeliveryQueuePayload;

        const queueMessage: QueueMessage<DeliveryQueuePayload> = {
          id: this.idFactory(),
          payload,
          scheduledAt,
          availableAt: scheduledAt,
          attempt: 0,
          priority: priorityWeight(message.priority ?? 'normal'),
        } satisfies QueueMessage<DeliveryQueuePayload>;

        await this.queue.enqueue(queueMessage);
        queuedRecipients.push({
          recipientId,
          channelType: resolution.channelType,
          channelId: resolution.channel.id,
          scheduledAt: scheduledAt.toISOString(),
        });
      } catch (error) {
        this.logger?.error?.('delivery_queue_error', {
          recipientId,
          messageId: message.id,
          error: error instanceof Error ? error.message : String(error),
        });
        blockedRecipients.push({ recipientId, reason: 'queue-error' });
      }
    }

    return {
      messageId: message.id,
      queuedRecipients,
      blockedRecipients,
    } satisfies MessageDeliveryResult;
  }
}

function priorityWeight(priority: Message['priority']): number {
  switch (priority) {
    case 'urgent':
      return 100;
    case 'high':
      return 75;
    case 'low':
      return 25;
    case 'normal':
    default:
      return 50;
  }
}
