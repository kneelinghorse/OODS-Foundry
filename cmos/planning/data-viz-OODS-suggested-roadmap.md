Phase 1 — Viz foundation pack (v1, atomic patterns only)

Goal: Bring trait + spec + a11y primitives into Foundry, tying them to the canonical objects, but keep the renderer story simple (Vega-Lite for atomic charts, ECharts optional).

Port the viz traits into the Trait Engine

Create a viz trait family in Foundry that mirrors the dv taxonomy:

Mark.*, Encoding.*, Scale.*, Guide.*, Layout.*, Interaction.* categories from dv-7.

Re-express the Normalized Viz Spec v0.1 as:

A viz.trait.yaml schema that composes into objects.

TS types generated from the same JSON Schema (re-use your schema-first patterns).

Wire these into the existing validation/governance: trait deps, conflicts, and a11y checks treated like any other trait.

Codify archetypes + inference as Foundry utilities

Wrap the Schema→Encoding Mapping table and archetype model into:

A viz.inferSpec(objectSchema, intentTag) helper that spits out a Normalized Viz Spec instance.

Start with atomic patterns only (bars/lines/scatters/heatmaps):

Temporal

Comparison & Ranking

Distribution & Correlation

Part-to-Whole (simple).

Define a minimal “Chart view” context in the View Engine

Add a new chart context alongside list/detail/form/timeline.

Provide one or two base containers:

<ObjectChartCard> for embedding a single viz next to object details.

<ObjectDashboardSection> for small multiples / archetype grids.

Use Vega-Lite as the reference implementation for this embed (purely client-side, spec-driven).

Chart-safe tokens

Define chart-specific system tokens in the existing token architecture:

color.chart.background, color.chart.series.n, color.chart.axis, color.chart.grid.

Spacing + typography tokens for chart titles, labels, legends.

Ensure they respect your OKLCH + WCAG guardrails so all out-of-the-box palettes hit AA contrast.

Deliverables for Phase 1

viz/traits/*.yaml & TS types.

viz.inferSpec() utility (traits + archetypes + intent tags).

<ObjectChartCard> & <ObjectDashboardSection> components with Vega-Lite under the hood.

A small bundle of “example charts” for 2–3 canonical objects (e.g., Subscription, RevenueMetric, Event).

Phase 2 — Renderer adapters, interaction, and a11y (still v1)

Goal: Make charts first-class citizens in the system: portable across renderers, interactive, and covered by your a11y/CI policies.

Implement the TEP → Vega-Lite adapter

Use your existing Trait Execution Pipeline analysis as a blueprint to map traits → VL fields:

Mark/Encoding/Scale/Guide/Layout traits to VL mark, encoding, transform, and view composition.

Treat this as the reference compiler: spec-to-spec, tests for drift.

Implement the TEP → ECharts adapter

For atomic patterns + composite ones you’ve validated:

Map data/traits into ECharts dataset + series structures.

Integrate the InteractionTrait → dispatchAction mapping from RDS.9:

Highlight / Filter / Linked views.

Tooltip builder.

aria-live updates for filtered/selected states.

Bake a11y equivalence into CI

Add a viz-specific validator that:

Enforces the “two-part text alternative” (table + narrative summary).

Uses RDV.4’s checklist to ensure charts hit the necessary WCAG checkpoints (names, focus, keyboard nav, ARIA roles).

Build a small test corpus (10 archetypes) and fail CI if any equivalence check regresses.

Plug into Foundry’s governance

Extend the existing validation/gating pipeline so:

Any chart context story in Storybook must pass:

Trait validation.

Portability lint (e.g., warn/error on unsupported VL composite traits).

A11y equivalence generation.

Surface warnings as part of your Storybook or CLI diagnostics, same as token/a11y gates.

Deliverables for Phase 2

viz/adapter/vegaLite.ts and viz/adapter/echarts.ts.

InteractionTrait support in both adapters.

CI job that runs “viz equivalence tests” and lints portability.

Phase 3 — Design tooling: Figma + Storybook integration

Goal: Make the viz system tangible for designers and devs; keep Figma and code in lockstep.

Figma: chart primitives + tokens

Use the Figma handshake workflow you already defined:

Tokens in Git → Tokens Studio → styles/variables in Figma.

Create a small set of chart primitives as Figma components:

Bar/line/scatter/heatmap templates with semantic styles (no bespoke colors).

Add a light “Viz Panel” in your plugin:

Attach “intent” annotations (Temporal / Comparison / Distribution) to frames.

Those feed back into the viz.inferSpec() step when you sync.

Storybook: chart catalog

Add a “Visualization” section to the DS Storybook:

One story per archetype (with knobs for data + intent).

Cross-renderer stories (same spec → Vega-Lite vs ECharts).

Hook visual regression (Chromatic) to these stories so chart changes are always diffed and reviewed.

Authoring ergonomics

A CLI (or MCP tool) like:

oods viz suggest Subscription --intent=change_over_time.

It spits out:

The viz spec.

A ready-to-use React <SubscriptionMRRChart> component wired to the adapter.

Deliverables for Phase 3

Figma chart library + updated plugin flows.

Storybook “Viz” catalog + Chromatic integration.

Optional: oods-viz CLI/agent tools to scaffold charts.

Phase 4 — v1.1/v2.0: complex domains & advanced interactions

This phase basically operationalizes the RDS.10 roadmap.

v1.1: Geospatial

Implement support for data.geo.join + lookup in the normalized spec & adapters (VL lookup, ECharts geo).

Add a “Map” archetype + canonical choropleth/bubble examples.

v2.0: Hierarchy & Network

Build the Resolver / Transform Engine:

Stratify + treemap/partition for hierarchical traits.

Force layout + full Vega “escape hatch” for network graphs.

Integrate it as a service behind the adapters (so DS consumers still just pass a Normalized Viz Spec).

Advanced interactions & dynamic a11y

Extend InteractionTrait + a11y model to:

Zoom/pan, multi-touch, multi-selection.

Narrate changes via aria-live (filters, zoom changes, etc.).