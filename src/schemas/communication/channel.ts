import { z, ZodIssueCode } from 'zod';

import {
  CHANNEL_TYPES,
  IN_APP_CHANNEL_TYPE,
  channelTypeSchema,
  identifierSchema,
  metadataSchema,
  normalizeChannelType,
  type ChannelType,
  type CoreChannelType,
} from './common.js';

const emailConfigSchema = z.object({
  provider: z.enum(['smtp', 'ses', 'sendgrid', 'mailgun', 'postmark', 'custom']).default('smtp'),
  host: z.string().min(3).max(255),
  port: z.number().int().min(1).max(65535).default(587),
  secure: z.boolean().default(true),
  auth: z
    .object({
      user: z.string().email(),
      pass: z.string().min(8),
    })
    .optional(),
  from: z.object({
    name: z.string().min(1).max(120),
    email: z.string().email(),
  }),
  reply_to: z
    .object({
      name: z.string().min(1).max(120).optional(),
      email: z.string().email().optional(),
    })
    .optional(),
  headers: z.record(z.string(), z.string()).default({}),
});

const smsConfigSchema = z.object({
  provider: z.enum(['twilio', 'sns', 'plivo', 'messagebird', 'custom']).default('twilio'),
  sender_id: z.string().min(1).max(20),
  long_code_pool: z.array(z.string().regex(/^[+][1-9]\d{1,14}$/u, 'Use E.164 format.')).default([]),
  delivery_receipts: z.boolean().default(true),
  dlr_webhook: z.string().url().optional(),
  character_limit: z.number().int().min(70).max(1000).default(320),
});

const pushConfigSchema = z.object({
  provider: z.enum(['fcm', 'apns', 'wns', 'custom']).default('fcm'),
  credentials: z.object({
    key_id: z.string().min(4),
    key: z.string().min(32),
    team_id: z.string().min(4).optional(),
    bundle_id: z.string().optional(),
  }),
  topics: z.array(z.string()).default([]),
  supports_silent: z.boolean().default(true),
  badge_strategy: z.enum(['increment', 'set', 'none']).default('increment'),
});

const inAppConfigSchema = z.object({
  notification_center_id: z.string().min(3).max(64),
  stream: z.string().min(3).max(64).default('default'),
  retention_days: z.number().int().min(1).max(365).default(30),
  allow_mark_seen: z.boolean().default(true),
});

const webhookConfigSchema = z.object({
  url: z.string().url(),
  method: z.enum(['POST', 'PUT']).default('POST'),
  signature_header: z.string().default('X-OODS-Signature'),
  secret: z.string().min(16),
  retry: z.object({
    max_attempts: z.number().int().min(0).max(10).default(3),
    backoff_seconds: z.number().int().min(1).max(3600).default(30),
  }),
  headers: z.record(z.string(), z.string()).default({}),
});

const customConfigSchema = z.record(z.string(), z.unknown());

const baseChannelSchema = z.object({
  id: identifierSchema,
  name: z.string().min(2).max(120),
  description: z.string().max(512).optional(),
  type: channelTypeSchema,
  enabled: z.boolean().default(true),
  metadata: metadataSchema,
  tags: z.array(z.string().min(1).max(64)).default([]),
  config: z.record(z.string(), z.unknown()).default({}),
});

const configValidators: Record<CoreChannelType, z.ZodTypeAny> = {
  email: emailConfigSchema,
  sms: smsConfigSchema,
  push: pushConfigSchema,
  [IN_APP_CHANNEL_TYPE]: inAppConfigSchema,
  webhook: webhookConfigSchema,
};

export type EmailChannelConfig = z.infer<typeof emailConfigSchema>;
export type SmsChannelConfig = z.infer<typeof smsConfigSchema>;
export type PushChannelConfig = z.infer<typeof pushConfigSchema>;
export type InAppChannelConfig = z.infer<typeof inAppConfigSchema>;
export type WebhookChannelConfig = z.infer<typeof webhookConfigSchema>;
export type CustomChannelConfig = z.infer<typeof customConfigSchema>;
export type ChannelConfig =
  | EmailChannelConfig
  | SmsChannelConfig
  | PushChannelConfig
  | InAppChannelConfig
  | WebhookChannelConfig
  | CustomChannelConfig;

type ChannelInput = z.infer<typeof baseChannelSchema>;

export const channelSchema = baseChannelSchema.superRefine((value, ctx) => {
  const candidateType = normalizeChannelType(value.type);
  if ((CHANNEL_TYPES as readonly string[]).includes(candidateType)) {
    const validator = configValidators[candidateType as CoreChannelType];
    try {
      const verdict = validator.safeParse(value.config);
      if (!verdict.success) {
        for (const issue of verdict.error.issues) {
          ctx.addIssue({ ...issue, path: ['config', ...issue.path] });
        }
      }
    } catch (error) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: error instanceof Error ? error.message : 'Channel configuration validation failed.',
        path: ['config'],
      });
    }
  }
});

export type Channel = Omit<ChannelInput, 'config'> & {
  readonly config: ChannelConfig;
};

function normalizeConfig(type: ChannelType, config: unknown): ChannelConfig {
  if ((CHANNEL_TYPES as readonly string[]).includes(type)) {
    const validator = configValidators[type as CoreChannelType];
    const result = validator.safeParse(config);
    if (result.success) {
      return result.data as ChannelConfig;
    }
  }
  return config as CustomChannelConfig;
}

export function parseChannel(data: unknown): Channel {
  const parsed = channelSchema.parse(data) as ChannelInput;
  return {
    ...parsed,
    config: normalizeConfig(parsed.type, parsed.config),
  };
}
