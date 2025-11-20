import { z } from 'zod';

import { identifierSchema, isoDateTimeSchema, metadataSchema } from './common.js';
import { messageSchema, type Message } from './message.js';

const PARTICIPANT_ROLES = ['owner', 'member', 'viewer'] as const;
export type ConversationParticipantRole = (typeof PARTICIPANT_ROLES)[number];

const participantSchema = z.object({
  user_id: identifierSchema,
  role: z.enum(PARTICIPANT_ROLES).default('member'),
  joined_at: isoDateTimeSchema,
  last_seen_at: isoDateTimeSchema.optional(),
});

export const conversationSchema = z.object({
  id: identifierSchema,
  subject: z.string().min(1).max(240),
  participants: z.array(participantSchema).min(2),
  messages: z.array(messageSchema).default([]),
  status: z.enum(['active', 'archived', 'deleted']).default('active'),
  metadata: metadataSchema,
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema.optional(),
});

export type Conversation = z.infer<typeof conversationSchema>;
export type ConversationParticipant = z.infer<typeof participantSchema>;

export function parseConversation(data: unknown): Conversation {
  return conversationSchema.parse(data);
}

export function addMessage(conversation: Conversation, message: Message): Conversation {
  const parsed = messageSchema.parse(message);
  return {
    ...conversation,
    messages: [...conversation.messages, parsed],
    updated_at: parsed.created_at,
  };
}
