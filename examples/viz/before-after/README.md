# Before/After Reference Specs

These normalized viz spec pairs capture real fixes applied during Sprints 21-23. Use them to illustrate anti-patterns, teach reviewers, or quickly regression-test renderer/layout decisions.

| Scenario | What Changed | Files |
| --- | --- | --- |
| Facet vs Concat | Converted a dashboard from three concat panels to a single facet with shared scales, improving payload size and focus order. | [`facet-small-multiples/before.spec.json`](./facet-small-multiples/before.spec.json), [`facet-small-multiples/after.spec.json`](./facet-small-multiples/after.spec.json) |
| Renderer density upgrade | Switched a high-density grouped bar from Vega-Lite to ECharts and trimmed encodings to keep highlight latency under budget. | [`renderer-density-upgrade/before.spec.json`](./renderer-density-upgrade/before.spec.json), [`renderer-density-upgrade/after.spec.json`](./renderer-density-upgrade/after.spec.json) |
| Accessibility tighten-up | Added the complete RDV.4 contract (description, narrative, table) plus keyboard interactions for a diverging bar chart. | [`accessibility-tighten/before.spec.json`](./accessibility-tighten/before.spec.json), [`accessibility-tighten/after.spec.json`](./accessibility-tighten/after.spec.json) |

## How to Use These Specs

1. Load them into Storybook or the CLI scaffolds to recreate the issue.
2. Reference them in docs or PRs to show evidence of improvements.
3. Extend the folder with new scenarios (name the directory after the problem you fixed) and update this README table.

Each spec contains inline comments via `notes.md` (if needed) explaining the rationale behind the fix. Keep additions deterministic so telemetry artifacts display the same diffs.
