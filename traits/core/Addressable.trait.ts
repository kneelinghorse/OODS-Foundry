import type { TraitDefinition } from '../../src/core/trait-definition.ts';

export const DEFAULT_ADDRESS_ROLES = ['billing', 'shipping'] as const;

const AddressableTrait = {
  trait: {
    name: 'Addressable',
    version: '1.0.0',
    description:
      'Canonical multi-role address trait with validation metadata, geocoding support, and role-based accessors.',
    category: 'core',
    tags: ['address', 'location', 'validation', 'delivery'],
  },

  parameters: [
    {
      name: 'roles',
      type: 'string[]',
      required: true,
      description: 'Ordered list of supported address roles (billing, shipping, warehouse, etc.).',
      default: DEFAULT_ADDRESS_ROLES,
      validation: {
        minItems: 1,
        maxItems: 16,
        uniqueItems: true,
        items: {
          pattern: '^[a-z0-9._-]+$',
          minLength: 2,
          maxLength: 32,
        },
      },
    },
    {
      name: 'defaultRole',
      type: 'string',
      required: false,
      description: 'Preferred role returned when no explicit role is supplied.',
      validation: {
        enumFromParameter: 'roles',
      },
    },
    {
      name: 'allowDynamicRoles',
      type: 'boolean',
      required: false,
      description: 'Allow runtime creation of roles not predeclared in the roles parameter.',
      default: false,
    },
  ] as const,

  schema: {
    address_roles: {
      type: 'string[]',
      required: true,
      description: 'Ordered list of roles that currently have address entries.',
      default: [],
    },
    default_address_role: {
      type: 'string',
      required: false,
      description: 'Role surfaced by default UI contexts (list badges, detail callouts).',
      validation: {
        enumFromParameter: 'roles',
      },
    },
    addresses: {
      type: 'AddressableEntry[]',
      required: false,
      description: 'Collection of { role, address, metadata } tuples keyed by role.',
      default: [],
    },
  },

  semantics: {
    addresses: {
      semantic_type: 'location.address.collection',
      token_mapping: 'tokenMap(location.address.collection)',
      ui_hints: {
        component: 'AddressCollection',
        roleParameter: 'roles',
        defaultRoleField: 'default_address_role',
      },
    },
    default_address_role: {
      semantic_type: 'location.address.default_role',
      token_mapping: 'tokenMap(location.address.default_role)',
      ui_hints: {
        component: 'AddressRoleBadge',
        parameterSource: 'defaultRole',
      },
    },
    address_roles: {
      semantic_type: 'location.address.roles',
      token_mapping: 'tokenMap(location.address.roles)',
      ui_hints: {
        component: 'AddressRolePills',
      },
    },
  },

  view_extensions: {
    list: [
      {
        component: 'AddressSummaryBadge',
        position: 'after',
        props: {
          field: 'default_address_role',
        },
      },
    ],
    detail: [
      {
        component: 'AddressCollectionPanel',
        position: 'main',
        priority: 60,
        props: {
          field: 'addresses',
          roleField: 'address_roles',
          defaultRoleField: 'default_address_role',
          roleParameter: 'roles',
        },
      },
    ],
    form: [
      {
        component: 'AddressEditor',
        position: 'top',
        props: {
          field: 'addresses',
          roleParameter: 'roles',
          allowDynamicParameter: 'allowDynamicRoles',
          defaultRoleField: 'default_address_role',
        },
      },
    ],
    timeline: [
      {
        component: 'AddressValidationTimeline',
        props: {
          field: 'addresses',
        },
      },
    ],
  },

  tokens: {
    'location.address.card.bg': 'var(--sys-surface-raised)',
    'location.address.card.border': 'var(--sys-border-subtle)',
    'location.address.role.text': 'var(--sys-text-muted)',
  },

  dependencies: [] as const,

  metadata: {
    created: '2025-11-17',
    owners: ['core@oods.systems', 'platform@oods.systems'],
    maturity: 'experimental',
    accessibility: {
      keyboard: 'AddressEditor keeps focus order aligned with field order.',
      screenreader: 'AddressCollection exposes headings per role with validation hints.',
    },
    regionsUsed: ['list', 'detail', 'form', 'timeline'],
    examples: ['User', 'Organization'],
    references: ['R21.1 Canonical Model for Address/Location Systems'],
  },
} as const satisfies TraitDefinition;

export default AddressableTrait;
