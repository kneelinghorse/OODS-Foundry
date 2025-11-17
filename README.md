
# OODS Foundry — Object-Oriented Design System

> A practical, tokens-only enterprise design system with semantic traits, context-aware rendering, and guardrails that keep accessibility and brand theming honest.


![Node 20+](https://img.shields.io/badge/node-20+-green)
![pnpm](https://img.shields.io/badge/pnpm-workspace-blue)
![TypeScript](https://img.shields.io/badge/ts-strict-blue)
![Storybook](https://img.shields.io/badge/storybook-8.x-purple)
![DTCG](https://img.shields.io/badge/DTCG-1.0-lightgrey)
![OKLCH](https://img.shields.io/badge/color-OKLCH-important)

---

> **Release status:** `v1.0 RC` (Sprints 1–19). See `docs/releases/v1.0-release-notes.md` for the full journey and `docs/releases/v1.0-migration-guide.md` for adoption guidance.

## Why this exists

OODS Foundry is a **design system you can ship**:
- **Trait-first object model** — canonical traits live in `traits/` and compose into objects under `objects/` via the deterministic compositor (`src/core/compositor.ts`). Provenance + collision policies make merges explainable.
- **Context-aware rendering** — List / Detail / Form / Timeline contexts share contracts through `src/contexts/` and region specs, with pure modifiers keeping view logic side-effect free (`docs/patterns/modifier-purity.md`).
- **Tokens + guardrails** — DTCG JSON in `packages/tokens` flow through Style Dictionary v4 to CSS variables consumed by Tailwind v4; guardrail suites (`pnpm tokens:guardrails`, `pnpm purity:audit`) keep OKLCH deltas and CSS variable reads honest.
- **Evidence-based pipeline** — `pnpm pipeline:push` builds tokens, runs Chromatic + HC VRT, and refreshes diagnostics bundles under `artifacts/` so every push carries a reproducible state snapshot.
- **Mission-aware automation** — CMOS (`cmos/`) tracks missions, telemetry, and approvals so agents/CLI flows can start, log, and complete work with an auditable history.

Live Storybook (GitHub Pages): https://kneelinghorse.github.io/OODS-Foundry/

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
# Pre-flight validation (lint + tokens + Storybook + diagnostics guards)
pnpm local:pr-check

# Storybook dev + static builds
pnpm storybook            # dev server on :6006
pnpm build-storybook      # static output in storybook-static/

# Token pipeline (DTCG JSON → Style Dictionary v4 → CSS vars)
pnpm build:tokens
pnpm tokens:guardrails    # OKLCH Δ checks + forced-color policy
pnpm tokens:governance    # semantic coverage + label enforcement

# Visual + accessibility evidence
pnpm chromatic:dry-run    # or pnpm chromatic when publishing
pnpm vrt:hc               # Playwright forced-colors PNGs
pnpm a11y:diff            # axe-core checks across contexts

# Guardrails + diagnostics bundles
pnpm purity:audit
pnpm pipeline:push        # tokens → storybook → VRT → HC → diagnostics → purity
```

> **Artifacts:** push pipelines roll evidence into `artifacts/state/` and dated folders under `artifacts/current-state/`. Keep daily bundles ≤10 files for reviewer sanity.
> Sprint walkthroughs and demo harnesses live under `scripts/demo/`.

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
OODS-Foundry/
├── src/                       # Trait engine, components, generators, contexts
├── packages/                  # Workspace packages (@oods/*, MCP bridge, tooling)
├── docs/                      # Architecture, adoption, releases, diagnostics
├── tests/                     # Unit, integration, a11y, guardrail specs
├── tokens/                    # Legacy token experiments (superseded by packages/tokens)
├── artifacts/                 # Diagnostics bundles, VRT, release evidence
├── scripts/                   # Build, release, diagnostics, guardrail helpers
├── cmos/                      # Missions, contexts, SQLite DB, CLI for backlog/runtime
└── apps/, stories/, .storybook/  # Storybook explorer + docs mode assets
```

## Mission control (CMOS)

CMOS keeps the backlog, sessions, and telemetry in SQLite. Pair this README with `agents.md` (repo root) and `cmos/agents.md` when running missions:

- `./cmos/cli.py validate health` — confirm SQLite + telemetry directories are writable.
- `./cmos/cli.py mission status` — list queued/current missions; `./cmos/cli.py db show current` mirrors the active context.
- `python - <<'PY' ... start(...) / complete(...)` or the CLI equivalents to transition missions with notes.
- `tail -20 cmos/telemetry/events/database-health.jsonl` — quick health pulse after major ops.

The CLI writes directly to `cmos/db/cmos.sqlite` and re-exports backlog/context files to keep the docs in sync.

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

## Roadmap & current focus

- **Sprint 19 — Design System Hardening & Packaging Readiness (✅)**: Component Set IV QA, reproducible packaging dry run, guardrail automation, and diagnostics refresh landed during Sprint 19 ([docs/changelog/sprint-19.md](docs/changelog/sprint-19.md)).
- **Sprint 20 — Private Review Preparation (🚧)**: Missions B20.1–B20.4 cover RC builds, reviewer kits, feedback triage, and release readiness per the Sprint 20 plan in `cmos/missions/backlog.yaml`.
- **Beyond Sprint 20**: MCP-powered tooling (agents panel, transcript capture, approval governance) extends the release train; see `cmos/missions/` and `cmos/docs/` for canonical plans.

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

* Release notes + migration: `docs/releases/`
* Getting started: `docs/getting-started/design.md`, `docs/getting-started/dev.md`
* Context defaults: `docs/context/form-timeline-defaults.md`
* Guardrails overview: `docs/guardrails/overview.md`
* Mission backlog + runtime: `cmos/missions/backlog.yaml`, `cmos/cli.py`, and `cmos/agents.md`
* Daily evidence: dated folders under `artifacts/current-state/`
* Sprint walkthrough script: `scripts/demo/sprint03.tsx`
