import type { User } from '../../generated/objects/User';
import { AUTHZ_SAMPLE_DATASET, AUTHZ_SAMPLE_IDS, createSampleAuthableTrait } from '@/data/authz/sample-entitlements.js';
import type { AuthzDataset } from '@/data/authz/types.js';
import { PreferenceStore } from '@/traits/preferenceable/preference-store.js';

const authableTrait = createSampleAuthableTrait();
const membershipRecords = authableTrait.getMembershipsForUser(AUTHZ_SAMPLE_IDS.USERS.anika);
const sampleUserRecord = AUTHZ_SAMPLE_DATASET.users.find((entry) => entry.id === AUTHZ_SAMPLE_IDS.USERS.anika);

const preferenceStore = new PreferenceStore(
  {},
  {
    namespaces: ['theme', 'notifications', 'display', 'privacy'],
    schemaVersion: '2.0.0',
  }
);

preferenceStore.setPreference(['theme', 'mode'], 'dark');
preferenceStore.setPreference(['notifications', 'approvals'], {
  escalations: true,
  smsFallback: false,
});
preferenceStore.setPreference(['display', 'timezone'], 'America/New_York');
preferenceStore.setPreference(['privacy', 'region'], 'amer');

const preferenceDocument = preferenceStore.toDocument();

function cloneRolePermissions(value: AuthzDataset['rolePermissions']): Record<string, string[]> {
  return Object.fromEntries(Object.entries(value).map(([roleId, permissions]) => [roleId, [...permissions]]));
}

/**
 * User fixture demonstrating Authable + Preferenceable + Addressable composition.
 */
export const UserWithAuthableExample: User = {
  user_id: AUTHZ_SAMPLE_IDS.USERS.anika,
  name: 'Anika Bhatt',
  preferred_name: 'Anika',
  description: 'Tenant onboarding lead coordinating RBAC for new subsidiaries.',
  primary_email: 'anika.bhatt@example.com',
  role: 'owner',
  status: 'active',
  created_at: '2025-02-11T16:00:00Z',
  updated_at: '2025-11-19T13:15:00Z',
  last_event: 'role_updated',
  last_event_at: '2025-11-19T13:15:00Z',
  timezone: 'America/New_York',
  tags: ['admin', 'beta_tester'],
  tag_count: 2,
  address_roles: ['home', 'billing'],
  addresses: [],
  state_history: [
    {
      from_state: 'invited',
      to_state: 'active',
      timestamp: '2025-02-20T08:00:00Z',
    },
  ],
  preference_document: preferenceDocument,
  preference_metadata: preferenceDocument.metadata,
  preference_version: preferenceDocument.version,
  preference_namespaces: [...preferenceStore.getNamespaces()],
  preference_mutations: 4,
  membership_records: membershipRecords,
  role_catalog: authableTrait.listRoles(),
  permission_catalog: authableTrait.listPermissions(),
  role_permissions: cloneRolePermissions(AUTHZ_SAMPLE_DATASET.rolePermissions),
  role_hierarchy_edges: authableTrait.listHierarchyEdges(),
  session_roles: [...(sampleUserRecord?.sessionRoles ?? [])],
};
