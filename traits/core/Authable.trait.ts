import type { TraitDefinition } from '../../src/core/trait-definition.ts';

export const AUTHABLE_TRAIT_VERSION = '1.0.0';

const AuthableTrait = {
  trait: {
    name: 'Authable',
    version: AUTHABLE_TRAIT_VERSION,
    description:
      'Role-based access control extension pack built on the R21.2 membership pattern. Encodes roles, permissions, memberships, and hierarchy edges for tenant-aware RBAC.',
    category: 'core',
    tags: ['authorization', 'rbac', 'membership', 'saas', 'security'],
  },

  parameters: [
    {
      name: 'defaultRoleId',
      type: 'string',
      required: false,
      description:
        'Role identifier applied when provisioning new tenants without explicit role assignments (R21.2 Part 2.3).',
      validation: {
        pattern: '^[0-9a-fA-F-]{32,36}$',
      },
    },
    {
      name: 'hierarchyDepthLimit',
      type: 'number',
      required: false,
      description: 'Maximum recursive depth when traversing role hierarchies for permission rollups.',
      default: 5,
      validation: {
        minimum: 1,
        maximum: 10,
      },
    },
  ] as const,

  schema: {
    role_catalog: {
      type: 'AuthzRoleDocument[]',
      required: true,
      description:
        'Canonical RBAC role entries mirroring R21.2 Part 4.2 TABLE 1. Serves as the "roles" table for the extension pack.',
      default: [],
    },
    permission_catalog: {
      type: 'AuthzPermissionDocument[]',
      required: true,
      description: 'Atomic operations (resource:action) captured in TABLE 2 of R21.2.',
      default: [],
    },
    role_permissions: {
      type: 'Record<string, string[]>',
      required: true,
      description: 'Junction mapping from role_id → [permission_id] representing TABLE 3.',
      default: {},
    },
    membership_records: {
      type: 'AuthzMembershipDocument[]',
      required: true,
      description:
        'Membership records (user_id, organization_id, role_id) enforcing UNIQUE triples per R21.2 Part 2.2.',
      default: [],
    },
    role_hierarchy_edges: {
      type: 'AuthzRoleHierarchyEdge[]',
      required: false,
      description: 'Adjacency list edges capturing parent→child inheritance (Part 3.1).',
      default: [],
    },
    session_roles: {
      type: 'string[]',
      required: false,
      description: 'Materialized role list for the current request context (used by guardrail middleware).',
      default: [],
    },
  },

  semantics: {
    membership_records: {
      semantic_type: 'authorization.memberships',
      token_mapping: 'tokenMap(authorization.memberships)',
      ui_hints: {
        component: 'MembershipMatrix',
        uniqueConstraint: 'user_id+organization_id+role_id',
      },
    },
    role_catalog: {
      semantic_type: 'authorization.roles',
      token_mapping: 'tokenMap(authorization.roles)',
      ui_hints: {
        component: 'RoleCatalogPanel',
      },
    },
    permission_catalog: {
      semantic_type: 'authorization.permissions',
      token_mapping: 'tokenMap(authorization.permissions)',
      ui_hints: {
        component: 'PermissionList',
      },
    },
  },

  view_extensions: {
    list: [
      {
        component: 'RoleBadgeList',
        position: 'after',
        props: {
          rolesField: 'session_roles',
          fallbackRoleParameter: 'defaultRoleId',
        },
      },
    ],
    detail: [
      {
        component: 'MembershipPanel',
        position: 'main',
        priority: 75,
        props: {
          membershipsField: 'membership_records',
          hierarchyField: 'role_hierarchy_edges',
          roleField: 'role_catalog',
          permissionField: 'permission_catalog',
        },
      },
    ],
    form: [
      {
        component: 'RoleAssignmentForm',
        position: 'main',
        props: {
          availableRolesField: 'role_catalog',
          membershipField: 'membership_records',
          defaultRoleParameter: 'defaultRoleId',
        },
      },
    ],
    timeline: [
      {
        component: 'MembershipAuditTimeline',
        props: {
          field: 'membership_records',
        },
      },
    ],
  },

  tokens: {
    'auth.roles.badge.bg': 'var(--sys-surface-neutral)',
    'auth.roles.badge.text': 'var(--sys-text-strong)',
    'auth.membership.card.border': 'var(--sys-border-strong)',
    'auth.membership.card.bg': 'var(--sys-surface-raised)',
  },

  dependencies: [] as const,

  metadata: {
    created: '2025-11-19',
    owners: ['security@oods.systems', 'platform@oods.systems'],
    maturity: 'experimental',
    accessibility: {
      keyboard: 'RoleAssignmentForm keeps role filter + add/remove buttons in a linear tab order.',
      screenreader: 'MembershipPanel announces role counts per organization and surfaces unique constraint violations.',
    },
    regionsUsed: ['list', 'detail', 'form', 'timeline'],
    examples: ['User', 'Organization'],
    references: ['R21.2 Canonical Data Models for Authorization Systems'],
  },
} as const satisfies TraitDefinition;

export default AuthableTrait;
