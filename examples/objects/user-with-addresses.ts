import type { User } from '../../generated/objects/User';
import type { PreferenceMetadata } from '@/schemas/preferences/preference-metadata.js';
import type { PreferenceDocument } from '@/schemas/preferences/preference-document.js';
import type { AddressableEntry } from '@/traits/addressable/address-entry.js';
import { normalizeAddress } from '@/schemas/address.js';

const userAddressEntries: AddressableEntry[] = [
  {
    role: 'home',
    isDefault: true,
    updatedAt: '2025-11-17T18:30:00Z',
    address: normalizeAddress({
      countryCode: 'US',
      postalCode: '10012',
      administrativeArea: 'NY',
      locality: 'New York',
      addressLines: ['125 Greene St', 'Apt 7B'],
      formatTemplateKey: 'US',
    }),
    metadata: {
      validationStatus: 'validated',
      validationProvider: 'loqate',
      validationTimestamp: '2025-11-17T18:31:00Z',
      validationFlags: { deliverable: true },
      geocode: {
        latitude: 40.7255,
        longitude: -73.9986,
        precision: 'rooftop',
      },
    },
  },
  {
    role: 'billing',
    isDefault: false,
    updatedAt: '2025-11-17T18:42:00Z',
    address: normalizeAddress({
      countryCode: 'US',
      postalCode: '94043',
      administrativeArea: 'CA',
      locality: 'Mountain View',
      addressLines: ['1600 Amphitheatre Pkwy'],
      organizationName: 'OODS Foundry',
      formatTemplateKey: 'US',
    }),
    metadata: {
      validationStatus: 'corrected',
      validationProvider: 'google-av',
      validationTimestamp: '2025-11-17T18:43:00Z',
      validationFlags: { normalized: true },
    },
  },
  {
    role: 'shipping',
    isDefault: false,
    updatedAt: '2025-11-17T18:45:00Z',
    address: normalizeAddress({
      countryCode: 'CA',
      postalCode: 'M5V 2T6',
      administrativeArea: 'ON',
      locality: 'Toronto',
      addressLines: ['480 Front St W', 'Unit 7'],
      formatTemplateKey: 'CA',
    }),
    metadata: {
      validationStatus: 'enriched',
      validationProvider: 'canada-post',
      validationTimestamp: '2025-11-17T18:46:00Z',
      validationFlags: { crossBorderEligible: true },
    },
  },
];

const preferenceDocument: PreferenceDocument = {
  version: '2.0.0',
  preferences: {
    theme: {
      mode: 'dark',
      density: 'comfortable',
    },
    notifications: {
      channels: {
        email: { enabled: true, address: 'rayna.chen@example.com' },
        push: { enabled: true, deviceCount: 2 },
        sms: { enabled: false },
      },
      policies: {
        digest: {
          enabled: true,
          frequency: 'weekly',
          time: '08:30',
        },
      },
    },
    display: {
      timezone: 'America/New_York',
      locale: 'en-US',
    },
    privacy: {
      shareActivity: false,
      profiling: false,
      region: 'us',
    },
  },
  metadata: {
    schemaVersion: '2.0.0',
    lastUpdated: '2025-11-19T12:15:00Z',
    source: 'user',
    updatedBy: 'usr_3ba4816f',
    migrationApplied: [],
  },
};

const preferenceMetadata: PreferenceMetadata = {
  schemaVersion: '2.0.0',
  lastUpdated: '2025-11-19T12:15:00Z',
  source: 'user',
  updatedBy: 'usr_3ba4816f',
  migrationApplied: [],
};

/**
 * Example helper showing a User object with Addressable trait roles populated.
 */
export const UserWithAddressesExample: User = {
  user_id: 'usr_3ba4816f',
  name: 'Rayna Chen',
  preferred_name: 'Ray',
  description: 'Senior solutions engineer owning the brownfield migration track.',
  primary_email: 'rayna.chen@example.com',
  role: 'admin',
  status: 'active',
  state_history: [
    {
      from_state: 'invited',
      to_state: 'active',
      timestamp: '2025-09-12T10:00:00Z',
    },
  ],
  created_at: '2025-09-10T18:00:00Z',
  updated_at: '2025-11-17T18:50:00Z',
  last_event: 'profile_updated',
  last_event_at: '2025-11-17T18:49:00Z',
  timezone: 'America/New_York',
  tags: ['beta_tester', 'vip'],
  tag_count: 2,
  preference_document: preferenceDocument,
  preference_metadata: preferenceMetadata,
  preference_version: '2.0.0',
  preference_namespaces: ['theme', 'notifications', 'display', 'privacy'],
  preference_mutations: 3,
  membership_records: [],
  permission_catalog: [],
  role_catalog: [],
  role_permissions: {},
  role_hierarchy_edges: [],
  session_roles: [],
  address_roles: ['home', 'billing', 'shipping'],
  default_address_role: 'home',
  addresses: userAddressEntries,
};
