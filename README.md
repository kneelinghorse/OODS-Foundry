
````md
# OODS Foundry — Object-Oriented Design System

> A practical, tokens-only enterprise design system with semantic traits, context-aware rendering, and guardrails that keep accessibility and brand theming honest.


![Node 20+](https://img.shields.io/badge/node-20+-green)
![pnpm](https://img.shields.io/badge/pnpm-workspace-blue)
![TypeScript](https://img.shields.io/badge/ts-strict-blue)
![Storybook](https://img.shields.io/badge/storybook-8.x-purple)
![DTCG](https://img.shields.io/badge/DTCG-1.0-lightgrey)
![OKLCH](https://img.shields.io/badge/color-OKLCH-important)

---

## Why this exists

OODS Foundry is a **design-system you can ship**:
- **Tokens-only components** — components read `--cmp-*` variables only. Brand/theme/ref layers live in CSS, not in component logic.
- **Context model** — every object renders consistently in **List / Detail / Form / Timeline** via regions and **pure modifiers** (no side-effects).
- **Color with guardrails** — OKLCH-based palettes with ΔL/ΔC state rules; **forced-colors** maps to **CSS System Colors**.
- **Low-friction pipeline** — **push-based** runs build tokens, run VRT (dark) + HC snapshots, and emit diagnostics to `/artifacts/current-state/YYYY-MM-DD`.
- **MCP + Agents (roadmap)** — a small, safe toolset exposed via MCP for plan→approve→execute flows (no repo-wide writes).

See live status and plan in `missions/backlog.yaml`.

---

## Repo quickstart

> ⚡ Need a 10-minute onboarding path? See `docs/getting-started/design.md` (Design) and `docs/getting-started/dev.md` (Development).

### Prereqs
- Node **20+**, pnpm (**via Corepack**)
- If using HC snapshots: Playwright (`pnpm exec playwright install`)

```bash
corepack enable
pnpm i
````

### Common scripts

```bash
# Pre-flight local PR checks
pnpm local:pr-check

# Dev Storybook
pnpm storybook:dev

# Build tokens (DTCG → Style Dictionary v4 → CSS vars for Tailwind v4)
pnpm tokens:build

# Build static Storybook
pnpm storybook:build

# Visual regression: Chromatic (dark variants); requires CHROMATIC_PROJECT_TOKEN
pnpm chromatic

# High-contrast snapshots (PNG via Playwright; non-blocking)
pnpm test:hc

# Purity audit (forbid direct --ref/--theme reads or color literals in components)
pnpm purity:audit

# Diagnostics snapshot (writes JSON/MD under /artifacts/current-state/YYYY-MM-DD)
pnpm diag:sprint

# Local push pipeline (tokens → storybook → chromatic → HC → diagnostics → purity)
pnpm pipeline:push
```

> **Artifacts:** every push run writes to `/artifacts/current-state/YYYY-MM-DD/` (summary + consolidated `diagnostics.json`). Keep total files ≤10 for reviews.
> Sprint walkthrough script lives at `scripts/demo/sprint03.tsx`.

---

## Architecture at a glance

### 1) Token stack (DTCG → SD v4 → Tailwind v4)

```
/tokens
  ├─ brands/
  │   └─ A/
  │       ├─ base.json        # light
  │       ├─ dark.json        # dark
  │       └─ hc.json          # forced-colors mapping
  ├─ aliases/                 # optional brand-scoped aliases
  └─ motion.json              # minimal duration/easing/transition set
```

* **Build:** DTCG JSON → Style Dictionary v4 transforms → `variables.css` (CSS custom properties).
* **Consumption:** Tailwind v4 reads CSS variables; components bind only to `--cmp-*`.

### 2) Contexts & regions

* Four canonical contexts: **List**, **Detail**, **Form**, **Timeline**.
* **Regions** define layout slots; **pure modifiers** compose visual state (idempotent, side-effect free).
* See [Region contract](docs/specs/regions.md) and [Modifier purity contract](docs/patterns/modifier-purity.md) for deep-dive docs that underpin these rules.

### 3) Theming & brand

* DOM contract:

  ```html
  <html data-brand="A" data-theme="light">...</html>
  ```
* **No component edits** required to switch brand/theme. Components are wired to `--cmp-*` variables only.

### 4) A11y & color policy

* OKLCH palette with **relative state deltas**; AA enforced in light/dark.
* In **forced-colors**, map tokens to **System Colors** (e.g., `Canvas`, `CanvasText`, `Highlight`).
* Focus indicators ≥ **3:1** in HC; reduced-motion respected.

### 5) Evidence & CI model

* **Push-based** process (no PR gating required): tokens build, VRT (dark, Chromatic), HC PNGs (Playwright), diagnostics snapshot.
* Artifacts and transcripts are reproducible and stored under `/artifacts/current-state/YYYY-MM-DD/`.

---

## Directory layout

```
/app
  └─ apps/explorer/            # Storybook "Explorer" app (components, stories, docs)
/docs                          # Architecture, context specs, review kits, diagnostics
/missions
  ├─ sprint-09/                # one mission per page (current)
  └─ research/                 # r.* research sources/findings
/packages
  ├─ a11y-tools/               # (pre-1.0) utilities for audits
  ├─ tokens/                   # build + runtime helpers for tokens
  └─ tw-variants/              # Tailwind v4 adapters (if used)
/scripts                       # normalizers, validators, diag collectors
/tokens                        # DTCG token source (brands, motion, aliases)
/artifacts/current-state/YYYY-MM-DD
                               # daily evidence bundles (≤10 files recommended)
```

---

## Using the system

### Brand & theme switch (no component changes)

```html
<html data-brand="A" data-theme="dark">
  <body>
    <button class="btn-primary">Save</button>
  </body>
</html>
```

```css
/* emitted by SD v4 and brand scoping */
[data-brand="A"] {
  --sys-color-primary: var(--brandA-color-primary);
}
@media (forced-colors: active) {
  [data-theme="hc"] {
    --sys-color-bg: Canvas;
    --sys-color-fg: CanvasText;
    --sys-color-primary: Highlight;
  }
}
```

### Purity rules (enforced)

* ✅ Components **may** read: `--cmp-*`
* ❌ Components **must not** read: `--ref-*`, `--theme-*`, or hardcoded color literals (`#`, `rgb(`, `oklch(`)
  Run `pnpm purity:audit` to block violations.

---

## Visual QA & diagnostics

* **Storybook dark VRT** via Chromatic (curated allowlist).
* **High-contrast** screenshots via Playwright (PNG; non-blocking).
* **Diagnostics** roll up AA/Δ summaries, VRT counts, HC image count, inventory, and tokens build time into a single `diagnostics.json`.

---

## Roadmap (high-level)

* **Sprint 09 (current)** — Brand A (tokens-only), reproducible local packages, purity audit, review kit roundtrip, brand-aware VRT.
* **Sprint 10–13** — **MCP + Agents**

  * v0.1 MCP server (local) exposing a small, safe toolset (`tokens.build`, `a11y.scan`, `purity.audit`, `vrt.run`, `reviewKit.create`, `release.verify`, `release.tag`, `diag.snapshot`)
  * Plan → approve → execute loop with transcripts & artifacts
  * Dev-tool client first (Claude/OpenAI), then a **Storybook Agent panel**
  * Governance: allow/deny rules, roles, rate limits, redaction, audit log

See `missions/backlog.yaml` for authoritative status.

---

## Contributing

This repo currently runs a **push-based** process for speed. External PRs may be parked initially while we stabilize the MCP/agent toolchain. If you do contribute:

* Follow the **tokens-only** rule and add/extend tokens in `/tokens` (DTCG).
* Add/curate stories; keep “Context” casing consistent (`List|Detail|Form|Timeline`).
* Keep artifact bundles lean (≤10 files per day folder).

---

## Troubleshooting

* **Chromatic token missing** — set `CHROMATIC_PROJECT_TOKEN` in your environment then run `pnpm chromatic`.
* **Playwright errors** — run `pnpm exec playwright install` once locally.
* **Token build drift** — ensure you’re on Node 20 with pinned pnpm; re-run `pnpm tokens:build`.
* **Purity audit fails** — search for `--ref-`/`--theme-`/color literals in components; move logic to CSS variables.

---

## License & governance

* **License:** *TBD* (add your preferred license file at the repo root).
* **Security/Responsible Disclosure:** *TBD* (add a short policy or link).
* **Code of Conduct:** *TBD*.

---

## Pointers

* Context spec: `docs/context/form-timeline-defaults.md`
* Research foundations (Sprint 09): `missions/research/r.13.1_Multi-Brand-Theming.md`, `r.13.2_Publishing-Reproducible-TypeScript-Packages.md`, `r.13.3_The-PR-less-Pipeline.md`
* Backlog: `missions/backlog.yaml`
* Artifacts (daily): `/artifacts/current-state/YYYY-MM-DD/`

```

If you want a slim “Getting Started” variant for npm/packaged consumers (separate from the monorepo README), I can draft `packages/README.md` stubs for `@oods/tokens`, `@oods/tw-variants`, and `@oods/a11y-tools` next.
::contentReference[oaicite:0]{index=0}
```
