# Accessibility

Network & Flow visualizations include built-in accessibility features to ensure all users can access the data, regardless of ability.

## Overview

All components provide:

1. **Semantic HTML** - Proper `role`, `aria-label`, and structure
2. **Table Fallback** - Data presented as accessible table
3. **Keyboard Navigation** - Tab-accessible interactive elements
4. **Screen Reader Support** - ARIA live regions for dynamic updates
5. **Color Independence** - Patterns and labels supplement color

## Table Fallback

Every Network & Flow component includes an accessible table representation:

```tsx
<Treemap
  data={data}
  name="Revenue Distribution"
  showTable  // Renders accessible table below chart
/>
```

The table fallback ensures screen reader users can access all data:

### Treemap/Sunburst Table

```html
<table aria-label="Revenue Distribution data table">
  <thead>
    <tr>
      <th>Name</th>
      <th>Value</th>
      <th>Percentage</th>
      <th>Path</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Enterprise</td>
      <td>$2,200,000</td>
      <td>40%</td>
      <td>Revenue > North America > Enterprise</td>
    </tr>
    ...
  </tbody>
</table>
```

### ForceGraph Tables

Two tables for nodes and links:

```html
<!-- Nodes table -->
<table aria-label="Team Collaboration nodes">
  <thead>
    <tr><th>Node</th><th>Group</th><th>Connections</th></tr>
  </thead>
  <tbody>
    <tr><td>Alice</td><td>Engineering</td><td>5</td></tr>
    ...
  </tbody>
</table>

<!-- Links table -->
<table aria-label="Team Collaboration connections">
  <thead>
    <tr><th>From</th><th>To</th><th>Weight</th></tr>
  </thead>
  <tbody>
    <tr><td>Alice</td><td>Bob</td><td>10</td></tr>
    ...
  </tbody>
</table>
```

### Sankey Tables

```html
<!-- Nodes table -->
<table aria-label="Energy Flow nodes">
  <thead>
    <tr><th>Node</th><th>Total Flow</th></tr>
  </thead>
  <tbody>
    <tr><td>Electricity</td><td>550 units</td></tr>
    ...
  </tbody>
</table>

<!-- Flows table -->
<table aria-label="Energy Flow connections">
  <thead>
    <tr><th>Source</th><th>Target</th><th>Flow</th></tr>
  </thead>
  <tbody>
    <tr><td>Coal</td><td>Electricity</td><td>250</td></tr>
    ...
  </tbody>
</table>
```

## ARIA Labels

Components use proper ARIA attributes:

```tsx
<Treemap
  data={data}
  name="Q4 Revenue"
  description="Treemap showing revenue distribution by region and segment for Q4 2024"
  aria-label="Q4 Revenue treemap visualization"  // Custom override
/>
```

Rendered HTML:

```html
<div role="figure" aria-label="Q4 Revenue treemap visualization">
  <div aria-hidden="true"><!-- Canvas chart --></div>
  <table><!-- Accessible data table --></table>
</div>
```

## Keyboard Navigation

Interactive elements are keyboard accessible:

| Key | Action |
|-----|--------|
| `Tab` | Move between interactive elements |
| `Enter` / `Space` | Activate selection |
| `Escape` | Clear selection / exit drill-down |
| `Arrow Keys` | Navigate within focused component |

### Focus Management

```tsx
<Treemap
  data={data}
  drilldown
  onDrillDown={(path) => {
    // Focus returns to chart after drill-down
    // Screen reader announces new context
  }}
/>
```

## Screen Reader Announcements

Dynamic updates are announced via ARIA live regions:

```tsx
// Internal implementation
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {announcement}
</div>
```

Announcements include:
- Selection changes: "Selected: North America, value 400,000"
- Drill-down navigation: "Drilled into North America, showing 3 children"
- Filter changes: "Filtered to EMEA region"

## Color Independence

### Problem

Color-only encoding excludes colorblind users:

```tsx
// Problematic: relies only on color
<ForceGraph data={data} colorField="group" />
```

### Solution

Supplement color with other visual channels:

```tsx
<ForceGraph
  data={data}
  colorField="group"
  showLabels          // Labels identify nodes
  showLegend          // Legend explains colors
/>
```

### Treemap/Sunburst

Labels are shown by default. For dense visualizations:

```tsx
<Treemap
  data={data}
  // Tooltips show name + value on hover
  // Table fallback provides full access
  showTable
/>
```

### Pattern Support (Future)

Pattern fills for categories are planned for v1.1:

```tsx
// Future API
<Treemap
  data={data}
  usePatterns  // Add patterns in addition to colors
/>
```

## High Contrast Mode

Components respect system high contrast preferences:

```css
@media (prefers-contrast: high) {
  /* Stronger borders, higher contrast colors */
  [data-viz-chart] {
    --border-color: black;
    --text-color: black;
    --background: white;
  }
}
```

## Reduced Motion

Respect user motion preferences:

```css
@media (prefers-reduced-motion: reduce) {
  /* Disable animations */
  [data-viz-chart] canvas {
    transition: none !important;
  }
}
```

Components also check programmatically:

```tsx
// Internal: check motion preference
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

// Disable animation if preferred
const option = {
  animation: !prefersReducedMotion,
  // ...
};
```

## Description Best Practices

Write clear, informative descriptions:

```tsx
// Good: Describes content and purpose
<Treemap
  name="Q4 2024 Revenue Distribution"
  description="Treemap visualization showing company revenue breakdown by region (North America, EMEA, APAC) and customer segment (Enterprise, Mid-Market, SMB) for the fourth quarter of 2024"
  data={data}
/>

// Poor: Too vague
<Treemap
  name="Data"
  description="A treemap"
  data={data}
/>
```

### Description Guidelines

1. **State the purpose** - What question does this answer?
2. **Describe the structure** - What dimensions are shown?
3. **Include context** - Time period, filters applied
4. **Mention key insights** - What should users notice?

## Testing Accessibility

### Automated Testing

```bash
# Run a11y checks on Storybook
pnpm a11y:check

# Check specific stories
pnpm a11y:check --stories="**/Treemap.stories.tsx"
```

### Manual Testing Checklist

- [ ] **Screen reader**: Navigate with VoiceOver/NVDA
- [ ] **Keyboard only**: Complete all interactions without mouse
- [ ] **Zoom**: Content readable at 200% zoom
- [ ] **Color contrast**: Check with contrast checker
- [ ] **Table fallback**: Verify data completeness

### Screen Reader Testing

Test with:
- **macOS**: VoiceOver (Cmd + F5)
- **Windows**: NVDA (free) or JAWS
- **Mobile**: VoiceOver (iOS) or TalkBack (Android)

Verify:
1. Chart name/description is announced
2. Table is navigable
3. Selections are announced
4. Drill-down state changes are announced

## WCAG Compliance

Network & Flow components target WCAG 2.1 AA:

| Criterion | Status | Notes |
|-----------|--------|-------|
| 1.1.1 Non-text Content | ✅ | Table fallback + aria-label |
| 1.3.1 Info and Relationships | ✅ | Semantic HTML structure |
| 1.4.1 Use of Color | ✅ | Labels supplement color |
| 1.4.3 Contrast | ✅ | 4.5:1 text contrast |
| 2.1.1 Keyboard | ✅ | Full keyboard access |
| 2.4.4 Link Purpose | ✅ | Clear interactive labels |
| 4.1.2 Name, Role, Value | ✅ | ARIA attributes |

## Known Limitations

1. **Canvas rendering** - ECharts uses canvas, which is inherently less accessible than SVG. Table fallbacks compensate.

2. **Complex interactions** - Drill-down and filtering can be disorienting. Clear announcements help.

3. **Large datasets** - Tables with 500+ rows may be overwhelming. Consider pagination or summary views.

4. **Touch devices** - Some gestures may conflict with screen reader gestures.

## Improving Accessibility

If you find accessibility issues:

1. **Report** - Open an issue with reproduction steps
2. **Describe impact** - How does it affect users?
3. **Suggest fix** - If you have ideas

We prioritize accessibility fixes and welcome contributions.

## Related

- [Accessibility Checklist](../accessibility-checklist.md) - Full OODS a11y checklist
- [High Contrast Guide](../../policies/hc-quickstart.md) - High contrast mode
- [Performance Guide](../performance-guide.md) - Large dataset handling
