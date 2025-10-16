# SaaS Billing Domain

The billing domain establishes normalized objects and traits for subscription-driven SaaS products. Canonical enums come from research in `cmos/missions/research/R13.5_Canonical-Model-Subscription-and-Invoice.md` and map directly to UI tokens via the shared manifest at `tokens/maps/saas-billing.status-map.json`.

## Objects

| Object | File | Summary |
| --- | --- | --- |
| Subscription | `domains/saas-billing/objects/Subscription.object.yaml` | Lifecycle, pricing, usage, and refund posture composed through traits. |
| Invoice | `domains/saas-billing/objects/Invoice.object.yaml` | Collections metadata plus audit timestamps and refund window support. |
| Plan | `domains/saas-billing/objects/Plan.object.yaml` | Catalog entry capturing pricing, packaging, and usage allowances. |
| Usage | `domains/saas-billing/objects/Usage.object.yaml` | Consumption snapshot with trend deltas for metered billing. |

## Traits

- `domains/saas-billing/traits/billable.trait.yaml` – recurring price contract metadata.
- `domains/saas-billing/traits/payable.trait.yaml` – invoice terms and canonical status support.
- `domains/saas-billing/traits/refundable.trait.yaml` – refund eligibility and credit memo tracking.
- `domains/saas-billing/traits/metered.trait.yaml` – usage ledger with rollover policy.

## Fixtures

Provider fixtures live in `domains/saas-billing/examples/` and include complete payloads for Stripe (`stripe.json`) and Chargebee (`chargebee.json`). Each aligns to the canonical object schema so UI surfaces can hydrate without case statements.

## Story coverage

Eight context stories under `apps/explorer/src/stories/Billing/` exercise the Subscription and Invoice objects across List, Detail, Form, and Timeline contexts. Each story imports the shared data module so status chips, metrics, and layout remain consistent across providers.

## Status mapping

The manifest `tokens/maps/saas-billing.status-map.json` is now the source of truth for subscription and invoice tones. `StatusChip` consumes this file directly, and the tokens explorer route renders its metadata alongside resolved token values.
