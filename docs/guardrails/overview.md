# Guardrail Coverage Overview

Sprint 19 extends the automated guardrails that keep the design system compliant and safe for release. This page captures the lint rules, diagnostics, and artifacts that now backstop metadata policy, tenancy isolation, and token governance.

## Current Status

| Guardrail | Tooling | Status Source | How to Re-run |
| --- | --- | --- | --- |
| Metadata policy (`oods/no-account-unsafe-metadata`) | ESLint custom rule | `artifacts/state/guardrails.json` → `diagnostics.helpers.guardrails` | `node scripts/state-assessment.mjs --guardrails`
| Tenancy overrides (`oods/no-unsafe-tenancy-override`) | ESLint custom rule | `artifacts/state/guardrails.json` → `diagnostics.helpers.guardrails` | `node scripts/state-assessment.mjs --guardrails`
| Token governance & labels | `tokens-governance diff` + CSS purity audit | `artifacts/state/tokens.json` → `diagnostics.tokens.governance` | `node scripts/state-assessment.mjs --tokens`

The state assessment now surfaces these results in the summary table (`artifacts/state/assessment.md`) and the console output, ensuring guardrail regressions turn the overall status red.

## Enforcement Notes

- **Metadata writes** must call `MetadataPolicy.validate()` before assigning to `account.metadata`. Violations surface in CI via `pnpm lint` and block merges (`oods/no-account-unsafe-metadata`).
- **Tenancy context overrides** (`TenancyContext.setCurrentTenant`, `TenancyContext.config.*`) are forbidden outside sanctioned test harnesses. The `oods/no-unsafe-tenancy-override` rule keeps production code from bypassing strict isolation.
- **Token governance** diffs continue to require the `token-change:breaking` label for high-risk namespaces. The dashboard in `diagnostics.tokens.governance.lastRun` records risk counts, label state, and artifact paths for each brand.

## CI integration

- `pnpm lint` (or the PR validation workflow) loads the OODS plugin so both guardrail rules fail fast in pull requests.
- `pnpm run state:token-breaking` mirrors the new diagnostics by re-running the state assessment with protected labels, keeping governance green.
- The nightly `release:dry-run` job calls `node scripts/state-assessment.mjs --all`, ensuring guardrail metrics stay recorded before packaging hand-off.

Refer to `docs/tokens/governance.md` for token-specific policies and to `docs/tenancy/README.md` for tenancy configuration guidance.
