# Sprint 21: Visualization Extension Pack - Research & Planning

**Date**: 2025-11-14  
**Status**: Planning Phase  
**Scope**: Foundation for trait-based data visualization system

---

## Vision Statement

Build a trait-based visualization extension pack that demonstrates how OODS Foundry's composition model scales to complex, data-driven components. Goals:

1. **Trait-driven patterns**: Define traits for visualization capabilities (Plottable, Encodable, Scaleable, etc.)
2. **Renderer abstraction**: Abstract viz spec → multiple renderers (Vega-Lite, ECharts, SVG native)
3. **Accessibility-first**: WCAG 2.2 AA compliance, screen reader patterns, keyboard nav
4. **Token integration**: Color scales, size scales, motion via existing token system
5. **Progressive complexity**: Start simple (bar/line charts) → geospatial → hierarchical

---

## Research Questions

### R21.1: Visualization Library Landscape

**Key Questions:**
- Which libraries support declarative specs + React integration?
- What are trade-offs: bundle size, a11y, customization, token integration?
- How do libraries handle responsive design, theming, dark mode?
- What's the server-side rendering story?

**Libraries to evaluate:**
1. **Vega-Lite** - Grammar of graphics, JSON specs, good a11y baseline
2. **Apache ECharts** - Rich features, large community, theme support
3. **D3.js** - Low-level control, steep learning curve, manual a11y
4. **Observable Plot** - D3 successor, simpler API, D3 Observable team
5. **Recharts** - React-native, simple API, limited customization
6. **Victory** - React-native, good theming, FormidableLabs
7. **Nivo** - React wrapper for D3, good docs, limited control

**Decision criteria:**
- Accessibility support (ARIA, keyboard, screen reader)
- Token/theming integration ease
- Bundle size (<100KB gzipped for core)
- TypeScript support + type safety
- Trait composition fit (can we layer capabilities?)

---

### R21.2: Trait Patterns for Data Visualization

**Core visualization traits needed:**

**Plottable** - Can accept data and render visual marks
- Parameters: `dataFormat` (array, nested, hierarchical), `markType` (bar, line, point, area)
- Schema adds: `data`, `marks`, `encoding`
- Semantics: Data source, refresh strategy, loading states

**Encodable** - Maps data fields to visual properties
- Parameters: `channels` (x, y, color, size, shape, opacity)
- Schema adds: `encoding` object with channel mappings
- Semantics: Scale types (linear, log, time, ordinal), domain/range

**Scaleable** - Handles axes, legends, scales
- Parameters: `scaleTypes` (continuous, discrete, temporal)
- Schema adds: `scales`, `axes`, `legends`
- Semantics: Tick formatting, grid lines, axis labels

**Interactable** - Supports tooltips, selection, drill-down
- Parameters: `interactions` (hover, click, brush, zoom)
- Schema adds: `tooltip`, `selection`, `handlers`
- Semantics: Event delegation, state management

**Annotatable** - Supports reference lines, labels, annotations
- Parameters: `annotationTypes` (line, rect, text, arrow)
- Schema adds: `annotations` array
- Semantics: Positioning strategy, z-index

**Animatable** - Transition support for data updates
- Parameters: `transitionType` (fade, grow, slide, morph)
- Schema adds: `motion` config (duration, easing, stagger)
- Semantics: Reduced-motion support, transition key

**Responsive** - Adapts to container size
- Parameters: `breakpoints`, `responsiveStrategy` (resize, simplify, stack)
- Schema adds: `responsive` config
- Semantics: Container query support, aspect ratio lock

**Key decision:** 
- Do these traits extend existing OODS core traits (Identifiable, Timestamped, Statusable)?
- How do viz traits interact with View contexts (List/Detail/Form/Timeline)?

---

### R21.3: Accessibility for Data Visualization

**WCAG 2.2 Requirements for Viz:**

**Perceivable:**
- Color is not the only visual means (patterns, labels, shapes)
- Contrast ratios meet AA (4.5:1 text, 3:1 UI elements)
- Text alternatives for non-text content (alt text, descriptions)
- Info/relationships programmatically determined (ARIA labels)

**Operable:**
- Keyboard accessible (focus visible, tab order logical)
- Enough time to read/use (no auto-advancing charts)
- Seizure/motion prevention (no flashing, respect prefers-reduced-motion)
- Navigate-able (skip links, focus management)

**Understandable:**
- Readable (legible fonts, clear labels, axis titles)
- Predictable (consistent patterns, no surprises)
- Input assistance (errors, labels, instructions)

**Robust:**
- Compatible with assistive tech (ARIA roles, proper semantics)
- Works across browsers/devices

**Specific patterns to research:**
1. **Screen reader patterns**: 
   - Sonification? (audio representation)
   - Table alternatives? (data table fallback)
   - Text descriptions? (structured narrative)
   
2. **Keyboard navigation**:
   - Tab through data points?
   - Arrow keys for exploration?
   - Shortcuts for filtering/sorting?

3. **Color independence**:
   - Pattern fills (stripes, dots, hatch)
   - Shape encoding (circle, square, triangle)
   - Texture overlays?

4. **High-contrast mode**:
   - forced-colors support (map to system colors)
   - Border emphasis when color removed
   - Pattern/texture fallbacks

**Research sources:**
- W3C Accessible Rich Internet Applications (ARIA) Authoring Practices
- A11y Weekly (data viz episodes)
- DataViz A11y Checklist (by Amy Cesal, Sarah Fossheim)
- Observable Plot accessibility features

---

### R21.4: Dual-Renderer Architecture

**Problem:** Different viz libraries have strengths/weaknesses. Can we create an abstract spec that renders via multiple engines?

**Architecture concept:**

```
Trait Composition
      ↓
Abstract Viz Spec (JSON)
      ↓
Renderer Selection (Vega-Lite | ECharts | SVG Native)
      ↓
React Component
```

**Abstract spec format** (inspired by Vega-Lite but library-agnostic):

```typescript
interface VizSpec {
  $schema: 'https://oods.dev/viz-spec/v1';
  data: DataSource;
  mark: MarkType; // bar, line, point, area, etc.
  encoding: {
    x?: EncodingChannel;
    y?: EncodingChannel;
    color?: EncodingChannel;
    size?: EncodingChannel;
    // ... more channels
  };
  config?: VizConfig; // theme, scales, axes
}
```

**Renderer adapter pattern:**

```typescript
interface VizRenderer {
  render(spec: VizSpec, container: HTMLElement): VizInstance;
  update(instance: VizInstance, spec: VizSpec): void;
  destroy(instance: VizInstance): void;
}

class VegaLiteRenderer implements VizRenderer { /* ... */ }
class EChartsRenderer implements VizRenderer { /* ... */ }
class SVGRenderer implements VizRenderer { /* ... */ }
```

**Key research questions:**
- What's the minimal common spec that works across renderers?
- Where do renderer-specific features live? (escape hatch?)
- How do we handle progressive enhancement?
- Performance implications of abstraction layer?

**Precedents to study:**
- Vega-Lite (high-level → Vega → D3)
- React-Vis (declarative → D3)
- Chart.js plugins (extend base)
- Plotly.js (declarative JSON → WebGL/SVG/Canvas)

---

### R21.5: Token Integration for Visualization

**Challenge:** How do visualization scales integrate with OODS token system?

**Token needs for viz:**

**1. Color scales** (already have some foundation):
- Sequential: single hue progression (light → dark)
- Diverging: two hues meeting at neutral (red ← white → blue)
- Categorical: distinct hues for categories (qualitative)
- Theme-aware: respect light/dark/HC modes

**Existing tokens we can leverage:**
- `--sys-status-*` for categorical (success/warning/error/info)
- `--sys-color-*` for semantic colors
- `--ref-color-*` for palette

**New tokens needed:**
- `--viz-scale-sequential-*` (steps 1-9?)
- `--viz-scale-diverging-*` (negative/neutral/positive)
- `--viz-scale-categorical-*` (distinct categories)

**2. Size scales**:
- Point sizes (3px, 5px, 8px, 12px, 16px)
- Stroke widths (1px, 2px, 3px, 4px)
- Bar widths (responsive?)

**Tokens:**
- `--viz-size-point-*`
- `--viz-size-stroke-*`
- `--viz-size-bar-width-*`

**3. Motion/transitions** (leverage existing motion tokens?):
- Duration: `--motion-duration-short` (150ms)
- Easing: `--motion-easing-standard`
- Stagger: new token? `--viz-motion-stagger` (50ms)

**4. Typography**:
- Axis labels: existing `--type-body-sm`?
- Tick labels: existing `--type-label`?
- Title: existing `--type-heading-*`?
- Annotations: existing `--type-caption`?

**Key decisions:**
- Separate viz tokens or extend existing system?
- How many scale steps? (5? 7? 9? Based on research)
- OKLCH deltas for sequential scales?
- HC mode: maps to Canvas/CanvasText/Highlight?

---

## Implementation Phases (Sprint 21-24 Tentative)

### Sprint 21: Foundation & Simple Charts
**Focus:** Core traits, single renderer (Vega-Lite?), bar/line charts

**Missions (tentative):**
- R21.1-R21.5: Research missions (5 reports)
- B21.1: Core viz traits (Plottable, Encodable, Scaleable)
- B21.2: Abstract viz spec v0.1
- B21.3: Vega-Lite renderer adapter
- B21.4: Bar chart component (with a11y baseline)
- B21.5: Line chart component (with responsive + motion)
- B21.6: Token scale expansion (color/size scales)
- B21.7: A11y validation suite for viz

### Sprint 22: Chart Variety & Dual Renderer
**Focus:** More chart types, add ECharts renderer, comparison

**Missions (tentative):**
- B22.1: Area/scatter/bubble charts
- B22.2: ECharts renderer adapter
- B22.3: Renderer selection + perf benchmarks
- B22.4: Interactive traits (Interactable implementation)
- B22.5: Tooltip/legend components
- B22.6: HC mode patterns (forced-colors support)

### Sprint 23: Complex Visualizations
**Focus:** Hierarchical, network, geospatial

**Missions (tentative):**
- B23.1: Tree/treemap (hierarchical trait)
- B23.2: Network graph (relational trait)
- B23.3: Choropleth map (geospatial trait)
- B23.4: Annotation system (Annotatable trait)
- B23.5: Drill-down/filtering patterns

### Sprint 24: Polish & Documentation
**Focus:** Patterns, docs, examples, Storybook gallery

**Missions (tentative):**
- B24.1: Viz pattern library (common combos)
- B24.2: Comprehensive docs (authoring guide)
- B24.3: Storybook viz gallery
- B24.4: Sample dashboards (real-world examples)
- B24.5: Performance optimization pass
- B24.6: A11y audit & compliance report

---

## Open Questions for Discussion

1. **Renderer strategy:** Start with one (Vega-Lite) or dual from beginning?
2. **Trait granularity:** Fewer fat traits vs many small traits?
3. **Token approach:** Extend existing vs separate viz namespace?
4. **A11y baseline:** Table fallback? Sonification? Both?
5. **Scope creep:** How do we keep Sprint 21 focused/achievable?
6. **Testing strategy:** Visual regression for charts? Snapshot data?
7. **Bundle size budget:** What's acceptable for viz extension pack?

---

## Success Criteria (Sprint 21)

By end of Sprint 21, we should have:

✅ 5 comprehensive research reports (R21.1-R21.5)
✅ 3-5 core viz traits defined and documented
✅ Abstract viz spec v0.1 with schema
✅ 1 renderer adapter fully working (Vega-Lite or ECharts)
✅ 2 chart types production-ready (bar + line)
✅ Viz token scales integrated (color/size)
✅ A11y baseline: keyboard nav, screen reader support, HC mode
✅ Test suite: unit tests + a11y tests + visual regression
✅ Storybook: 10+ stories demonstrating patterns
✅ Docs: trait authoring guide, renderer guide, token guide

---

## Next Steps

1. **Review this plan** - Adjust scope, priorities, concerns
2. **Execute research** - R21.1-R21.5 (can be parallel)
3. **Synthesize findings** - Create decision doc from research
4. **Build mission specs** - Create detailed YAML missions with rich JSON
5. **Seed database** - Add Sprint 21 missions to CMOS SQLite
6. **Begin Sprint 21** - Kick off first mission

---

## Notes

- This is a NEW domain for OODS Foundry - expect learning curve
- Research phase is CRITICAL - don't rush into implementation
- A11y is non-negotiable - must be baked in from start
- Token integration should feel natural, not bolted on
- Keep trait patterns consistent with core system (Identifiable, Statusable, etc.)

