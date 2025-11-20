import { parseChannel, type Channel } from '@/schemas/communication/channel.js';
import { parseTemplate, type Template } from '@/schemas/communication/template.js';
import {
  parseDeliveryPolicy,
  type DeliveryPolicy,
} from '@/schemas/communication/delivery-policy.js';
import {
  appendStatus,
  applyDeliveryPolicy,
  parseMessage,
  type Message,
} from '@/schemas/communication/message.js';
import { parseConversation, type Conversation } from '@/schemas/communication/conversation.js';
import { parseMessageStatus, type MessageStatusEntry } from '@/schemas/communication/message-status.js';

import {
  validateChannel,
  validateConversation,
  validateDeliveryPolicy,
  validateMessage,
  validateMessageStatus,
  validateTemplate,
  type CommunicationValidationResult,
} from './schema-validator.js';

export interface CommunicableTraitState {
  readonly channels?: readonly Channel[];
  readonly templates?: readonly Template[];
  readonly deliveryPolicies?: readonly DeliveryPolicy[];
  readonly messages?: readonly Message[];
  readonly conversations?: readonly Conversation[];
  readonly messageStatuses?: readonly MessageStatusEntry[];
}

export interface CommunicableTraitOptions {
  readonly enforceChannelWhitelist?: readonly string[];
}

export interface MessageValidationResult extends CommunicationValidationResult<Message> {}

export class CommunicableTrait {
  private readonly channels = new Map<string, Channel>();
  private readonly templates = new Map<string, Template>();
  private readonly policies = new Map<string, DeliveryPolicy>();
  private readonly messages = new Map<string, Message>();
  private readonly conversations = new Map<string, Conversation>();
  private readonly statusHistory = new Map<string, MessageStatusEntry[]>();
  private readonly channelWhitelist?: Set<string>;

  constructor(state: CommunicableTraitState = {}, options: CommunicableTraitOptions = {}) {
    this.channelWhitelist = options.enforceChannelWhitelist
      ? new Set(options.enforceChannelWhitelist.map((value) => value.toLowerCase()))
      : undefined;

    for (const channel of state.channels ?? []) {
      this.storeChannel(parseChannel(channel));
    }

    for (const template of state.templates ?? []) {
      this.templates.set(template.id, parseTemplate(template));
    }

    for (const policy of state.deliveryPolicies ?? []) {
      this.policies.set(policy.id, parseDeliveryPolicy(policy));
    }

    for (const message of state.messages ?? []) {
      this.storeMessage(parseMessage(message));
    }

    for (const conversation of state.conversations ?? []) {
      this.conversations.set(conversation.id, parseConversation(conversation));
    }

    for (const status of state.messageStatuses ?? []) {
      const parsed = parseMessageStatus(status);
      const list = this.statusHistory.get(parsed.message_id) ?? [];
      list.push(parsed);
      list.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
      this.statusHistory.set(parsed.message_id, list);

      const message = this.messages.get(parsed.message_id);
      if (message) {
        this.storeMessage({
          ...message,
          status: list[list.length - 1]?.state ?? message.status,
          status_history: list,
        });
      }
    }
  }

  private storeChannel(channel: Channel): void {
    if (this.channelWhitelist && !this.channelWhitelist.has(channel.type)) {
      throw new Error(`Channel type "${channel.type}" is not allowed in this context.`);
    }
    this.channels.set(channel.id, channel);
  }

  private storeMessage(message: Message): void {
    this.messages.set(message.id, message);
    this.statusHistory.set(message.id, [...message.status_history]);
  }

  getChannels(): Channel[] {
    return [...this.channels.values()];
  }

  getChannel(id: string): Channel | undefined {
    return this.channels.get(id);
  }

  getTemplates(channelType?: string): Template[] {
    const templates = [...this.templates.values()];
    if (!channelType) {
      return templates;
    }
    const normalized = channelType.toLowerCase();
    return templates.filter((template) => template.channel_type === normalized);
  }

  getDeliveryPolicies(): DeliveryPolicy[] {
    return [...this.policies.values()];
  }

  getConversations(): Conversation[] {
    return [...this.conversations.values()];
  }

  getMessages(): Message[] {
    return [...this.messages.values()];
  }

  getStatusHistory(messageId: string): MessageStatusEntry[] {
    return [...(this.statusHistory.get(messageId) ?? [])];
  }

  validateChannel(channel: unknown) {
    return validateChannel(channel);
  }

  validateTemplate(template: unknown) {
    return validateTemplate(template);
  }

  validateDeliveryPolicy(policy: unknown) {
    return validateDeliveryPolicy(policy);
  }

  validateMessageStatus(status: unknown) {
    return validateMessageStatus(status);
  }

  validateMessage(payload: unknown): MessageValidationResult {
    return validateMessage(payload);
  }

  validateConversation(payload: unknown) {
    return validateConversation(payload);
  }

  registerChannel(candidate: Channel | unknown): CommunicationValidationResult<Channel> {
    const result = this.validateChannel(candidate);
    if (result.success && result.data) {
      try {
        this.storeChannel(result.data);
      } catch (error) {
        return {
          success: false,
          schemaId: 'channel',
          version: result.version,
          errors: [
            {
              code: 'TE-0402',
              message: error instanceof Error ? error.message : 'Channel registration failed.',
              location: { file: 'src/traits/communication/communication-trait.ts', path: '/channels' },
              fixHint: 'Update enforceChannelWhitelist or provide a supported channel type.',
              severity: 'error',
            },
          ],
        };
      }
    }
    return result;
  }

  registerTemplate(candidate: Template | unknown): CommunicationValidationResult<Template> {
    const result = this.validateTemplate(candidate);
    if (result.success && result.data) {
      this.templates.set(result.data.id, result.data);
    }
    return result;
  }

  registerDeliveryPolicy(candidate: DeliveryPolicy | unknown): CommunicationValidationResult<DeliveryPolicy> {
    const result = this.validateDeliveryPolicy(candidate);
    if (result.success && result.data) {
      this.policies.set(result.data.id, result.data);
    }
    return result;
  }

  queueMessage(candidate: Message | unknown, policyId?: string): MessageValidationResult {
    const result = this.validateMessage(candidate);
    if (!result.success || !result.data) {
      return result;
    }

    const policy = policyId ? this.policies.get(policyId) : undefined;
    const message = policy ? applyDeliveryPolicy(result.data, policy) : result.data;
    this.storeMessage(message);
    return { ...result, data: message };
  }

  recordStatus(messageId: string, status: MessageStatusEntry | unknown): CommunicationValidationResult<MessageStatusEntry> {
    const result = this.validateMessageStatus(status);
    if (!result.success || !result.data) {
      return result;
    }

    const message = this.messages.get(messageId);
    if (!message) {
      return {
        success: false,
        schemaId: 'message-status',
        version: result.version,
        errors: [
          {
            code: 'TE-0402',
            message: `Message ${messageId} is not registered in CommunicableTrait state.`,
            location: { file: 'src/traits/communication/communication-trait.ts', path: `/messages/${messageId}` },
            fixHint: 'Register the message via queueMessage before appending status history.',
            severity: 'error',
          },
        ],
      };
    }

    const updated = appendStatus(message, { ...result.data, message_id: messageId });
    this.storeMessage(updated);
    this.statusHistory.set(messageId, [...updated.status_history]);
    return { ...result, data: result.data };
  }
}

export function createCommunicableTrait(
  state: CommunicableTraitState = {},
  options: CommunicableTraitOptions = {}
): CommunicableTrait {
  return new CommunicableTrait(state, options);
}
