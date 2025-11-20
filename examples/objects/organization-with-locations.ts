import type { Organization } from '../../generated/objects/Organization';
import type { AddressableEntry } from '@/traits/addressable/address-entry.js';
import { normalizeAddress } from '@/schemas/address.js';

const locationEntries: AddressableEntry[] = [
  {
    role: 'headquarters',
    isDefault: true,
    updatedAt: '2025-11-17T19:05:00Z',
    address: normalizeAddress({
      countryCode: 'US',
      postalCode: '94105',
      administrativeArea: 'CA',
      locality: 'San Francisco',
      addressLines: ['500 Howard St', 'Floor 4'],
      organizationName: 'OODS Foundry HQ',
    }),
    metadata: {
      validationStatus: 'validated',
      validationProvider: 'google-av',
      validationTimestamp: '2025-11-17T19:05:30Z',
      validationFlags: { deliverable: true },
      geocode: {
        latitude: 37.7898,
        longitude: -122.3971,
        precision: 'rooftop',
      },
    },
  },
  {
    role: 'office',
    isDefault: false,
    updatedAt: '2025-11-17T19:06:00Z',
    address: normalizeAddress({
      countryCode: 'IE',
      postalCode: 'D02',
      administrativeArea: 'Leinster',
      locality: 'Dublin',
      addressLines: ['2 Grand Canal Square'],
      organizationName: 'OODS EMEA Hub',
    }),
    metadata: {
      validationStatus: 'enriched',
      validationProvider: 'loqate',
      validationTimestamp: '2025-11-17T19:06:30Z',
      validationFlags: { timezoneAligned: true },
    },
  },
  {
    role: 'warehouse',
    isDefault: false,
    updatedAt: '2025-11-17T19:07:00Z',
    address: normalizeAddress({
      countryCode: 'US',
      postalCode: '60608',
      administrativeArea: 'IL',
      locality: 'Chicago',
      addressLines: ['1325 W 16th St'],
      organizationName: 'OODS Logistics',
    }),
    metadata: {
      validationStatus: 'validated',
      validationProvider: 'uship',
      validationTimestamp: '2025-11-17T19:07:30Z',
      validationFlags: { loadingDock: true },
    },
  },
  {
    role: 'branch',
    isDefault: false,
    updatedAt: '2025-11-17T19:08:00Z',
    address: normalizeAddress({
      countryCode: 'JP',
      postalCode: '150-0002',
      administrativeArea: 'Tokyo',
      locality: 'Shibuya',
      addressLines: ['1-19-8 Jinnan'],
      organizationName: 'OODS APAC',
    }),
    metadata: {
      validationStatus: 'unvalidated',
      validationProvider: 'manual-entry',
      validationTimestamp: '2025-11-17T19:09:00Z',
      validationFlags: { needsReview: true },
    },
  },
];

/**
 * Example organization snapshot showing core + Addressable trait parity.
 */
export const OrganizationWithLocationsExample: Organization = {
  organization_id: 'org_a94de110',
  owner_id: 'org_platform_root',
  owner_type: 'platform',
  plan_tier: 'enterprise',
  billing_status: 'good_standing',
  domain: 'oods-foundry.example',
  label: 'OODS Foundry',
  description: 'Multi-region enterprise tenant with branch fulfilment centers.',
  status: 'active',
  state_history: [
    {
      from_state: 'onboarding',
      to_state: 'active',
      timestamp: '2025-05-18T16:30:00Z',
    },
  ],
  created_at: '2025-04-01T08:00:00Z',
  updated_at: '2025-11-17T19:09:00Z',
  last_event: 'plan_upgraded',
  last_event_at: '2025-11-10T12:15:00Z',
  tags: ['strategic', 'enterprise'],
  tag_count: 2,
  billing_contact_email: 'billing@oods-foundry.example',
  data_residency: 'us',
  employee_count: 950,
  address_roles: ['headquarters', 'office', 'warehouse', 'branch'],
  default_address_role: 'headquarters',
  addresses: locationEntries,
  membership_records: [],
  role_catalog: [],
  permission_catalog: [],
  role_permissions: {},
  role_hierarchy_edges: [],
  session_roles: [],
};
