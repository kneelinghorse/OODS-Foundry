import type { PreferenceRecord } from '@/schemas/preferences/preference-document.js';
import { getPreferenceExample } from '@/traits/preferenceable/schema-registry.js';
import { runDualWriteMigration } from '@/traits/preferenceable/dual-write-migrator.js';

const document = getPreferenceExample('1.1.0');
const notifications = ensurePreferenceRecord(document.preferences.notifications, 'preferences.notifications');
notifications.channels = ['email', 'push'];

const result = runDualWriteMigration(document, { targetVersion: '2.0.0' });

const legacyNotifications = ensurePreferenceRecord(
  result.legacyDocument.preferences.notifications,
  'legacy.preferences.notifications'
);
const nextNotifications = ensurePreferenceRecord(
  result.nextDocument.preferences.notifications,
  'next.preferences.notifications'
);

console.log('Legacy schema (array):', legacyNotifications.channels);
console.log('Next schema (map):', nextNotifications.channels);
console.log('Change set:', result.changes);

function ensurePreferenceRecord(value: unknown, path: string): PreferenceRecord {
  if (!isPreferenceRecord(value)) {
    throw new Error(`${path} must be a record for this example.`);
  }
  return value;
}

function isPreferenceRecord(value: unknown): value is PreferenceRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
