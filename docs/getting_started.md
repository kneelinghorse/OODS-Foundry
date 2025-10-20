# Getting Started with OODS Foundry

This guide walks you through your first interactions with the OODS Foundry design system, regardless of your role.

## Prerequisites

### For Everyone
- Git installed and configured
- Access to the OODS repository
- Basic understanding of design systems

### For Designers
- Figma account with access to OODS design library
- Tokens Studio plugin installed in Figma

### For Developers
- Node.js 18+ and pnpm 8+
- Code editor with TypeScript support
- Docker (optional, for MCP tools)

## Choose Your Path

### Path A: I want to understand the concepts first
**→ Skip to [Core Concepts](#understanding-core-concepts)**

### Path B: I want to make a change right away
**→ Continue with [Quick Wins](#quick-wins)**

### Path C: I want to set up my environment
**→ Jump to [Environment Setup](#environment-setup)**

---

## Quick Wins

These tasks take 10-15 minutes and give you hands-on experience with the system.

### Quick Win #1: View a Component in All Contexts

**Goal**: See how the same component renders differently in list, detail, form, and timeline contexts.

```bash
# Clone and run Storybook
git clone [repo-url]
cd oods-foundry
pnpm install
pnpm storybook

# Navigate to any object story (e.g., "Objects/Subscription/List")
# Use the Context selector in Storybook toolbar to switch between:
# - List (compact)
# - Detail (expanded)
# - Form (validation states)
# - Timeline (chronological)
```

**What you learned**: Contexts change spacing, typography, and layout without touching component code.

### Quick Win #2: Change a Token and See It Propagate

**Goal**: Edit a single color token and see it update across all components.

**For Designers**:
1. Open Figma library
2. Change a semantic token (e.g., `theme.text.primary`)
3. Export tokens: Plugins → Tokens Studio → Export → JSON
4. Save to clipboard

**For Developers**:
```bash
# Place exported JSON in tokens/theme0/
pnpm tokens:transform

# Start Storybook to see changes
pnpm storybook
```

**What you learned**: Tokens flow from Figma → transform → CSS variables → components automatically.

### Quick Win #3: Run All Validations

**Goal**: Understand the quality gates that protect the system.

```bash
# Run the full validation suite
pnpm validate:all

# This runs:
# ✓ Purity audit (components use only --cmp-* tokens)
# ✓ Composition validation (trait dependencies satisfied)
# ✓ Type generation (YAML → TypeScript types)
# ✓ Schema validation (objects match expected structure)
```

**What you learned**: The system enforces quality rules automatically before code can be merged.

---

## Understanding Core Concepts

### Concept 1: The Four-Layer Token Stack

OODS uses a layered token architecture that separates concerns:

```
Component writes:    background-color: var(--cmp-surface-default);
                                              ↓
Theme resolves:      --cmp-surface-default: var(--theme-surface-neutral-100);
                                              ↓
Reference provides:  --theme-surface-neutral-100: var(--ref-neutral-100);
                                              ↓
Base value:          --ref-neutral-100: #f5f5f5;
```

**Why this matters**: You can swap entire themes (light/dark, brand overlays) without changing component code.

**Key rules**:
- Components consume **only** `--cmp-*` tokens
- Never use `--theme-*` or `--ref-*` directly in components
- Modifiers (`--mod-*`) handle runtime states (hover, focus, disabled)

**→ [Deep dive: 4-Layer Architecture](tokens/4-layer-overview.md)**

### Concept 2: Objects Are Composed From Traits

Instead of building monolithic components, OODS composes **objects** from **traits**.

**Traits** = reusable capabilities:
- `statusable`: Adds status field + badge rendering
- `timestamped`: Adds created_at, updated_at + relative time display
- `monetary`: Adds amount fields + currency formatting
- `commentable`: Adds comments section
- `documentable`: Adds file attachments

**Objects** = trait combinations:
```yaml
# domains/billing/objects/subscription.yaml
object: Subscription
traits:
  - statusable      # Status: active, past_due, cancelled
  - timestamped     # Created, updated timestamps
  - monetary        # Amount, currency
  - lifecycle       # State transitions
  - documentable    # Invoices, receipts
```

**Why this matters**: 
- Write a trait once, use it everywhere
- Consistent UX patterns across all objects
- Type-safe composition with validation

**→ [Deep dive: Trait Composition](compositor-readme.md)**

### Concept 3: Regions Define Object Structure

Every object follows a canonical structure using **regions**:

```tsx
<article data-object="subscription">
  <header data-region="header">
    {/* Title, primary ID */}
  </header>
  
  <div data-region="badges">
    {/* Status badge, tags */}
  </div>
  
  <div data-region="meta">
    {/* Timestamps, secondary info */}
  </div>
  
  <div data-region="body">
    {/* Main content */}
  </div>
  
  <aside data-region="sidebar">
    {/* Related info */}
  </aside>
  
  <footer data-region="actions">
    {/* Buttons, menus */}
  </footer>
</article>
```

**Why this matters**:
- Consistent layout structure across all objects
- Context classes can style regions differently (list vs detail)
- Predictable DOM structure for testing and automation

**→ [Deep dive: Canonical Regions](specs/regions.md)**

### Concept 4: Contexts Adapt UI to Use Cases

The same object component changes based on **context**:

| Context | Use Case | Spacing | Typography | Interactivity |
|---------|----------|---------|------------|---------------|
| **List** | Scanning many items | Compact | Small (body-sm) | View, quick actions |
| **Detail** | Focused viewing | Generous | Large (body-lg) | All actions, full data |
| **Form** | Editing data | Standard | Medium (body-md) | Validation, errors |
| **Timeline** | Activity history | Chronological | Small (caption) | Read-only, expandable |

**Implementation**:
```tsx
// List view
<div className="context-list">
  <SubscriptionCard />  {/* Compact, scannable */}
</div>

// Detail view  
<div className="context-detail">
  <SubscriptionCard />  {/* Expanded, full info */}
</div>
```

**Why this matters**: One component, four renderings. No prop drilling. CSS handles everything.

**→ [Deep dive: Context System](contexts/defaults.md)**

---

## Environment Setup

### Designers: Figma + Tokens Studio

1. **Install Tokens Studio Plugin**
   - In Figma: Plugins → Find more plugins → "Tokens Studio"
   - Install and authorize

2. **Sync with OODS Library**
   - File → Libraries → Enable "OODS Design System"
   - Verify you see design tokens in the plugin

3. **Configure Export Settings**
   - Open Tokens Studio
   - Settings → Export format: JSON
   - Export path: `tokens/theme0/tokens.json`

4. **Test Roundtrip**
   - Make a small change to a color token
   - Export → Save JSON
   - Share with dev team for transform step

**→ [Complete Figma Setup](Figma%20Integration%20Guidelines%20for%20Traits.md)**

### Developers: Local Environment

1. **Clone Repository**
   ```bash
   git clone [repo-url]
   cd oods-foundry
   ```

2. **Install Dependencies**
   ```bash
   pnpm install
   ```

3. **Start Storybook**
   ```bash
   pnpm storybook
   # Opens http://localhost:6006
   ```

4. **Run Development Suite**
   ```bash
   # Terminal 1: Storybook
   pnpm storybook

   # Terminal 2: Type watcher
   pnpm types:watch

   # Terminal 3: Test runner
   pnpm test:watch
   ```

5. **Verify Installation**
   ```bash
   pnpm validate:all
   # Should pass all checks
   ```

**→ [Complete Dev Setup](getting-started/dev.md)**

### Maintainers: Full Pipeline

In addition to dev setup:

1. **MCP Tools (Optional)**
   ```bash
   # Build MCP server
   cd mcp
   docker build -t oods-mcp .
   docker run -p 3000:3000 oods-mcp
   ```

2. **Visual Regression Setup**
   ```bash
   # Configure Chromatic
   export CHROMATIC_PROJECT_TOKEN=[your-token]
   
   # Run baseline capture
   pnpm chromatic --project-token=$CHROMATIC_PROJECT_TOKEN
   ```

3. **CI Pipeline Config**
   - Configure GitHub Actions secrets
   - Set up Chromatic webhook
   - Configure accessibility scanning

**→ [Complete CI/CD Setup](mcp/Internal-Release-Readiness.md)**

---

## Your First Contribution

### For Designers: Change a Color Token

**Scenario**: Update the primary brand color.

1. **In Figma**:
   - Open Tokens Studio
   - Navigate to Theme layer
   - Find `theme.color.primary.default`
   - Change value to new color
   - Export tokens

2. **In Terminal** (or ask a dev):
   ```bash
   pnpm tokens:transform
   pnpm storybook
   ```

3. **Verify**:
   - Check all components with primary color
   - Test dark mode: `data-theme="dark"`
   - Test high contrast: Enable in Storybook toolbar

4. **Open PR**:
   ```bash
   git checkout -b design/update-primary-color
   git add tokens/
   git commit -m "Update primary brand color"
   git push origin design/update-primary-color
   ```

**→ [Design Quickstart](getting-started/design.md)**

### For Developers: Add a New Trait

**Scenario**: Create a "taggable" trait for objects that support tags.

1. **Define Trait Schema**:
   ```yaml
   # traits/taggable.yaml
   trait: taggable
   description: Adds tag support to objects
   
   schema:
     tags:
       type: array
       items:
         type: object
         properties:
           id: { type: string }
           label: { type: string }
           color: { type: string }
   
   regions:
     badges:
       components:
         - TagList
   ```

2. **Generate Types**:
   ```bash
   pnpm types:generate
   # Creates types/traits/taggable.ts
   ```

3. **Build Component**:
   ```tsx
   // components/TagList.tsx
   export const TagList = ({ tags }: TaggableProps) => (
     <div data-region="badges">
       {tags.map(tag => (
         <span key={tag.id} className="tag" style={{ '--tag-color': tag.color }}>
           {tag.label}
         </span>
       ))}
     </div>
   );
   ```

4. **Compose into Object**:
   ```yaml
   # objects/subscription.yaml
   traits:
     - statusable
     - taggable  # ← Add here
   ```

5. **Validate**:
   ```bash
   pnpm validate:composition
   pnpm test:types
   ```

**→ [Authoring Traits](authoring-traits.md)**

---

## Common Questions

### Q: What's the difference between a trait and a component?

**A**: 
- **Trait** = data schema + UI contract (YAML definition)
- **Component** = React implementation of a trait's UI

Traits define *what* data exists and *where* it renders (which region).  
Components define *how* it renders (the actual React code).

### Q: Can I use custom CSS in my components?

**A**: Only `--cmp-*` tokens are allowed. The purity audit blocks custom colors, spacing, or typography. This ensures:
- Themes work correctly
- Dark mode works automatically  
- Accessibility policies apply consistently

### Q: How do I add a new context (e.g., "card" context)?

**A**: 
1. Define context defaults in `contexts/[name]-defaults.md`
2. Add context class: `.context-card { ... }`
3. Map regions to tokens: `--context-card-spacing-inset: ...`
4. Document and add stories

**→ [Context System](contexts/defaults.md)**

### Q: What happens if two traits conflict?

**A**: The compositor has a resolution strategy:
1. Explicit `conflictResolution` in object definition wins
2. Last trait in list wins (by default)
3. Validation warns you about conflicts

**→ [Collision Resolution](compositor-readme.md#collision-resolution)**

### Q: Can I opt out of the token purity rule?

**A**: Only for documentation and examples. Add an allowlist entry in `scripts/purity/allowlist.json` with justification. Runtime components cannot opt out.
