import type { Channel } from '@/schemas/communication/channel.js';
import type { ChannelType } from '@/schemas/communication/common.js';
import type { RuntimeLogger } from '@/traits/authz/runtime-types.js';

import type { ChannelPreferences } from '@/traits/communication/runtime-types.js';
import { PreferenceableBridge } from './bridges/preferenceable-bridge.js';

export interface ChannelResolverOptions {
  readonly logger?: RuntimeLogger;
}

export interface ChannelResolution {
  readonly channel: Channel;
  readonly channelType: ChannelType;
  readonly source: 'user' | 'organization' | 'system' | 'fallback';
}

export class ChannelResolver {
  private readonly logger?: RuntimeLogger;

  constructor(private readonly bridge: PreferenceableBridge, options: ChannelResolverOptions = {}) {
    this.logger = options.logger;
  }

  async resolveChannel(
    userId: string,
    eventType: string,
    availableChannels: readonly Channel[]
  ): Promise<ChannelResolution | null> {
    if (!availableChannels.length) {
      return null;
    }
    const preferences = await this.bridge.getUserChannelPreferences(userId, eventType);
    const channel = this.pickChannel(preferences, availableChannels);
    if (!channel) {
      this.logger?.warn?.('channel_resolver:no_channel', { userId, eventType });
      return null;
    }
    return channel;
  }

  private pickChannel(preferences: ChannelPreferences, availableChannels: readonly Channel[]): ChannelResolution | null {
    const priority = dedupe([
      ...preferences.optedInChannels,
      ...preferences.organizationDefaults,
      ...preferences.systemDefaults,
    ]);
    for (const channelType of priority) {
      if (preferences.explicitlyBlockedChannels.includes(channelType)) {
        continue;
      }
      const candidate = findChannel(channelType, availableChannels);
      if (!candidate) {
        continue;
      }
      const source = resolveSource(channelType, preferences);
      return { channel: candidate, channelType, source } satisfies ChannelResolution;
    }
    const fallback = availableChannels.find((channel) => channel.enabled !== false);
    if (!fallback || preferences.explicitlyBlockedChannels.includes(fallback.type)) {
      return null;
    }
    return { channel: fallback, channelType: fallback.type, source: 'fallback' } satisfies ChannelResolution;
  }
}

function dedupe(values: readonly ChannelType[]): ChannelType[] {
  const seen = new Set<string>();
  const result: ChannelType[] = [];
  for (const value of values) {
    const key = value.toString();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(value);
  }
  return result;
}

function findChannel(channelType: ChannelType, available: readonly Channel[]): Channel | undefined {
  return available.find((channel) => channel.type === channelType && channel.enabled !== false);
}

function resolveSource(channelType: ChannelType, preferences: ChannelPreferences): ChannelResolution['source'] {
  if (preferences.optedInChannels.includes(channelType)) {
    return 'user';
  }
  if (preferences.organizationDefaults.includes(channelType)) {
    return 'organization';
  }
  if (preferences.systemDefaults.includes(channelType)) {
    return 'system';
  }
  return 'fallback';
}
