import { ZodError, type ZodTypeAny } from 'zod';

import {
  channelSchema,
  type Channel,
} from '@/schemas/communication/channel.js';
import {
  templateSchema,
  type Template,
} from '@/schemas/communication/template.js';
import {
  deliveryPolicySchema,
  type DeliveryPolicy,
} from '@/schemas/communication/delivery-policy.js';
import {
  messageSchema,
  type Message,
} from '@/schemas/communication/message.js';
import {
  conversationSchema,
  type Conversation,
} from '@/schemas/communication/conversation.js';
import {
  messageStatusSchema,
  type MessageStatusEntry,
} from '@/schemas/communication/message-status.js';

import { formatZodIssues } from '@/validation/formatter.js';
import type { ValidationIssue } from '@/validation/types.js';

import {
  communicationSchemaRegistry,
  type CommunicationSchemaId,
  type CommunicationSchemaValidationResult,
} from './schema-registry.js';

export interface CommunicationValidationResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly schemaId: CommunicationSchemaId;
  readonly version: string;
  readonly errors: ValidationIssue[];
}

interface SchemaConfig<T> {
  readonly schema: ZodTypeAny;
  readonly schemaId: CommunicationSchemaId;
  readonly filePath: string;
  readonly typeGuard?: (value: unknown) => value is T;
}

const SCHEMAS: Record<string, SchemaConfig<unknown>> = {
  channel: {
    schema: channelSchema,
    schemaId: 'channel',
    filePath: 'src/schemas/communication/channel.ts',
  },
  template: {
    schema: templateSchema,
    schemaId: 'template',
    filePath: 'src/schemas/communication/template.ts',
  },
  'delivery-policy': {
    schema: deliveryPolicySchema,
    schemaId: 'delivery-policy',
    filePath: 'src/schemas/communication/delivery-policy.ts',
  },
  'message-status': {
    schema: messageStatusSchema,
    schemaId: 'message-status',
    filePath: 'src/schemas/communication/message-status.ts',
  },
  message: {
    schema: messageSchema,
    schemaId: 'message',
    filePath: 'src/schemas/communication/message.ts',
  },
  conversation: {
    schema: conversationSchema,
    schemaId: 'conversation',
    filePath: 'src/schemas/communication/conversation.ts',
  },
};

function normalizeWithSchema<T>(config: SchemaConfig<T>, data: unknown): { success: true; data: T } | { success: false; errors: ValidationIssue[] } {
  try {
    const parsed = config.schema.parse(data) as T;
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, errors: formatZodIssues(error.issues, config.filePath) };
    }

    return {
      success: false,
      errors: [
        {
          code: 'TE-0402',
          message: error instanceof Error ? error.message : 'Validation failed.',
          location: {
            file: config.filePath,
            path: '/',
          },
          fixHint: null,
          severity: 'error',
          source: 'zod',
        },
      ],
    };
  }
}

function combineResult<T>(config: SchemaConfig<T>, payload: unknown): CommunicationValidationResult<T> {
  const normalized = normalizeWithSchema(config, payload);
  const version = communicationSchemaRegistry.getVersion();

  if (!normalized.success) {
    return {
      success: false,
      schemaId: config.schemaId,
      version,
      errors: normalized.errors,
    };
  }

  const registryVerdict: CommunicationSchemaValidationResult = communicationSchemaRegistry.validate(
    normalized.data,
    config.schemaId
  );

  if (!registryVerdict.success) {
    return {
      success: false,
      schemaId: config.schemaId,
      version: registryVerdict.version,
      errors: registryVerdict.issues,
    };
  }

  return {
    success: true,
    schemaId: config.schemaId,
    version: registryVerdict.version,
    data: normalized.data,
    errors: [],
  };
}

function buildValidator<T>(configKey: keyof typeof SCHEMAS) {
  const config = SCHEMAS[configKey];
  return (payload: unknown): CommunicationValidationResult<T> =>
    combineResult(config as SchemaConfig<T>, payload);
}

export const validateChannel = buildValidator<Channel>('channel');
export const validateTemplate = buildValidator<Template>('template');
export const validateDeliveryPolicy = buildValidator<DeliveryPolicy>('delivery-policy');
export const validateMessageStatus = buildValidator<MessageStatusEntry>('message-status');
export const validateMessage = buildValidator<Message>('message');
export const validateConversation = buildValidator<Conversation>('conversation');

export function isChannel(payload: unknown): payload is Channel {
  try {
    channelSchema.parse(payload);
    return true;
  } catch {
    return false;
  }
}

export function isTemplate(payload: unknown): payload is Template {
  try {
    templateSchema.parse(payload);
    return true;
  } catch {
    return false;
  }
}

export function isDeliveryPolicy(payload: unknown): payload is DeliveryPolicy {
  try {
    deliveryPolicySchema.parse(payload);
    return true;
  } catch {
    return false;
  }
}

export function isMessageStatus(payload: unknown): payload is MessageStatusEntry {
  try {
    messageStatusSchema.parse(payload);
    return true;
  } catch {
    return false;
  }
}

export function isMessage(payload: unknown): payload is Message {
  try {
    messageSchema.parse(payload);
    return true;
  } catch {
    return false;
  }
}

export function isConversation(payload: unknown): payload is Conversation {
  try {
    conversationSchema.parse(payload);
    return true;
  } catch {
    return false;
  }
}
