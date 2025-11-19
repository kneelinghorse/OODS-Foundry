import { describe, expect, it } from 'vitest';

import type { PreferenceDocument } from '@/schemas/preferences/preference-document.js';
import { runDualWriteMigration } from '@/traits/preferenceable/dual-write-migrator.ts';

function buildChannelsDocument(): PreferenceDocument {
  return {
    version: '1.1.0',
    preferences: {
      theme: {
        mode: 'system',
        density: 'compact',
        highContrast: false,
      },
      notifications: {
        mentions: {
          email: true,
          push: true,
          sms: false,
        },
        digest: {
          enabled: true,
          time: '09:00',
          timezone: 'UTC',
          frequency: 'weekly',
        },
        channels: ['email', 'sms'],
      },
      display: {
        timezone: 'UTC',
        locale: 'en-US',
      },
    },
    metadata: {
      schemaVersion: '1.1.0',
      lastUpdated: '2025-11-19T00:00:00Z',
      source: 'system',
      migrationApplied: [],
    },
  } satisfies PreferenceDocument;
}

describe('dual-write preference migration', () => {
  it('produces legacy and next documents with version tracking', () => {
    const input = buildChannelsDocument();
    const result = runDualWriteMigration(input, {
      targetVersion: '2.0.0',
      clock: () => '2025-11-19T02:00:00Z',
      updatedBy: 'migration-daemon',
    });

    expect(result.plan.strategy).toBe('eager');
    expect(result.legacyDocument.preferences.notifications.channels).toEqual(['email', 'sms']);
    expect(result.nextDocument.preferences.notifications.channels).toMatchObject({
      email: { enabled: true },
      sms: { enabled: true },
      push: { enabled: false },
    });
    expect(result.nextDocument.preferences.privacy).toMatchObject({
      shareActivity: false,
      profiling: false,
    });
    expect(result.nextDocument.metadata.schemaVersion).toBe('2.0.0');
    expect(result.nextDocument.metadata.migrationApplied.at(-1)?.strategy).toBe('eager');
    expect(result.changes.some((change) => change.path === 'preferences.notifications.channels')).toBe(true);
  });

  it('throws when no eager plan is configured for the requested versions', () => {
    const input = buildChannelsDocument();
    expect(() => runDualWriteMigration(input, { targetVersion: '1.1.0' })).toThrow();
  });
});
