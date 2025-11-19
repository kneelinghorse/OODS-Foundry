import { getPreferenceExample } from '@/traits/preferenceable/schema-registry.ts';
import { runDualWriteMigration } from '@/traits/preferenceable/dual-write-migrator.ts';

const document = getPreferenceExample('1.1.0');
document.preferences.notifications.channels = ['email', 'push'];

const result = runDualWriteMigration(document, { targetVersion: '2.0.0' });

console.log('Legacy schema (array):', result.legacyDocument.preferences.notifications.channels);
console.log('Next schema (map):', result.nextDocument.preferences.notifications.channels);
console.log('Change set:', result.changes);
