# Object Definition Authoring Guide

This guide explains how to create and maintain object definitions using the `*.object.yaml` format. Objects compose traits and add object-specific fields, providing a powerful way to build domain-specific data models.

## Overview

Object definitions follow the pattern: **extends traits + adds object-specific schema + resolves collisions + provides metadata**. This is distinct from trait definitions which provide reusable capabilities.

## Basic Structure

```yaml
object:
  name: MyObject
  version: 1.0.0
  description: Brief description of the object

traits:
  - name: Timestamped
  - name: Stateful
    alias: Lifecycle
    parameters:
      states: [draft, active, archived]

schema:
  custom_field: string
  optional_field: number?

resolutions:
  fields:
    status:
      use: Lifecycle
```

## Object Metadata

The `object` section defines core metadata about your object definition:

```yaml
object:
  name: User                    # Required: Object name
  version: 1.2.0               # Optional: Semantic version
  title: User Account          # Optional: Display title
  description: Core user record # Optional: Description
  category: identity           # Optional: Category grouping
  domain: platform            # Optional: Domain context
  status: stable              # Optional: draft|beta|stable|deprecated
  maturity: production        # Optional: Maturity level
  owners:                     # Optional: Owner emails
    - platform@company.test
  tags: [core, identity]      # Optional: Searchable tags
  extends:                    # Optional: Base object reference
    name: BaseRecord
    version: 2.1.0
    source: core/base
  docs:                       # Optional: Documentation links
    summary: User management
    url: https://docs.company.com/objects/user
    diagram: user-entity-diagram.svg
  lifecycle:                  # Optional: Lifecycle tracking
    introduced: 2024-01-15
    deprecated: null
    replacement: null
  audits:                     # Optional: Audit information
    last_reviewed: 2024-03-01
    notes: Reviewed for GDPR compliance
  links:                      # Optional: Related links
    api: /api/v1/users
    docs: /docs/objects/user
  annotations:                # Optional: Custom metadata
    draft: false
    experimental: false
```

## Trait References

The `traits` section lists traits that your object composes. Each trait can be referenced as a simple string or with detailed configuration:

### Simple Trait References

```yaml
traits:
  - Timestamped
  - Stateful
  - Taggable
```

### Detailed Trait References

```yaml
traits:
  - name: Stateful
    alias: Lifecycle           # Optional: Alias for conflict resolution
    version: 1.2.0            # Optional: Specific version
    namespace: core           # Optional: Namespace prefix
    displayName: Lifecycle    # Optional: Display name
    description: State management # Optional: Description
    optional: false           # Optional: Can be missing
    disabled: false           # Optional: Temporarily disabled
    parameters:               # Optional: Trait parameters
      states: [draft, active, archived]
      trackHistory: true
      allowRollbacks: false
    mount:                    # Optional: Mount configuration
      contexts: [detail, list]
      regions: [pageHeader, contextPanel]
      priority: 50
      when: env == "production"
    annotations:              # Optional: Custom metadata
      experimental: true
      team: platform
```

### Trait Parameterization

Traits can be parameterized with various value types:

```yaml
traits:
  - name: Configurable
    parameters:
      # Simple values
      enabled: true
      timeout: 5000
      name: "MyConfig"
      
      # Arrays
      states: [draft, active, archived]
      numbers: [1, 2, 3]
      flags: [true, false, true]
      
      # Complex objects
      thresholds:
        - label: "low"
          value: 10
        - label: "high" 
          value: 90
      
      # Nested objects
      config:
        api:
          baseUrl: "https://api.example.com"
          timeout: 30000
        ui:
          theme: "dark"
          animations: true
```

## Object Schema

The `schema` section defines object-specific fields that complement trait-provided fields:

### Field Shorthand

```yaml
schema:
  name: string                # Required string field
  email: string?              # Optional string field
  age: number                 # Required number field
  tags: string[]              # Array field
  metadata: object            # Object field
```

### Detailed Field Definitions

```yaml
schema:
  display_name:
    type: string
    required: true
    default: "Anonymous"
    description: User's display name
    validation:
      minLength: 1
      maxLength: 100
  avatar_url:
    type: string
    required: false
    description: URL to user's avatar image
    validation:
      format: uri
  timezone:
    type: string
    required: false
    default: "UTC"
    description: User's timezone
    enum: ["UTC", "EST", "PST", "GMT"]
  preferences:
    type: object
    required: false
    default: {}
    description: User preferences
    properties:
      theme:
        type: string
        enum: ["light", "dark", "auto"]
      notifications:
        type: boolean
        default: true
```

## Conflict Resolution

The `resolutions` section handles conflicts when traits and object definitions provide overlapping fields:

### Field Resolutions

```yaml
resolutions:
  fields:
    # Use trait definition
    status:
      use: Lifecycle
      
    # Use object definition  
    price:
      keep: object
      
    # Merge both definitions
    metadata:
      merge: true
      mergeStrategy: deep
      
    # Detailed resolution
    description:
      strategy: use_trait
      trait: Describable
      alias:
        Timestamped: timestamp_description
      rename:
        Describable: desc
      notes: Prefer trait description with aliasing
```

### Resolution Strategies

- **`use_trait`**: Use the trait's field definition
- **`use_object`**: Use the object's field definition  
- **`merge`**: Combine both definitions

### Semantic Resolutions

```yaml
resolutions:
  semantics:
    status:
      use: Lifecycle
    price:
      keep: object
```

### Token Resolutions

```yaml
resolutions:
  tokens:
    primary_color:
      use: Branded
    secondary_color:
      keep: object
```

### View Resolutions

```yaml
resolutions:
  views:
    detail:
      use: Detailed
    list:
      keep: object
```

## View Overrides

The `views` section customizes how the object appears in different contexts:

```yaml
views:
  detail:
    - action: add
      id: statusBadge
      component: StatusBadge
      priority: 50
      props:
        variant: success
      when: status == "active"
    - action: replace
      id: title
      component: CustomTitle
      priority: 10
  list:
    - action: add
      id: quickActions
      component: QuickActions
      priority: 100
```

### View Actions

- **`add`**: Add a new view extension
- **`replace`**: Replace an existing view extension
- **`remove`**: Remove a view extension
- **`augment`**: Enhance an existing view extension

## Additional Sections

### Semantics

```yaml
semantics:
  user_id:
    semantic_type: user_reference
    description: Reference to user entity
  created_at:
    semantic_type: timestamp
    format: iso8601
```

### Tokens

```yaml
tokens:
  user.primary: "#1f2937"
  user.secondary: "#6b7280"
  user.accent: "#3b82f6"
```

### Actions

```yaml
actions:
  - name: activate
    label: Activate User
    confirmation: true
    icon: check-circle
  - name: deactivate
    label: Deactivate User
    confirmation: true
    icon: x-circle
```

### Metadata

```yaml
metadata:
  owners:
    - platform@company.test
    - security@company.test
  steward: platform-team
  lastReviewed: 2024-03-01
  changelog:
    - version: 1.2.0
      date: 2024-02-15
      description: Added timezone support
    - version: 1.1.0
      date: 2024-01-10
      description: Added avatar support
  contacts:
    - platform@company.test
  links:
    api: /api/v1/users
    docs: /docs/objects/user
  compliance:
    gdpr: compliant
    sox: compliant
  notes: Core user entity for all platform features
```

### Annotations

```yaml
annotations:
  experimental: false
  deprecated: false
  migration_required: false
  team: platform
  sprint: 2024-Q1
```

## Example Objects

### User Object

```yaml
object:
  name: User
  version: 1.1.0
  description: Core identity record for application users
  tags: [core, identity]

traits:
  - name: Timestamped
  - name: Ownable
    alias: Ownership
  - name: Taggable
    parameters:
      tagLimit: 12

schema:
  display_name: string
  avatar_url: string?
  timezone: string?
  status:
    type: string
    required: false
    default: active
    description: Lifecycle label used in UI badges

resolutions:
  fields:
    owner_id:
      use: Ownership
      alias:
        Taggable: tag_owner_id

metadata:
  owners:
    - platform@company.test
  changelog:
    - version: 1.1.0
      description: Added timezone field and status metadata
```

### Product Object

```yaml
object:
  name: Product
  version: 1.0.0
  category: ecommerce
  tags: [catalog, ecommerce]

traits:
  - name: Timestamped
  - name: Sellable
    alias: Commerce
    parameters:
      currency: USD
      allowBackorder: false
  - name: InventoryTracked
    optional: true

schema:
  sku: string
  title: string
  description: string?
  status:
    type: string
    required: true
    default: draft
  price_override: number?

resolutions:
  fields:
    price:
      use: Commerce
    status:
      keep: object

views:
  detail:
    - action: add
      id: pricingSummary
      component: ProductPricingSummary
      priority: 30

metadata:
  owners:
    - commerce@company.test
  domain: ecommerce
```

### Subscription Object

```yaml
object:
  name: Subscription
  version: 2.0.0
  extends:
    name: RecurringContract
    version: 1.0.0
  tags: [billing, recurring]

traits:
  - name: Stateful
    alias: Lifecycle
    parameters:
      states: [future, trialing, active, paused, pending_cancellation, delinquent, terminated]
      allowRollbacks: false
  - name: Billable
    alias: Billing
    parameters:
      currency: USD
      requirePaymentMethod: true
  - Timestamped

schema:
  plan_id: string
  quantity: number
  billing_cycle: string?
  renewal_date: string?

resolutions:
  fields:
    status:
      use: Lifecycle
      alias:
        Billing: billing_status
    renewal_date:
      keep: object
  semantics:
    status:
      use: Lifecycle

views:
  detail:
    - action: replace
      id: statusBadge
      component: SubscriptionStatusBadge
      priority: 40
    - action: add
      id: renewalSummary
      component: RenewalSummary
      priority: 60

metadata:
  owners:
    - billing@company.test
  changelog:
    - version: 2.0.0
      description: Added renewal summary and lifecycle aliasing
```

## Best Practices

### Naming Conventions

- Use PascalCase for object names: `User`, `Product`, `Subscription`
- Use snake_case for field names: `display_name`, `created_at`, `user_id`
- Use descriptive aliases for traits: `Lifecycle` for `Stateful`

### Version Management

- Use semantic versioning: `1.0.0`, `1.1.0`, `2.0.0`
- Document changes in the changelog
- Mark breaking changes with major version bumps

### Conflict Resolution

- Prefer trait definitions for consistency
- Use object definitions for domain-specific requirements
- Document resolution decisions in the `notes` field

### Performance Considerations

- Keep trait lists focused and necessary
- Use `optional: true` for traits that may not always be available
- Avoid deep nesting in parameters

### Documentation

- Provide clear descriptions for all fields
- Document resolution decisions
- Include examples in metadata

## Validation

Object definitions are validated for:

- Required fields are present
- Trait references are valid
- Schema fields have proper types
- Resolution strategies are consistent
- View overrides reference valid components

## Error Handling

The parser provides detailed error messages including:

- File path and line number
- Field path for nested errors
- Specific error codes
- Suggested fixes

Common error codes:

- `MISSING_REQUIRED_FIELD`: Required field is missing
- `INVALID_FIELD_TYPE`: Field has wrong type
- `DUPLICATE_ALIAS`: Trait alias is used multiple times
- `CONFLICTING_FIELD_DEFINITION`: Schema conflicts with resolution
- `YAML_PARSE_ERROR`: YAML syntax error
- `FILE_READ_ERROR`: Cannot read file

## Integration

Object definitions integrate with:

- **Trait Engine**: For trait resolution and composition
- **Type Generator**: For TypeScript type generation
- **Registry**: For object discovery and indexing
- **Validation Pipeline**: For runtime validation
- **CLI Tools**: For object management commands
