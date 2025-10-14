# Universal Quintet Composition Reference

Mission **B6 – Universal Quintet Implementation** establishes the canonical object definitions for the five foundational entities that appear across product ecosystems. Each object composes 3–5 Sprint 01 traits, introduces object-specific schema, and emits provenance-aware TypeScript types through the object generator.

## Trait Additions

- **Timestampable** (`traits/lifecycle/Timestampable.trait.yaml`): Captures created/updated timestamps with lifecycle event context.
- **Ownerable** (`traits/structural/Ownerable.trait.yaml`): Links entities to governing principals with transfer auditing.
- **Priceable** (`traits/financial/Priceable.trait.yaml`): Provides monetization metadata (currency, pricing model, billing cadence).

Associated parameter schemas live under `schemas/traits/*.parameters.schema.json`.

## Object Composition Summaries

### User (`objects/core/User.object.yaml`)
- **Traits**: `Labelled`, `Taggable`, `Stateful`, `Timestampable`, `Archivable`
- **Key trait parameters**
  - `Stateful.states`: invited → active → suspended → deactivated (`initialState: invited`)
  - `Taggable.allowedTags`: admin, beta_tester, vip, suspended
  - `Timestampable.recordedEvents`: created, profile_updated, status_changed, role_updated
  - `Archivable.gracePeriodDays`: 60, `retainHistory: true`
- **Object-only schema**
  - `user_id`, `primary_email`, `role`, `auth_provider`, `preferred_name`, `avatar_url`, `timezone`, `mfa_enrolled`, `email_verified`
- **Notes**
  - Role and auth provider enumerations preserve literal unions in generated types.
  - Archival metadata flows from the trait; optional datetime fields emit as `string | null`.

### Organization (`objects/core/Organization.object.yaml`)
- **Traits**: `Labelled`, `Stateful`, `Ownerable`, `Timestampable`, `Taggable`
- **Key trait parameters**
  - `Stateful.states`: prospect → onboarding → active → churned
  - `Ownerable.ownerTypes`: parent_organization, reseller, platform (`primaryOwnerType: parent_organization`)
  - `Taggable.allowedTags`: enterprise, smb, nonprofit, startup, strategic
- **Object-only schema**
  - `organization_id`, `domain`, `plan_tier`, `billing_status`, `industry`, `employee_count`, `billing_contact_email`, `data_residency`
- **Notes**
  - Domain uses hostname validation; plan tier and billing status unions surface in generated declarations.

### Product (`objects/core/Product.object.yaml`)
- **Traits**: `Labelled`, `Stateful`, `Timestampable`, `Priceable`, `Taggable`
- **Key trait parameters**
  - `Priceable.supportedCurrencies`: USD, EUR, GBP, AUD (`pricingModels`: one_time, subscription, usage_based)
  - `Taggable.allowedTags`: new_release, beta, deprecated, bundle, featured, add_on
- **Object-only schema**
  - `product_id`, `sku`, `inventory_status`, `release_channel`, `requires_subscription`, `support_level`, `summary_blurb`
- **Notes**
  - Inventory and release channel enums produce literal unions.
  - Requires subscription defaults to `false` allowing stricter type inference in downstream consumers.

### Transaction (`objects/core/Transaction.object.yaml`)
- **Traits**: `Stateful`, `Timestampable`, `Priceable`, `Cancellable`, `Archivable`
- **Key trait parameters**
  - `Stateful.states`: pending → authorized → settled → failed → refunded
  - `Cancellable.allowedReasons`: customer_request, suspected_fraud, duplicate_charge, payment_method_error
  - `Archivable.gracePeriodDays`: 365, `restoreWindowDays`: 30
- **Object-only schema**
  - `transaction_id`, `user_id`, `organization_id`, `occurred_at`, `payment_method`, `channel`, `payment_reference`, `risk_score`
- **Notes**
  - Monetary fields (`unit_amount_cents`, `currency`, `tax_behavior`) originate from `Priceable` with union-safe parameter mapping.
  - Cancellation metadata surfaces literal unions for reason codes.

### Relationship (`objects/core/Relationship.object.yaml`)
- **Traits**: `Labelled`, `Stateful`, `Timestampable`, `Ownerable`, `Taggable`
- **Key trait parameters**
  - `Taggable` supports custom tagging with seed list: primary, secondary, inferred, manual, pending_review
  - `Ownerable.ownerTypes`: organization, team, platform (`allowTransfer: true`)
- **Object-only schema**
  - `relationship_id`, `source_id`, `target_id`, `relationship_type`, `direction`, `strength`, `origin_source`, `is_bidirectional`
- **Notes**
  - Relationship type enum (membership, ownership, follows, depends_on, references) powers graph traversal.
  - Direction defaults to `bidirectional` while `is_bidirectional` boolean exposes quick flag checks.

## Type Generation

- `npm run generate:objects -- --objects objects/core` produces declarations under `generated/objects/`.
- Generated interfaces preserve literal unions for status fields, plan tiers, pricing enums, and cancellation reason codes.
- Nullability markers in traits (e.g., `datetime?`) emit as `string | null`, matching runtime expectations.
- `generated/objects/index.ts` re-exports `Organization`, `Product`, `Relationship`, `Transaction`, and `User`.

## Validation & Testing

- Added `tests/integration/universal-quintet-objects.integration.test.ts` to compose each object, verify provenance, and assert generated unions.
- `npm run test:integration` exercises canonical trait stacks plus the new object registry flow.
- Parameter schemas for new traits ensure AJV validation coverage via `ParameterValidator`.

## Operational Notes

- CLI defaults: `generate:objects` now prioritises `objects/core` when canonical definitions exist; pass `--objects` to include example catalogs.
- `registry:list` automatically includes `objects/core` (when present) alongside existing example directories.
- Future missions should append documentation to this file when extending canonical objects or adding domain packs.
