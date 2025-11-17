# Visualization Accessibility Checklist

The normalized viz spec and RDV.4 contract demand parity between visual stories and non-visual experiences. The 15 rules below map directly to `spec.a11y` fields, component props, and interaction traits so you can prove compliance before shipping.

## Checklist

1. **Plain-language description** - Populate `spec.a11y.description` with a one-sentence summary that explains the story outcome (e.g., "West region leads revenue"), not the chart mechanics.
2. **Narrative summary and findings** - Provide `spec.a11y.narrative.summary` plus at least three `keyFindings`. These should mirror the spoken intent you would give in a meeting.
3. **Table fallback enabled** - Set `spec.a11y.tableFallback.enabled = true`, include a caption, and define `tableColumnOrder` under `portability` so `<AccessibleTable>` renders predictably.
4. **Aria labeling** - Supply `spec.a11y.ariaLabel` to describe the component role ("Bar chart showing MRR by region").
5. **Unit and scale clarity** - Ensure axis titles include units (`MRR (USD)`) and `portability.tableColumnOrder` follows the same labels to avoid disorientation when switching modalities.
6. **Keyboard interactions** - Every interaction trait must declare `on: 'focus'` alongside pointer events so keyboard users can trigger the same highlight/tooltip flows.
7. **Focus ring visibility** - Use component tokens (`--sys-focus-ring`, `--cmp-focus-outline`) when styling interactive overlays so focus is visible even against heatmaps.
8. **Reduced-motion fallback** - Honor `prefers-reduced-motion` in animation helpers (already wired in `<VizContainer>`) and avoid reliance on motion cues to convey state.
9. **Non-pointer equivalence** - Document how non-pointer users perform the same workflows (filter, brush, zoom) and include the instructions inside `spec.a11y.narrative.interactions`.
10. **Color contrast + token usage** - Reference only `--viz-scale-*` or `--sys-*` tokens, never hard-coded colors, and run `pnpm tokens:guardrails` when updating palettes.
11. **Alternative text for annotations** - Provide `mark.options.ariaLabel` or include annotation descriptions inside the narrative whenever you add reference bands or callouts.
12. **Legend redundancy** - Duplicate legend meaning inside the narrative or table when color is the only differentiator (e.g., "Blue bars represent active accounts").
13. **Layout ordering** - When using facets or concat, define `aria-flowto` via the layout metadata so screen readers announce panels in the intended order (left-to-right, top-to-bottom).
14. **Dataset provenance** - Include `spec.meta.source` or mention the dataset inside the description so auditors know where the data originated.
15. **Automated guardrails** - Run `pnpm test --filter=viz`, `pnpm a11y:diff`, and Storybook keyboard walkthroughs before completing a mission. Attach failing screenshots/logs to mission notes if issues persist.

Keep this list adjacent to design reviews and code reviews. It gives engineers, designers, and QA a common vocabulary for verifying that a chart remains accessible across every interaction channel.
