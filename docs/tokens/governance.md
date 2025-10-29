# Token Governance

Design tokens power multi-brand delivery and require protections that surface risky edits early in the pull-request flow. This document captures the guardrails that land with mission **B15.4 Token governance for brands**.

## Namespace Policy

- **Allowed write surfaces**: `brand/*`, `color.brand/*`, `aliases/brand-*`.
- **Protected namespaces**: `base/*`, `sys/*`, `ref/*`, `focus/*`, any path containing `a11y`.
- Changes to protected namespaces are automatically flagged as high-risk and require CODEOWNER review plus an acknowledgement label (`token-change:breaking`).

## tokens-governance CLI

```
tokens-governance diff --brand A --base main --head HEAD \
  --json artifacts/tokens/brand-a-report.json \
  --comment artifacts/tokens/brand-a-comment.md
```

Key behaviours:

- Loads flattened token outputs from `packages/tokens/dist/tailwind/tokens.json` for both refs (workspace-aware for `HEAD`).
- Emits change summaries (added / removed / modified) and risk levels. Foreground/background and focus edits are high-risk.
- Computes contrast deltas for matching `text`/`surface` or `foreground`/`background` pairs when both colours can be normalised.
- Scans `packages/**` and `src/stories/**` (excluding fixtures) to detect **orphans** (new tokens with no usage) and **leaks** (removed tokens still referenced).
- Generates a Markdown PR comment and JSON report; high-risk changes require the `token-change:breaking` label to pass without exit-code failures.
- Validates CODEOWNER coverage for each touched token namespace so protected directories are never unowned.

## CI Integration Expectations

1. Invoke `tokens-governance diff` during PR validation with the base branch commit.
2. Upload the generated JSON artifact for auditing; post the Markdown comment via the GitHub API.
3. Fail the workflow when the tool exits non-zero (missing acknowledgement label for high-risk changes).
4. Store artifacts under `artifacts/tokens/` for both brands to aid release audits.

## Reports and Artifacts

Sample outputs live under `artifacts/tokens/`:

- `brand-a-report.json` / `brand-a-comment.md`
- `brand-b-report.json` / `brand-b-comment.md`

Regenerate them locally via the CLI (ensure tokens are built so `packages/tokens/dist/tailwind/tokens.json` is current).

## Diagnostics dashboard

Every state assessment run now aggregates governance metrics into `diagnostics.json`:

- Latest snapshot: `diagnostics.tokens.governance.lastRun` (high-risk counts, label state, and per-brand artifacts).
- History: `diagnostics.tokens.governance.history` retains recent diffs so reviewers can track drift over time.

Re-run the tokens check in isolation with:

```bash
node scripts/state-assessment.mjs --tokens
```

This command refreshes `artifacts/state/tokens.json`, regenerates the per-brand governance reports, and updates the diagnostics dashboard.
