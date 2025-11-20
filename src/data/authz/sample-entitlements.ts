import { AuthableTrait } from '@/traits/authz/authz-trait.js';

import type { AuthzDataset } from './types.js';

const ROLE_IDS = {
  owner: '11111111-1111-4111-8111-111111111111',
  approver: '22222222-2222-4222-8222-222222222222',
  editor: '33333333-3333-4333-8333-333333333333',
} as const;

const PERMISSION_IDS = {
  manageOrg: 'aaaa1111-1111-4111-8111-aaaaaaaaaaaa',
  inviteUser: 'bbbb1111-1111-4111-8111-bbbbbbbbbbbb',
  documentCreate: 'cccc1111-1111-4111-8111-cccccccccccc',
  documentApprove: 'dddd1111-1111-4111-8111-dddddddddddd',
  documentRead: 'eeee1111-1111-4111-8111-eeeeeeeeeeee',
} as const;

const USER_IDS = {
  anika: '0f0fa0a0-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  milo: '0f0fb0b0-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  sunny: '0f0fc0c0-cccc-4ccc-8ccc-cccccccccccc',
} as const;

const ORG_IDS = {
  atlas: '7aa0b813-eca4-4e14-9f3c-9b98b16d6c91',
  northwind: '2250ff13-0b42-42a4-b571-ebc9d8a35e91',
} as const;

export const AUTHZ_SAMPLE_DATASET: AuthzDataset = {
  roles: [
    {
      id: ROLE_IDS.owner,
      name: 'Owner',
      description: 'Full tenant access + invoice approval (R21.2 Table 1).',
    },
    {
      id: ROLE_IDS.approver,
      name: 'Approver',
      description: 'Workflow approver for compliance-sensitive documents.',
    },
    {
      id: ROLE_IDS.editor,
      name: 'Editor',
      description: 'Contributor allowed to create + update documents in scope.',
    },
  ],
  permissions: [
    {
      id: PERMISSION_IDS.manageOrg,
      name: 'org:manage',
      description: 'Manage tenant metadata + lifecycle states.',
      resource_type: 'organization',
    },
    {
      id: PERMISSION_IDS.inviteUser,
      name: 'user:invite',
      description: 'Invite and deactivate tenant members.',
      resource_type: 'user',
    },
    {
      id: PERMISSION_IDS.documentCreate,
      name: 'document:create',
      description: 'Create workspace documents.',
      resource_type: 'document',
    },
    {
      id: PERMISSION_IDS.documentApprove,
      name: 'document:approve',
      description: 'Approve workflow steps and mark controls complete.',
      resource_type: 'document',
    },
    {
      id: PERMISSION_IDS.documentRead,
      name: 'document:read',
      description: 'Read workspace documents.',
      resource_type: 'document',
    },
  ],
  rolePermissions: {
    [ROLE_IDS.owner]: [
      PERMISSION_IDS.manageOrg,
      PERMISSION_IDS.inviteUser,
      PERMISSION_IDS.documentCreate,
      PERMISSION_IDS.documentApprove,
      PERMISSION_IDS.documentRead,
    ],
    [ROLE_IDS.approver]: [
      PERMISSION_IDS.documentApprove,
      PERMISSION_IDS.documentRead,
    ],
    [ROLE_IDS.editor]: [
      PERMISSION_IDS.documentCreate,
      PERMISSION_IDS.documentRead,
    ],
  },
  roleHierarchy: [
    {
      parent_role_id: ROLE_IDS.owner,
      child_role_id: ROLE_IDS.approver,
      depth: 1,
    },
    {
      parent_role_id: ROLE_IDS.approver,
      child_role_id: ROLE_IDS.editor,
      depth: 2,
    },
  ],
  memberships: [
    {
      id: '6ab15d05-bf05-4ccf-a4b9-89f7f2569dd1',
      user_id: USER_IDS.anika,
      organization_id: ORG_IDS.atlas,
      role_id: ROLE_IDS.owner,
      created_at: '2025-10-01T08:05:00Z',
      updated_at: '2025-11-19T13:15:00Z',
    },
    {
      id: '4f66d868-1323-4b53-908f-a3149d1fd468',
      user_id: USER_IDS.anika,
      organization_id: ORG_IDS.northwind,
      role_id: ROLE_IDS.approver,
      created_at: '2025-10-12T09:22:00Z',
      updated_at: '2025-11-18T17:15:00Z',
    },
    {
      id: 'e30d607f-b5f3-4f11-a40b-4dfbd56f4df6',
      user_id: USER_IDS.milo,
      organization_id: ORG_IDS.atlas,
      role_id: '99999999-9999-4999-8999-999999999999',
      created_at: '2025-09-05T14:04:00Z',
      updated_at: '2025-10-01T14:04:00Z',
    },
  ],
  users: [
    {
      id: USER_IDS.anika,
      name: 'Anika Bhatt',
      preferredName: 'Anika',
      email: 'anika.bhatt@example.com',
      organizationIds: [ORG_IDS.atlas, ORG_IDS.northwind],
      sessionRoles: ['Owner', 'Approver'],
    },
    {
      id: USER_IDS.milo,
      name: 'Milo Park',
      email: 'milo.park@example.com',
      organizationIds: [ORG_IDS.atlas],
    },
    {
      id: USER_IDS.sunny,
      name: 'Sunny Ekpo',
      email: 'sunny.ekpo@example.com',
      organizationIds: [ORG_IDS.northwind],
    },
  ],
  organizations: [
    {
      id: ORG_IDS.atlas,
      name: 'Atlas FinOps',
      label: 'Atlas',
      domain: 'atlas.example',
      region: 'us-west-2',
    },
    {
      id: ORG_IDS.northwind,
      name: 'Northwind Research',
      label: 'Northwind',
      domain: 'northwind.example',
      region: 'us-east-1',
    },
  ],
} as const;

export function createSampleAuthableTrait(): AuthableTrait {
  return new AuthableTrait({
    roleCatalog: AUTHZ_SAMPLE_DATASET.roles,
    permissionCatalog: AUTHZ_SAMPLE_DATASET.permissions,
    rolePermissions: AUTHZ_SAMPLE_DATASET.rolePermissions,
    roleHierarchyEdges: AUTHZ_SAMPLE_DATASET.roleHierarchy,
    memberships: AUTHZ_SAMPLE_DATASET.memberships,
  });
}

export const AUTHZ_SAMPLE_IDS = {
  USERS: USER_IDS,
  ORGS: ORG_IDS,
  ROLES: ROLE_IDS,
} as const;
