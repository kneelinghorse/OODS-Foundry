import type { TraitDefinition } from '../../src/core/trait-definition.ts';

export const PREFERENCEABLE_TRAIT_VERSION = '1.0.0';

const PreferenceableTrait = {
  trait: {
    name: 'Preferenceable',
    version: PREFERENCEABLE_TRAIT_VERSION,
    description:
      'User preference trait backed by JSONB storage, schema versioning, and registry-driven governance. Encodes namespaces such as theme, notifications, and display options with deterministic overrides.',
    category: 'core',
    tags: ['preferences', 'jsonb', 'schema-evolution', 'user-settings', 'notification'],
  },

  parameters: [
    {
      name: 'namespaces',
      type: 'string[]',
      required: true,
      description:
        'Allowed top-level namespaces for preference keys (theme, notifications, display, etc.).',
      default: ['theme', 'notifications', 'display'],
      validation: {
        minItems: 1,
        maxItems: 12,
        uniqueItems: true,
        items: {
          pattern: '^[a-z0-9._-]+$',
          minLength: 2,
          maxLength: 48,
        },
      },
    },
    {
      name: 'schemaVersion',
      type: 'string',
      required: true,
      description: 'Current JSON Schema version served by the registry for validation and UIs.',
      default: '1.0.0',
      validation: {
        pattern: '^\\d+\\.\\d+\\.\\d+$',
      },
    },
    {
      name: 'allowUnknownNamespaces',
      type: 'boolean',
      required: false,
      description: 'Escape hatch allowing writes outside the declared namespace allow list.',
      default: false,
    },
    {
      name: 'registryNamespace',
      type: 'string',
      required: false,
      description: 'Registry identifier used to fetch JSON Schema + UI schema bundles.',
      default: 'user-preferences',
      validation: {
        pattern: '^[a-z0-9._-]+$',
      },
    },
  ] as const,

  schema: {
    preference_document: {
      type: 'PreferenceDocument',
      required: true,
      description:
        'Normalized preference payload captured by PreferenceStore (version, preferences map, metadata). Stored as JSONB.',
      default: {
        version: '1.0.0',
        preferences: {
          theme: {
            mode: 'system',
          },
          notifications: {
            mention: {
              email: true,
              push: true,
            },
          },
        },
        metadata: {
          schemaVersion: '1.0.0',
          lastUpdated: '2025-11-18T00:00:00Z',
          source: 'system',
          migrationApplied: [],
        },
      },
    },
    preference_metadata: {
      type: 'PreferenceMetadata',
      required: true,
      description: 'Tracks schema version, lastUpdated timestamp, migration records, and source.',
    },
    preference_version: {
      type: 'string',
      required: true,
      description: 'SemVer mirror of preference_document.version for indexing and analytics.',
      validation: {
        pattern: '^\\d+\\.\\d+\\.\\d+$',
      },
    },
    preference_namespaces: {
      type: 'string[]',
      required: true,
      description: 'Materialized namespace list resolved from parameters/registry for auditing.',
      default: ['theme', 'notifications', 'display'],
    },
    preference_mutations: {
      type: 'number',
      required: false,
      description: 'Monotonic counter incremented whenever preferences mutate (invalidates caches).',
      default: 0,
      validation: {
        minimum: 0,
      },
    },
  },

  semantics: {
    preference_document: {
      semantic_type: 'preferences.document',
      token_mapping: 'tokenMap(preferences.document)',
      ui_hints: {
        component: 'PreferenceDiffPanel',
        registryNamespaceParameter: 'registryNamespace',
      },
    },
    preference_metadata: {
      semantic_type: 'preferences.metadata',
      token_mapping: 'tokenMap(preferences.metadata)',
      ui_hints: {
        component: 'PreferenceDiagnostics',
      },
    },
    preference_version: {
      semantic_type: 'preferences.version',
      token_mapping: 'tokenMap(preferences.version)',
      ui_hints: {
        component: 'PreferenceVersionBadge',
      },
    },
    preference_namespaces: {
      semantic_type: 'preferences.namespaces',
      token_mapping: 'tokenMap(preferences.namespaces)',
      ui_hints: {
        component: 'PreferenceNamespaceChips',
      },
    },
  },

  view_extensions: {
    list: [
      {
        component: 'PreferenceSummaryBadge',
        position: 'after',
        props: {
          namespacesField: 'preference_namespaces',
          versionField: 'preference_version',
        },
      },
    ],
    detail: [
      {
        component: 'PreferencePanel',
        position: 'main',
        priority: 55,
        props: {
          preferencesField: 'preference_document',
          metadataField: 'preference_metadata',
          namespaceField: 'preference_namespaces',
        },
      },
    ],
    form: [
      {
        component: 'PreferenceEditor',
        position: 'main',
        props: {
          namespacesField: 'preference_namespaces',
          documentField: 'preference_document',
          registryNamespaceParameter: 'registryNamespace',
        },
      },
    ],
    timeline: [
      {
        component: 'PreferenceTimeline',
        props: {
          metadataField: 'preference_metadata',
        },
      },
    ],
  },

  tokens: {
    'preferences.panel.bg': 'var(--sys-surface-raised)',
    'preferences.panel.border': 'var(--sys-border-strong)',
    'preferences.namespace.badge.bg': 'var(--sys-surface-muted)',
    'preferences.namespace.badge.text': 'var(--sys-text-strong)',
  },

  dependencies: [] as const,

  metadata: {
    created: '2025-11-18',
    owners: ['core@oods.systems', 'platform@oods.systems'],
    maturity: 'experimental',
    accessibility: {
      keyboard: 'PreferenceEditor supports section-by-section keyboard traversal via namespace headings.',
      screenreader:
        'PreferencePanel announces namespace and control labels via JSON Schema-provided titles + aria-describedby links.',
    },
    regionsUsed: ['list', 'detail', 'form', 'timeline'],
    examples: ['User', 'Subscription'],
    references: ['R21.5 Preferenceable Trait Implementation', 'docs/traits/preference-scope-boundaries.md'],
  },
} as const satisfies TraitDefinition;

export default PreferenceableTrait;
