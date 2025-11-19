import { describe, expect, it } from 'vitest';

import {
  InMemoryMigrationLogWriter,
  PreferenceMigrationLogger,
} from '@/traits/preferenceable/migration-logger.ts';

describe('preference migration logger', () => {
  it('writes structured entries with change sets', () => {
    const writer = new InMemoryMigrationLogWriter();
    const logger = new PreferenceMigrationLogger(writer, { clock: () => '2025-11-19T00:00:00Z' });
    logger.log(
      {
        userId: 'user-1',
        strategy: 'lazy',
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        appliedBy: 'test',
      },
      {
        status: 'completed',
        message: 'defaults applied',
        changeSet: [{ path: 'preferences.theme.highContrast', from: undefined, to: false }],
      }
    );

    expect(writer.entries).toHaveLength(1);
    expect(writer.entries[0]?.changeSet[0]?.path).toBe('preferences.theme.highContrast');
    expect(writer.entries[0]?.status).toBe('completed');
  });
});
