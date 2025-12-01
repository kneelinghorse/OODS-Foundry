# Sprint 24: Storybook Fixes & Welcome Page Update

**Mission:** B24.2 - Storybook Improvements & Polish  
**Issues to address:** Welcome page, broken area charts, token warnings

---

## 🏠 **Welcome Page Update (apps/explorer/.storybook/Intro.mdx)**

### **Current Issues:**
1. Hero text: "Trait-based objects. Purpose-built docs. Public-ready Storybook." - feels vague
2. Deep links don't work (internal Storybook routing changed)
3. Content focuses on "Explorer" branding (confusing for visitors)
4. Stats shown but not contextualized well

### **Proposed New Hero Text:**

**Option 1 (Concise):**
```
OODS Foundry
Object-Oriented Design System

Build from meaning, not markup. Compose traits into objects. 
Render objects in contexts. Let the system handle the rest.
```

**Option 2 (Feature-focused):**
```
OODS Foundry
Where Objects Compose and Meaning Matters

Trait-based composition • Context-aware rendering • Multi-brand theming
WCAG 2.2 AA compliant • Data visualization • Agent-native architecture
```

**Option 3 (Value-prop):**
```
OODS Foundry
Design System for Object-Oriented Interfaces

Describe your objects once (User, Subscription, Product). 
Compose from traits (Statusable, Timestamped, Addressable).
Render in any context (List, Detail, Dashboard, Chart).
The system generates types, views, tokens, and tests.
```

**Recommendation:** Option 3 - Clear value prop, shows what you get

---

### **Navigation Section Update:**

**Current:** Deep links to specific stories (broken)

**Proposed:** Category overview (stable)
```markdown
## **What to Explore**

**Foundations** — Color, typography, spacing, motion tokens with OKLCH deltas and WCAG guardrails.

**Components** — 40+ production components: primitives, statusables, inputs, overlays, data displays.

**Contexts** — List/Detail/Form/Timeline render contexts with responsive density and semantic regions.

**Visualization** — 5 chart types (bar, line, scatter, area, heatmap), layout compositions (facet/layer), 
35+ documented patterns, dual-renderer support (Vega-Lite + ECharts).

**Domains** — End-to-end flows: Billing (subscription, invoice, usage), Account management, Authorization.

**Brand & Accessibility** — Multi-brand theming (A/B), dark mode, forced-colors (high-contrast) with 
automated compliance checks.

Navigation follows this order in the sidebar. Browse freely or jump to specific components via search.
```

---

### **Stats Update:**

**Current:**
```
Release Target: v1.0 RC
Tests: 754 / 754
A11y: 49 / 49 axes
Guardrails: Purity • Tokens • Perf
```

**Proposed:** Add context
```
**Release:** v1.0 RC (Sprint 20)
**Quality:** 754/754 tests passing, 49/49 a11y checks, 0 performance violations
**Guardrails:** Token purity audit, OKLCH color deltas, contrast compliance, performance budgets
**What's New:** Visualization system (Sprint 21-23) - trait-based charts with dual-renderer support
```

---

## 📊 **Broken Area Charts (Pattern Gallery V2)**

### **Issues Identified:**

**File:** `stories/viz/PatternGalleryV2.stories.tsx`

**Broken stories:**
1. **"Layered Actual vs Target"** - Area chart not rendering
2. **"Channel Contribution Area"** - Area chart not rendering
3. **"Line - Facet Target Band"** - Not showing (might be in FacetedCharts.stories.tsx)

### **Likely Causes:**

**1. Missing spec files:**
```typescript
// In PatternGalleryV2.stories.tsx, check if these imports exist:
import layeredActualTarget from '../../examples/viz/patterns-v2/layered-actual-target.spec.json';
import channelContribution from '../../examples/viz/patterns-v2/channel-contribution-area.spec.json';
```
If files missing, need to create them.

**2. Spec validation failures:**
- Area chart specs might have invalid schema
- Check console for Zod validation errors
- Verify marks array structure

**3. Component mapping:**
```typescript
// Pattern Gallery might not be mapping area chart specs correctly
const ChartComponent = spec.marks[0]?.trait === 'MarkArea' ? AreaChart : ...
```

**4. Data transform issues:**
- Stacked area requires stack transform
- Layered area might need explicit layer config
- Check if `prepareAreaChartSpec` being called

### **Debug Approach:**

```bash
# 1. Check if spec files exist
ls examples/viz/patterns-v2/*area*.json
ls examples/viz/patterns-v2/*target*.json

# 2. Validate specs
node -e "console.log(require('./examples/viz/patterns-v2/layered-actual-target.spec.json'))"

# 3. Check component rendering
pnpm storybook  # Open dev mode, check console for errors

# 4. Test area chart directly
pnpm test tests/components/viz/AreaChart.test.tsx
```

### **Fix Strategy:**

**If spec files missing:**
- Create spec files based on pattern library v2 (B23.6)
- Follow examples from working area chart stories

**If validation failing:**
- Check NormalizedVizSpec schema compliance
- Verify marks array structure
- Ensure encoding fields present

**If component mapping broken:**
- Update PatternGalleryV2 component selector logic
- Add explicit area chart handling
- Test with simple area spec first

---

## 🔧 **Quick Fixes for B24.2**

### **Priority 1: Welcome Page** (30 min)
1. Update IntroSplash.tsx with new hero text (Option 3 recommended)
2. Replace deep links with category overview
3. Update stats section with context
4. Test in dev mode + static build

### **Priority 2: Broken Charts** (1-2 hours)
1. Identify missing spec files
2. Create specs if missing (use area chart patterns from B23.6)
3. Fix component mapping in PatternGalleryV2
4. Verify all 3 stories render
5. Add to VRT baseline

### **Priority 3: Token Collision** (15 min)
1. Add to .storybook/main.ts:
```typescript
build: {
  chunkSizeWarningLimit: 2000
}
```
2. Verify warning gone in static build

**Total estimated time:** 2-3 hours

---

## 📝 **Updated B24.2 Mission Scope**

✅ Mission updated in database to include:
- Welcome page refresh (new hero text, fixed links)
- Fix 3 broken area chart stories
- Token collision warning fix
- Navigation improvements

**All captured in B24.2 success criteria and deliverables.**

---

## 🎯 **Acceptance Criteria**

**B24.2 is complete when:**
- ✅ Welcome page has new hero text (clear, compelling)
- ✅ Welcome links work or are removed (no broken deep links)
- ✅ All 3 area charts render in Pattern Gallery V2
- ✅ Token collision warning eliminated
- ✅ Static build completes cleanly
- ✅ All existing stories still work (no regressions)
- ✅ Tested in dev mode + static build

**Estimated:** Can be completed in single 2-3 hour session


