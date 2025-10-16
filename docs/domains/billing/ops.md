# Billing Ops Flow

The billing domain now exposes MCP tooling so designers and engineers can audit fixtures, generate review kits, and rehearse Storybook fixture switches without touching repository sources.

## MCP Tools

- `billing.reviewKit` – Generates a billing review kit bundle for Subscription, Invoice, Plan, or Usage objects. Dry runs preview fixture deltas; apply writes summaries, specimens, diff logs, and diagnostics under `artifacts/current-state/<date>/billing.reviewKit/`.
- `billing.switchFixtures` – Rehearses switching Storybook billing fixtures (Stripe ↔ Chargebee). Dry runs highlight expected data changes and stories to refresh; apply records the switch metadata and diff artifacts in the dated bundle.

Both tools run behind the Storybook agent approval gate. The bridge policy restricts writes to the dated artifacts directory and produces transcripts plus bundle indices for each run.

## Recommended Workflow

1. Plan `billing.reviewKit` for the desired object to inspect fixture parity. Review the diff notes before seeking approval.
2. After approval, apply the review kit to capture specimens and diagnostics for handoff.
3. Plan `billing.switchFixtures` to preview the impact of swapping fixtures on Storybook stories.
4. Once stakeholders approve, apply the switch to document the targeted provider and affected stories.

Artifacts from these tools are safe to share with the diagnostics viewer and live alongside existing review and policy bundles.
