# Context Styling

Mission BI-20251020-1610d locks the domain context layer to the view profiles
introduced in sprint 16.10. All layout affordances are token-driven inside
`src/styles/domain-contexts.css`; no literal colour, spacing, or radius values
are permitted. This note explains how the tokens map to selectors, how
contributors should extend the system, and which proofs keep the contract green.

## View Profiles → Styling Bridge

- `configs/view-profiles.yaml` describes each context (regions, layout type, and
  the design tokens to consume).
- `tokens/view.json` exposes the referenced tokens as CSS custom properties
  (e.g. `--view-columns-two-column-standard`, `--view-main-gap-list`).
- `src/styles/domain-contexts.css` reads the profile via `data-view-context` and
  `data-view-has-*` attributes emitted by `ViewContainer`. The stylesheet only
  references the tokens declared in the profile.

## Token Matrix

| Category | Tokens | Purpose |
| --- | --- | --- |
| Shell | `--view-shell-padding-inline`, `--view-shell-padding-block`, `--view-shell-max-width` | Outer chrome padding/alignment |
| Columns | `--view-columns-*` | Grid templates for single/two-column layouts |
| Gap | `--view-main-gap-*`, `--view-section-gap-*`, `--view-card-gap`, `--view-gap-inline` | Vertical rhythm per context |
| Rail | `--view-rail-width-*`, `--view-rail-width-min-*` | Right-rail sizing and collapse thresholds |
| Card | `--view-card-radius`, `--view-card-padding`, `--view-card-max-width` | Shared surface treatments |
| Toolbar | `--view-toolbar-gap`, `--view-toolbar-item-gap` | Action cluster spacing |
| Context panel | `--view-contextPanel-padding`, `--view-contextPanel-gap` | Stack spacing inside the rail |
| Timeline | `--view-timeline-layer`, `--view-timeline-gap`, `--view-timeline-stream-gap` | Temporal flow treatment |
| Focus/Border | `--view-border-*`, `--view-accessibility-outline-offset` | Forced-colour + HC affordances |

## Context Layout Summaries

- **Detail** — two-column fallback using `--view-columns-two-column-standard`
  with body rhythm from `--view-section-gap-detail`.
- **List** — narrow rail via `--view-columns-two-column-narrow` and chrome/main
  gaps from `--view-section-gap-list` and `--view-main-gap-list`.
- **Form** — guidance rail using `--view-columns-two-column-guidance` with body
  spacing `--view-section-gap-form`.
- **Timeline** — single column surface layer `--view-timeline-layer` plus meta
  and stream cadence from the timeline gap tokens.
- **Card** — constrained width through `--view-card-max-width`; inner regions
  inherit the card surface tokens.
- **Inline** — minimal shell using `--view-gap-inline` and transparent surfaces
  to avoid double panels when embedded.

Each section in `domain-contexts.css` is annotated with the tokens it consumes
so new contributors can trace selectors back to design primitives.

## Data Attributes & Contributions

`ViewContainer` emits:

- `data-view-context` — canonical view profile (detail, list, form, timeline,
  card, inline). Use this for selectors to remain stable if brands override
  `data-view`.
- `data-view-profile` — mirrors the canonical context for now; reserved for
  future profile variants.
- `data-view-has-*` — boolean flags for region presence (e.g.
  `data-view-has-contextpanel="true"`). Layout rules toggle columns and rail
  sizing with these attributes.

Trait contributions should avoid bespoke CSS. Instead, inject structural hints
via the declared regions so the shared stylesheet can style them generically.

## Adding a New Context

1. Define the profile in `configs/view-profiles.yaml`, pointing at existing or
   new tokens.
2. Extend `tokens/view.json` with any missing primitives, then run
   `pnpm build:tokens` to regenerate outputs.
3. Add a token-annotated section to `src/styles/domain-contexts.css`, targeting
   `data-view-context="<context>"` and the relevant region groups.
4. Register proofs: update `stories/proofs/context-gallery.stories.tsx` (or add
   a sibling story) so VRT and axe pick up the new context across domains.
5. Capture verification in `artifacts/domains/<mission>-report.md` with
   screenshots and tooling notes.

## Proofs & Verification

- Storybook: `Contexts/Domain Context Gallery` renders subscription,
  invoice, and user objects across all six contexts using only tokenised rules.
- Automated a11y: Story parameters enable axe colour-contrast and landmark
  assertions; run `pnpm test:storybook -- --smoke` before handoff.
- Forced colours: `domain-contexts.css` overrides border/outline tokens inside
  a `(forced-colors: active)` media query so HC mode never relies on shadow-only
  affordances.
- Visual review: Chromatic snapshots should only show intentional diffs; record
  coverage in `artifacts/domains/context-finalize-report.md`.
