# Chart Selection Guide

This guide turns schema metadata into a deterministic recommendation. Use it
when planning traits, writing docs, or invoking the `pnpm viz:suggest`
command.

## Decision Tree

1. **Count measures vs dimensions**
   - `≥3 measures` + `1 dimension` → Bubble Distribution (portfolio quadrants).
   - `2 measures` + `1 dimension` → Correlation Scatter.
   - `1 measure` + `2 discrete dimensions` → choose among grouped bar (if the
     secondary dimension represents cohorts), stacked bar (part-to-whole), or
     time-grid heatmap (when both axes are temporal/ordinal buckets).
2. **Temporal dimension present?**
   - Yes + grouping dimension → Multi-series Line.
   - Yes + tolerance band → Trend vs Target Band.
   - Yes + single dimension → Running Total Area (burn-up) or grouped/stacked
     bar (if timeline is bucketed quarters and comparison is categorical).
3. **Part-to-whole emphasis?**
   - Use Stacked Bar for absolute totals, 100% Stacked Bar for normalized share.
4. **Matrix layout required?**
   - Two identical domains (features × features) → Correlation Matrix.
   - Day/hour grid → Time Grid Heatmap.
5. **Directional change (positive/negative)**
   - Diverging Bar when the story revolves around deltas relative to a neutral
     baseline.

The chart below restates the heuristics `src/viz/patterns/suggest-chart.ts`
implements.

| Goal | Measures | Dimensions | Temporal | Pattern(s) |
| --- | --- | --- | --- | --- |
| Comparison | 1 | 2 | optional | Grouped Bar |
| Composition | 1 | 2 | optional | Stacked Bar / 100% Stacked |
| Comparison (±) | 1 | 1 | optional | Diverging Bar |
| Trend | 1 | 2 | 1 | Multi-series Line |
| Trend (band) | 3 | 1 | 1 | Trend vs Target Band |
| Accumulation | 1 | 1 | 1 | Running Total Area |
| Relationship | 2 | 2 | 0 | Correlation Scatter |
| Portfolio | 3 | 1 | 0 | Bubble Distribution |
| Intensity | 1 | 2 | 0 | Time Grid Heatmap |
| Relationship (matrix) | 1 | 2 | 0 | Correlation Matrix |

## CLI Usage

1. Describe your schema using counts and optional flags.
2. Run `pnpm viz:suggest` with either a descriptor string or explicit flags.

Examples:

```bash
# 1 quantitative + 2 nominal dimensions → grouped bar
pnpm viz:suggest "1Q+2N goal=comparison grouping=true"

# Multi-metric temporal trend → banded line
pnpm viz:suggest --measures 3 --dimensions 1 --temporals 1 --goal trend --multi --density flex

# Heatmap request
pnpm viz:suggest "1Q+2N matrix dense goal=intensity"
```

The CLI prints the top matches with score explanations and links back to the
pattern specs. Feed the output into docs or mission briefs to ensure trait
choices reference this canonical library.
