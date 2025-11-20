import type { Organization } from '../../generated/objects/Organization';
import { OrganizationWithLocationsExample } from './organization-with-locations';
import { AUTHZ_SAMPLE_DATASET, AUTHZ_SAMPLE_IDS, createSampleAuthableTrait } from '@/data/authz/sample-entitlements.js';
import type { AuthzDataset } from '@/data/authz/types.js';

const authableTrait = createSampleAuthableTrait();
const membershipRecords = authableTrait.getMembershipsForOrganization(AUTHZ_SAMPLE_IDS.ORGS.atlas);

function cloneRolePermissions(value: AuthzDataset['rolePermissions']): Record<string, string[]> {
  return Object.fromEntries(Object.entries(value).map(([roleId, permissions]) => [roleId, [...permissions]]));
}

/**
 * Organization fixture demonstrating Addressable + Authable composition.
 */
export const OrganizationWithAuthableExample: Organization = {
  ...OrganizationWithLocationsExample,
  organization_id: AUTHZ_SAMPLE_IDS.ORGS.atlas,
  label: 'Atlas FinOps',
  description: 'Multi-region enterprise tenant with strict RBAC governance.',
  domain: 'atlas.example',
  plan_tier: 'enterprise',
  billing_status: 'good_standing',
  status: 'active',
  employee_count: 1200,
  tags: ['enterprise', 'strategic'],
  tag_count: 2,
  membership_records: membershipRecords,
  role_catalog: authableTrait.listRoles(),
  permission_catalog: authableTrait.listPermissions(),
  role_permissions: cloneRolePermissions(AUTHZ_SAMPLE_DATASET.rolePermissions),
  role_hierarchy_edges: authableTrait.listHierarchyEdges(),
  session_roles: [],
};
