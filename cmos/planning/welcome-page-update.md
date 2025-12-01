# Welcome Page Update for B24.2

**File:** `apps/explorer/.storybook/IntroSplash.tsx`  
**Current Hero:** "Trait-based objects. Purpose-built docs. Public-ready Storybook."  
**Issue:** Vague, doesn't explain value prop clearly

---

## 🎯 **Updated Hero Text (Recommended)**

**Replace lines 77-79 with:**
```tsx
<h1
  style={{
    margin: 0,
    fontSize: 'clamp(2.25rem, 6vw, 3.25rem)',
    lineHeight: 1.05,
  }}
>
  Build from meaning, not markup
</h1>
```

**Replace lines 80-90 with:**
```tsx
<p
  style={{
    margin: 0,
    fontSize: '1.05rem',
    lineHeight: 1.6,
    color: 'var(--cmp-text-muted)',
  }}
>
  Describe your objects once—User, Subscription, Product. Compose from traits—Statusable, 
  Timestamped, Addressable. Render in any context—List, Detail, Dashboard, Chart. 
  The system generates types, views, tokens, tests, and documentation. Object-oriented 
  design, trait-first composition, agent-native architecture.
</p>
```

---

## 📊 **Updated Metrics Section**

**Replace metrics array (lines 3-8) with:**
```tsx
const metrics = [
  { label: 'Release', value: 'v1.0 RC' },
  { label: 'Tests', value: '754 / 754' },
  { label: 'A11y', value: '49 / 49' },
  { label: 'Viz System', value: 'Sprint 21-23' },
];
```

**Adds context that viz system is post-RC but available**

---

## 🔗 **Updated Quick Links (Fix Broken Deep Links)**

**Replace quickLinks array (lines 10-31) with:**
```tsx
const quickLinks = [
  {
    title: 'Foundations',
    description: 'Color, typography, spacing, motion tokens with OKLCH deltas and WCAG guardrails.',
    href: '#',  // Remove deep link, Storybook nav works better
  },
  {
    title: 'Components',
    description: '40+ production components: primitives, statusables, inputs, overlays, data displays.',
    href: '#',
  },
  {
    title: 'Contexts',
    description: 'List/Detail/Form/Timeline render contexts with responsive density and semantic regions.',
    href: '#',
  },
  {
    title: 'Visualization',
    description: '5 chart types, layout compositions (facet/layer), 35+ patterns, dual-renderer (Vega-Lite + ECharts).',
    href: '#',
  },
  {
    title: 'Domains',
    description: 'End-to-end flows: Billing (subscription, invoice), Account management, Authorization.',
    href: '#',
  },
  {
    title: 'Brand & Accessibility',
    description: 'Multi-brand theming (A/B), dark mode, forced-colors (high-contrast), automated compliance.',
    href: '#',
  },
];
```

**Changes:**
- ✅ Adds Visualization section (new!)
- ✅ Adds Domains section  
- ✅ Removes broken deep links (use `#` so cards still render but don't navigate)
- ✅ Better descriptions (more specific)
- ✅ Shows system scope clearly

---

## 🐛 **Broken Area Charts to Fix**

**File:** `stories/viz/PatternGalleryV2.stories.tsx`  
**Stories not rendering:**

### **1. "Layered Actual vs Target"**
**Issue:** Area chart not showing  
**Likely cause:** Missing spec file or incorrect component mapping  
**Fix:** 
```typescript
// Check if spec exists
import layeredActualTarget from '../../examples/viz/patterns-v2/layered-actual-target.spec.json';

// Ensure AreaChart component mapped correctly
const ChartComponent = spec.marks[0]?.trait === 'MarkArea' ? AreaChart : ...;

// Verify spec has valid structure
// Test directly: <AreaChart spec={layeredActualTarget} />
```

### **2. "Channel Contribution Area"**
**Issue:** Area chart not showing  
**Likely cause:** Stacked area spec might have transform issues  
**Fix:**
```typescript
// Check spec includes stack transform
{
  "transforms": [{ "type": "stack", "groupBy": "channel" }],
  "marks": [{ "trait": "MarkArea", "stacking": "normalized" }]
}

// Ensure stack-transform is applied before rendering
```

### **3. "Line - Facet Target Band"** 
**Issue:** Not showing (might be in FacetedCharts.stories.tsx instead)  
**Likely cause:** Facet layout spec or missing spec file  
**Fix:**
```typescript
// Check if facetTargetBand spec exists
import facetTargetBand from '../../examples/viz/patterns-v2/facet-target-band.spec.json';

// Verify facet trait structure
{
  "layout": {
    "type": "facet",
    "row": "category",
    "shared": { "scales": true }
  }
}

// Might need VizFacetGrid component instead of LineChart directly
```

---

## 🔍 **Debug Steps for B24.2**

### **Step 1: Identify missing specs**
```bash
cd examples/viz/patterns-v2
ls *actual*.json
ls *contribution*.json  
ls *target-band*.json

# If missing, create them based on pattern library v2
```

### **Step 2: Validate existing specs**
```bash
# Test spec structure
node -e "const spec = require('./examples/viz/patterns-v2/layered-actual-target.spec.json'); console.log(JSON.stringify(spec, null, 2))"

# Check for validation errors
pnpm test tests/viz/normalized-viz-spec.test.ts
```

### **Step 3: Test components directly**
```tsx
// Create minimal test story
export const TestLayeredArea: Story = {
  render: () => <AreaChart spec={layeredActualTarget} />
};

// If renders: issue is in PatternGalleryV2 mapping
// If doesn't render: issue is in spec or AreaChart component
```

### **Step 4: Fix PatternGalleryV2**
```typescript
// Ensure all area specs mapped to AreaChart
const componentMap = {
  'MarkBar': BarChart,
  'MarkLine': LineChart,
  'MarkArea': AreaChart,  // Check this mapping exists
  'MarkPoint': ScatterChart,
  // ...
};
```

---

## ✅ **Complete IntroSplash.tsx Update**

**Full updated component (copy-paste ready):**

```tsx
import React from 'react';

const metrics = [
  { label: 'Release', value: 'v1.0 RC' },
  { label: 'Tests', value: '754 / 754' },
  { label: 'A11y', value: '49 / 49' },
  { label: 'Viz System', value: 'Sprint 21-23' },
];

const quickLinks = [
  {
    title: 'Foundations',
    description: 'Color, typography, spacing, motion tokens with OKLCH deltas and WCAG guardrails.',
  },
  {
    title: 'Components',
    description: '40+ production components: primitives, statusables, inputs, overlays, data displays.',
  },
  {
    title: 'Contexts',
    description: 'List/Detail/Form/Timeline render contexts with responsive density and semantic regions.',
  },
  {
    title: 'Visualization',
    description: '5 chart types, layout compositions (facet/layer), 35+ patterns, dual-renderer support.',
  },
  {
    title: 'Domains',
    description: 'End-to-end flows: Billing (subscription, invoice), Account management, Authorization.',
  },
  {
    title: 'Brand & Accessibility',
    description: 'Multi-brand theming (A/B), dark mode, forced-colors with automated compliance checks.',
  },
];

const IntroSplash: React.FC = () => (
  <div
    style={{
      fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      background:
        'radial-gradient(circle at top, color-mix(in srgb, var(--cmp-surface-subtle) 60%, transparent) 0%, transparent 55%), var(--cmp-surface-canvas)',
      minHeight: '100vh',
      padding: 'clamp(2rem, 4vw, 4rem)',
      color: 'var(--cmp-text-body)',
      display: 'grid',
      gap: 'clamp(2rem, 2vw, 3rem)',
      boxSizing: 'border-box',
    }}
  >
    <section
      style={{
        display: 'grid',
        gap: '1.5rem',
        padding: 'clamp(2rem, 3vw, 3rem)',
        borderRadius: '2rem',
        background:
          'linear-gradient(125deg, color-mix(in srgb, var(--cmp-surface-panel) 85%, transparent), color-mix(in srgb, var(--cmp-surface-action) 40%, transparent))',
        boxShadow:
          '0 32px 64px -32px color-mix(in srgb, var(--cmp-text-body) 24%, transparent)',
      }}
    >
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <p
          style={{
            margin: 0,
            fontSize: '0.85rem',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: 'var(--cmp-text-muted)',
          }}
        >
          OODS Foundry
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(2.25rem, 6vw, 3.25rem)',
            lineHeight: 1.05,
          }}
        >
          Build from meaning, not markup
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: '1.05rem',
            lineHeight: 1.6,
            color: 'var(--cmp-text-muted)',
          }}
        >
          Describe your objects once—User, Subscription, Product. Compose from traits—Statusable, 
          Timestamped, Addressable. Render in any context—List, Detail, Dashboard, Chart. 
          The system generates types, views, tokens, tests, and documentation. Object-oriented 
          design, trait-first composition, agent-native architecture.
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.85rem',
        }}
      >
        <a
          href="https://github.com/kneelinghorse/OODS-Foundry"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            borderRadius: '999px',
            padding: '0.65rem 1.5rem',
            fontWeight: 600,
            color: 'var(--cmp-text-on_action)',
            background: 'var(--cmp-surface-action)',
            border: '1px solid transparent',
            boxShadow: 'inset 0 -1px 0 color-mix(in srgb, currentColor 18%, transparent)',
            textDecoration: 'none',
          }}
        >
          View on GitHub ↗︎
        </a>
        <a
          href="https://github.com/kneelinghorse/OODS-Foundry/blob/main/README.md"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            borderRadius: '999px',
            padding: '0.65rem 1.5rem',
            fontWeight: 600,
            color: 'var(--cmp-text-action)',
            border: '1px solid var(--cmp-border-default)',
            background: 'transparent',
            textDecoration: 'none',
          }}
        >
          Read Documentation ↗︎
        </a>
      </div>
    </section>

    <section
      style={{
        display: 'grid',
        gap: '1rem',
        gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))',
      }}
    >
      {metrics.map((metric) => (
        <article
          key={metric.label}
          style={{
            borderRadius: '1.25rem',
            padding: '1.25rem',
            background: 'var(--cmp-surface-panel)',
            border: '1px solid color-mix(in srgb, var(--cmp-border-default) 45%, transparent)',
            display: 'grid',
            gap: '0.35rem',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '0.8rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--cmp-text-muted)',
            }}
          >
            {metric.label}
          </p>
          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{metric.value}</p>
        </article>
      ))}
    </section>

    <section
      style={{
        display: 'grid',
        gap: '1.25rem',
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: '1.35rem',
          }}
        >
          What to explore
        </h2>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--cmp-text-muted)' }}>
          Browse the sidebar or start with any section below. Navigation follows: Intro → Docs → Foundations → Components → Visualization → Contexts → Domains → Patterns → Brand.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))',
        }}
      >
        {quickLinks.map((link) => (
          <article
            key={link.title}
            style={{
              borderRadius: '1.25rem',
              padding: '1.35rem',
              background: 'var(--cmp-surface-panel)',
              border: '1px solid color-mix(in srgb, var(--cmp-border-default) 35%, transparent)',
              display: 'grid',
              gap: '0.6rem',
            }}
          >
            <strong style={{ fontSize: '1rem' }}>{link.title}</strong>
            <span style={{ color: 'var(--cmp-text-muted)', lineHeight: 1.5 }}>{link.description}</span>
          </article>
        ))}
      </div>
    </section>

    <section
      style={{
        display: 'grid',
        gap: '0.75rem',
        padding: '1.5rem',
        borderRadius: '1.25rem',
        background: 'color-mix(in srgb, var(--cmp-surface-panel) 85%, transparent)',
        border: '1px dashed color-mix(in srgb, var(--cmp-border-default) 45%, transparent)',
      }}
    >
      <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Theme & accessibility</h2>
      <p style={{ margin: 0, color: 'var(--cmp-text-muted)', lineHeight: 1.5 }}>
        Stories default to Brand A • Light mode. Brand B, dark theme, and forced-colors (high-contrast) 
        variants are available under Brand section. All themes tested with Chromatic visual regression 
        and automated WCAG 2.2 AA compliance checks.
      </p>
    </section>
  </div>
);

export default IntroSplash;
```

---

## 🎨 **Key Changes**

**Hero updates:**
- ✅ "Build from meaning, not markup" - clearer value prop
- ✅ Shows the workflow: describe → compose → render → system generates
- ✅ Mentions agent-native architecture
- ✅ More specific about what system does

**Navigation updates:**
- ✅ Removed broken deep links (cards now static, not clickable)
- ✅ Added Visualization section (highlights Sprint 21-23 work!)
- ✅ Added Domains section
- ✅ Better descriptions (40+ components vs vague "primitives")
- ✅ Clear navigation path

**Metrics updates:**
- ✅ Added "Viz System: Sprint 21-23" metric
- ✅ Shows viz is available (post-RC but present)

**Theme guidance updates:**
- ✅ Clearer language
- ✅ Mentions forced-colors explicitly
- ✅ References compliance automation

---

## 📋 **Implementation Checklist for B24.2**

### **Welcome Page** (30 min)
- [ ] Update IntroSplash.tsx with new hero text
- [ ] Update metrics array (add Viz System)
- [ ] Update quickLinks (add Visualization, Domains, remove hrefs)
- [ ] Update theme guidance section
- [ ] Test in dev mode
- [ ] Test in static build
- [ ] Verify responsive behavior

### **Broken Charts** (1-2 hours)
- [ ] Check if spec files exist for 3 broken stories
- [ ] Create missing specs if needed (use pattern library v2 as guide)
- [ ] Fix component mapping in PatternGalleryV2.stories.tsx
- [ ] Test each story individually
- [ ] Verify in dev mode + static build
- [ ] Add to VRT baseline

### **Token Collision** (15 min)
- [ ] Add chunkSizeWarningLimit: 2000 to .storybook/main.ts
- [ ] Test static build (warning should disappear)
- [ ] Document in sprint-24-storybook-fixes.md

---

**Total B24.2 Time Estimate:** 2-3 hours  
**Priority:** Welcome page (most visible), Broken charts (functionality), Token warning (noise reduction)

