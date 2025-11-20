import { describe, expect, it } from 'vitest';

import type { Channel } from '@/schemas/communication/channel.js';
import type { ChannelType } from '@/schemas/communication/common.js';
import type { PreferenceableBridge } from '@/traits/communication/bridges/preferenceable-bridge.js';
import { ChannelResolver } from '@/traits/communication/channel-resolver.js';

const EMAIL_CHANNEL: Channel = {
  id: 'email',
  name: 'Email',
  type: 'email',
  enabled: true,
  description: 'SMTP',
  metadata: {},
  tags: [],
  config: {},
};

const SMS_CHANNEL: Channel = {
  id: 'sms',
  name: 'SMS',
  type: 'sms',
  enabled: true,
  description: 'SMS',
  metadata: {},
  tags: [],
  config: {},
};

function bridgeFactory(preferences: { optedIn?: string[]; blocked?: string[]; org?: string[]; system?: string[] }): PreferenceableBridge {
  return {
    getUserChannelPreferences: async () => ({
      userId: 'user-1',
      eventType: 'welcome',
      matrix: {},
      optedInChannels: (preferences.optedIn ?? []) as ChannelType[],
      explicitlyBlockedChannels: (preferences.blocked ?? []) as ChannelType[],
      organizationDefaults: (preferences.org ?? []) as ChannelType[],
      systemDefaults: (preferences.system ?? []) as ChannelType[],
      quietHours: null,
    }),
    getQuietHours: async () => null,
  } as PreferenceableBridge;
}

describe('ChannelResolver', () => {
  it('prioritizes user-selected channels', async () => {
    const bridge = bridgeFactory({ optedIn: ['sms', 'email'] });
    const resolver = new ChannelResolver(bridge);
    const result = await resolver.resolveChannel('user-1', 'welcome', [EMAIL_CHANNEL, SMS_CHANNEL]);
    expect(result?.channel.id).toBe('sms');
  });

  it('falls back to organization defaults when user has no preference', async () => {
    const bridge = bridgeFactory({ org: ['email'] });
    const resolver = new ChannelResolver(bridge);
    const result = await resolver.resolveChannel('user-2', 'alerts', [EMAIL_CHANNEL]);
    expect(result?.source).toBe('organization');
    expect(result?.channel.id).toBe('email');
  });

  it('returns null when all channels are explicitly blocked', async () => {
    const bridge = bridgeFactory({ optedIn: ['email'], blocked: ['email'] });
    const resolver = new ChannelResolver(bridge);
    const result = await resolver.resolveChannel('user-3', 'welcome', [EMAIL_CHANNEL]);
    expect(result).toBeNull();
  });
});
