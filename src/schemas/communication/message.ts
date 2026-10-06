import { z, ZodIssueCode } from 'zod';

import {
  channelTypeSchema,
  identifierSchema,
  isoDateTimeSchema,
  messageStateSchema,
  metadataSchema,
  prioritySchema,
  jsonValueSchema,
} from './common.js';
import { deliveryPolicySchema, type DeliveryPolicy } from './delivery-policy.js';
import { messageStatusSchema, type MessageStatusEntry } from './message-status.js';

const variableMapSchema = z.record(z.string(), jsonValueSchema);

const timestampSchemaShape = {
  created_at: isoDateTimeSchema,
  queued_at: isoDateTimeSchema.optional(),
  sent_at: isoDateTimeSchema.optional(),
  delivered_at: isoDateTimeSchema.optional(),
  read_at: isoDateTimeSchema.optional(),
  failed_at: isoDateTimeSchema.optional(),
} as const;

const timestampKeys = Object.keys(timestampSchemaShape) as (keyof typeof timestampSchemaShape)[];
type TimestampKey = (typeof timestampKeys)[number];

const messageBase = z.object({
  id: identifierSchema,
  organization_id: identifierSchema.optional(),
  sender_id: identifierSchema,
  recipient_ids: z.array(identifierSchema).min(1).max(100),
  channel_type: channelTypeSchema,
  template_id: identifierSchema,
  variables: variableMapSchema.default({}),
  metadata: metadataSchema,
  priority: prioritySchema.default('normal'),
  status: messageStateSchema.default('queued'),
  status_history: z.array(messageStatusSchema).default([]),
  delivery_policy: deliveryPolicySchema.optional(),
  conversation_id: identifierSchema.optional(),
  attachments: z.array(
    z.object({
      id: identifierSchema,
      uri: z.string().url(),
      type: z.string().min(1).max(120),
      size_bytes: z.number().int().nonnegative().optional(),
    })
  )
    .max(10)
    .default([]),
});

export const messageSchema = messageBase.extend(timestampSchemaShape).superRefine((value, ctx) => {
  const uniqueRecipients = new Set(value.recipient_ids);
    if (uniqueRecipients.size !== value.recipient_ids.length) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: 'Recipient list contains duplicates.',
        path: ['recipient_ids'],
      });
    }

  const timeline: [TimestampKey, string | undefined][] = timestampKeys.map((key) => [key, value[key]]);
  let previousTimestamp: string | undefined;
  for (const [, timestamp] of timeline) {
    if (!timestamp) {
      continue;
    }
      if (previousTimestamp && previousTimestamp > timestamp) {
        ctx.addIssue({
          code: ZodIssueCode.custom,
          message: 'Timestamps must be monotonic ascending.',
          path: ['timestamps'],
        });
        break;
      }
    previousTimestamp = timestamp;
  }

  if (value.status_history.length > 0) {
    let lastStatusTime: string | undefined;
    for (const [index, entry] of value.status_history.entries()) {
        if (lastStatusTime && lastStatusTime > entry.occurred_at) {
          ctx.addIssue({
            code: ZodIssueCode.custom,
            message: 'Status history must be chronological.',
            path: ['status_history', index, 'occurred_at'],
          });
          break;
        }
      lastStatusTime = entry.occurred_at;
    }

    const finalState = value.status_history[value.status_history.length - 1]?.state;
      if (finalState && finalState !== value.status) {
        ctx.addIssue({
          code: ZodIssueCode.custom,
          message: `Latest status history entry (${finalState}) does not match message status (${value.status}).`,
          path: ['status'],
        });
      }
    }

    if (value.status === 'delivered' && !value.delivered_at) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: 'Delivered messages require delivered_at timestamp.',
        path: ['delivered_at'],
      });
    }

    if (value.status === 'read' && !value.read_at) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: 'Read messages require read_at timestamp.',
        path: ['read_at'],
      });
    }
  });

export type Message = z.infer<typeof messageSchema>;
export type MessageVariables = z.infer<typeof variableMapSchema>;
export type MessageAttachment = Message['attachments'][number];

export function parseMessage(data: unknown): Message {
  return messageSchema.parse(data);
}

export function appendStatus(message: Message, entry: MessageStatusEntry): Message {
  const status = messageStatusSchema.parse(entry);
  const history = [...message.status_history, status];
  return {
    ...message,
    status: status.state,
    status_history: history,
  };
}

export function applyDeliveryPolicy(message: Message, policy: DeliveryPolicy): Message {
  return {
    ...message,
    delivery_policy: deliveryPolicySchema.parse(policy),
  };
}
