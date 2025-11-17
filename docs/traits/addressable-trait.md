# Addressable Trait

> Canonical multi-role address capability built from the R21.1 research track. Addressable treats structural formats, validation metadata, and compositional role management as a single trait rather than a bespoke schema per product.

## Why Addressable?

1. **Structural diversity** – Country formats diverge (UPU S42 templates, Japan block notation, UK PAF, etc.). Addressable stores normalized fields (`countryCode`, `administrativeArea`, `locality`) plus immutable `addressLines` and a `formatTemplateKey` that hooks into the formatting engine (B25.2).
2. **Lifecycle & metadata** – Every validation provider (Google AV, USPS, Loqate) returns rich metadata. `AddressMetadata` encodes validation status, timestamps, provider IDs, deliverability flags, corrected addresses, and geocode snapshots.
3. **Compositional multi-role** – Most objects need multiple addresses (billing, shipping, warehouse, HQ). Addressable standardizes this map via `AddressableEntry` and trait-level getters.

## Canonical Schemas

### `Address`

Defined in [`src/schemas/address.ts`](../../src/schemas/address.ts) and exported for external tooling via [`generated/types/address.d.ts`](../../generated/types/address.d.ts).

| Field | Description |
| --- | --- |
| `countryCode` | ISO 3166-1 alpha-2 (upper case) |
| `postalCode` | Postal/ZIP/PIN code |
| `administrativeArea` | State/Province/Prefecture |
| `locality` | City/Town/Post town |
| `addressLines` | Ordered lines (line1/2/3) |
| `organizationName` | Organization or company |
| `formatTemplateKey` | UPU S42 template key |
| `languageCode` | ISO 639-1 language hint |

### `AddressMetadata`

Located in [`src/schemas/address-metadata.ts`](../../src/schemas/address-metadata.ts). Tracks validation lifecycle:

- `validationStatus`: `unvalidated | validated | corrected | enriched`
- `validationTimestamp` / `validationProvider`
- `isResidential`, `isBusiness`, `isPOBox`
- `validationFlags`: read-only record of provider booleans
- `correctedAddress`: normalized `Address`
- `geocode`: lat/lng + precision source

These two schemas are surfaced downstream via `normalizeAddress`, `normalizeAddressMetadata`, and corresponding helper utilities.

## Trait Definition

- YAML: [`traits/core/Addressable.trait.yaml`](../../traits/core/Addressable.trait.yaml)
- TypeScript: [`traits/core/Addressable.trait.ts`](../../traits/core/Addressable.trait.ts)

**Parameters**

| Parameter | Type | Default | Notes |
| --- | --- | --- | --- |
| `roles` | `string[]` | `['billing', 'shipping']` | Ordered allow list of roles |
| `defaultRole` | `string` | – | Validated via `enumFromParameter` |
| `allowDynamicRoles` | `boolean` | `false` | Opt-in escape hatch for runtime role creation |

**Schema fields**

- `addresses`: `AddressableEntry[]` storing `{ role, address, metadata, isDefault }`
- `address_roles`: derived ordered list for rendering and auditing
- `default_address_role`: primary role returned when consumers omit `role`

**Semantics & Views**

- `AddressCollection` + `AddressEditor` provide context-aware UI hooks
- Timeline extension uses `AddressValidationTimeline` to surface enrichment history
- Token namespace: `location.address.*` (no direct hex colors)

## Runtime Helper API

`src/traits/addressable/addressable-trait.ts` packages a deterministic interface for objects or services that manipulate Addressable data.

```ts
import { AddressableTrait } from '@/traits/addressable/addressable-trait';

const trait = new AddressableTrait(
  {
    addresses: [
      { role: 'billing', address: billingAddress, isDefault: true },
    ],
  },
  { roles: ['billing', 'shipping'] }
);

trait.setAddress('shipping', shippingAddress, {
  metadata: { validationStatus: 'validated', validationProvider: 'google-av' },
});

const defaultAddress = trait.getDefaultAddress();
trait.removeAddress('billing'); // default shifts to shipping
```

**Available methods**

- `getAddress(role?: string)` – returns an `AddressableEntry` or falls back to the default role
- `getDefaultAddress(role?: string)` / `getDefaultRole()` – explicit default accessors for global or role-scoped reads
- `getAddresses(roles?: readonly string[])` – ordered entries using role precedence, optionally filtered to a subset
- `setAddress(role, address, options)` – validates inputs via shared Zod schemas
- `setAddresses(entries)` – bulk replace the role map using arrays, records, or `Map` inputs
- `setDefaultAddress(role)` – reassign the canonical default without mutating address payloads
- `removeAddress(role)` – deletes entries and reassigns the default when necessary
- `toSnapshot()` – serializes addresses for persistence/composition

The runtime honors the parameter schema at execution time—roles outside the configured set throw unless `allowDynamicRoles` is true, satisfying the “integration with trait engine validators” success criterion.

## Testing & Validation

- `tests/schemas/address.test.ts` exercises the value object + metadata schemas
- `tests/traits/addressable.test.ts` covers YAML/TS parsing, parameter validation, and runtime behaviors
- JSON Schema for parameters lives at [`schemas/traits/addressable.parameters.schema.json`](../../schemas/traits/addressable.parameters.schema.json) and feeds `ParameterValidator` + generated types (`generated/types/traits/addressable.parameters.ts`)

## Next Steps in Sprint 25

- **B25.2** builds on `formatTemplateKey` to render localized formats
- **B25.3** extends validation metadata with provider adapters and async lifecycles
- **B25.4/B25.5** consume the runtime helper to expose multi-role UI + context-aware editors
