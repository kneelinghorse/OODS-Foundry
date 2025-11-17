# Multi-Role Address Management

> Sprint 25 Mission B25.4 formalises the trait runtime pattern for managing multiple address roles (billing, shipping, warehouse, etc.) per object. The goal is to bundle storage, default handling, and per-role validation metadata into a deterministic API that every domain object can consume without bespoke scaffolding.

## Runtime building blocks

| Module | Responsibility |
| --- | --- |
| `role-manager.ts` | Normalises/guards roles and preserves the canonical order configured via trait parameters |
| `address-store.ts` | Immutable `Map<role, AddressableEntry>` wrapper exposing get/set/remove/bulk APIs |
| `default-resolver.ts` | Tracks canonical default role, preferring explicit assignments or entries flagged `isDefault` |
| `addressable-trait.ts` | Public API that composes the modules above and surfaces formatting helpers |

`AddressStore` accepts arrays, records, or `Map` inputs for bulk ingestion, automatically normalises `AddressableEntry` structures, and guarantees that each role stores independent `AddressMetadata` derived from the validation lifecycle.

## Key APIs

```ts
import { AddressableTrait } from '@/traits/addressable/addressable-trait';

const trait = new AddressableTrait(
  {
    addresses: [{ role: 'billing', address: billingAddress, isDefault: true }],
  },
  { roles: ['billing', 'shipping', 'warehouse'] }
);

trait.setAddress('shipping', shippingAddress, {
  metadata: { validationStatus: 'validated', validationProvider: 'google-av' },
});
trait.setDefaultAddress('shipping'); // reassign without mutating address payloads

const warehouseEntries = trait.getAddresses(['warehouse']);
const defaultShipping = trait.getDefaultAddress();
const snapshot = trait.toSnapshot(); // { addresses: Record<string, AddressableEntry>, defaultRole: 'shipping' }
```

### Capabilities unlocked

1. **Multi-role storage** – `AddressStore` stores every address in a Map keyed by the normalised role, guaranteeing O(1) retrieval and deterministic ordering via `RoleManager`.
2. **Role-scoped operations** – `getAddress(role)` and `getAddresses(['shipping', 'warehouse'])` offer targeted access without cloning collections manually.
3. **Default orchestration** – `setDefaultAddress(role)` updates the canonical role while `getDefaultAddress(role?)` supports both global and role-specific reads.
4. **Bulk resets** – `setAddresses(entries)` replaces the entire collection without touching validation metadata objects and preserves the previous default when possible.
5. **Metadata isolation** – Each `AddressableEntry` instance carries its own `AddressMetadata`, ensuring validation/enrichment state is independent per role.

## Testing & documentation

- `tests/traits/addressable/multi-role.test.ts` covers role-scoped retrieval, metadata isolation, and bulk ingestion paths.
- `tests/traits/addressable/default-management.test.ts` verifies the explicit default assignment API and fallback behaviour when roles are removed.
- Examples live at `examples/addresses/multi-role-user.ts` and `examples/addresses/multi-role-organization.ts`.

For runtime reference, see [`docs/traits/addressable-trait.md`](./addressable-trait.md) which now links to these APIs, and mission telemetry is captured in `cmos/db/cmos.sqlite` under mission `B25.4`.
