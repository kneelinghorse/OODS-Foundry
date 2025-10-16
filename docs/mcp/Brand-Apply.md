# Brand Apply MCP Tool

## Overview

`brand.apply` previews and applies approved palette deltas for Brand A. The tool defaults to the alias strategy, merging delta objects into the Brand A token sources (base/dark/hc) in-memory. The patch strategy allows tightly scoped RFC 6902 operations. All writes stay inside dated review-kit artifacts; repository sources are never modified.

## Inputs

- `brand` (string, default `"A"`): currently only Brand A is supported.
- `delta` (object or array, required): alias strategy expects a nested object with `value` keys; patch strategy consumes RFC 6902 operations.
- `strategy` (string, default `"alias"`): choose between alias merge and patch execution.
- `apply` (boolean, default `false`): dry run when false, write artifacts when true.

If `delta` is supplied as an array and `strategy` is omitted, the tool infers `"patch"` automatically.

## Dry-Run vs Apply

- **Dry run (`apply=false`)** – validates the payload, merges it in-memory, and returns a structured diff plus encoded specimen previews. No artifact writes occur beyond transcript and bundle index entries.
- **Apply (`apply=true`)** – gated by the bridge approval header. Artifacts (≤10 per day) land under `artifacts/current-state/YYYY-MM-DD/review-kit/brand.apply/`:
  - `tokens.A.{base,dark,hc}.json` snapshots
  - `specimens.json` summarising before/after values
  - `variables.css` generated from changed `$value` entries
  - `diagnostics.json` with run metadata and the check-mode token build timing
  - Transcript and bundle index files (auto-generated)

## Output Contract

- `artifacts`: absolute paths to emitted artifacts (empty during dry runs)
- `preview`: summary + diff hunks + specimen data URIs for Storybook rendering
- `artifactsDetail`: path, hash, size, and purpose metadata
- `diagnosticsPath`: present only when `apply=true`
- `transcriptPath` and `bundleIndexPath`: audit trail for both plan and apply runs

## Safety & Policy

- Write boundaries are enforced with `withinAllowed(policy.artifactsBase, candidate)` checks.
- The bridge marks `brand.apply` as write-gated; `apply=true` requires an approval token.
- The tool invokes `pnpm run check:tokens` in best-effort mode to capture build timing without modifying repository sources. Failures are ignored so the run can still complete.

## Operational Notes

- Alias delta objects may target all themes or specify per-theme overrides (`{ base: { ... }, dark: { ... } }`). Shared entries merge into every theme automatically.
- Patch operations run across each Brand A theme; prefer absolute paths to `$value` nodes when replacing color values.
- The generated CSS file is lightweight and intended for review-kit diffing; the full Style Dictionary build remains in the main pipeline.
