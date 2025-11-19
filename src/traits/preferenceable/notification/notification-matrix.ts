import { z } from 'zod';

import {
  clonePreferenceRecord,
  type PreferenceRecord,
  type PreferenceValue,
} from '@/schemas/preferences/preference-document.js';

const CHANNEL_KEY_PATTERN = /^[a-z0-9_-]+$/i;
const EVENT_KEY_PATTERN = /^[a-z0-9._-]+$/i;
const IN_APP_SEGMENTS = ['in', 'app'] as const;
type InAppChannelId = `${typeof IN_APP_SEGMENTS[0]}_${typeof IN_APP_SEGMENTS[1]}`;
const IN_APP_CHANNEL_ID = `${IN_APP_SEGMENTS[0]}_${IN_APP_SEGMENTS[1]}` as InAppChannelId;

export const NOTIFICATION_CHANNEL_IDS = {
  email: 'email',
  push: 'push',
  sms: 'sms',
  inApp: IN_APP_CHANNEL_ID,
} as const;

type CanonicalNotificationChannelId =
  (typeof NOTIFICATION_CHANNEL_IDS)[keyof typeof NOTIFICATION_CHANNEL_IDS];

export type NotificationChannelId =
  | CanonicalNotificationChannelId
  | (string & Record<never, never>);

export const DEFAULT_NOTIFICATION_CHANNELS: readonly NotificationChannelConfig[] = [
  {
    id: NOTIFICATION_CHANNEL_IDS.email,
    label: 'Email',
    description: 'Send to the primary inbox via transactional ESP.',
  },
  {
    id: NOTIFICATION_CHANNEL_IDS.push,
    label: 'Push',
    description: 'Dispatch via mobile push notifications.',
  },
  {
    id: NOTIFICATION_CHANNEL_IDS.sms,
    label: 'SMS',
    description: 'Deliver through the registered phone number via SMS.',
  },
  {
    id: NOTIFICATION_CHANNEL_IDS.inApp,
    label: 'In-app',
    description: 'Render inside the application notification center.',
  },
] as const;

export const DEFAULT_NOTIFICATION_EVENTS: readonly NotificationEventDefinition[] = [
  {
    id: 'new_comment',
    label: 'New comment',
    description: 'Thread replies, reviews, or other comment activity.',
    defaultChannels: [NOTIFICATION_CHANNEL_IDS.email, NOTIFICATION_CHANNEL_IDS.inApp],
  },
  {
    id: 'mention',
    label: 'Mention',
    description: 'Direct @mentions inside projects or tickets.',
    defaultChannels: [
      NOTIFICATION_CHANNEL_IDS.email,
      NOTIFICATION_CHANNEL_IDS.push,
      NOTIFICATION_CHANNEL_IDS.inApp,
    ],
  },
  {
    id: 'new_follower',
    label: 'New follower',
    description: 'Fires when another user follows this account.',
    defaultChannels: [NOTIFICATION_CHANNEL_IDS.push, NOTIFICATION_CHANNEL_IDS.inApp],
  },
  {
    id: 'billing_alert',
    label: 'Billing alert',
    description: 'Payment failures, expiring cards, and plan downgrades.',
    defaultChannels: [
      NOTIFICATION_CHANNEL_IDS.email,
      NOTIFICATION_CHANNEL_IDS.push,
      NOTIFICATION_CHANNEL_IDS.sms,
      NOTIFICATION_CHANNEL_IDS.inApp,
    ],
  },
] as const;

export interface NotificationChannelConfig {
  readonly id: NotificationChannelId;
  readonly label: string;
  readonly description?: string;
  readonly category?: string;
}

export interface NotificationEventDefinition {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly category?: string;
  readonly defaultChannels?: readonly NotificationChannelId[];
}

export type NotificationMatrixRow = Partial<Record<NotificationChannelId, boolean>> & PreferenceRecord;
export type NotificationPreferenceMatrix = Record<string, NotificationMatrixRow> & PreferenceRecord;

export interface NotificationMatrixOptions {
  readonly events?: readonly NotificationEventDefinition[];
  readonly channels?: readonly NotificationChannelConfig[];
  readonly seed?: unknown;
}

export type NotificationMatrixPath = readonly string[];

export interface NotificationMatrixExtractionOptions extends NotificationMatrixOptions {
  readonly path?: NotificationMatrixPath;
}

export interface NotificationMatrixWriteOptions extends NotificationMatrixExtractionOptions {}

const ChannelKeySchema = z.string().regex(CHANNEL_KEY_PATTERN, 'channel id must be alphanumeric');
const EventKeySchema = z.string().regex(EVENT_KEY_PATTERN, 'event id must be alphanumeric');

const MatrixRowSchema = z.record(ChannelKeySchema, z.boolean());
const NotificationMatrixSchema = z.record(EventKeySchema, MatrixRowSchema);

const DEFAULT_MATRIX_PATH: NotificationMatrixPath = ['notifications', 'matrix'];
export const DEFAULT_NOTIFICATION_MATRIX_PATH = DEFAULT_MATRIX_PATH;

export function createNotificationMatrix(options: NotificationMatrixOptions = {}): NotificationPreferenceMatrix {
  const matrix = normalizeNotificationMatrix(options.seed, options);
  return matrix;
}

export function normalizeNotificationMatrix(
  input: unknown,
  options: NotificationMatrixOptions = {}
): NotificationPreferenceMatrix {
  const events = options.events ?? DEFAULT_NOTIFICATION_EVENTS;
  const channels = options.channels ?? DEFAULT_NOTIFICATION_CHANNELS;
  const parsed = parseMatrix(input);

  const normalized: NotificationPreferenceMatrix = {};
  const seenEvents = new Set<string>();

  for (const definition of events) {
    const eventId = definition.id;
    const row = parsed[eventId];
    normalized[eventId] = normalizeRow(row, channels, definition.defaultChannels);
    seenEvents.add(eventId);
  }

  for (const [eventId, row] of Object.entries(parsed)) {
    if (seenEvents.has(eventId)) {
      continue;
    }
    normalized[eventId] = normalizeRow(row, channels);
  }

  return normalized;
}

export function getNotificationMatrixFromPreferences(
  preferences: PreferenceRecord | undefined,
  options: NotificationMatrixExtractionOptions = {}
): NotificationPreferenceMatrix {
  const node = readPreferencePath(preferences, options.path ?? DEFAULT_MATRIX_PATH);
  return normalizeNotificationMatrix(node, options);
}

export function setNotificationMatrixInPreferences(
  preferences: PreferenceRecord,
  matrix: NotificationPreferenceMatrix,
  options: NotificationMatrixWriteOptions = {}
): PreferenceRecord {
  const cloned = clonePreferenceRecord(preferences);
  const path = options.path ?? DEFAULT_MATRIX_PATH;
  if (path.length === 0) {
    throw new Error('Notification matrix path must contain at least one segment.');
  }

  let cursor: PreferenceValue = cloned;
  for (let index = 0; index < path.length; index += 1) {
    const segment = path[index];
    if (index === path.length - 1) {
      (cursor as PreferenceRecord)[segment] = cloneMatrix(matrix);
      break;
    }
    const next = (cursor as PreferenceRecord)[segment];
    if (!isPreferenceRecord(next)) {
      (cursor as PreferenceRecord)[segment] = {};
    }
    cursor = (cursor as PreferenceRecord)[segment];
  }

  return cloned;
}

export function applyChannelPreference(
  matrix: NotificationPreferenceMatrix,
  eventId: string,
  channelId: NotificationChannelId,
  enabled: boolean
): NotificationPreferenceMatrix {
  const clone = cloneMatrix(matrix);
  const row = clone[eventId] ?? {};
  row[channelId] = enabled;
  clone[eventId] = row;
  return clone;
}

export function setEventChannels(
  matrix: NotificationPreferenceMatrix,
  eventId: string,
  enabled: boolean
): NotificationPreferenceMatrix {
  const clone = cloneMatrix(matrix);
  const row = clone[eventId] ?? {};
  for (const channelId of Object.keys(row)) {
    row[channelId] = enabled;
  }
  clone[eventId] = row;
  return clone;
}

export function setChannelForAllEvents(
  matrix: NotificationPreferenceMatrix,
  channelId: NotificationChannelId,
  enabled: boolean
): NotificationPreferenceMatrix {
  const clone = cloneMatrix(matrix);
  for (const row of Object.values(clone)) {
    row[channelId] = enabled;
  }
  return clone;
}

export function setAllChannels(matrix: NotificationPreferenceMatrix, enabled: boolean): NotificationPreferenceMatrix {
  const clone = cloneMatrix(matrix);
  for (const row of Object.values(clone)) {
    for (const channelId of Object.keys(row)) {
      row[channelId] = enabled;
    }
  }
  return clone;
}

export function getEnabledChannels(
  matrix: NotificationPreferenceMatrix,
  eventId: string
): NotificationChannelId[] {
  const row = matrix[eventId];
  if (!row) {
    return [];
  }
  return Object.entries(row)
    .filter(([, enabled]) => enabled)
    .map(([channelId]) => channelId);
}

export function cloneMatrix(matrix: NotificationPreferenceMatrix): NotificationPreferenceMatrix {
  const clone: NotificationPreferenceMatrix = {};
  for (const [eventId, row] of Object.entries(matrix ?? {})) {
    const nextRow: NotificationMatrixRow = {};
    for (const [channelId, enabled] of Object.entries(row ?? {})) {
      if (typeof enabled === 'boolean') {
        nextRow[channelId] = enabled;
      }
    }
    clone[eventId] = nextRow;
  }
  return clone;
}

function parseMatrix(input: unknown): NotificationPreferenceMatrix {
  if (!input) {
    return {};
  }
  try {
    return NotificationMatrixSchema.parse(input);
  } catch {
    return {};
  }
}

function normalizeRow(
  row: NotificationMatrixRow | undefined,
  channels: readonly NotificationChannelConfig[],
  defaults?: readonly NotificationChannelId[]
): NotificationMatrixRow {
  const normalized: NotificationMatrixRow = {};
  const source = row ?? {};
  for (const channel of channels) {
    const existing = source[channel.id];
    if (typeof existing === 'boolean') {
      normalized[channel.id] = existing;
      continue;
    }
    normalized[channel.id] = defaults?.includes(channel.id) ?? false;
  }

  for (const [channelId, value] of Object.entries(source)) {
    if (normalized[channelId] !== undefined) {
      continue;
    }
    if (typeof value === 'boolean' && CHANNEL_KEY_PATTERN.test(channelId)) {
      normalized[channelId] = value;
    }
  }
  return normalized;
}

function readPreferencePath(
  preferences: PreferenceRecord | undefined,
  path: NotificationMatrixPath
): unknown {
  if (!preferences) {
    return undefined;
  }
  let cursor: unknown = preferences;
  for (const segment of path) {
    if (!isPreferenceRecord(cursor)) {
      return undefined;
    }
    cursor = cursor[segment];
    if (cursor == null) {
      return undefined;
    }
  }
  return cursor;
}

function isPreferenceRecord(value: unknown): value is PreferenceRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
