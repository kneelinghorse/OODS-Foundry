import type { NotificationChannelId, NotificationPreferenceMatrix } from './notification-matrix.js';
import {
  NotificationPreferenceFilter,
  type NotificationEventPayload,
  type PreferenceFilterOptions,
} from './preference-filter.js';

export interface NotificationChannelHandlerContext<
  TPayload extends Record<string, unknown> = Record<string, unknown>
> {
  readonly channel: NotificationChannelId;
  readonly event: NotificationEventPayload<TPayload>;
}

export type NotificationChannelHandler<
  TPayload extends Record<string, unknown> = Record<string, unknown>
> = (context: NotificationChannelHandlerContext<TPayload>) => void | Promise<void>;

export interface NotificationChannelRouterOptions extends PreferenceFilterOptions {
  readonly handlers?: Partial<Record<NotificationChannelId, NotificationChannelHandler>>;
  readonly filter?: NotificationPreferenceFilter;
  readonly matrix?: NotificationPreferenceMatrix | unknown;
}

export interface NotificationRouteResult<
  TPayload extends Record<string, unknown> = Record<string, unknown>
> {
  readonly event: NotificationEventPayload<TPayload>;
  readonly eventType: string;
  readonly enabledChannels: readonly NotificationChannelId[];
  readonly dispatchedChannels: readonly NotificationChannelId[];
  readonly missingHandlers: readonly NotificationChannelId[];
}

export class NotificationChannelRouter {
  private readonly filter: NotificationPreferenceFilter;
  private readonly handlers = new Map<NotificationChannelId, NotificationChannelHandler>();

  constructor(options: NotificationChannelRouterOptions = {}) {
    if (options.filter) {
      this.filter = options.filter;
    } else if (options.matrix) {
      this.filter = new NotificationPreferenceFilter(options.matrix, options);
    } else {
      this.filter = new NotificationPreferenceFilter(undefined, options);
    }

    if (options.handlers) {
      for (const [channelId, handler] of Object.entries(options.handlers)) {
        if (!handler) {
          continue;
        }
        this.handlers.set(channelId, handler);
      }
    }
  }

  registerHandler(channelId: NotificationChannelId, handler: NotificationChannelHandler): void {
    this.handlers.set(channelId, handler);
  }

  unregisterHandler(channelId: NotificationChannelId): void {
    this.handlers.delete(channelId);
  }

  getFilter(): NotificationPreferenceFilter {
    return this.filter;
  }

  async route<TPayload extends Record<string, unknown> = Record<string, unknown>>(
    event: NotificationEventPayload<TPayload>
  ): Promise<NotificationRouteResult<TPayload>> {
    const enabledChannels = this.filter.getEnabledChannels(event.type);
    const dispatchedChannels: NotificationChannelId[] = [];
    const missingHandlers: NotificationChannelId[] = [];

    for (const channel of enabledChannels) {
      const handler = this.handlers.get(channel);
      if (!handler) {
        missingHandlers.push(channel);
        continue;
      }
      await handler({ channel, event });
      dispatchedChannels.push(channel);
    }

    return {
      event,
      eventType: event.type,
      enabledChannels,
      dispatchedChannels,
      missingHandlers,
    } satisfies NotificationRouteResult<TPayload>;
  }
}
