import { randomUUID } from 'node:crypto';

import type { JsonValue } from '@/schemas/communication/common.js';
import type { Message } from '@/schemas/communication/message.js';
import type { Template } from '@/schemas/communication/template.js';
import type { MessageDeliveryResult } from '@/traits/communication/runtime-types.js';
import TimeService from '@/services/time/index.js';
import { cloneDataset, SAMPLE_COMMUNICATION_DATASET, type CommunicationDataset } from '@/cli/communication-shared.js';

interface CommunicableUser {
  user_id: string;
  name: string;
  sendMessage: (recipientIds: string[], template: Template, variables?: Record<string, JsonValue>) => MessageDeliveryResult;
  getMessages: () => Message[];
  getConversations: () => CommunicationDataset['conversations'];
  getUnreadCount: () => number;
  markAllAsRead: () => void;
}

const dataset = cloneDataset(SAMPLE_COMMUNICATION_DATASET);

function createUser(userId: string): CommunicableUser {
  return {
    user_id: userId,
    name: 'Communicable User',
    sendMessage: (recipientIds, template, variables): MessageDeliveryResult => {
      const now = TimeService.toIsoString(TimeService.nowSystem());
      const message: Message = {
        id: randomUUID(),
        sender_id: userId,
        organization_id: 'org-comm-001',
        recipient_ids: recipientIds,
        channel_type: template.channel_type,
        template_id: template.id,
        variables: variables ?? {},
        metadata: { subject: template.subject, event_type: template.name },
        priority: 'normal',
        status: 'delivered',
        status_history: [
          { message_id: '', state: 'queued', occurred_at: now, attempt: 0 },
          { message_id: '', state: 'sent', occurred_at: now, attempt: 0 },
          { message_id: '', state: 'delivered', occurred_at: now, attempt: 0 },
        ],
        attachments: [],
        created_at: now,
        queued_at: now,
        sent_at: now,
        delivered_at: now,
      };
      message.status_history = message.status_history.map((entry) => ({ ...entry, message_id: message.id }));
      dataset.messages.push(message);
      return {
        messageId: message.id,
        queuedRecipients: recipientIds.map((recipientId) => ({
          recipientId,
          channelType: message.channel_type,
          scheduledAt: now,
        })),
        blockedRecipients: [],
        metadata: { template: template.id },
      };
    },
    getMessages: () => dataset.messages.filter((message) => message.sender_id === userId || message.recipient_ids.includes(userId)),
    getConversations: () => dataset.conversations,
    getUnreadCount: () =>
      dataset.messages.filter(
        (message) => message.recipient_ids.includes(userId) && message.status !== 'read'
      ).length,
    markAllAsRead: () => {
      const now = TimeService.toIsoString(TimeService.nowSystem());
      dataset.messages.forEach((message) => {
        if (!message.recipient_ids.includes(userId) || message.status === 'read') {
          return;
        }
        message.status = 'read';
        message.read_at = message.read_at ?? now;
        message.status_history = [
          ...message.status_history,
          {
            message_id: message.id,
            state: 'read',
            occurred_at: now,
            attempt: 0,
          },
        ];
      });
    },
  };
}

const user = createUser('user-alpha');
const template = dataset.templates[0];

user.sendMessage(['user-beta'], template, { firstName: 'Beta', workspace: 'OODS Foundry' });
console.log('Unread count before markAllAsRead:', user.getUnreadCount());
user.markAllAsRead();
console.log('Unread count after markAllAsRead:', user.getUnreadCount());
console.log('Conversations:', user.getConversations().map((conversation) => conversation.subject));
