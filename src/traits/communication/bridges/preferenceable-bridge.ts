import type { PreferenceCache } from '@/traits/preferenceable/cache/preference-cache.js';
import { getNotificationMatrixFromPreferences } from '@/traits/preferenceable/notification/notification-matrix.js';
import type { PreferenceDocument, PreferenceRecord } from '@/schemas/preferences/preference-document.js';
import type { ChannelType } from '@/schemas/communication/common.js';

import type { ChannelPreferences, QuietHours } from '@/traits/communication/runtime-types.js';

export interface PreferenceableBridgeOptions {
  readonly tenantId?: string;
  readonly organizationDefaults?: readonly ChannelType[];
  readonly systemDefaults?: readonly ChannelType[];
}

export class PreferenceableBridge {
  private readonly tenantId?: string;
  private readonly organizationDefaults: readonly ChannelType[];
  private readonly systemDefaults: readonly ChannelType[];
  private readonly preferenceMemo = new Map<string, ChannelPreferences>();
  private readonly documentMemo = new Map<string, PreferenceDocument | null>();

  constructor(private readonly cache: PreferenceCache, options: PreferenceableBridgeOptions = {}) {
    this.tenantId = options.tenantId;
    this.organizationDefaults = options.organizationDefaults ?? [];
    this.systemDefaults = options.systemDefaults ?? [];
  }

  async getUserChannelPreferences(userId: string, eventType: string): Promise<ChannelPreferences> {
    const key = `${userId}:${eventType}`;
    const memoized = this.preferenceMemo.get(key);
    if (memoized) {
      return memoized;
    }
    const document = await this.loadPreferenceDocument(userId);
    const matrix = getNotificationMatrixFromPreferences(document?.preferences);
    const row = matrix[eventType] ?? {};
    const optedIn = Object.entries(row)
      .filter(([, enabled]) => enabled === true)
      .map(([channel]) => channel.toLowerCase() as ChannelType);
    const explicitlyBlocked = Object.entries(row)
      .filter(([, enabled]) => enabled === false)
      .map(([channel]) => channel.toLowerCase() as ChannelType);
    const entry: ChannelPreferences = {
      userId,
      eventType,
      matrix,
      optedInChannels: optedIn,
      explicitlyBlockedChannels: explicitlyBlocked,
      organizationDefaults: this.organizationDefaults,
      systemDefaults: this.systemDefaults,
      quietHours: extractQuietHours(document) ?? null,
    } satisfies ChannelPreferences;
    this.preferenceMemo.set(key, entry);
    return entry;
  }

  async isChannelOptedIn(userId: string, eventType: string, channelType: ChannelType): Promise<boolean> {
    const preferences = await this.getUserChannelPreferences(userId, eventType);
    if (preferences.explicitlyBlockedChannels.includes(channelType)) {
      return false;
    }
    if (preferences.optedInChannels.length === 0) {
      return true;
    }
    return preferences.optedInChannels.includes(channelType);
  }

  async getQuietHours(userId: string): Promise<QuietHours | null> {
    const document = await this.loadPreferenceDocument(userId);
    return extractQuietHours(document) ?? null;
  }

  private async loadPreferenceDocument(userId: string): Promise<PreferenceDocument | null> {
    const memo = this.documentMemo.get(userId);
    if (memo !== undefined) {
      return memo;
    }
    const result = await this.cache.getDocument({ userId, tenantId: this.tenantId });
    const document = result.document ?? null;
    this.documentMemo.set(userId, document);
    return document;
  }
}

function extractQuietHours(document: PreferenceDocument | null): QuietHours | null {
  if (!document?.preferences) {
    return null;
  }
  const candidates = [
    readPreferenceNode(document.preferences, ['quietHours']),
    readPreferenceNode(document.preferences, ['notifications', 'quietHours']),
  ];
  for (const candidate of candidates) {
    const parsed = normalizeQuietHours(candidate);
    if (parsed) {
      return parsed;
    }
  }
  return null;
}

function normalizeQuietHours(candidate: unknown): QuietHours | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }
  const record = candidate as Record<string, unknown>;
  const timezone = typeof record.timezone === 'string' ? record.timezone : undefined;
  const start = readTime(record.start_time ?? record.start);
  const end = readTime(record.end_time ?? record.end);
  if (!timezone || !start || !end) {
    return null;
  }
  const days = Array.isArray(record.days_of_week ?? record.daysOfWeek)
    ? (record.days_of_week ?? record.daysOfWeek)
    : undefined;
  const normalizedDays = Array.isArray(days)
    ? days.map((day) => String(day).toLowerCase())
    : undefined;
  return {
    start_time: start,
    end_time: end,
    timezone,
    days_of_week: normalizedDays as QuietHours['days_of_week'],
  } satisfies QuietHours;
}

function readTime(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/u.test(value)) {
    return null;
  }
  return value;
}

function readPreferenceNode(record: PreferenceRecord | null | undefined, path: readonly string[]): unknown {
  if (!record) {
    return undefined;
  }
  let cursor: unknown = record;
  for (const segment of path) {
    if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) {
      return undefined;
    }
    const map = cursor as PreferenceRecord;
    cursor = map[segment];
  }
  return cursor;
}
