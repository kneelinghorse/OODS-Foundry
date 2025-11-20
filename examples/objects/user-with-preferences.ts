import type { User } from '../../generated/objects/User';
import { PreferenceStore } from '@/traits/preferenceable/preference-store.js';

const store = new PreferenceStore(
  {},
  {
    namespaces: ['theme', 'notifications', 'display', 'privacy'],
    schemaVersion: '2.0.0',
  }
);

store.setPreference(['theme', 'mode'], 'system');
store.setPreference(['theme', 'density'], 'compact');
store.setPreference(['notifications', 'channels'], {
  email: { enabled: true, address: 'keon.wu@example.com' },
  push: { enabled: true, deviceCount: 1 },
  sms: { enabled: false },
});
store.setPreference(['notifications', 'policies', 'digest'], {
  enabled: true,
  frequency: 'daily',
  time: '07:30',
});
store.setPreference(['display', 'timezone'], 'America/Los_Angeles');
store.setPreference(['display', 'locale'], 'en-US');
store.setPreference(['privacy'], {
  shareActivity: true,
  profiling: false,
  region: 'apac',
});

const preferenceDocument = store.toDocument();

/**
 * Example helper showing a User object enriched with Preferenceable data.
 */
export const UserWithPreferencesExample: User = {
  user_id: 'usr_pref_a21',
  name: 'Keon Wu',
  description: 'Regional success manager piloting adaptive notification surfaces.',
  preferred_name: 'Keon',
  primary_email: 'keon.wu@example.com',
  role: 'end_user',
  status: 'active',
  created_at: '2025-03-01T15:00:00Z',
  updated_at: '2025-11-18T20:10:00Z',
  last_event: 'profile_updated',
  last_event_at: '2025-11-18T20:09:40Z',
  timezone: 'America/Los_Angeles',
  tags: ['beta_tester'],
  tag_count: 1,
  address_roles: [],
  state_history: [
    {
      from_state: 'invited',
      to_state: 'active',
      timestamp: '2025-03-02T08:00:00Z',
    },
  ],
  preference_document: preferenceDocument,
  preference_metadata: preferenceDocument.metadata,
  preference_version: preferenceDocument.version,
  preference_namespaces: [...store.getNamespaces()],
  preference_mutations: 5,
  membership_records: [],
  permission_catalog: [],
  role_catalog: [],
  role_permissions: {},
  role_hierarchy_edges: [],
  session_roles: [],
};
