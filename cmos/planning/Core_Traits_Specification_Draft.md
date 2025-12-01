# Core Traits Specification Draft
## Based on R20 and R21 Research Synthesis

**Version:** 0.2.0  
**Status:** Draft for Review (Updated with R21 Implementation Deep Dives)  
**Date:** 2025-01-XX

This document provides draft specifications for four core traits identified from the R20 and R21 research reports as foundational patterns that appear in 90-100% of applications. These traits address the complications and architectural challenges identified in the research, with implementation details from R21 deep dives.

---

## Trait 1: Auditable

**Category:** `lifecycle`  
**Priority:** Core  
**Version:** 1.0.0-draft

### Overview

Adds immutable audit trail capability to any object, recording who performed what action, when, and with what context. This trait implements the "Universal Event Quintet" pattern (Actor-Action-Entity-Context-Timestamp) for compliance and accountability.

**Research Basis:** R20.5 (Activity and Event Log Systems)

### Complications Addressed

The research identifies four distinct event logging use cases (Analytics, Audit, Observability, Activity Feeds) with divergent requirements. This trait focuses on the **Audit** use case (most foundational for compliance), with other use cases available as extension traits.

**Key Architectural Decision:** This trait implements the append-only, immutable audit log pattern. For GDPR compliance, it must support pseudonymization (see `pseudonymization_enabled` parameter).

### Schema

```yaml
schema:
  # Core Event Quintet fields
  audit_actor_id:
    type: string
    required: true
    description: "ID of the user/service/system that performed the action"
    semantic_type: user_reference
  
  audit_actor_type:
    type: enum
    enum: [user, service, system, anonymous]
    required: true
    default: user
    description: "Type of actor performing the action"
  
  audit_action:
    type: string
    required: true
    description: "Action performed in Domain.Entity.Action format (e.g., 'billing.invoice.created')"
    validation:
      pattern: "^[a-z0-9_]+\\.[a-z0-9_]+\\.[a-z0-9_]+$"
  
  audit_entity_id:
    type: string
    required: false
    description: "ID of the entity being acted upon (if different from object itself)"
  
  audit_entity_type:
    type: string
    required: false
    description: "Type of entity being acted upon"
  
  audit_timestamp:
    type: timestamp
    required: true
    description: "UTC timestamp when the action occurred"
    default: "now()"
  
  audit_observed_timestamp:
    type: timestamp
    required: false
    description: "UTC timestamp when the event was observed by the logging system"
    default: "now()"
  
  # Context payload (for compliance/verification)
  audit_context:
    type: object
    required: false
    description: "Full context payload for non-repudiation (request/response, metadata)"
    properties:
      request:
        type: object
        description: "Request payload (e.g., CloudTrail requestParameters)"
      response:
        type: object
        description: "Response payload or error message"
      metadata:
        type: object
        description: "Additional metadata (IP, user_agent, etc.)"
  
  # Pseudonymization support (GDPR compliance)
  audit_actor_pseudonym:
    type: string
    required: false
    description: "Anonymized, non-reversible ID for compliance. Set when pseudonymization_enabled=true"
  
  # Source/service identification
  audit_source:
    type: string
    required: false
    description: "Service, host, or application that generated the event (URI format)"
  
  # Outcome
  audit_status:
    type: enum
    enum: [success, failure, partial]
    required: false
    default: success
  
  audit_error:
    type: object
    required: false
    description: "Error details if status is failure"
    properties:
      code:
        type: string
      message:
        type: string
```

### Parameters

```yaml
parameters:
  - name: pseudonymization_enabled
    type: boolean
    required: false
    default: false
    description: "Enable GDPR-compliant pseudonymization (stores pseudonym instead of actor_id)"
  
  - name: include_request_response
    type: boolean
    required: false
    default: true
    description: "Include full request/response payloads in audit_context (required for SOC2/HIPAA)"
  
  - name: hash_chain_enabled
    type: boolean
    required: false
    default: false
    description: "Enable cryptographic hash chaining for verifiable integrity (advanced)"
  
  - name: retention_days
    type: number
    required: false
    default: 2555
    description: "Retention period in days (default: 7 years for compliance)"
```

### Semantics

```yaml
semantics:
  audit_action:
    semantic_type: event_name
    token_map: "event.{audit_action}"
    display_format: "human_readable"
  
  audit_actor_id:
    semantic_type: user_reference
    display_format: "user_display_name"
  
  audit_timestamp:
    semantic_type: timestamp
    display_format: "relative_time"
    timezone_aware: true
  
  audit_status:
    semantic_type: status_enum
    token_map: "status.{audit_status}"
```

### View Extensions

```yaml
view_extensions:
  - context: detail
    region: pageHeader
    component: AuditBadge
    props:
      action: "{audit_action}"
      timestamp: "{audit_timestamp}"
      status: "{audit_status}"
  
  - context: timeline
    region: main
    component: AuditTimeline
    props:
      events: "{audit_history}"
      show_context: true
```

### Dependencies

```yaml
dependencies:
  requires:
    - Identifiable  # Object must have an id field
  extends:
    - Timestamped  # Uses created_at/updated_at for correlation
```

### Tokens

```yaml
tokens:
  event:
    namespace: "--cmp-audit-event"
    properties:
      action:
        type: color
        semantic: "event.{audit_action}"
      status_success:
        type: color
        semantic: "status.success"
      status_failure:
        type: color
        semantic: "status.error"
```

### Metadata

```yaml
metadata:
  category: lifecycle
  research_source: "R20.5"
  compliance_notes: |
    - Supports SOC2, HIPAA, SOX audit requirements
    - Pseudonymization enables GDPR "Right to be Forgotten" compliance
    - Hash chaining provides verifiable integrity for legal discovery
  related_traits:
    - AnalyticsEventable (extension)
    - Observable (extension)
    - ActivityFeedable (extension)
```

### Usage Example

```yaml
# objects/Invoice.object.yaml
traits:
  - trait: Auditable
    parameters:
      include_request_response: true
      retention_days: 2555  # 7 years for financial records
```

### Implementation Notes

1. **Storage Pattern:** Append-only log. Never update or delete audit records.
2. **Pseudonymization:** When enabled, `audit_actor_id` is stored in separate PII store, `audit_actor_pseudonym` is stored in log.
3. **Hash Chaining:** If enabled, each audit record includes hash of previous record for tamper detection.
4. **Query Performance:** Audit logs should be in separate table/indexed by `audit_timestamp` and `audit_actor_id`.

---

## Trait 2: Classifiable

**Category:** `organization`  
**Priority:** Core  
**Version:** 1.0.0-draft

### Overview

Adds classification capability to objects, supporting both hierarchical taxonomies (controlled vocabularies) and flat folksonomies (user-generated tags). This trait enables content organization, product categorization, and information architecture.

**Research Basis:** R20.7 (Category, Tag, and Taxonomy Data Models)

### Complications Addressed

The research identifies two fundamentally different classification philosophies:
1. **Taxonomy** - Hierarchical, read-optimized, admin-governed
2. **Folksonomy** - Flat, write-optimized, community-governed

This trait supports both via a `classification_mode` parameter, allowing implementers to choose the appropriate storage pattern.

### Schema

```yaml
schema:
  # For both modes: M:M relationship via join table
  # The join table is: {object_type}_classifications
  # Fields: object_id, classification_id, relationship_type, sort_order
  
  # Taxonomy mode fields (hierarchical)
  primary_category_id:
    type: string
    required: false
    description: "Primary category in hierarchical taxonomy (taxonomy mode only)"
    semantic_type: category_reference
  
  category_path:
    type: string
    required: false
    description: "Materialized path for fast tree queries (e.g., '/1/5/12/')"
    validation:
      pattern: "^/[0-9]+(/[0-9]+)*/$"
  
  category_depth:
    type: number
    required: false
    description: "Depth in hierarchy (0 = root)"
    validation:
      minimum: 0
  
  # Tag mode fields (flat)
  tags:
    type: array
    items:
      type: string
    required: false
    default: []
    description: "Array of tag names (folksonomy mode, denormalized for performance)"
    validation:
      maxItems: 50  # Prevent tag spam
  
  tags_string:
    type: string
    required: false
    description: "Denormalized tag string for fast display (e.g., '<tag1><tag2>')"
  
  # Hybrid mode: both taxonomy and tags
  # (WordPress pattern - most flexible)
```

### Parameters

```yaml
parameters:
  - name: classification_mode
    type: enum
    enum: [taxonomy, tag, hybrid]
    required: true
    default: hybrid
    description: |
      taxonomy: Hierarchical, controlled vocabulary (e-commerce, knowledge bases)
      tag: Flat, user-generated tags (social platforms)
      hybrid: Support both simultaneously (WordPress pattern)
  
  - name: max_tags
    type: number
    required: false
    default: 10
    description: "Maximum number of tags allowed (prevents tag spam)"
    validation:
      minimum: 1
      maximum: 50
  
  - name: allow_user_generated_tags
    type: boolean
    required: false
    default: true
    description: "Allow users to create new tags (folksonomy) vs admin-only (taxonomy)"
  
  - name: require_primary_category
    type: boolean
    required: false
    default: false
    description: "Require at least one primary category (taxonomy mode)"
  
  - name: hierarchy_storage_model
    type: enum
    enum: [adjacency_list, materialized_path, closure_table]
    required: false
    default: materialized_path
    description: |
      adjacency_list: Simple parent_id (fast writes, slow reads)
      materialized_path: Path string (balanced, recommended)
      closure_table: Bridge table (max flexibility, high storage cost)
```

### Semantics

```yaml
semantics:
  primary_category_id:
    semantic_type: category_reference
    display_format: "category_breadcrumb"
    token_map: "category.{primary_category_id}"
  
  tags:
    semantic_type: tag_array
    display_format: "tag_cloud"
    token_map: "tag.{tag_name}"
  
  category_path:
    semantic_type: hierarchy_path
    display_format: "breadcrumb"
```

### View Extensions

```yaml
view_extensions:
  - context: list
    region: itemMeta
    component: CategoryBadge
    props:
      category_id: "{primary_category_id}"
      mode: "{classification_mode}"
  
  - context: detail
    region: sidebar
    component: ClassificationPanel
    props:
      mode: "{classification_mode}"
      categories: "{categories}"
      tags: "{tags}"
  
  - context: form
    region: main
    component: ClassificationEditor
    props:
      mode: "{classification_mode}"
      allow_user_tags: "{allow_user_generated_tags}"
```

### Dependencies

```yaml
dependencies:
  requires:
    - Identifiable  # Object must have an id for M:M relationships
```

### Tokens

```yaml
tokens:
  category:
    namespace: "--cmp-category"
    properties:
      background:
        type: color
        semantic: "category.background"
      text:
        type: color
        semantic: "category.text"
      border:
        type: color
        semantic: "category.border"
  
  tag:
    namespace: "--cmp-tag"
    properties:
      background:
        type: color
        semantic: "tag.background"
      text:
        type: color
        semantic: "tag.text"
```

### Metadata

```yaml
metadata:
  category: organization
  research_source: "R20.7"
  implementation_notes: |
    - Taxonomy mode: Use hierarchical storage (parent_id, path, or closure table)
    - Tag mode: Use simple M:M join table + denormalized tags array
    - Hybrid mode: Use WordPress pattern (terms + term_taxonomy + term_relationships)
    - SEO: slug field is critical for URL-friendly category paths
    - Governance: Folksonomy mode requires synonym mapping and spam detection tools
  related_traits:
    - Searchable (often used together)
    - Filterable (for faceted search)
```

### Usage Examples

```yaml
# E-commerce Product (Taxonomy mode)
# objects/Product.object.yaml
traits:
  - trait: Classifiable
    parameters:
      classification_mode: taxonomy
      hierarchy_storage_model: materialized_path
      require_primary_category: true
      allow_user_generated_tags: false

# Social Post (Tag mode)
# objects/Post.object.yaml
traits:
  - trait: Classifiable
    parameters:
      classification_mode: tag
      max_tags: 5
      allow_user_generated_tags: true

# CMS Article (Hybrid mode)
# objects/Article.object.yaml
traits:
  - trait: Classifiable
    parameters:
      classification_mode: hybrid
      hierarchy_storage_model: materialized_path
      max_tags: 10
      allow_user_generated_tags: true
```

### Implementation Notes

1. **Storage Decision:** The `hierarchy_storage_model` parameter determines database schema:
   - `adjacency_list`: Simple `parent_id` column
   - `materialized_path`: `path` string column (e.g., '/1/5/12/')
   - `closure_table`: Separate `category_tree` table with `ancestor_id`, `descendant_id`, `depth`

2. **Performance Optimization:** 
   - Denormalize `tags_string` for fast display (Stack Overflow pattern)
   - Denormalize `category_path` for breadcrumbs
   - Cache `tag_count` on tag objects

3. **Governance:** Folksonomy mode requires:
   - Synonym mapping (js → javascript)
   - Tag merging tools
   - Spam detection
   - These are application-level concerns, not trait concerns

4. **UI Impact:** 
   - Taxonomy mode needs tree navigation component
   - Tag mode needs autocomplete/cloud component
   - Hybrid mode needs both

---

## Trait 3: Preferenceable

**Category:** `behavioral`  
**Priority:** Core  
**Version:** 1.0.0-draft

### Overview

Adds user-level preference storage capability to the User object. Stores dynamic, high-read-frequency, low-stakes settings (theme, language, notification preferences) in a JSONB column for flexibility and performance.

**Research Basis:** R20.10 (Settings, Preferences, and Configuration Systems)

### Complications Addressed

The research identifies that a single canonical model for all configuration is an **anti-pattern**. This trait implements ONLY the **User Preference Service** pattern (JSONB storage). Enterprise Configuration and Feature Flags are infrastructure services, not object traits.

**Key Limitation:** This trait is ONLY for User-level preferences. Enterprise org-level settings and feature flags are out of scope.

### Schema

```yaml
schema:
  # Preferences stored as JSONB document
  preferences:
    type: object
    required: false
    default: {}
    description: "User preferences stored as versioned JSONB document"
    properties:
      version:
        type: number
        required: true
        default: 1
        description: "Schema version for migration support"
      
      # UI Preferences
      ui:
        type: object
        properties:
          theme:
            type: enum
            enum: [light, dark, auto]
            default: auto
          language:
            type: string
            default: "en"
            validation:
              pattern: "^[a-z]{2}(-[A-Z]{2})?$"  # ISO 639-1
          timezone:
            type: string
            default: "UTC"
            validation:
              pattern: "^[A-Za-z_/]+$"  # IANA timezone
          date_format:
            type: string
            default: "YYYY-MM-DD"
          time_format:
            type: enum
            enum: [12h, 24h]
            default: 24h
      
      # Notification Preferences (two-axis matrix)
      notifications:
        type: object
        properties:
          global_opt_out_all:
            type: boolean
            default: false
            description: "Master kill switch for all non-essential communication"
          
          channels:
            type: object
            description: "Per-channel global opt-out"
            properties:
              email:
                type: object
                properties:
                  enabled: { type: boolean, default: true }
                  global_opt_out: { type: boolean, default: false }
              push:
                type: object
                properties:
                  enabled: { type: boolean, default: true }
                  global_opt_out: { type: boolean, default: false }
              sms:
                type: object
                properties:
                  enabled: { type: boolean, default: true }
                  global_opt_out: { type: boolean, default: false }
              in_app:
                type: object
                properties:
                  enabled: { type: boolean, default: true }
                  global_opt_out: { type: boolean, default: false }
          
          categories:
            type: object
            description: "Granular Channel x Event-Type matrix"
            additionalProperties:
              type: object
              properties:
                description: { type: string }
                channels:
                  type: object
                  additionalProperties:
                    type: object
                    properties:
                      enabled: { type: boolean }
                      locked: { type: boolean, default: false }
                      description: "locked=true means system enforces (e.g., transactional emails)"
      
      # Application-specific preferences
      custom:
        type: object
        description: "Flexible key-value store for application-specific preferences"
        additionalProperties: true
  
  # Metadata for preference management
  preferences_updated_at:
    type: timestamp
    required: false
    description: "Timestamp of last preference update (for cache invalidation)"
  
  preferences_version:
    type: number
    required: false
    description: "Current version of preferences schema (for migration)"
    default: 1
```

### Parameters

```yaml
parameters:
  - name: schema_version
    type: number
    required: false
    default: 1
    description: "Current version of preferences schema (for backward compatibility)"
  
  - name: enable_notification_preferences
    type: boolean
    required: false
    default: true
    description: "Enable two-axis notification preference matrix"
  
  - name: enable_custom_preferences
    type: boolean
    required: false
    default: true
    description: "Allow application-specific custom preferences"
  
  - name: migration_strategy
    type: enum
    enum: [client_side, server_side, hybrid]
    required: false
    default: client_side
    description: |
      client_side: Application reads version and migrates in-memory
      server_side: Server handles migration on read
      hybrid: Server migrates, client validates
```

### Semantics

```yaml
semantics:
  preferences:
    semantic_type: user_preferences
    display_format: "preferences_form"
  
  preferences.ui.theme:
    semantic_type: theme_enum
    token_map: "theme.{value}"
  
  preferences.ui.language:
    semantic_type: locale_code
    display_format: "language_name"
```

### View Extensions

```yaml
view_extensions:
  - context: form
    region: main
    component: PreferencesForm
    props:
      preferences: "{preferences}"
      schema_version: "{preferences_version}"
      enable_notifications: "{enable_notification_preferences}"
  
  - context: detail
    region: sidebar
    component: PreferencesSummary
    props:
      preferences: "{preferences}"
```

### Dependencies

```yaml
dependencies:
  requires:
    - Identifiable  # Must be on User object
  conflicts_with:
    - Preferenceable  # Can only be applied once (to User)
```

### Tokens

```yaml
tokens:
  preference:
    namespace: "--cmp-preference"
    properties:
      background:
        type: color
        semantic: "preference.background"
      border:
        type: color
        semantic: "preference.border"
      active:
        type: color
        semantic: "preference.active"
```

### Metadata

```yaml
metadata:
  category: behavioral
  research_source: "R20.10"
  scope_limitations: |
    - ONLY for User-level preferences (JSONB storage)
    - Enterprise Configuration (SSO, security policies) is infrastructure, not a trait
    - Feature Flags are a separate evaluation service, not a trait
    - Notification preferences use two-axis Channel x Event-Type matrix
  implementation_notes: |
    - Storage: JSONB column in User table (PostgreSQL recommended)
    - Versioning: Include version field in document for schema evolution
    - Migration: Client-side or server-side migration based on version field
    - Performance: JSONB is queryable and indexable (GIN indexes)
    - UI Generation: JSON Schema can drive automatic form generation
  related_services:
    - Enterprise Configuration Service (infrastructure)
    - Feature Flag Service (infrastructure)
```

### Usage Example

```yaml
# objects/User.object.yaml
traits:
  - trait: Identifiable
  - trait: Timestamped
  - trait: Preferenceable
    parameters:
      schema_version: 1
      enable_notification_preferences: true
      enable_custom_preferences: true
      migration_strategy: client_side
```

### Implementation Notes

1. **Storage Pattern:** JSONB column in User table. Never use EAV (Entity-Attribute-Value) model.

2. **Schema Evolution:** 
   - Include `version` field in preferences document
   - Application code reads version and runs in-memory migration
   - Example: `if (prefs.version === 1) { prefs.new_feature = true; prefs.version = 2; }`

3. **Backward Compatibility:** 
   - Adding new preference with default value is safe
   - Never change data type or semantic meaning of existing preference
   - To change behavior: add new key, migrate clients, deprecate old key

4. **Notification Preferences:** 
   - Two-axis matrix: Channel (email, push, SMS) x Event-Type (transactional, promotional, social)
   - `locked: true` allows system to enforce policy (e.g., "must receive transactional emails")
   - Used as filter by Notification Service (preference-as-filter pattern)

5. **Query Performance:**
   - Use GIN indexes on JSONB for fast queries: `CREATE INDEX ON users USING GIN (preferences)`
   - Query example: `SELECT * FROM users WHERE preferences->'ui'->>'theme' = 'dark'`

6. **UI Generation:**
   - JSON Schema can drive automatic form generation (react-jsonschema-form, JSONForms)
   - Single source of truth: schema validates data AND generates UI

---

## Trait 4: Addressable

**Category:** `organization`  
**Priority:** Core  
**Version:** 1.0.0-draft

### Overview

Adds address and location capability to any object, supporting multi-role addresses (billing, shipping, physical) with international format support, validation lifecycle management, and geocoding integration.

**Research Basis:** R21.1 (Canonical Model Address Location Systems)

### Complications Addressed

The research identifies three axes of complexity that justify a core trait:

1. **Structural Complexity (Internationalization):** Simple 6-field model is US-centric and lossy. Global formats diverge significantly (UK PAF, Japan block-based, Germany street-name-first). UPU S42 standard requires template-based engine.

2. **Lifecycle Complexity (Validation & Enrichment):** Addresses exist on spectrum: unvalidated → validated → corrected → enriched. Validation services return complex metadata (verdict, geocode, flags) that must be preserved.

3. **Compositional Complexity (Multi-Role):** Billing vs. shipping pattern is foundational (1:N relationship). Objects need multiple addresses distinguished by role.

**Key Architectural Decision:** Address is a Value Object. The trait manages the 1:N composition pattern via role-based methods. Geocoding is stored in AddressMetadata, not in Address itself (keeps postal address model pure).

### Schema

```yaml
schema:
  # Internal structure managed by trait
  # addresses: Map<string (role), AddressableEntry>
  # AddressableEntry: { address: Address, metadata: AddressMetadata, isDefault: boolean }
  
  # Note: Address and AddressMetadata are separate Value Objects
  # The trait manages the relationship, not the schema directly
```

**Address Value Object Schema:**
```yaml
Address:
  countryCode:
    type: string
    required: true
    description: "ISO 3166-1 alpha-2 country code"
    validation:
      pattern: "^[A-Z]{2}$"
  
  postalCode:
    type: string
    required: false
    description: "Postal code, ZIP code, or pincode"
  
  administrativeArea:
    type: string
    required: false
    description: "Top-level administrative division (State, Province, Prefecture, Region)"
  
  locality:
    type: string
    required: false
    description: "City, town, village, or post town"
  
  addressLine1:
    type: string
    required: false
    description: "Primary address line (Street + House Number, PO Box, or Japanese Block)"
  
  addressLine2:
    type: string
    required: false
    description: "Secondary address line (Apartment, Suite, Unit, Building Name)"
  
  addressLine3:
    type: string
    required: false
    description: "Additional address line (C/O, Dependent Locality)"
  
  organizationName:
    type: string
    required: false
    description: "Company or organization name at this address"
  
  formatTemplateKey:
    type: string
    required: false
    description: "Key referencing UPU S42-style format template (e.g., 'JP', 'GB-PAF', 'US-PR')"
```

**AddressMetadata Schema:**
```yaml
AddressMetadata:
  validationStatus:
    type: enum
    enum: [unvalidated, valid, invalid, partial_valid]
    required: true
    default: unvalidated
  
  validationTimestamp:
    type: timestamp
    required: false
    description: "UTC timestamp of last validation attempt"
  
  validationProvider:
    type: string
    required: false
    description: "Service that provided validation (e.g., 'google-av', 'usps')"
  
  isResidential:
    type: boolean
    required: false
    description: "True if address is confirmed residential"
  
  isBusiness:
    type: boolean
    required: false
    description: "True if address is confirmed commercial"
  
  isPOBox:
    type: boolean
    required: false
    description: "True if address is a PO Box"
  
  validationFlags:
    type: object
    required: false
    description: "Key-value pairs for validation results (e.g., hasUnconfirmedComponents, hasInferredComponents)"
    additionalProperties: boolean
  
  correctedAddress:
    type: Address
    required: false
    description: "Corrected/standardized Address object from validation provider"
  
  geocode:
    type: object
    required: false
    description: "Geocode (lat/lng) associated with validated address"
    properties:
      latitude:
        type: number
      longitude:
        type: number
      precision:
        type: enum
        enum: [rooftop, range_interpolated, geometric_center, approximate]
```

### Parameters

```yaml
parameters:
  - name: enable_validation
    type: boolean
    required: false
    default: true
    description: "Enable address validation via external service"
  
  - name: validation_provider
    type: enum
    enum: [google-av, usps, smarty, ekata]
    required: false
    default: google-av
    description: "Default validation service provider"
  
  - name: store_geocode
    type: boolean
    required: false
    default: true
    description: "Store geocode (lat/lng) in AddressMetadata when available"
  
  - name: default_roles
    type: array
    items:
      type: string
    required: false
    default: [billing, shipping]
    description: "Default address roles to support"
```

### Semantics

```yaml
semantics:
  countryCode:
    semantic_type: country_code
    display_format: "country_name"
    token_map: "address.country"
  
  locality:
    semantic_type: city_name
    display_format: "city"
    token_map: "address.city"
  
  formatTemplateKey:
    semantic_type: format_template
    display_format: "hidden"
    description: "Used internally by trait for formatting logic"
```

### View Extensions

```yaml
view_extensions:
  - context: form
    region: main
    component: AddressForm
    props:
      role: "{role}"
      countryCode: "{countryCode}"
      formatTemplate: "{formatTemplateKey}"
      enableValidation: "{enable_validation}"
  
  - context: detail
    region: sidebar
    component: AddressDisplay
    props:
      role: "{role}"
      address: "{address}"
      metadata: "{metadata}"
  
  - context: list
    region: itemMeta
    component: AddressBadge
    props:
      role: "{role}"
      locality: "{locality}"
      countryCode: "{countryCode}"
```

### Trait Interface

```yaml
methods:
  - name: setAddress
    signature: setAddress(role: string, address: Address, isDefault: boolean = false): void
    description: "Adds or updates an address for a specific role (e.g., 'billing', 'shipping')"
  
  - name: getAddress
    signature: getAddress(role: string): AddressableEntry | undefined
    description: "Retrieves the address and its metadata for a specific role"
  
  - name: removeAddress
    signature: removeAddress(role: string): boolean
    description: "Removes an address for a specific role"
  
  - name: getAddresses
    signature: getAddresses(roles?: string[]): Map<string, AddressableEntry>
    description: "Returns all addresses or a filtered subset by roles"
  
  - name: getDefaultAddress
    signature: getDefaultAddress(role?: string): AddressableEntry | undefined
    description: "Gets the default address, or the default for a specific role"
  
  - name: validateAddress
    signature: validateAddress(role: string): Promise<AddressMetadata>
    description: "Triggers validation for a specific address via external API, updates metadata"
  
  - name: getFormattedAddress
    signature: getFormattedAddress(role: string, locale?: string): string
    description: "Returns postal-service-ready formatted address string using formatTemplateKey"
```

### Dependencies

```yaml
dependencies:
  requires:
    - Identifiable  # Object must have an id for M:N relationships
```

### Tokens

```yaml
tokens:
  address:
    namespace: "--cmp-address"
    properties:
      background:
        type: color
        semantic: "address.background"
      border:
        type: color
        semantic: "address.border"
      text:
        type: color
        semantic: "address.text"
```

### Metadata

```yaml
metadata:
  category: organization
  research_source: "R21.1"
  complexity_axes: |
    - Structural: International format divergence (UPU S42 templates)
    - Lifecycle: Validation and enrichment metadata
    - Compositional: Multi-role address management (billing, shipping, etc.)
  implementation_notes: |
    - Address is a Value Object (immutable)
    - AddressMetadata is associated but separate
    - Geocode stored in metadata, not address (keeps postal model pure)
    - formatTemplateKey enables international formatting via trait behavior
    - Validation is async operation via validateAddress() method
  related_services:
    - Address Validation Service (Google AV API, USPS, etc.)
    - International Format Template Service (UPU S42)
```

### Usage Example

```yaml
# objects/Customer.object.yaml
traits:
  - trait: Identifiable
  - trait: Addressable
    parameters:
      enable_validation: true
      validation_provider: google-av
      store_geocode: true
      default_roles: [billing, shipping, physical]
```

### Implementation Notes

1. **International Format Support:**
   - `formatTemplateKey` references UPU S42-style templates
   - Trait provides `getFormattedAddress()` method that uses template for correct ordering
   - Templates stored in external service or configuration

2. **Validation Lifecycle:**
   - Original user input preserved in `Address`
   - Validation results stored in `AddressMetadata.correctedAddress`
   - `validationFlags` capture verdict details (hasUnconfirmedComponents, etc.)

3. **Geocoding:**
   - Geocode stored in `AddressMetadata.geocode`, not in `Address`
   - Keeps postal address model pure (PO Boxes don't have geocodes)
   - Geocode is result of validation process, not part of address itself

4. **Multi-Role Composition:**
   - Trait manages 1:N relationship via role-based methods
   - Roles are flexible (billing, shipping, physical, warehouse, return, etc.)
   - `isDefault` flag allows default selection per role

5. **Storage Pattern:**
   - Normalized: Separate `addresses` table with `entity_id`, `entity_type`, `role`
   - Address and AddressMetadata stored as JSONB or separate tables
   - Junction table pattern: `{entity_type}_addresses` (e.g., `customer_addresses`)

---

## Cross-Trait Considerations

### Trait Composition Examples

```yaml
# Product with classification and audit trail
# objects/Product.object.yaml
traits:
  - trait: Identifiable
  - trait: Timestamped
  - trait: Classifiable
    parameters:
      classification_mode: taxonomy
      require_primary_category: true
  - trait: Auditable
    parameters:
      include_request_response: false  # Products don't need full request/response
```

```yaml
# User with preferences and audit trail
# objects/User.object.yaml
traits:
  - trait: Identifiable
  - trait: Timestamped
  - trait: Preferenceable
  - trait: Auditable
    parameters:
      pseudonymization_enabled: true  # Critical for user data
```

### Conflict Resolution

- **Preferenceable** can only be applied to User object (enforced by `conflicts_with`)
- **Classifiable** can be applied to any object (Product, Content, Asset, etc.)
- **Auditable** can be applied to any object that needs compliance tracking
- **Addressable** can be applied to any object that needs addresses (User, Organization, Order, etc.)

### Performance Considerations

1. **Auditable:** Store audit logs in separate table, indexed by `audit_timestamp` and `audit_actor_id`. Use append-only pattern.

2. **Classifiable:** 
   - Denormalize `tags_string` and `category_path` for fast reads
   - Cache tag counts on tag objects
   - Use appropriate hierarchy storage model based on read/write ratio

3. **Preferenceable:** 
   - JSONB with GIN indexes (jsonb_path_ops) for fast queries
   - Cache-Aside pattern with Redis for high-read scenarios
   - Use containment queries (@>) to leverage jsonb_path_ops index

4. **Addressable:**
   - Normalized storage: junction table pattern for multi-role addresses
   - Address and AddressMetadata as separate Value Objects
   - Cache formatted addresses for display performance

---

## Migration Path

### From Existing Systems

1. **Auditable:** 
   - If existing audit log exists, create adapter to map to canonical schema
   - Implement pseudonymization if GDPR compliance needed
   - Migrate to append-only pattern if currently mutable

2. **Classifiable:**
   - If using simple tags: migrate to tag mode
   - If using categories: migrate to taxonomy mode with appropriate storage model
   - If using both: migrate to hybrid mode (WordPress pattern)

3. **Preferenceable:**
   - If using EAV model: migrate to JSONB (one-time migration script)
   - If using separate columns: migrate to JSONB with version field
   - If using external service: consider keeping service, add trait for UI integration

4. **Addressable:**
   - If using simple address fields: migrate to Address Value Object
   - If using separate billing/shipping columns: migrate to role-based composition
   - If using geocode in address: separate to AddressMetadata

---

## Testing Requirements

### Unit Tests

Each trait must have:
- Schema contract validation
- Parameter validation
- Semantic mapping validation
- Token reference validation
- Dependency resolution tests

### Integration Tests

- Composition tests (trait combinations)
- Migration tests (schema versioning)
- Performance tests (query patterns)
- Accessibility tests (UI components)

---

## Open Questions

1. Should `Auditable` support all four event types (Analytics, Audit, Observability, Activity Feed) or only Audit?
   - **Recommendation:** Start with Audit, add others as extension traits

2. Should `Classifiable` force a storage model or allow implementer choice?
   - **Recommendation:** Allow choice via `hierarchy_storage_model` parameter

3. Should `Preferenceable` include notification preference schema or be separate?
   - **Recommendation:** Include as optional (enable_notification_preferences parameter)

4. How should Enterprise Configuration and Feature Flags be represented in OODS?
   - **Recommendation:** Infrastructure services, not traits. Document integration patterns.

5. Should Addressable support geocoding as part of Address or only in AddressMetadata?
   - **Recommendation:** Only in AddressMetadata (keeps postal address model pure, PO Boxes don't have geocodes)

6. Should Addressable trait provide international format templates or rely on external service?
   - **Recommendation:** Trait provides interface, templates managed by external service/configuration

---

## References

- R20.5: Canonical Data Model for Activity and Event Log Systems
- R20.7: Canonical Analysis of Category, Tag, and Taxonomy Data Models  
- R20.10: Foundational Report on Settings, Preferences, and Configuration Systems
- R21.1: Canonical Model Address Location Systems
- R21.2: Canonical Data Models for Authorization Systems
- R21.3: A Reference Architecture for Verifiable, Compliant, and Scalable Audit Logs
- R21.4: Deep Dive Implementation Research for the Classifiable Core Trait
- R21.5: Preferenceable Trait Implementation
- OODS Trait Engine Specification v0.1
- OODS Authoring Traits Guide

