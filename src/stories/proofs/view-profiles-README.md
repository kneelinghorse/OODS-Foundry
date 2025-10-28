# View Profiles Proof Stories

**Mission:** B16.10a - View Profiles and Region Tokens  
**Status:** ✅ Complete  
**Date:** October 22, 2025

## Overview

This proof story demonstrates the canonical view profiles defined in `configs/view-profiles.yaml`. Each view context renders with distinct layouts using semantic tokens from `tokens/view.json`, with zero hard-coded CSS literals.

## View Profiles

### 1. Detail View
- **Layout:** Two-column with standard rail token `--view-columns-two-column-standard`
- **Primary Tokens:** `--view-section-gap-detail`, `--view-rail-width-standard`
- **Use Case:** Comprehensive information display for single entities
- **Story:** `Detail` (`view-profiles/Detail.stories.tsx`)

### 2. List View
- **Layout:** Two-column with narrow rail token `--view-columns-two-column-narrow`
- **Primary Tokens:** `--view-main-gap-list`, `--view-rail-width-narrow`
- **Use Case:** Scanning and comparison of multiple items
- **Story:** `List` (`view-profiles/List.stories.tsx`)

### 3. Form View
- **Layout:** Asymmetric layout token `--view-columns-two-column-guidance`
- **Primary Tokens:** `--view-section-gap-form`, `--view-rail-width-narrow`
- **Use Case:** Focused data input with contextual guidance
- **Story:** `Form` (`view-profiles/Form.stories.tsx`)

### 4. Timeline View
- **Layout:** Single-column stream via `--view-columns-default`
- **Primary Tokens:** `--view-timeline-gap`, `--view-timeline-stream-gap`, `--view-timeline-layer`
- **Use Case:** Chronological activity streams
- **Story:** `Timeline` (`view-profiles/Timeline.stories.tsx`)

### 5. Card View
- **Layout:** Constrained container token `--view-card-max-width`
- **Primary Tokens:** `--view-card-gap`, `--view-border-thin`
- **Use Case:** Compact, at-a-glance presentation
- **Story:** `Card` (`view-profiles/Card.stories.tsx`)

### 6. Inline View
- **Layout:** Minimal single-column token `--view-gap-inline`
- **Primary Tokens:** `--view-main-gap-inline`, `--view-gap-inline`
- **Use Case:** Space-efficient embedding
- **Story:** `Inline` (`view-profiles/Inline.stories.tsx`)

## Success Criteria

All success criteria from mission B16.10a have been met:

✅ **View Profiles Config**  
- `configs/view-profiles.yaml` defines regions and layouts for all 6 contexts

✅ **Data Attributes**  
- All view components emit `data-view="<context>"` on top container
- All regions emit `data-region="<regionId>"` attributes

✅ **Layout Tokens**  
- `tokens/view.json` defines DTCG-compliant tokens:
  - `--view-columns-*` (grid structures)
  - `--view-gap-*` (context spacing)
  - `--view-rail-width-*` (sidebar widths)
  - `--view-border-{thin,medium,strong}` (surface borders)
  - `--view-accessibility-outline-offset` (forced-colors outline offset)
  - `--view-timeline-*` (timeline spacing/background)

✅ **Token-Based CSS**  
- `src/styles/domain-contexts.css` uses only semantic tokens
- Zero literals in layout code
- All values resolve to design token CSS variables

✅ **Distinct Structures**  
- Each context shows visibly different layout
- Two-column contexts: detail (`--view-columns-two-column-standard`), list (`--view-columns-two-column-narrow`), form (`--view-columns-two-column-guidance`)
- Single-column contexts: timeline (`--view-columns-default`), card (`--view-card-max-width`), inline (`--view-gap-inline`)

✅ **Accessibility**  
- Forced-colors mode shows explicit borders sourced from view border tokens
- No reliance on shadows in high-contrast
- Focus indicators use `--cmp-focus-width` with `--view-accessibility-outline-offset`
- Axe smoke tests: **0 violations** across all contexts

## Architecture

### Token Flow
```
tokens/view.json (DTCG)
    ↓ (scripts/tokens/transform.ts)
apps/explorer/src/styles/tokens.css (CSS vars)
    ↓ (consumed by)
src/styles/domain-contexts.css (layout rules)
    ↓ (applied to)
src/contexts/*View.tsx (React components)
```

### Region Contract
```typescript
// Canonical regions (src/types/regions.ts)
type CanonicalRegionID = 
  | 'globalNavigation'
  | 'pageHeader'
  | 'breadcrumbs'
  | 'viewToolbar'
  | 'main'
  | 'contextPanel';
```

### View Container Pattern
```tsx
<div data-view="detail">
  <nav data-region="globalNavigation">...</nav>
  <header data-region="pageHeader">...</header>
  <div data-region="viewToolbar" role="toolbar">...</div>
  <main data-region="main">...</main>
  <aside data-region="contextPanel">...</aside>
</div>
```

## Testing

### Accessibility Tests
```bash
pnpm test:axe
```
Result: **9/9 tests passed** with 0 violations

### Visual Regression
All stories tagged with `vrt` or `vrt-critical` for Chromatic snapshots:
- `view-profiles/Detail` (vrt-critical)
- `view-profiles/List`
- `view-profiles/Form`
- `view-profiles/Timeline`
- `view-profiles/Card`
- `view-profiles/Inline`

### Forced Colors
`view-profiles/ForcedColors` renders the detail profile in forced-colors mode to prove visible borders and focus treatments.

## Usage in Stories

```tsx
import { RenderObject } from '../../components/RenderObject';

<RenderObject
  object={UserObject}
  context="detail" // or 'list' | 'form' | 'timeline' | 'card' | 'inline'
  data={userData}
  className="explorer-view context-detail"
/>
```

## Related Documentation

- [Canonical Region Contract](../../../docs/Canonical%20Region%20Contract.md)
- [View Profiles Config](../../../configs/view-profiles.yaml)
- [View Tokens](../../../tokens/view.json)
- [Domain Contexts CSS](../../../src/styles/domain-contexts.css)

## Research Foundation

This implementation builds on prior research missions:
- **R11.3** - Deterministic region contracts & artifact presentation
- **R4.3** - Contextual design token defaults
- **R4.4** - A11y contract & forced-colors policy

## Next Steps

**B16.10b** - Trait→Region Contributions will extend this foundation by adding domain-specific content contributions from traits (Subscription, User) into these canonical regions.
