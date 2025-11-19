# Preferenceable Scope Boundaries

> Source: Research Mission R21.5 — “Preferenceable Trait Implementation”

Preferenceable intentionally narrows scope to the **User Preference Service** layer of the three-service control plane:

1. **Enterprise Config Service** – tenant/organization policy, non-overridable. Examples: `security.require_mfa`, `billing.invoice_cc_bcc`. Implemented via infrastructure configs, *not* traits.
2. **User Preference Service (Preferenceable)** – user-controlled overrides (theme, notification channels, layout density, accessibility). Stored in JSONB with schema version + metadata.
3. **Feature Flag Service** – runtime gating of UI exposure. Determines whether a preference is even shown, but does not store the preference value.

## Inclusion Rules

- **Audience**: Individual user accounts or personas within a tenant.
- **Data model**: JSONB document containing `version`, `preferences`, `metadata`.
- **Validation**: JSON Schema (registry) + pg_jsonschema CHECK constraint.
- **Hierarchy**: Enterprise config ➝ User preference ➝ Application default. Preferenceable lives at the middle layer and must respect upstream overrides.
- **Namespaces**: Curated list (`theme`, `notifications`, `display`, `accessibility`, etc.) enforced via trait parameters and `PreferenceStore`.
- **Versioning**: SemVer field mandated on every document. Allows dual-migration strategy (lazy read-repair for additive changes; eager dual-write for breaking ones).

## Exclusion Rules

- **Tenant policies**: No enterprise-level toggles or config storage (handled elsewhere).
- **Feature toggles**: No LaunchDarkly/GrowthBook integration; only consumes their decisions.
- **Notification routing matrices**: Complex Channel × Event matrices are represented *as data* (nested JSON), but the actual routing logic resides in services (Mission B27.5).
- **Cache/GIN tuning**: Implemented later in sprint (B27.6). Preferenceable only exposes metadata fields to support those systems.
- **UI layout / widget definitions**: Provided by react-jsonschema-form via registry; Preferenceable exposes references but not layout code.

## Operational Expectations

- **Default precedence**: `effective_value = enterpriseOverride ?? userPreference ?? appDefault`.
- **Migrations**: Breaking changes must register an eager migration record (`strategy: "eager"`) capturing `fromVersion`, `toVersion`, `appliedAt`, `notes`.
- **Telemetry**: `preference_mutations` counter feeds cache invalidation + auditing dashboards.
- **Audit trail**: `metadata.updatedBy` + `metadata.source` differentiate system migrations from user intent.

Adhering to these boundaries keeps Preferenceable focused on user-centric overrides while allowing Enterprise Config and Feature Flags to evolve independently without polluting trait logic.
