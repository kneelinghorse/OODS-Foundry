# Chart Selection Decision Tree

This decision tree encodes the heuristics used by `pnpm viz:suggest` and the Sprint 21-23 research synthesis. Work through the questions in order to reach the recommended chart pattern and renderer default.

## Step 1: Describe the Data Card

| Question | Options | Notes |
| --- | --- | --- |
| How many quantitative measures? | 1, 2, 3+ | Count distinct numeric fields that need to appear simultaneously. |
| How many categorical dimensions? | 0, 1, 2 | Includes nominal or ordinal buckets (region, product tier, funnel step). |
| Is there a temporal axis? | yes/no | Any continuous or discrete time field. |
| Is the story part-to-whole, comparison, relationship, or intensity? | `composition`, `comparison`, `trend`, `distribution`, `relationship`, `intensity` | Missions B21.4-B23.6 map these goals to canonical marks. |
| Do you need signed or tolerance ranges? | yes/no | Diverging palettes and banded charts rely on this flag. |

Record the answers using the shorthand `<measures>Q + <dimensions>N + <temporals>T`. Example: `1Q + 2N + 0T composition`.

## Step 2: Traverse the Tree

1. **Start with part-to-whole stories.**  If `goal = composition`, choose:
   - `stacked-bar` for absolute totals.
   - `stacked-100-bar` when the total must sum to 100%.
   - `donut` is never recommended (see anti-patterns) unless the story is literally a highlight plus remainder.
2. **If there is a temporal axis (`T >= 1`):**
   - `measures >= 2` -> `multi-series-line`.
   - `measures = 1` and `goal = accumulation` -> `running-total-area`.
   - `goal = tolerance` -> `trend-vs-target-band` (layered line + area).
3. **If there is no temporal axis but two categorical dimensions:**
   - Dense grid (>=30 combinations) -> `time-grid-heatmap` or `matrix-heatmap` when both axes are ordered.
   - Sparse grid (<30 combos) -> `grouped-bar` (comparison) or `stacked-bar` (composition).
4. **When measures >=3 and dimensions = 1:**
   - Use `bubble-distribution` (portfolio quadrant) if one measure should map to size or color.
   - Use `scatter-relationships` when two measures determine position and the third is an annotation.
5. **Directional change emphasis (positive vs negative deltas):** choose `diverging-bar`.
6. **Relationship focus with 2 measures + 1 dimension:** choose `correlation-scatter`.

## Patterns Matrix

| Descriptor | Suggested Pattern | Default Renderer | Notes |
| --- | --- | --- | --- |
| `1Q + 1N`, comparison | `bar` | Vega-Lite | Switch to ECharts above 500 rows (see performance guide). |
| `1Q + 2N`, comparison | `grouped-bar` | Vega-Lite | Multi-series line if one dimension is temporal. |
| `1Q + 2N`, composition | `stacked-bar` / `stacked-100-bar` | Vega-Lite | Normalized version preferred for share-oriented metrics. |
| `1Q + 2N`, intensity | `time-grid-heatmap` | Vega-Lite | Promote to ECharts for >10k cells. |
| `2Q + 1N`, relationship | `correlation-scatter` | ECharts | Offers better tooltip density and zooming. |
| `3Q + 1N`, portfolio | `bubble-distribution` | ECharts | Size encodes 3rd measure, color optional. |
| `1Q + 1T`, accumulation | `running-total-area` | Vega-Lite | Add trendline overlay for burn rate comparisons. |
| `2Q + 1T`, trend | `multi-series-line` | Vega-Lite -> ECharts at high density | The CLI prints the renderer threshold. |
| `3Q + 1T`, tolerance | `trend-vs-target-band` | ECharts | Leverages layering + highlight interactions. |
| Matrix (same domain twice) | `correlation-matrix` | Vega-Lite | Use highlight interactions plus accessible table fallback. |

## Confidence Heuristics

`pnpm viz:suggest` exposes the same metadata used above. Review the scored output:

- `score.pattern`: Weight applied to structural fit (goal + counts).
- `score.layout`: Bonus when layout requirements are explicit.
- `score.renderer`: Adjustment when renderer selection is deterministic.

Treat any result with `confidence < 0.65` as a prompt to revisit the spec. Usually this means the schema lacks enough structure or there are conflicting goals (e.g., both composition and trend).

## Documenting the Decision

Include the following snippet inside docs or pull requests:

```
Decision: 1Q + 2N comparison => Grouped Bar (Vega-Lite default)
Renderer Evidence: artifacts/performance/viz-benchmark-results.json (scenario #12)
Accessibility Impact: Provide narrative summary + AccessibleTable fallback per rule 3
```

This keeps architecture reviewers aligned with the automated heuristics and closes the loop between research artifacts and day-to-day implementation.
