import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { Channel } from '@/schemas/communication/channel.js';
import type { Conversation, ConversationParticipant } from '@/schemas/communication/conversation.js';
import type { DeliveryPolicy } from '@/schemas/communication/delivery-policy.js';
import { IN_APP_CHANNEL_TYPE } from '@/schemas/communication/common.js';
import type { Message } from '@/schemas/communication/message.js';
import type { MessageStatusEntry } from '@/schemas/communication/message-status.js';
import type { Template } from '@/schemas/communication/template.js';
import TimeService from '@/services/time/index.js';

export type MessageDirection = 'sent' | 'received';

export interface DateRange {
  readonly start?: string;
  readonly end?: string;
}

export interface CommunicationDataset {
  readonly messages: Message[];
  readonly conversations: Conversation[];
  readonly channels: Channel[];
  readonly templates: Template[];
  readonly deliveryPolicies: DeliveryPolicy[];
}

const ORG_ID = 'org-comm-001';
const USERS = {
  sender: 'user-alpha',
  recipient: 'user-beta',
  observer: 'user-gamma',
} as const;

const STATUS_HISTORY_ONE: MessageStatusEntry[] = [
  { message_id: 'msg-1', state: 'queued', occurred_at: '2025-11-19T10:00:00Z', attempt: 0 },
  { message_id: 'msg-1', state: 'sent', occurred_at: '2025-11-19T10:01:00Z', attempt: 0 },
  { message_id: 'msg-1', state: 'delivered', occurred_at: '2025-11-19T10:02:00Z', attempt: 0 },
] satisfies MessageStatusEntry[];

const STATUS_HISTORY_TWO: MessageStatusEntry[] = [
  { message_id: 'msg-2', state: 'queued', occurred_at: '2025-11-19T12:00:00Z', attempt: 0 },
  { message_id: 'msg-2', state: 'sent', occurred_at: '2025-11-19T12:01:00Z', attempt: 0 },
  { message_id: 'msg-2', state: 'read', occurred_at: '2025-11-19T12:02:00Z', attempt: 0 },
] satisfies MessageStatusEntry[];

const STATUS_HISTORY_THREE: MessageStatusEntry[] = [
  { message_id: 'msg-3', state: 'queued', occurred_at: '2025-11-18T08:00:00Z', attempt: 0 },
  { message_id: 'msg-3', state: 'failed', occurred_at: '2025-11-18T08:05:00Z', attempt: 0 },
] satisfies MessageStatusEntry[];

const CONVERSATION_PARTICIPANTS: ConversationParticipant[] = [
  { user_id: USERS.sender, role: 'owner', joined_at: '2025-11-19T12:00:00Z' },
  { user_id: USERS.recipient, role: 'member', joined_at: '2025-11-19T12:00:00Z' },
] satisfies ConversationParticipant[];

const MESSAGES: Message[] = [
  {
    id: 'msg-1',
    sender_id: USERS.sender,
    organization_id: ORG_ID,
    recipient_ids: [USERS.recipient],
    channel_type: 'email',
    template_id: 'tmpl-welcome',
    variables: { firstName: 'Beta', workspace: 'OODS Foundry' },
    metadata: { subject: 'Welcome to Foundry', event_type: 'welcome' },
    priority: 'normal',
    status: 'delivered',
    status_history: STATUS_HISTORY_ONE,
    attachments: [],
    created_at: '2025-11-19T10:00:00Z',
    queued_at: '2025-11-19T10:00:00Z',
    sent_at: '2025-11-19T10:01:00Z',
    delivered_at: '2025-11-19T10:02:00Z',
  },
  {
    id: 'msg-2',
    sender_id: USERS.recipient,
    organization_id: ORG_ID,
    recipient_ids: [USERS.sender],
    channel_type: IN_APP_CHANNEL_TYPE,
    template_id: 'tmpl-thread-reply',
    variables: { escalation: false },
    metadata: { subject: 'Re: Welcome to Foundry', event_type: 'thread' },
    priority: 'high',
    status: 'read',
    status_history: STATUS_HISTORY_TWO,
    attachments: [],
    conversation_id: 'conv-1',
    created_at: '2025-11-19T12:00:00Z',
    queued_at: '2025-11-19T12:00:00Z',
    sent_at: '2025-11-19T12:01:00Z',
    delivered_at: '2025-11-19T12:01:30Z',
    read_at: '2025-11-19T12:02:00Z',
  },
  {
    id: 'msg-3',
    sender_id: USERS.sender,
    organization_id: ORG_ID,
    recipient_ids: [USERS.observer],
    channel_type: 'sms',
    template_id: 'tmpl-alert',
    variables: { reason: 'dispatch-failed' },
    metadata: { subject: 'Dispatch failure notice', event_type: 'alert' },
    priority: 'urgent',
    status: 'failed',
    status_history: STATUS_HISTORY_THREE,
    attachments: [],
    created_at: '2025-11-18T08:00:00Z',
    queued_at: '2025-11-18T08:00:00Z',
    sent_at: '2025-11-18T08:01:00Z',
    failed_at: '2025-11-18T08:05:00Z',
  },
] satisfies Message[];

const CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-1',
    subject: 'Onboarding thread',
    participants: CONVERSATION_PARTICIPANTS,
    messages: [MESSAGES[1]],
    status: 'active',
    metadata: {},
    created_at: '2025-11-19T12:00:00Z',
    updated_at: '2025-11-19T12:02:00Z',
  },
] satisfies Conversation[];

const CHANNELS: Channel[] = [
  {
    id: 'chn-email',
    name: 'Primary Email',
    description: 'SMTP delivery with audit headers',
    type: 'email',
    enabled: true,
    metadata: { provider: 'smtp' },
    tags: ['primary'],
    config: {
      provider: 'smtp',
      host: 'smtp.oods-foundry.dev',
      port: 587,
      secure: false,
      from: { name: 'Messages', email: 'messages@oods-foundry.dev' },
    },
  },
  {
    id: 'chn-sms',
    name: 'Trusted SMS',
    description: 'Twilio SMS channel',
    type: 'sms',
    enabled: true,
    metadata: { provider: 'twilio' },
    tags: ['fallback'],
    config: {
      provider: 'twilio',
      sender_id: 'OODSFNDRY',
      long_code_pool: ['+15551001000'],
      delivery_receipts: true,
      character_limit: 320,
    },
  },
] satisfies Channel[];

const TEMPLATES: Template[] = [
  {
    id: 'tmpl-welcome',
    name: 'Welcome Email',
    channel_type: 'email',
    subject: 'Welcome to OODS, {{firstName}}',
    body: 'Hello {{firstName}}, welcome to {{workspace}}!',
    variables: ['firstName', 'workspace'],
    locale: 'en-US',
    metadata: {},
  },
  {
    id: 'tmpl-thread-reply',
    name: 'Conversation Reply',
    channel_type: IN_APP_CHANNEL_TYPE,
    subject: 'You have a new reply',
    body: '{{author}} replied to your conversation.',
    variables: ['author'],
    locale: 'en-US',
    metadata: {},
  },
  {
    id: 'tmpl-alert',
    name: 'Dispatch Alert',
    channel_type: 'sms',
    subject: 'Dispatch failure notice',
    body: 'A dispatch failed with reason {{reason}}.',
    variables: ['reason'],
    locale: 'en-US',
    metadata: {},
  },
] satisfies Template[];

const DELIVERY_POLICIES: DeliveryPolicy[] = [
  {
    id: 'policy-standard',
    name: 'Standard Delivery Policy',
    retry: { max_attempts: 3, backoff_strategy: 'exponential', initial_delay_seconds: 30 },
    quiet_hours: { start_time: '22:00', end_time: '06:00', timezone: 'UTC', days_of_week: ['saturday', 'sunday'] },
    throttling: { max_per_minute: 200, max_per_hour: 2000, max_per_day: 8000 },
    priority: 'normal',
    metadata: {},
  },
] satisfies DeliveryPolicy[];

export const SAMPLE_COMMUNICATION_DATASET: CommunicationDataset = {
  messages: MESSAGES,
  conversations: CONVERSATIONS,
  channels: CHANNELS,
  templates: TEMPLATES,
  deliveryPolicies: DELIVERY_POLICIES,
};

export function cloneDataset(dataset: CommunicationDataset): CommunicationDataset {
  return {
    messages: dataset.messages.map((message) => ({ ...message, status_history: [...message.status_history] })),
    conversations: dataset.conversations.map((conversation) => ({
      ...conversation,
      participants: [...conversation.participants],
      messages: [...conversation.messages],
    })),
    channels: dataset.channels.map((channel) => ({ ...channel, tags: [...channel.tags], metadata: { ...channel.metadata } })),
    templates: dataset.templates.map((template) => ({ ...template, variables: [...template.variables], metadata: { ...template.metadata } })),
    deliveryPolicies: dataset.deliveryPolicies.map((policy) => ({ ...policy, metadata: { ...(policy.metadata ?? {}) } })),
  };
}

export function loadCommunicationDataset(datasetPath?: string): CommunicationDataset {
  if (!datasetPath) {
    return cloneDataset(SAMPLE_COMMUNICATION_DATASET);
  }

  const resolved = path.resolve(datasetPath);
  const contents = readFileSync(resolved, 'utf8');
  const parsed = JSON.parse(contents) as Partial<CommunicationDataset>;
  return {
    messages: parsed.messages ?? [],
    conversations: parsed.conversations ?? [],
    channels: parsed.channels ?? [],
    templates: parsed.templates ?? [],
    deliveryPolicies: parsed.deliveryPolicies ?? [],
  } satisfies CommunicationDataset;
}

export function isWithinRange(timestamp: string | undefined, range?: DateRange): boolean {
  if (!timestamp) {
    return false;
  }
  if (!range) {
    return true;
  }
  const value = TimeService.normalizeToUtc(timestamp).toMillis();
  if (range.start && value < TimeService.normalizeToUtc(range.start).toMillis()) {
    return false;
  }
  if (range.end && value > TimeService.normalizeToUtc(range.end).toMillis()) {
    return false;
  }
  return true;
}
