import { describe, expect, it } from 'vitest';

import type { PreferenceDocument } from '@/schemas/preferences/preference-document.js';
import { applyPreferenceReadRepair, rollbackPreferenceReadRepair } from '@/traits/preferenceable/read-repair.ts';

function buildDocument(version: string): PreferenceDocument {
  return {
    version,
    preferences: {
      theme: {
        mode: 'dark',
        density: 'comfortable',
      },
      notifications: {
        mentions: {
          email: true,
          push: true,
        },
        digest: {
          enabled: true,
          time: '08:00',
          timezone: 'UTC',
        },
        channels: ['email', 'push'],
      },
      display: {
        timezone: 'UTC',
        locale: 'en-US',
      },
    },
    metadata: {
      schemaVersion: version,
      lastUpdated: '2025-11-19T00:00:00Z',
      source: 'system',
      migrationApplied: [],
    },
  } satisfies PreferenceDocument;
}

describe('preference read-repair', () => {
  it('injects defaults for additive schema changes and updates version metadata', () => {
    const result = applyPreferenceReadRepair(buildDocument('1.0.0'), {
      targetVersion: '1.1.0',
      clock: () => '2025-11-19T01:00:00Z',
      updatedBy: 'migration-bot',
      source: 'migration',
    });

    expect(result.changed).toBe(true);
    expect(result.applied.length).toBeGreaterThanOrEqual(2);
    expect(result.applied.map((change) => change.path)).toEqual(
      expect.arrayContaining([
        'preferences.theme.highContrast',
        'preferences.notifications.digest.frequency',
      ])
    );
    expect(result.document.metadata.schemaVersion).toBe('1.1.0');
    expect(result.document.preferences.theme.highContrast).toBe(false);
    expect(result.document.preferences.notifications.digest.frequency).toBe('daily');
    expect(result.document.metadata.migrationApplied.at(-1)?.strategy).toBe('lazy');
  });

  it('throws when attempting read-repair on a breaking schema change', () => {
    const doc = buildDocument('1.1.0');
    expect(() => applyPreferenceReadRepair(doc, { targetVersion: '2.0.0' })).toThrow(/dual-write/);
  });

  it('rolls back applied read-repair changes when requested', () => {
    const original = buildDocument('1.0.0');
    const migrated = applyPreferenceReadRepair(original, { targetVersion: '1.1.0' });
    const reverted = rollbackPreferenceReadRepair(migrated.document, migrated.applied, migrated.fromVersion);

    expect(reverted.metadata.schemaVersion).toBe('1.0.0');
    expect(reverted.preferences.theme.highContrast).toBeUndefined();
    expect(reverted.metadata.migrationApplied).toHaveLength(0);
  });
});
