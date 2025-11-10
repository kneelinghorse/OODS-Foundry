# AI Agent Configuration

**Purpose**: Instructions for AI agents working on **OODS Foundry application code**.

**Scope**: This file covers APPLICATION CODE ONLY. For CMOS project management operations, see `cmos/agents.md`.

---

## Critical Boundary

**This agents.md is for YOUR APPLICATION CODE, NOT for CMOS operations**.

✅ **Application code**: `src/`, `packages/`, `tests/`, `apps/`, `.storybook/`, `scripts/`
❌ **NOT application code**: `cmos/` (that's project management)

**When working on application code**:
- Write to: `src/`, `packages/`, `tests/`, `scripts/`, `docs/`
- Never write to: `cmos/` (unless explicitly working on CMOS itself)
- Read: Project root `agents.md` (this file) for coding standards
- Read: `cmos/agents.md` ONLY when managing missions/sprints

---

## Project Overview

**Project Name**: OODS Foundry (Object-Oriented Design System)
**Project Type**: Enterprise Design System
**Primary Languages**: TypeScript 5.3+ (strict mode), React 19
**Package Manager**: pnpm 9.12+ (workspace monorepo)

**Description**: A trait-based design system where small, composable capabilities (traits) build complex objects (User, Subscription, Product). Features DTCG tokens, OKLCH color science, multi-brand theming, context-aware rendering, and comprehensive accessibility/VRT guardrails.

**Architecture Pillars**:
1. **Trait Engine** - Compose objects from small, validated traits
2. **Object Registry** - Canonical object definitions (User, Product, etc.)
3. **View Engine** - Context-aware rendering (List/Detail/Form/Timeline)
4. **Token System** - DTCG → Style Dictionary v4 → Tailwind CSS v4
5. **Component Library** - React components with Storybook documentation

---

## Build & Development Commands

### Prerequisites
```bash
# Node 20+, pnpm via Corepack
corepack enable
pnpm i

# For visual regression testing
pnpm exec playwright install
```

### Development Workflow
```bash
# Start Storybook dev server
pnpm storybook

# Build tokens (DTCG → CSS variables)
pnpm build:tokens

# Run tests
pnpm test                    # All tests (watch mode)
pnpm test:unit              # Unit tests only
pnpm test:integration       # Integration tests
pnpm test:coverage          # Coverage report (requires build first)
pnpm test:axe               # Accessibility tests (axe-core)

# Type checking
pnpm typecheck              # TypeScript type check (no emit)

# Linting
pnpm lint                   # ESLint on src/**
pnpm lint:tokens            # Token structure validation
pnpm lint:enum-map          # Enum-to-token coverage check

# Build
pnpm build                  # TypeScript compilation
pnpm build-storybook        # Static Storybook build
pnpm build:packages         # Build all workspace packages

# Local PR validation (runs full check suite)
pnpm local:pr-check
```

### Token Operations
```bash
# Transform tokens (DTCG JSON → CSS vars)
pnpm tokens:transform

# Validate token structure
pnpm tokens:validate

# Check semantic token usage
pnpm tokens:lint-semantic

# Run color guardrails (OKLCH ΔL/ΔC checks)
pnpm tokens:guardrails

# Token governance risk assessment
pnpm tokens:governance
```

### Visual Regression & Accessibility
```bash
# Chromatic (light/dark themes, requires CHROMATIC_PROJECT_TOKEN)
pnpm chromatic
pnpm chromatic:dry-run      # Preview without publishing

# High-contrast snapshots (Playwright)
pnpm vrt:hc

# Accessibility checks
pnpm a11y:check             # Run full axe suite
pnpm a11y:diff              # Compare against baseline
pnpm a11y:baseline          # Update baseline
```

### CI/Local Validation
```bash
# Pre-push pipeline (tokens → build → chromatic → HC → diagnostics)
pnpm pipeline:push

# Local CI simulation
pnpm ci:local
```

---

## Project Structure & Navigation

```
OODS-Foundry/
├── src/                       # Application source code
│   ├── components/            # React components (Button, Badge, etc.)
│   ├── core/                  # Trait engine, compositor, registry
│   ├── generators/            # Type generators (trait → TS types)
│   ├── contexts/              # View contexts (List/Detail/Form/Timeline)
│   ├── domain/                # Domain-specific components (billing, etc.)
│   ├── cli/                   # CLI tools (validate, object commands)
│   └── index.ts               # Public API exports
│
├── packages/                  # Workspace packages
│   ├── tokens/                # Design tokens (DTCG JSON)
│   └── a11y-tools/            # Accessibility utilities
│
├── tests/                     # Test files (mirrors src/ structure)
│   ├── integration/           # Integration tests
│   ├── validation/            # Validation pipeline tests
│   └── a11y/                  # Accessibility tests
│
├── .storybook/                # Storybook configuration
├── apps/                      # Sample applications
├── scripts/                   # Build/release/diagnostics scripts
├── docs/                      # Project documentation
├── artifacts/                 # Build outputs, diagnostics snapshots
├── diagnostics.json           # Current project state snapshot
│
├── cmos/                      # ⚠️ PROJECT MANAGEMENT (see cmos/agents.md)
│   ├── missions/              # Sprint/mission definitions
│   ├── context/               # Project context & history
│   ├── docs/                  # CMOS operation guides
│   └── scripts/               # CMOS migration/seed scripts
│
└── package.json               # Root workspace manifest
```

**Key File Conventions**:
- `*.trait.yaml` or `*.trait.ts` - Trait definitions (in `traits/`)
- `*.object.yaml` - Object definitions (in `objects/`)
- `*.test.ts` or `*.test.tsx` - Unit tests (Vitest)
- `*.a11y.test.tsx` - Accessibility tests (vitest-axe)
- `*.stories.tsx` - Storybook stories (CSF 3.0)
- `*.integration.test.ts` - Integration tests

---

## Coding Standards & Style

### TypeScript Rules
- **Strict mode required** - No `any` types; use `unknown` + type guards
- **Explicit return types** - All functions must declare return types
- **No implicit any** - Enable `noImplicitAny`, `strictNullChecks`
- **Prefer const** - Use `const` and `as const` for immutable values
- **No unused vars** - ESLint enforces (except `_` prefix for intentionally unused)

### Naming Conventions
- **Files**: kebab-case (`user-card.tsx`, `trait-parser.ts`)
- **Components**: PascalCase (`UserCard`, `StatusBadge`)
- **Functions/Variables**: camelCase (`parseTraitDefinition`, `isValid`)
- **Constants**: SCREAMING_SNAKE_CASE (`DEFAULT_TIMEOUT`, `MAX_RETRIES`)
- **Types/Interfaces**: PascalCase (`TraitDefinition`, `RenderContext`)

### Code Organization
```typescript
// 1. Imports (third-party, then local)
import React from 'react';
import { z } from 'zod';
import type { TraitDefinition } from '@/core/trait-definition';

// 2. Types/Interfaces
export interface UserCardProps {
  user: User;
  context: RenderContext;
}

// 3. Constants
const DEFAULT_AVATAR_SIZE = 48;

// 4. Component/Function
export function UserCard({ user, context }: UserCardProps): JSX.Element {
  // Implementation
}

// 5. Exports (if not inline)
export { UserCard };
```

### Comment Style
```typescript
/**
 * Parse a trait definition from YAML or TypeScript.
 *
 * @param source - File path or YAML string
 * @param format - 'yaml' | 'ts' | 'auto' (default: 'auto')
 * @returns Parsed trait definition
 * @throws {TraitParseError} If parsing fails
 */
export async function parseTrait(
  source: string,
  format: 'yaml' | 'ts' | 'auto' = 'auto'
): Promise<TraitDefinition> {
  // Implementation
}
```

---

## Testing Preferences

### Framework & Structure
- **Framework**: Vitest 3.2+ with jsdom environment
- **Coverage**: V8 instrumentation (target: 70% lines, 80% functions, 70% branches)
- **Test file naming**: `*.test.ts` or `*.test.tsx` (mirrors src structure)
- **Integration tests**: `tests/integration/**/*.integration.test.ts`

### Test Organization
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { parseTrait } from '@/parsers/trait-parser';

describe('TraitParser', () => {
  describe('parseTrait', () => {
    it('should parse valid YAML trait definition', async () => {
      const yaml = `
        trait: Statusable
        schema:
          status:
            type: enum
            values: [active, inactive, pending]
      `;

      const result = await parseTrait(yaml, 'yaml');

      expect(result.trait).toBe('Statusable');
      expect(result.schema.status.type).toBe('enum');
    });

    it('should throw TraitParseError on invalid YAML', async () => {
      await expect(parseTrait('invalid: [', 'yaml'))
        .rejects
        .toThrow(TraitParseError);
    });
  });
});
```

### Coverage Requirements
- **All new features**: 80%+ coverage
- **Critical paths**: 90%+ coverage (trait engine, compositor, registry)
- **Run before PR**: `pnpm test:coverage`
- **Threshold gates**: 70% lines/branches, 80% functions/statements

### Accessibility Testing
```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Button } from '@/components/button';

describe('Button a11y', () => {
  it('should have no axe violations', async () => {
    const { container } = render(<Button>Click me</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('should be keyboard navigable', async () => {
    const { getByRole } = render(<Button>Submit</Button>);
    const button = getByRole('button');

    button.focus();
    expect(document.activeElement).toBe(button);
  });
});
```

---

## Security & Quality Guardrails

### Security Rules
1. **No secrets in code** - Use `.env.local` (gitignored) for API keys
2. **Validate all inputs** - Use Zod/AJV for runtime validation
3. **Sanitize user content** - Escape HTML, validate URLs
4. **No `eval()` or `Function()`** - Security risk; use safe alternatives
5. **Dependency audits** - Run `pnpm audit` before releases

### Token & Theming Guardrails
1. **No direct color literals** - Components must use CSS variables only
   ```typescript
   // ❌ BAD
   <div style={{ color: '#3b82f6' }}>

   // ✅ GOOD
   <div className="text-[--cmp-button-fg]">
   ```

2. **Purity audit** - Enforced by `pnpm purity:audit`
   - No direct `--ref-*` or `--theme-*` token reads in components
   - Only `--cmp-*` (component) and `--sys-*` (system) tokens allowed

3. **Enum-to-token coverage** - All status/state enums must map to tokens
   ```typescript
   // Enforced by pnpm lint:enum-map
   const statusMap = {
     active: '--sys-status-success-fg',
     pending: '--sys-status-warning-fg',
     inactive: '--sys-status-neutral-fg'
   };
   ```

4. **Color guardrails (OKLCH)**
   - Interactive states: ΔL ≥ 10, ΔC ≤ 0.04
   - WCAG AA contrast: 4.5:1 for text, 3:1 for UI components
   - Enforced by `pnpm tokens:guardrails`

### Code Review Requirements
- **PR template followed** - All sections completed
- **Tests pass** - `pnpm local:pr-check` must succeed
- **No console warnings** - Clean build output
- **Accessibility verified** - `pnpm a11y:diff` passes
- **Visual regression reviewed** - Chromatic snapshots approved

---

## Architecture Patterns

### Trait Composition Pattern
```typescript
// traits/Statusable.trait.ts
export const Statusable = {
  trait: 'Statusable',
  parameters: [
    { name: 'states', type: 'array', items: { type: 'string' } }
  ] as const,
  schema: (params) => ({
    status: {
      type: 'enum',
      values: params.states
    }
  }),
  semantics: {
    status: { role: 'state', criticality: 'high' }
  }
};

// objects/User.object.yaml
extends: BaseObject
traits:
  - Statusable:
      states: [active, inactive, suspended]
  - Timestamped
  - Identifiable
schema:
  email: { type: string, format: email }
  name: { type: string }
```

### View Extension Pattern
```typescript
// View extensions target canonical regions
const viewExtension = {
  region: 'main',
  type: 'field',
  component: 'StatusBadge',
  priority: 100,
  conditions: { context: ['detail', 'list'] }
};
```

### Pure Modifier Pattern
```typescript
// Modifiers MUST be pure (no side effects, no hooks)
export function withElevation(props: ComponentProps): ComponentProps {
  return {
    ...props,
    className: `${props.className} shadow-[--sys-elevation-2]`
  };
}

// ❌ NOT ALLOWED (side effects)
function impureModifier(props) {
  useEffect(() => { /* ... */ }, []); // FAIL: uses hooks
  fetch('/api/data'); // FAIL: side effect
  return props;
}
```

### Context-Aware Rendering
```typescript
import { RenderObject } from '@/components/render-object';

<RenderObject
  object={user}
  context="detail"  // list | detail | form | timeline
  extensions={customExtensions}
/>
```

---

## Project-Specific Configuration

### Environment Variables
```bash
# .env.local (gitignored)
CHROMATIC_PROJECT_TOKEN=<your-token>
STORYBOOK_PORT=6006
MCP_BRIDGE_PORT=4466
```

### TypeScript Configuration
- **Base**: `tsconfig.json` (strict mode, ES2022, module: ESNext)
- **Storybook**: `tsconfig.storybook.json` (includes .storybook/)
- **Stories**: `tsconfig.stories.json` (for .stories.tsx files)

### Workspace Structure
```json
// pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

---

## Special Instructions

### Before Starting Any Work
1. **Read mission context** - If working on a mission, read `cmos/missions/sprint-XX/NN.N_mission-name.yaml`
2. **Check diagnostics** - Review `diagnostics.json` for current state
3. **Review recent changes** - Check recent commits for context

### When Adding New Components
1. **Create trait definition** - Define capabilities as traits first
2. **Add to object registry** - Register in `objects/` if domain object
3. **Implement component** - Write React component in `src/components/`
4. **Add Storybook story** - Create `*.stories.tsx` with CSF 3.0
5. **Write tests** - Unit tests + a11y tests
6. **Document** - Add props table, usage examples
7. **Run guardrails** - `pnpm purity:audit && pnpm a11y:diff`

### When Modifying Tokens
1. **Edit DTCG JSON** - Modify `packages/tokens/src/tokens/**/*.json`
2. **Build tokens** - `pnpm build:tokens`
3. **Run guardrails** - `pnpm tokens:guardrails`
4. **Check coverage** - `pnpm lint:enum-map`
5. **Visual regression** - `pnpm chromatic:dry-run`
6. **Update baseline if needed** - Review Chromatic snapshots

### Performance Considerations
- **Trait composition**: < 10ms for 100-trait dependency graph
- **Component render**: < 16ms (60fps target)
- **Token build**: < 3s for 2000+ tokens
- **Storybook build**: < 60s total

### CI/CD Integration
- **PR checks**: lint, typecheck, test, a11y:diff, tokens:validate, purity:audit
- **Chromatic**: Auto-runs on PR, requires approval for visual changes
- **Coverage gate**: 70% minimum (enforced in CI)

---

## Common Pitfalls & Solutions

### ❌ Don't: Write application code in `cmos/`
```bash
# WRONG - application code in CMOS
cmos/components/UserCard.tsx
```
✅ **Do**: Write in `src/`
```bash
src/components/user-card.tsx
```

### ❌ Don't: Use direct color literals
```typescript
// WRONG
<Button style={{ backgroundColor: '#3b82f6' }} />
```
✅ **Do**: Use CSS variables
```typescript
<Button className="bg-[--cmp-button-bg]" />
```

### ❌ Don't: Duplicate trait logic in objects
```yaml
# WRONG - duplicating Statusable logic
extends: BaseObject
schema:
  status:
    type: enum
    values: [active, inactive]  # Already in Statusable trait!
```
✅ **Do**: Compose traits
```yaml
extends: BaseObject
traits:
  - Statusable:
      states: [active, inactive]
```

### ❌ Don't: Skip a11y validation
```typescript
// WRONG - no a11y tests
it('renders button', () => {
  render(<Button>Click</Button>);
});
```
✅ **Do**: Include axe tests
```typescript
it('has no a11y violations', async () => {
  const { container } = render(<Button>Click</Button>);
  expect(await axe(container)).toHaveNoViolations();
});
```

---

## Quick Reference

### File Type → Action
| File Type | Primary Tool | Test Location |
|-----------|-------------|---------------|
| `*.trait.ts` | Trait engine | `tests/core/` |
| `*.object.yaml` | Object registry | `tests/registry/` |
| `*.tsx` (component) | React + Storybook | `tests/components/` |
| `*.stories.tsx` | Storybook CSF 3.0 | - |
| `*.test.tsx` | Vitest + jsdom | Same dir as source |
| `tokens/*.json` | DTCG + Style Dictionary | `tests/tokens/` |

### Command Cheat Sheet
```bash
# Most common workflow
pnpm storybook              # Develop components
pnpm test                   # Run tests (watch mode)
pnpm local:pr-check         # Pre-push validation

# When changing tokens
pnpm build:tokens && pnpm tokens:guardrails

# When adding components
pnpm a11y:diff && pnpm purity:audit

# Before creating PR
pnpm local:pr-check && pnpm chromatic:dry-run
```

---

**Version**: 1.0.0
**Last Updated**: 2025-11-09
**Project**: OODS Foundry
**For CMOS operations**: See `cmos/agents.md`
