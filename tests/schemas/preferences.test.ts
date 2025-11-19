import { describe, expect, it } from 'vitest';

import {
  PreferenceDocumentSchema,
  normalizePreferenceDocument,
} from '@/schemas/preferences/preference-document.ts';
import {
  PreferenceMetadataSchema,
  normalizePreferenceMetadata,
} from '@/schemas/preferences/preference-metadata.ts';

const baseMetadata = {
  schemaVersion: '1.0.0',
  lastUpdated: '2025-11-18T00:00:00Z',
  source: 'user',
  migrationApplied: [],
};

describe('PreferenceDocument schema', () => {
  it('normalizes nested preferences and metadata defaults', () => {
    const document = normalizePreferenceDocument({
      version: '1.0.0',
      preferences: {
        theme: {
          mode: ' dark ',
        },
        notifications: {
          mention: {
            email: true,
            push: false,
          },
        },
      },
      metadata: {
        ...baseMetadata,
        updatedBy: 'user-123',
      },
    });

    expect(document.version).toBe('1.0.0');
    expect(document.preferences.theme).toMatchObject({ mode: 'dark' });
    expect(document.preferences.notifications).toBeDefined();
    expect(document.metadata.updatedBy).toBe('user-123');
  });

  it('rejects invalid version values', () => {
    expect(() =>
      PreferenceDocumentSchema.parse({
        version: '1',
        preferences: {},
        metadata: baseMetadata,
      })
    ).toThrow(/version/i);
  });
});

describe('PreferenceMetadata schema', () => {
  it('normalizes timestamps and migration history', () => {
    const metadata = normalizePreferenceMetadata(
      {
        migrationApplied: [
          {
            id: 'mig-2',
            fromVersion: '1.1.0',
            toVersion: '1.2.0',
            appliedAt: '2025-11-19T00:00:00Z',
            strategy: 'eager',
          },
          {
            id: 'mig-1',
            fromVersion: '1.0.0',
            toVersion: '1.1.0',
            appliedAt: '2025-11-18T00:00:00Z',
            strategy: 'lazy',
          },
        ],
      },
      {
        clock: () => '2025-11-20T00:00:00Z',
        schemaVersionFallback: '1.2.0',
        updatedBy: 'system',
      }
    );

    expect(metadata.lastUpdated).toBe('2025-11-20T00:00:00Z');
    expect(metadata.schemaVersion).toBe('1.2.0');
    expect(metadata.migrationApplied[0]?.id).toBe('mig-1');
    expect(metadata.migrationApplied).toHaveLength(2);
  });

  it('validates metadata payloads through zod schema', () => {
    expect(() =>
      PreferenceMetadataSchema.parse({
        ...baseMetadata,
        schemaVersion: 'invalid',
      })
    ).toThrow(/schemaVersion/i);
  });
});
