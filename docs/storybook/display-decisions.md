# Storybook Display Decisions — Sprint 20 / Mission B20.1

Mission B20.1 focuses on polishing the public Storybook deployed to GitHub Pages. The changes below document the decisions made so visitors land on a purposeful splash screen, understand navigation, and can trust the curated theme/brand presentation.

## Landing & Navigation

- Added `Intro/Welcome` (`apps/explorer/.storybook/Intro.mdx`) as the first story to greet GitHub Pages viewers with project stats, quick links, and CTA buttons.
- Locked the sidebar sort order to `Intro → Docs → Foundations → Components → Contexts → Domains → Patterns → Explorer → Brand` so the left rail always reads the same way across rebuilds.
- Updated `.storybook/TAXONOMY.md` to reflect the formal order and ensure future titles stay within the sanctioned buckets.
- Manager panel is pinned to the right (documented in `.storybook/manager.ts`) to mirror the hosted deployment layout guidelines.

## Brand & Theme Strategy

- Storybook toolbar controls for theme/brand are now hidden; globals stay fixed to Brand A + light mode while Chromatic still exercises all combinations through `parameters.chromatic.modes`.
- Intro splash copy and Docs entries explain where to find Brand B, high-contrast, and dark-theme coverage so reviewers don’t assume the toolbar is missing.

## Foundations & Token Browser

- Removed the redundant `Foundations/Elements Smoke Test` story to keep the section focused on purposeful documentation and proofs.
- Clarified the intent of `Foundations/Tokens Roundtrip` through richer docs copy and made the `Token Browser` story fullscreen with narrative guidance.
- Fixed the `TokenBrowser` + `Swatch` pairing so CSS custom properties and OKLCH values render directly instead of falling back to neutral colors, restoring contrast and utility.

## Dark Mode Documentation

- `Docs/Contexts/Dark` now wraps content in a purpose-built `.docs-dark-surface` container so Storybook docs text switches to light-on-dark without mutating global theme state.
- Removed the old global `data-theme` side effect from `DarkModeDemo`, relying on scoped token overrides instead.

## Components & Illustrations

- Improved the sample illustration in `Components/Feedback/EmptyState` to use gradients, strokes, and tone tokens with AA-friendly contrast so the gallery no longer shows gray-on-gray artwork.

## Validation

- `pnpm vitest run tests/components/empty-state.spec.tsx`
- `pnpm build-storybook`
- `./cmos/cli.py validate docs`
