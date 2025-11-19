import { getPreferenceExample } from '@/traits/preferenceable/schema-registry.ts';
import { applyPreferenceReadRepair } from '@/traits/preferenceable/read-repair.ts';

const document = getPreferenceExample('1.0.0');
// Simulate a user that predates the high-contrast + digest frequency fields.
delete (document.preferences.theme as any).highContrast;
delete (document.preferences.notifications.digest as any).frequency;

const result = applyPreferenceReadRepair(document, { targetVersion: '1.1.0' });

console.log('Read-repair changed fields:', result.applied);
console.log('Updated schema version:', result.document.metadata.schemaVersion);
