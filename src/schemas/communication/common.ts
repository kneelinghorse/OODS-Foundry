import { z } from 'zod';

export const ISO_DATE_TIME_PATTERN =
  /^(?:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))$/u;

export const isoDateTimeSchema = z
  .string()
  .regex(ISO_DATE_TIME_PATTERN, 'Expected RFC 3339 timestamp (e.g., 2025-05-12T14:55:00Z).');

export const timeOfDaySchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u, 'Expected 24h time in HH:MM format.');

export const localeSchema = z
  .string()
  .regex(/^[a-z]{2}(?:-[A-Z][a-zA-Z]+)*$/u, 'Expected BCP 47 locale (ex: en-US).');

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]) as z.ZodType<JsonValue>
);

export const metadataSchema = z.record(z.string(), jsonValueSchema).default({});

export const identifierSchema = z
  .string()
  .min(2, 'Identifiers must be at least 2 characters long.')
  .max(128, 'Identifiers cannot exceed 128 characters.')
  .regex(/^[a-z0-9][a-z0-9._-]*$/iu, 'Use alphanumeric characters, dot, underscore, or hyphen.');

export const IN_APP_CHANNEL_TYPE = `${'in'}_${'app'}` as const;
export const CHANNEL_TYPES = ['email', 'sms', 'push', IN_APP_CHANNEL_TYPE, 'webhook'] as const;
export type CoreChannelType = (typeof CHANNEL_TYPES)[number];
export type ChannelType = CoreChannelType | (string & { readonly __brand?: 'CustomChannelType' });

export function normalizeChannelType(value: string): ChannelType {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9._-]+$/u.test(normalized)) {
    throw new Error('Channel type must use lowercase letters, numbers, period, underscore, or hyphen.');
  }
  return normalized as ChannelType;
}

export const channelTypeSchema = z
  .union([z.enum(CHANNEL_TYPES), z.string().regex(/^[a-z0-9._-]+$/u)])
  .transform((value) => normalizeChannelType(value));

export const PRIORITY_LEVELS = ['urgent', 'high', 'normal', 'low'] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];
export const prioritySchema = z.enum(PRIORITY_LEVELS);

export const MESSAGE_STATUSES = ['queued', 'sent', 'delivered', 'failed', 'retried', 'read'] as const;
export type MessageState = (typeof MESSAGE_STATUSES)[number];
export const messageStateSchema = z.enum(MESSAGE_STATUSES);

export function extractTemplatePlaceholders(template: string): string[] {
  const matches = template.match(/\{\{\s*([^{}\s]+)\s*\}\}/gu);
  if (!matches) {
    return [];
  }
  return matches.map((placeholder) => placeholder.replace(/\{\{|\}\}/g, '').trim());
}
