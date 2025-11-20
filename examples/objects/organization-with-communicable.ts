import { randomUUID } from 'node:crypto';

import type { Channel } from '@/schemas/communication/channel.js';
import type { DeliveryPolicy } from '@/schemas/communication/delivery-policy.js';
import type { Message } from '@/schemas/communication/message.js';
import type { Template } from '@/schemas/communication/template.js';
import type { SLAMetrics } from '@/traits/communication/sla-monitor.js';
import type { MessageDeliveryResult } from '@/traits/communication/runtime-types.js';
import TimeService from '@/services/time/index.js';
import { cloneDataset, SAMPLE_COMMUNICATION_DATASET } from '@/cli/communication-shared.js';

interface CommunicableOrganization {
  organization_id: string;
  name: string;
  broadcastMessage: (recipientIds: string[], template: Template) => MessageDeliveryResult;
  getChannels: () => Channel[];
  getTemplates: (channelType?: string) => Template[];
  getDeliveryPolicies: () => DeliveryPolicy[];
  getSLAMetrics: (windowHours: number | string) => SLAMetrics;
}

const dataset = cloneDataset(SAMPLE_COMMUNICATION_DATASET);

function createOrganization(organizationId: string): CommunicableOrganization {
  return {
    organization_id: organizationId,
    name: 'Communicable Org',
    broadcastMessage: (recipientIds, template) => {
      const now = TimeService.toIsoString(TimeService.nowSystem());
      const message: Message = {
        id: randomUUID(),
        sender_id: 'system-broadcast',
        organization_id: organizationId,
        recipient_ids: recipientIds,
        channel_type: template.channel_type,
        template_id: template.id,
        variables: {},
        metadata: { subject: template.subject, event_type: 'broadcast' },
        priority: 'high',
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
    getChannels: () => dataset.channels,
    getTemplates: (channelType) =>
      channelType
        ? dataset.templates.filter((template) => template.channel_type === channelType)
        : dataset.templates,
    getDeliveryPolicies: () => dataset.deliveryPolicies,
    getSLAMetrics: (windowHours) => {
      const hours = typeof windowHours === 'number' ? windowHours : Number.parseInt(String(windowHours), 10) || 24;
      const now = TimeService.nowSystem();
      const windowStart = now.minus({ hours });
      const cutoff = windowStart.toMillis();
      const durations = dataset.messages
        .filter((message) => TimeService.normalizeToUtc(message.created_at ?? now.toISO()).toMillis() >= cutoff)
        .map((message) => {
          const start = TimeService.normalizeToUtc(
            message.queued_at ?? message.created_at ?? TimeService.toIsoString(now)
          ).toMillis();
          const end = TimeService.normalizeToUtc(
            message.delivered_at ?? message.read_at ?? message.sent_at ?? message.created_at ?? TimeService.toIsoString(now)
          ).toMillis();
          return Math.max(0, end - start);
        });
      const sorted = [...durations].sort((a, b) => a - b);
      const percentile = (rank: number) => {
        if (sorted.length === 0) return 0;
        const index = Math.min(sorted.length - 1, Math.floor(rank * (sorted.length - 1)));
        return sorted[index] ?? 0;
      };
      const average =
        sorted.reduce((sum, value) => sum + value, 0) / (sorted.length === 0 ? 1 : sorted.length);
      return {
        value: Number(average.toFixed(3)),
        p50: percentile(0.5),
        p95: percentile(0.95),
        p99: percentile(0.99),
        count: sorted.length,
        windowStart: windowStart.toJSDate(),
        windowEnd: now.toJSDate(),
      };
    },
  };
}

const org = createOrganization('org-comm-001');
const template = dataset.templates.find((entry) => entry.channel_type === 'email') ?? dataset.templates[0];

org.broadcastMessage(['user-alpha', 'user-beta', 'user-gamma'], template);
console.log('Channels:', org.getChannels().map((channel) => channel.name));
console.log('Templates (email):', org.getTemplates('email').map((templateEntry) => templateEntry.name));
console.log('Delivery policies:', org.getDeliveryPolicies().map((policy) => policy.name));
console.log('SLA metrics:', org.getSLAMetrics(24));
