# Authoring Traits

A comprehensive guide to creating reusable trait definitions for the OODS Trait Engine.

## Overview

Traits are reusable capabilities that objects can compose to gain functionality. Think of them as mixins or behaviors that objects "have" rather than "are". A trait defines:

- **Schema**: Data fields the trait adds to an object
- **Semantics**: How those fields should be understood and displayed
- **View Extensions**: UI components that appear when the trait is used
- **Tokens**: Design tokens for styling
- **Actions**: Behaviors the trait provides
- **State Machine**: (Optional) State transitions for stateful traits

## File Formats

Traits can be authored in two formats:

### 1. YAML Format (.yaml or .yml)

Best for simple traits and non-technical authors.

```yaml
trait:
  name: Cancellable
  version: 1.0.0
  description: Adds soft-delete/cancellation capability
  category: lifecycle

schema:
  cancelled_at:
    type: timestamp
    required: false
  cancellation_reason:
    type: string
    required: false
```

### 2. TypeScript Format (.ts)

Best for complex traits with type safety and IDE support.

```typescript
import type { TraitDefinition } from '../app/src/core/trait-definition.ts';

const CancellableTrait: TraitDefinition = {
  trait: {
    name: 'Cancellable',
    version: '1.0.0',
    description: 'Adds soft-delete/cancellation capability',
    category: 'lifecycle',
  },

  schema: {
    cancelled_at: {
      type: 'timestamp',
      required: false,
    },
    cancellation_reason: {
      type: 'string',
      required: false,
    },
  },
};

export default CancellableTrait;
```

## Required Fields

Every trait must have:

1. **trait.name** - Unique identifier (PascalCase recommended)
2. **trait.version** - Semantic version (e.g., "1.0.0")
3. **schema** - Object defining the fields this trait adds (can be empty `{}`)

## Optional Fields

### trait (metadata)

```yaml
trait:
  name: Taggable
  version: 1.0.0
  description: Adds tag/category support  # Optional
  category: organization                   # Optional
  author: OODS Team                        # Optional
  tags:                                    # Optional
    - tags
    - categorization
```

### parameters (Parameterized Traits)

For traits that need configuration:

```yaml
parameters:
  - name: tagLimit
    type: number
    required: false
    default: 10
    description: Maximum number of tags allowed

  - name: allowCustomTags
    type: boolean
    required: false
    default: true
```

**TypeScript with 'as const' pattern** (recommended for type safety):

```typescript
parameters: [
  {
    name: 'states',
    type: 'enum',
    required: true,
    enumValues: ['draft', 'active', 'archived'] as const,
  },
] as const,
```

### schema

Define the data fields your trait adds:

```yaml
schema:
  tags:
    type: array
    required: false
    default: []
    description: List of tags
    validation:
      maxItems: 10

  primary_tag:
    type: string
    required: false
    description: Main category tag
```

### semantics

Map fields to semantic types and UI hints:

```yaml
semantics:
  status:
    semantic_type: status_enum
    token_mapping: "{domain}-status-*"
    ui_hints:
      component: Badge
      color_when_true: success
      color_when_false: neutral
```

Common semantic types:
- `status_enum` - Status/state fields
- `money_field` - Currency amounts
- `timestamp_field` - Dates and times
- `email_field` - Email addresses
- `url_field` - URLs
- `boolean_flag` - True/false flags
- `rich_text` - Content fields

### view_extensions

Define UI components for different contexts. Each entry must specify a canonical region ID:

```yaml
view_extensions:
  detail:
    - id: statusBadge
      region: pageHeader
      type: section
      priority: 20
      conditions:
        - id: hasStatus
          expression: "data.status != null"
      render: StatusBadge

  list:
    - id: statusIcon
      region: main
      type: modifier
      render: StatusListDecorator
```

Supported contexts:
- `list` - Table/grid views
- `detail` - Full detail pages
- `form` - Edit/create forms
- `timeline` - Activity feeds
- `card` - Card layouts
- `inline` - Inline mentions

### tokens

Design tokens for styling:

```yaml
tokens:
  taggable-tag-bg: "#f3f4f6"
  taggable-tag-text: "#374151"
  taggable-tag-border: "#e5e7eb"
  taggable-tag-radius: "0.375rem"
```

### dependencies

Other traits this trait requires:

```yaml
dependencies:
  - Timestampable
  - Ownerable
```

Or with version constraints:

```yaml
dependencies:
  - trait: Statusable
    version: "^1.0.0"
    optional: false
```

### actions

Behaviors the trait provides:

```yaml
actions:
  - name: cancel
    label: Cancel
    icon: x-circle
    confirmation: true
    confirmationMessage: Are you sure you want to cancel?
    condition: "cancelled_at === null"

  - name: restore
    label: Restore
    icon: arrow-counterclockwise
    condition: "cancelled_at !== null"
```

### state_machine

For stateful traits:

```yaml
state_machine:
  states: [draft, active, archived]
  initial: draft
  transitions:
    - from: draft
      to: active
      trigger: publish

    - from: active
      to: archived
      trigger: archive

    - from: archived
      to: active
      trigger: restore
```

Required fields:
- `states` - Non-empty array of state names
- `initial` - Initial state (must be in states array)
- `transitions` - Array of allowed state changes

## Examples

See the `app/examples/traits/` directory for complete examples:

- Stateful.trait.yaml - Generic status with state machine
- Colorized.trait.ts - Parameterized color theming (TypeScript)
- Labelled.trait.yaml - Label and description fields

## Best Practices

1. Single Responsibility: each trait should do one thing well
2. Composition Over Inheritance: design traits to be composed together
3. Clear Naming: use descriptive, adjective-form names
4. Semantic Field Names: prefer unambiguous names
5. Provide Defaults: add sensible defaults for optional params
6. Document Everything: add descriptions for maintainability
7. Version Carefully: follow semantic versioning

## Validation Rules

The parser enforces these rules:

1. trait.name and trait.version are required
2. schema object is required (can be empty)
3. If state_machine exists, it must have states, initial, and transitions
4. states array must be non-empty
5. initial must be a string
6. Arrays fields must be arrays (parameters, dependencies, actions)
7. Object fields must be objects (semantics, view_extensions, tokens, state_machine)

## Error Messages

The parser provides detailed error messages including file path, field path, and codes. YAML syntax errors include line and column when available.

## Next Steps

1. Parse it to validate: `parseTrait('path/to/trait.yaml')`
2. Write tests for complex traits
3. Add it to your trait library
4. Compose it into objects
5. Generate types and validators (Mission B2+)
