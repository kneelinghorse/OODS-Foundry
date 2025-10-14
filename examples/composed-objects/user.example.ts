/**
 * User Example
 *
 * Demonstrates composing a User object from multiple traits:
 * - Timestamped (creation/update tracking)
 * - Ownable (ownership tracking)
 * - Taggable (tag management)
 */

import { TraitCompositor } from '../../src/core/compositor.js';
import type { TraitDefinition } from '../../src/core/trait-definition.js';

// Define the Timestamped trait
const TimestampedTrait: TraitDefinition = {
  trait: {
    name: 'Timestamped',
    version: '1.0.0',
    description: 'Adds creation and update timestamps',
    category: 'temporal',
  },
  schema: {
    created_at: {
      type: 'timestamp',
      required: true,
      description: 'When the object was created',
    },
    updated_at: {
      type: 'timestamp',
      required: true,
      description: 'When the object was last updated',
    },
  },
  semantics: {
    created_at: {
      semantic_type: 'timestamp',
      ui_hints: {
        component: 'DateDisplay',
        format: 'relative',
      },
    },
    updated_at: {
      semantic_type: 'timestamp',
      ui_hints: {
        component: 'DateDisplay',
        format: 'relative',
      },
    },
  },
  view_extensions: {
    detail: [
      {
        component: 'TimestampInfo',
        position: 'bottom',
        props: {
          showCreated: true,
          showUpdated: true,
        },
        priority: 90,
      },
    ],
  },
};

// Define the Ownable trait
const OwnableTrait: TraitDefinition = {
  trait: {
    name: 'Ownable',
    version: '1.0.0',
    description: 'Adds ownership tracking',
    category: 'ownership',
  },
  schema: {
    owner_id: {
      type: 'uuid',
      required: true,
      description: 'ID of the owner',
    },
    owner_type: {
      type: 'string',
      required: true,
      description: 'Type of owner (user, team, etc.)',
      validation: {
        enum: ['user', 'team', 'organization'],
      },
    },
  },
  semantics: {
    owner_id: {
      semantic_type: 'reference',
      ui_hints: {
        component: 'UserLink',
        referenceType: 'user',
      },
    },
  },
  view_extensions: {
    detail: [
      {
        component: 'OwnerInfo',
        position: 'top',
        props: {
          showAvatar: true,
          showName: true,
        },
        priority: 15,
      },
    ],
    list: [
      {
        component: 'OwnerAvatar',
        props: {
          size: 'sm',
        },
        priority: 5,
      },
    ],
  },
  actions: [
    {
      name: 'changeOwner',
      label: 'Change Owner',
      icon: 'user',
      confirmation: true,
    },
  ],
};

// Define the Taggable trait
const TaggableTrait: TraitDefinition = {
  trait: {
    name: 'Taggable',
    version: '1.0.0',
    description: 'Adds tag management',
    category: 'content',
  },
  schema: {
    tags: {
      type: 'array',
      required: false,
      default: [],
      description: 'Tags associated with this object',
      validation: {
        maxItems: 10,
      },
    },
  },
  semantics: {
    tags: {
      semantic_type: 'tag_array',
      ui_hints: {
        component: 'TagInput',
        allowCreate: true,
      },
    },
  },
  view_extensions: {
    list: [
      {
        component: 'TagList',
        props: {
          maxTags: 3,
          showMore: true,
        },
        priority: 30,
      },
    ],
    detail: [
      {
        component: 'TagManager',
        position: 'top',
        props: {
          editable: true,
        },
        priority: 25,
      },
    ],
  },
  actions: [
    {
      name: 'addTag',
      label: 'Add Tag',
      icon: 'tag',
    },
  ],
  tokens: {
    'tag-bg': '#e9ecef',
    'tag-color': '#495057',
    'tag-border-radius': '0.25rem',
  },
};

// Compose the User object
export function createUserExample() {
  console.log('='.repeat(80));
  console.log('USER COMPOSITION EXAMPLE');
  console.log('='.repeat(80));
  console.log('');

  const compositor = new TraitCompositor({
    trackProvenance: true,
    trackPerformance: true,
  });

  const result = compositor.compose(
    [TimestampedTrait, OwnableTrait, TaggableTrait],
    {
      id: 'user',
      name: 'User',
      schema: {
        id: { type: 'uuid', required: true },
        email: {
          type: 'email',
          required: true,
          description: 'User email address',
        },
        name: {
          type: 'string',
          required: true,
          description: 'User full name',
        },
        avatar_url: {
          type: 'url',
          required: false,
          description: 'Profile picture URL',
        },
        role: {
          type: 'string',
          required: true,
          default: 'user',
          validation: {
            enum: ['admin', 'user', 'guest'],
          },
        },
      },
    }
  );

  if (!result.success) {
    console.error('❌ Composition failed:', result.errors);
    return null;
  }

  console.log('✅ Composition successful!');
  console.log('');

  // Display specific information
  const composed = result.data!;
  console.log('SCHEMA FIELDS');
  console.log('-'.repeat(80));
  for (const [fieldName, fieldDef] of Object.entries(composed.schema)) {
    const provenance = composed.metadata.provenance.get(fieldName);
    const source = provenance ? ` (${provenance.source})` : '';
    console.log(
      `  ${fieldName}: ${fieldDef.type}${fieldDef.required ? ' [required]' : ' [optional]'}${source}`
    );
  }
  console.log('');

  console.log('VIEW EXTENSIONS');
  console.log('-'.repeat(80));
  for (const [context, extensions] of Object.entries(composed.viewExtensions)) {
    if (extensions && extensions.length > 0) {
      console.log(`  ${context}:`);
      for (const ext of extensions) {
        console.log(
          `    - ${ext.component} (priority: ${ext.priority ?? 50})`
        );
      }
    }
  }
  console.log('');

  // Generate full report
  const report = compositor.generateReport(composed);
  console.log(report);

  return composed;
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  createUserExample();
}
