# Billing Timeline Reference

The billing timeline captures canonical subscription and invoice transitions using the shared status token map. UI
surfaces (list, detail, form, timeline) consume the same status payload—timeline views simply render the transitions in
chronological order.

## Event Schema

- Source of truth: `domains/saas-billing/events/timeline.schema.json`.
- Required fields forward the information Storybook and MCP clients rely on:
  - `type` — domain-qualified event identifier (e.g. `subscription.renewed`, `invoice.refund_issued`).
  - `at` — ISO timestamp that drives chronological sorting.
  - `prevStatus` / `nextStatus` — canonical statuses that map directly to `tokens/maps/saas-billing.status-map.json`.
  - `meta` — headline + summary copy plus optional hints (provider, channel, amount, actor).
- Events are append-only in downstream logs. Deduplication uses the stable `id`.

## Status Mapping

- `nextStatus` selects the token bundle for badges, markers, and banners—no component overrides are required.
- Tone mapping lives in `BillingContexts.tsx` (`resolveToneForStatus`). It mirrors the status map so future statuses only
  need JSON updates.
- `prevStatus` lets surfaces compose transition copy (e.g. `past_due → active`) without switch statements.

## Scenarios

- Example payloads live beside other fixtures:
  - `timeline.success.json` — on-time renewal and ACH settlement.
  - `timeline.retry.json` — dunning with smart retries + customer portal recovery.
  - `timeline.refund.json` — cancellation, partial refund, and credit memo export.
- Storybook surfaces (`Subscription.Timeline`, `Invoice.Timeline`) read these files directly, ensuring parity with MCP
  flows and upcoming diagnostics dashboards.

## Implementation Notes

- Keep notes and hints succinct—two short sentences per event maintain scannability in `context-timeline`.
- When introducing a new status, update the status map first, then extend the timeline schema or tone map as needed.
- Additional metadata belongs under `meta`; keep top-level keys reserved for the canonical transition contract.

## Mapping governance

- Timeline badges and `data-tone` resolutions flow through `apps/explorer/src/config/statusMap.ts`, which reads `configs/ui/status-map.json` instead of duplicating tone logic.
- The helper delegates to `StatusChip.getStatusStyle` so any new enum in the token manifest automatically picks up the correct palette.
- `scripts/lint/enum-to-token.ts` verifies the config mirrors the token manifest and that JSX never introduces manual tone maps.
