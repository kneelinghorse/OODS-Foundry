import type { PreferenceRecord } from '@/schemas/preferences/preference-document.js';
import { getPreferenceExample } from '@/traits/preferenceable/schema-registry.js';
import { applyPreferenceReadRepair } from '@/traits/preferenceable/read-repair.js';

const document = getPreferenceExample('1.0.0');
// Simulate a user that predates the high-contrast + digest frequency fields.
const theme = ensurePreferenceRecord(document.preferences.theme, 'preferences.theme');
delete theme.highContrast;

const notifications = ensurePreferenceRecord(document.preferences.notifications, 'preferences.notifications');
const digest = ensurePreferenceRecord(notifications.digest, 'preferences.notifications.digest');
delete digest.frequency;

const result = applyPreferenceReadRepair(document, { targetVersion: '1.1.0' });

console.log('Read-repair changed fields:', result.applied);
console.log('Updated schema version:', result.document.metadata.schemaVersion);

function ensurePreferenceRecord(value: unknown, path: string): PreferenceRecord {
  if (!isPreferenceRecord(value)) {
    throw new Error(`${path} must be a record for this example.`);
  }
  return value;
}

function isPreferenceRecord(value: unknown): value is PreferenceRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
