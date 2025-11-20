import { z } from 'zod';

import { identifierSchema, isoDateTimeSchema, messageStateSchema, metadataSchema } from './common.js';

export const messageStatusSchema = z.object({
  id: identifierSchema.optional(),
  message_id: identifierSchema,
  state: messageStateSchema,
  occurred_at: isoDateTimeSchema,
  description: z.string().max(512).optional(),
  channel_response: metadataSchema.optional(),
  error_code: z.string().max(128).optional(),
  attempt: z.number().int().min(0).default(0),
});

export type MessageStatusEntry = z.infer<typeof messageStatusSchema>;

export function parseMessageStatus(data: unknown): MessageStatusEntry {
  return messageStatusSchema.parse(data);
}
