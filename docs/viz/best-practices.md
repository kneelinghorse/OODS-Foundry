# Visualization Best Practices

The Sprint 21-23 visualization missions produced 24 deliverables spanning traits, normalized specs, renderers, layouts, and guardrails. This guide distills those learnings into a single playbook that points builders to the right artifacts (docs, CLIs, examples) at each decision point.

## How to Use This Guide

1. **Classify the story** you need to tell (goal, measures, dimensions) and consult the [Chart Selection Decision Tree](./chart-selection-decision-tree.md).
2. **Pick a layout contract** (single, facet, layer, concat) using the criteria in [Layout Selection](#layout-selection-guide-facet-vs-layer-vs-concat).
3. **Validate renderer + performance** using the [Performance Optimization Checklist](./performance-optimization.md) and, when needed, `./scripts/perf/run-viz-benchmarks.mjs`.
4. **Apply the accessibility equivalence rules** defined in the [Accessibility Checklist](./accessibility-checklist.md) before handing work to QA or design reviewers.
5. **Run the CLI** - `pnpm viz:best-practices` - to generate contextual reminders that combine chart, layout, performance, and a11y heuristics for the scenario you described.
6. **Cross-check the anti-patterns** list and the [before/after examples](../../examples/viz/before-after/README.md) before opening a PR.

## Decision Surface Overview

| Decision | Primary Inputs | Artifact | Guardrail |
| --- | --- | --- | --- |
| Chart selection | Measures, dimensions, narrative goal | [`chart-selection-decision-tree.md`](./chart-selection-decision-tree.md) | `pnpm viz:suggest`
| Layout | Data distribution, reuse of scales/interactions, dashboard footprint | [Layout Selection Guide](#layout-selection-guide-facet-vs-layer-vs-concat) | Layout parity tests (`tests/viz/adapters/layout-*`)
| Renderer | Data density, required interactions, bundle impact | [`performance-optimization.md`](./performance-optimization.md) | `./scripts/perf/run-viz-benchmarks.mjs`
| Accessibility | Story fidelity, keyboard/mobility support, fallbacks | [`accessibility-checklist.md`](./accessibility-checklist.md) | `pnpm a11y:diff`
| Quality sweeps | QA reviews, code reviews, storybook demos | [`anti-patterns.md`](./anti-patterns.md) | Chromatic + `pnpm local:pr-check`

## Chart Selection Highlights

- Map schema counts (e.g., `1Q + 2N`, `3Q + 1 time`) to canonical chart families. Use the table + heuristics inside [`chart-selection-decision-tree.md`](./chart-selection-decision-tree.md) for deterministic recommendations.
- `pnpm viz:suggest` already encodes the same weights as the tree. Feed it the descriptors you outlined while documenting the decision.
- When a dataset matches multiple branches, prefer the pattern whose recommended renderer (see performance guide) keeps interaction budgets green.

## Layout Selection Guide (Facet vs Layer vs Concat)

| Layout | Use When | Guardrails | Trade-offs |
| --- | --- | --- | --- |
| **Facet** | Same mark/encodings repeated across a categorical split (region, product tier) or small multiples of the same timeline. | Keep `sharedScales` enabled unless side-by-side comparisons require independent axes; limit panels to <=9 for Chromatic readability. | Additional data duplication can inflate payloads-filter data early and prefer inline values for Storybook/testing. |
| **Layer** | Multiple measures share the same axes (line + area, bar + target band) and must align on hover/tooltip interactions. | Assign explicit `mark.options.id` + `order` hints to keep renderer layering deterministic. Run layout parity tests whenever a new layer type is introduced. | Too many layers hurt clarity; keep <=3 visual encodings visible at once and lean on annotations rather than more layers. |
| **Concat** | Panels require different chart families or axis domains altogether (e.g., KPIs + distribution + explanation). Also used for dashboard hero sections that mix viz + narrative cards. | Choose `direction` (`horizontal`, `vertical`, or `grid`) based on responsive breakpoints and annotate each section with `filters` to avoid manual dataset slicing. | Interactions do not automatically sync-decide upfront whether you need `interactionPropagation` or discrete behaviors. |

**Selection checklist:**

1. Classify the viewing context (`list`, `detail`, `dashboard`).
2. Choose the smallest layout that tells the story-facet before concat.
3. Declare `sharedScales` per channel, even when defaulting to shared, so adapters enforce intent.
4. Capture interaction requirements (`syncHover`, `filter`, `brush`) in the layout trait so the adapter can wire propagation plans.
5. Run the responsive VRT pass (`pnpm vrt:layouts`) when a layout uses more than four panels.

## Performance & Renderer Strategy

- Start with the [Performance Optimization Checklist](./performance-optimization.md) to catch bottlenecks: data shaping, renderer selection, layout cost, and interaction overhead.
- Use the recorder template in `artifacts/performance/` to capture before/after metrics; attach them to PRs when renderer switches occur.
- Always justify renderer overrides with an artifact from `./scripts/perf/run-viz-benchmarks.mjs` so future contributors inherit evidence.

## Accessibility Integration

- Follow the 15 rules enumerated in [`accessibility-checklist.md`](./accessibility-checklist.md); they directly align with the RDV.4 contract enforced by `spec.a11y` validators.
- When pairing layouts and interactions, document how non-pointer users achieve the same outcome (rule #9) and include that text inside `spec.a11y.narrative`.
- Pair this checklist with automated guardrails: `pnpm a11y:diff`, `pnpm test --filter=viz`, and Storybook keyboard walkthroughs.

## Anti-pattern Sweep & Before/After Library

- Review the expanded [`anti-patterns.md`](./anti-patterns.md) list before sign-off. It captures the 10+ real issues surfaced during Sprint 21-23 builds plus how we remedied them.
- The [Before/After examples](../../examples/viz/before-after/README.md) include normalized spec pairs that illustrate fixes for layout misuse, renderer mismatches, and a11y regressions. Use them to teach reviewers or onboard teams that inherit the system.

## Automation & CLI Hooks

- `pnpm viz:best-practices` prompts for chart goal, data density, and layout type, then outputs the subset of best-practice sections you need along with file paths.
- Add the command to onboarding checklists and runbooks alongside `pnpm viz:suggest` and `pnpm viz:bench` so the entire team keeps using deterministic references rather than tribal knowledge.
