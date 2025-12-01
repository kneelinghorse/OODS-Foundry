# Sprint 21: Visualization Extension Pack - Decision Framework

**Date:** 2025-11-14  
**Status:** Planning  
**Research Foundation:** 10 complete reports (RDV.1-6, RDS.7-10)

---

## 📚 **What Research Already Decided**

### ✅ **Architecture Decisions (Already Made)**

**From RDS.7 (Synthesis Report):**
1. **Trait Taxonomy v0.1** - 6 categories defined:
   - Mark Traits (bar, point, line, area)
   - Encoding Traits (Position.X/Y, Color.Hue, Size, etc.)
   - Scale Traits (linear, log, temporal, ordinal)
   - Guide Traits (Axis, Legend, Gridline)
   - Interaction Traits (Highlight, Filter, Tooltip)
   - Layout Traits (Facet.Grid, Repeat, Layer)

2. **Normalized Viz Spec v0.1** - JSON schema defined:
   ```json
   {
     "data": {...},
     "transforms": [...],
     "marks": [...],
     "encoding": {...},
     "a11y": { "description": "...", "aria-label": "..." },
     "portability": { "fallback_type": "table|text" }
   }
   ```

3. **Schema→Encoding Mapping Table** - Intelligence defaults defined:
   - 1Q+1N → Bar chart (Position.Y for quantitative, Position.X for nominal)
   - 2Q → Scatter plot
   - 1Q+2N → Grouped bar chart
   - Confidence signal (High/Medium/Low)

**From RDV.6 (Library Analysis):**
4. **Dual-Renderer Strategy:**
   - **Primary:** Vega-Lite (grammar-pure, JSON spec, good a11y baseline)
   - **Secondary:** ECharts (enterprise-grade, Canvas, better interactions)
   - **Rejected:** D3 (too low-level), Recharts (poor composability), Plotly (deprecated transforms)

**From RDS.9 (Interaction Semantics):**
5. **Interaction Model:**
   - Reactive signal-based (Events → Signals → Predicates → Production Rules)
   - Finite State Machine (FSM) for interaction lifecycle
   - Normalized event payload schema defined

**From RDV.4 (Accessibility):**
6. **A11y Strategy:**
   - 15 equivalence rules defined (e.g., color must have redundant encoding)
   - Two-part alternative: table fallback + narrative description
   - WCAG 2.2 AA compliance mandatory

---

## 🤔 **Decisions Still Needed for Sprint 21**

### **1. Sprint 21 Scope - How Much?**

**Option A: Foundation Only (Recommended)**
- Focus: Trait definitions + Vega-Lite renderer + 2 chart types
- **Missions (6-7):**
  - Port viz trait taxonomy into OODS trait engine
  - Implement Normalized Viz Spec v0.1 as composable object
  - Build Vega-Lite adapter (traits → VL JSON)
  - Bar chart component (with a11y baseline)
  - Line chart component (temporal data)
  - Viz tokens (color scales, size scales)
  - A11y validation suite
- **Pros:** Focused, achievable, validates core architecture
- **Cons:** Limited chart variety, single renderer only

**Option B: Foundation + Dual Renderer**
- Foundation from Option A + ECharts adapter
- **Additional missions (2-3):**
  - ECharts adapter implementation
  - Renderer comparison benchmarks
  - Interaction trait with both renderers
- **Pros:** Proves dual-renderer concept early
- **Cons:** Larger scope, more risk

**Option C: Atomic Pattern Coverage**
- Foundation + more chart types (scatter, area, heatmap)
- **Additional missions (3-4):**
  - Scatter plot component
  - Area chart component
  - Heatmap component
  - Chart pattern library
- **Pros:** Broad pattern coverage
- **Cons:** May delay renderer architecture validation

---

### **2. Trait Granularity - How Fine?**

**From research:** RDS.7 defines ~30 traits across 6 categories

**Option A: Start with 10-12 essential traits**
- Mark: Bar, Line, Point, Area
- Encoding: Position.X, Position.Y, Color.Hue
- Scale: Linear, Temporal
- Guide: Axis, Legend
- **Pros:** Manageable scope, proven patterns
- **Cons:** Limited expressiveness

**Option B: Implement full taxonomy (30+ traits)**
- Complete Mark/Encoding/Scale/Guide/Interaction/Layout coverage
- **Pros:** Complete system from start
- **Cons:** Large scope, harder to validate

**Option C: Progressive implementation (Phase 1: 10, Phase 2: 20, Phase 3: 30+)**
- Sprint 21: 10 essential traits
- Sprint 22: Add 10 more (interactions, layout)
- Sprint 23: Complete taxonomy
- **Pros:** Iterative validation, lower risk
- **Cons:** Multiple sprints to completeness

---

### **3. Token Integration - Extend or Separate?**

**Option A: Extend existing token system**
- Use existing `--sys-color-*` for categorical scales
- Add `--viz-*` namespace for viz-specific needs
- **Pros:** Consistent with existing system, smaller footprint
- **Cons:** May blur boundaries, viz scales don't fit system tokens cleanly

**Option B: Separate viz namespace**
- All viz tokens under `--viz-*` prefix
- `--viz-scale-sequential-*`, `--viz-scale-categorical-*`, `--viz-size-*`
- **Pros:** Clear separation, easier to maintain
- **Cons:** More tokens, potential duplication

**Option C: Hybrid approach**
- Structural tokens (spacing, typography) from existing system
- Color scales as separate viz namespace
- **Pros:** Best of both worlds
- **Cons:** Need clear documentation of boundaries

---

### **4. A11y Baseline - Table, Narrative, or Both?**

**From RDV.4:** Two-part alternative recommended

**Option A: Table fallback (mandatory)**
- Every chart must generate accessible HTML table
- Narrative description optional
- **Pros:** Proven pattern, testable
- **Cons:** Tables don't convey trends well

**Option B: Narrative description (mandatory)**
- Every chart must have prose description
- Table optional for simple charts
- **Pros:** Better for conveying insights
- **Cons:** Harder to automate/validate

**Option C: Both (research recommendation)**
- Table for data structure
- Narrative for trends/insights
- **Pros:** Complete accessibility
- **Cons:** More work per chart

---

### **5. Testing Strategy - How to Validate Viz?**

**Option A: Snapshot testing**
- Jest snapshots of generated specs
- Validates spec structure stability
- **Pros:** Fast, catches regressions
- **Cons:** Doesn't validate visual output

**Option B: Visual regression testing**
- Chromatic for chart screenshots
- Validates actual rendered output
- **Pros:** Catches visual bugs
- **Cons:** Slower, more setup

**Option C: Dual strategy (recommended)**
- Spec snapshots for structure
- VRT for critical charts
- **Pros:** Best coverage
- **Cons:** More test infrastructure

---

### **6. Chart Context in View Engine**

**Should we add "Chart" as 5th core context?**

**Current contexts:** List, Detail, Form, Timeline

**Option A: Add Chart context**
- New context template: `<RenderObject context="chart" />`
- Chart-specific regions and layout
- **Pros:** First-class citizen, consistent with other contexts
- **Cons:** Adds complexity to view engine

**Option B: Embed in existing contexts**
- Charts rendered within Detail/Timeline contexts
- Use view extensions to add chart regions
- **Pros:** Reuses existing infrastructure
- **Cons:** Charts not a standalone use case

**Option C: Hybrid - Chart components but not context**
- Create `<ObjectChart>` component (separate from `<RenderObject>`)
- Charts have their own composition rules
- **Pros:** Separation of concerns, simpler
- **Cons:** Two different patterns in system

---

## 🎯 **Recommended Sprint 21 Scope**

Based on research and OODS patterns, I recommend:

**Scope:** Foundation + Validation  
**Missions:** 7 missions  
**Renderer:** Vega-Lite only (ECharts in Sprint 22)

### **Sprint 21 Missions (Tentative):**

1. **B21.1: Viz Trait Foundation**
   - Port 10 essential traits from RDS.7 taxonomy
   - Trait definitions (YAML + TS)
   - Unit tests for trait composition

2. **B21.2: Normalized Viz Spec Implementation**
   - Implement spec schema from RDS.7
   - Type generation (schema → TypeScript)
   - Validation suite (Zod/AJV)

3. **B21.3: Vega-Lite Adapter**
   - Trait composer → VL JSON translator
   - Integration with existing compositor
   - Adapter tests

4. **B21.4: Bar Chart Component**
   - First working chart (bar)
   - Table fallback implementation
   - A11y baseline (description + table)

5. **B21.5: Line Chart Component (Temporal)**
   - Temporal data handling
   - Motion/transitions
   - Responsive behavior

6. **B21.6: Viz Token Integration**
   - Color scales (sequential, categorical)
   - Size scales
   - Chart typography/spacing tokens
   - **Decision:** Hybrid approach (extend existing + add viz-specific)

7. **B21.7: A11y & Validation Suite**
   - Implement 15 equivalence rules from RDV.4
   - Table generator
   - Narrative description template
   - CI integration

**Success Criteria:**
- ✅ 10 viz traits working with trait engine
- ✅ 2 chart types production-ready (bar, line)
- ✅ Vega-Lite adapter validates dual-renderer concept
- ✅ A11y baseline established (table + description)
- ✅ Tokens integrated without breaking existing system
- ✅ All tests passing (unit, a11y, visual)

---

## ❓ **Questions for You:**

1. **Scope:** Foundation only (7 missions) or include ECharts adapter (9 missions)?

2. **Chart context:** Add as 5th core context, embed in existing, or separate component pattern?

3. **Token strategy:** Hybrid (extend + add viz), separate namespace, or full extension?

4. **Testing depth:** Spec snapshots only, or full VRT via Chromatic?

5. **Any chart types beyond bar/line?** (Scatter? Area? Heatmap?)

---

## 🚀 **Next Steps:**

Once you answer these questions, I'll:
1. Create detailed mission specs with rich JSON (using new DB fields!)
2. Insert missions directly into database
3. Generate Sprint 21 backlog
4. Prepare build session prompt

**What are your preferences for the 5 questions above?**

