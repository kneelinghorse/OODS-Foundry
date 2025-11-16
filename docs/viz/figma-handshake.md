# Viz <-> Figma Handshake for Visualization Layouts

Mission **B23.7** introduces a durable handshake between the viz trait engine and the Figma library so designers can instance the exact layout/pattern primitives surfaced by Storybook and the CLI. This playbook complements the Theme 0 tokens checklist in `docs/figma/roundtrip-checklist.md`.

## Source of Truth

- **Pattern metadata**: Generated from `chartPatternsV2` via `pnpm viz:figma-handshake`. The script writes `cmos/planning/figma/viz-handshake-library.json` with pattern summaries, layout/interaction profiles, and the governed `--viz-*` token bindings for each supported primitive.
- **Tokens**: `packages/tokens/src/viz-scales.json` and `packages/tokens/src/viz-sizing.json` remain authoritative. Figma styles must reference the published CSS custom properties (`var(--viz-*)`) created by `pnpm build:tokens`.
- **Diagnostics evidence**: `diagnostics.json.helpers.vizHandshake` records when the handshake JSON was refreshed, which primitives are available, and the expected Figma component keys.

## Library Primitives

| Primitive | Pattern | Tokens | Notes |
|-----------|---------|--------|-------|
| `Viz - Facet Grid (4-up)` | `facet-small-multiples-line` | `--viz-scale-categorical-01..05`, `--viz-margin-tight`, `--viz-size-stroke-01/03` | 4-up panel uses compact density with inline legends limited to four series. |
| `Viz - Layered Overlay (band + dual line)` | `layered-line-area` | `--viz-scale-diverging-*`, `--viz-size-stroke-02/03`, `--viz-size-point-04` | Diverging threshold band communicates tolerance ranges, dual lines inherit positive ramps. |
| `Viz - Heatmap Matrix (calendar)` | `time-grid-heatmap` | `--viz-scale-sequential-01..09`, `--viz-size-stroke-01/02`, `--viz-margin-tight` | Inline legend exposes min/mid/max stops; value labels must respect Delta L >= 15. |

Run `pnpm viz:figma-handshake` whenever pattern heuristics change. Commit the regenerated JSON so design ops can diff bindings before touching Figma.

## Workflow

1. **Refresh tokens** - Follow the Theme 0 checklist (Section 1) to pull the latest DTCG exports into Figma via Tokens Studio. This guarantees every `--viz-*` custom property resolves inside the viz library file.
2. **Export pattern metadata** - Run `pnpm viz:figma-handshake`. Attach the terminal output + JSON diff to the design ops ticket so we can trace which primitives changed.
3. **Update the Figma library** - Inside **OODS - Viz Layouts**, create/refresh the referenced components using the JSON file:
   - Apply the listed `tokenBindings` verbatim by mapping each `--viz-*` token to a Figma style (e.g., `Color/Viz/Categorical/01`).
   - Mirror the `componentGuidance` array as sticky notes or documentation nodes on the master component.
   - Align facet/legend variants with the `figma.variant` string so plugin automation can target them deterministically.
4. **Traceability** - Log the refresh in `diagnostics.json.helpers.vizHandshake.notes` (script handles this automatically) and cross-link the JSON blob in the design ops issue.
5. **Validation** - Open Storybook `Visualization/Layouts/*` (B23.6) or run `pnpm viz:suggest --layout facet --interactions filter` to ensure CLI + UI agree on the recommended primitive. Designers can now reference the same pattern IDs when filing requests.

## Evidence & Diagnostics

`diagnostics.json.helpers.vizHandshake` includes:
- `artifact` - Path to the JSON export (`cmos/planning/figma/viz-handshake-library.json`).
- `updatedAt` - Timestamp from the last run of `pnpm viz:figma-handshake`.
- `components` - Array of `{ id, patternId, libraryComponent }` pairs for auditing library coverage.
- `notes` - Guidance for design ops on how to refresh the handshake.

Before closing a mission that touches the handshake, run `pnpm viz:figma-handshake` and `./cmos/cli.py db show current` to capture both state and diagnostics updates.
