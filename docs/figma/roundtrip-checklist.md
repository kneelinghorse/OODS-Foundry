# Theme 0 Repo <-> Figma Round-Trip Checklist

This checklist locks the repository as the source of truth while giving designers a predictable way to visualise Theme 0 inside Figma. Complete every item in order when onboarding a new designer or refreshing the bridge.

## 1. Library & Sync Setup
- [ ] Confirm `/app/packages/tokens/src/tokens` builds cleanly (`npm run build:tokens`) with no local diffs.
- [ ] Regenerate `apps/explorer/src/styles/tokens.css` via `pnpm run tokens:transform -- --mission <missionId>` to refresh Tailwind-ready `--sys-*` variables and log the run in `diagnostics.json.tokens.transforms`.
- [ ] Issue a GitHub fine-grained personal access token with **Repository -> Contents: Read-only** scope. Store it in 1Password entry `OODS > Tokens Studio (Read Only)`.
- [ ] In Figma, open the Tokens Studio plugin -> **Sync Providers** -> **Add provider** and configure:
  - Provider: `GitHub`
  - Repository: `kneelinghorse/OODS-Foundry`
  - Branch: `main`
  - Path: `app/packages/tokens/src/tokens`
  - Token: the read-only PAT above
- [ ] Save and choose **Pull**. Verify Tokens Studio reports "Synced - Read-only" with no push option.

## 2. Tokens -> Styles Mapping
- [ ] In Tokens Studio, enable **Themes > Theme 0** only. All other themes remain unchecked for read-only sessions.
- [ ] Run **Create styles** (paint, effect, typography). Confirm the generated style tree matches the CSV at `app/docs/figma/mapping-table.csv` (`dot -> slash` mapping).
- [ ] For interactive surface variants (`default/hover/pressed`), keep the OKLCH relative formula intact. Do **not** flatten to static hex values in Figma.
- [ ] Verify the generated CSS variables in `apps/explorer/src/styles/tokens.css` now expose the matching `--sys.status.*` and `--sys.space.*` hooks that Storybook and Tailwind consume.
- [ ] Promote the generated styles to the Team Library `OODS - Theme 0` via Figma's **Assets -> Publish** flow.

## 3. Specimen Coverage (List & Detail)
- [ ] Open the library file **OODS - Theme 0** (shared link: https://www.figma.com/file/OODS-Theme-0-Library/OODS-%E2%80%A2-Theme-0?type=design&node-id=1-1&mode=design).
- [ ] Maintain two top-level pages: `01 List Context` and `02 Detail Context`.
- [ ] Each page contains a canonical frame with the six region slots (`globalNavigation`, `pageHeader`, `breadcrumbs`, `viewToolbar`, `main`, `contextPanel`) labelled per `app/docs/Canonical Region Contract.md`.
- [ ] Within the `main` region, include:
  - A `StatusBanner` variant referencing the status paint styles.
  - A chip rail demonstrating info/success/critical variants.
- [ ] Sync the frame thumbnails to cover both compact (List) and spacious (Detail) density values with spacing variables sourced from `Theme > Space > ...`.

## 4. Drift Prevention
- [ ] Any proposed token change starts a new branch via Tokens Studio (**Pull from Remote -> Create branch**). Designers must never edit while on `main`.
- [ ] Designers annotate diffs in Figma using Tokens Studio's **Compare** view and export the diff panel as PNG for PR attachment.
- [ ] Before merging, run `npm run check:tokens && npm run lint:tokens` locally to guarantee Style Dictionary output parity.
- [ ] Run `pnpm run tokens:transform -- --check` to ensure the generated CSS matches the committed file; PR Validate’s `tokens-validate` job fails when it drifts.
- [ ] Update the "Round-trip validation" section in PR description referencing this checklist and attach the compare export.

## 5. Validation & Sign-off
- [ ] Claude review: confirm namespace fidelity between CSV and published styles.
- [ ] Gemini review: validate List/Detail specimens include chips + banners with correct status ramps.
- [ ] Handoff owner signs the checklist, links the PR, and logs outcome in `SESSIONS.jsonl`.

## 6. Handshake Evidence
- [x] `pnpm run tokens:transform -- --mission B14.2` generates `apps/explorer/src/styles/tokens.css` from the exported DTCG files in `tokens/*.json` and appends a metrics entry to `diagnostics.json`.
- [x] Storybook entry **Foundations/Tokens Roundtrip** renders the Tailwind classes backed by `sys.status.info.*` variables, confirming that the CSS is consumed in UI.

## 7. Visualization Layout Handshake (B23.7+)
- [ ] Run `pnpm viz:figma-handshake` to refresh `cmos/planning/figma/viz-handshake-library.json` (pattern metadata + token bindings live in git for auditability).
- [ ] Follow `docs/viz/figma-handshake.md` to mirror the exported primitives (`Viz - Facet Grid`, `Viz - Layered Overlay`, `Viz - Heatmap Matrix`) inside the **OODS - Viz Layouts** Figma library using governed `--viz-*` tokens.
- [ ] Record the refresh timestamp + component coverage under `diagnostics.json.helpers.vizHandshake` (script writes automatically; verify via `pnpm viz:figma-handshake && git status`).
- [ ] Attach the JSON diff + Storybook/CLI references to the design ops ticket so designers can request layout-ready components by pattern ID.
