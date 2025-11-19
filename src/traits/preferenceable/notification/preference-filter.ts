import {
  cloneMatrix,
  createNotificationMatrix,
  getEnabledChannels,
  type NotificationChannelId,
  type NotificationMatrixOptions,
  type NotificationPreferenceMatrix,
  normalizeNotificationMatrix,
} from './notification-matrix.js';

export interface NotificationEventPayload<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  readonly type: string;
  readonly recipientId: string;
  readonly payload?: TPayload;
  readonly metadata?: Record<string, unknown>;
}

export interface PreferenceFilterOptions extends NotificationMatrixOptions {
  readonly fallbackChannels?: readonly NotificationChannelId[];
}

export interface PreferenceFilterResult<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  readonly event: NotificationEventPayload<TPayload>;
  readonly eventType: string;
  readonly enabledChannels: readonly NotificationChannelId[];
  readonly matrix: NotificationPreferenceMatrix;
}

const EMPTY_CHANNELS: readonly NotificationChannelId[] = Object.freeze([]);

export class NotificationPreferenceFilter {
  private readonly matrix: NotificationPreferenceMatrix;
  private readonly fallbackChannels: readonly NotificationChannelId[];

  constructor(matrix?: unknown, options: PreferenceFilterOptions = {}) {
    if (matrix) {
      this.matrix = normalizeNotificationMatrix(matrix, options);
    } else {
      this.matrix = createNotificationMatrix(options);
    }
    this.fallbackChannels = options.fallbackChannels ?? EMPTY_CHANNELS;
  }

  getMatrix(): NotificationPreferenceMatrix {
    return cloneMatrix(this.matrix);
  }

  getEnabledChannels(eventType: string): NotificationChannelId[] {
    const row = this.matrix[eventType];
    if (!row) {
      return [...this.fallbackChannels];
    }
    return getEnabledChannels(this.matrix, eventType);
  }

  isChannelEnabled(eventType: string, channelId: NotificationChannelId): boolean {
    const row = this.matrix[eventType];
    if (!row) {
      return this.fallbackChannels.includes(channelId);
    }
    return Boolean(row[channelId]);
  }

  apply<TPayload extends Record<string, unknown> = Record<string, unknown>>(
    event: NotificationEventPayload<TPayload>
  ): PreferenceFilterResult<TPayload> {
    const enabledChannels = this.getEnabledChannels(event.type);
    return {
      event,
      eventType: event.type,
      enabledChannels,
      matrix: this.matrix,
    } satisfies PreferenceFilterResult<TPayload>;
  }
}

export function filterChannelsForEvent(
  matrix: NotificationPreferenceMatrix,
  eventType: string,
  options: PreferenceFilterOptions = {}
): NotificationChannelId[] {
  const filter = new NotificationPreferenceFilter(matrix, options);
  return filter.getEnabledChannels(eventType);
}
