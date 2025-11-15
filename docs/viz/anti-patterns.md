# Visualization Anti-patterns

When pairing traits, avoid the following pitfalls surfaced during the
RDS.7/RDV.2 research cycles.

## 1. Pie/Donut overload
- **Symptom**: categorical shares communicated through pie/donut segments.
- **Issue**: difficult to compare slices; fails accessibility contrast checks.
- **Fix**: use `stacked-bar` (absolute) or `stacked-100-bar` (normalized).

## 2. Raw heatmaps for sparse data
- **Symptom**: applying `MarkRect` to a dataset with gaps or <6 rows.
- **Issue**: empty cells imply missing data and mislead confidence.
- **Fix**: switch to grouped bar/line or fill missing combinations explicitly
  so the heatmap remains dense. The CLI flags this via the `density` hint.

## 3. Trend lines without consistent grids
- **Symptom**: Multi-series line charts using irregular temporal spacing.
- **Issue**: hard to parse slopes; leads to incorrect correlation claims.
- **Fix**: align to a fixed interval (week/month) or use grouped bar if
  sampling is inconsistent.

## 4. Overloaded color encodings
- **Symptom**: Reusing `EncodingColor` for both grouping and semantics (e.g.,
  positive/negative).
- **Issue**: accessible palette cannot communicate two concepts at once.
- **Fix**: pick a consistent meaning—use diverging palettes for signed data or
  categorical palettes for cohorts, never both simultaneously.

## 5. Missing fallback narratives
- **Symptom**: Complex charts (heatmap, bubble, diverging) lacking a11y
  narratives or table fallbacks.
- **Issue**: fails RDV.4 contract; screen-reader users lose insight.
- **Fix**: use the `a11y.narrative` block from the provided specs as a template
  and ensure every component renders `AccessibleTable` fallback.

Keep this checklist handy during reviews and run `pnpm viz:suggest` to confirm
the schema-goal pairing lines up with approved patterns.
