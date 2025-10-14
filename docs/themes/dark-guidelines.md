# Dark Theme Guidelines

The dark theme is delivered by overriding the theme layer (`--theme-dark-*`) while the system/component (`--sys-*`, `--cmp-*`) layers remain untouched. Components continue to consume the same slots they use in Theme&nbsp;0; switching to dark mode is as simple as toggling `html[data-theme='dark']`.

## Layer Overrides

- `--theme-dark-surface-*` remaps the canvas/raised/subtle stack to cool neutrals (canvas `oklch(0.18 0.007 255)`, raised `0.24`, subtle `0.30`). Disabled surfaces stay slightly lighter so outlines remain visible.
- `--theme-dark-text-*` provides ≥4.5:1 contrast against the new surfaces. `text.accent` aligns with the brand ramp while `text.inverse` supplies on-light support for nested cards.
- `--theme-dark-status-*` covers all five tones (info, success, warning, critical, neutral) with AA text/icon pairings. No component branching is required—the `StatusChip` tone attribute continues to drive the slots.
- `--theme-dark-focus.*` keeps the ring visible on dark surfaces by pairing an OKLCH `L` 0.85 cyan outer ring with a low-luminance inner ring (`L` 0.16) that “cuts” into the surface.
- `--theme-dark-shadow-elevation-*` shifts elevation to outline-first shadows: low-opacity cool glows combine with the default border mix so cards read as elevated without blooming.

## Surface & Text Pairings

| Pair | Contrast | Notes |
| --- | --- | --- |
| `text.primary` on `surface.canvas` | 14.3:1 | Primary copy remains crisp even on the darkest canvas. |
| `text.secondary` on `surface.raised` | 6.7:1 | Secondary metadata clears AA while keeping an appropriate hierarchy gap. |
| `text.muted` on `surface.subtle` | 5.2:1 | Muted captions stay legible on timelines and sidebars. |
| `text.on-interactive` on `surface.interactive.primary.default` | 9.1:1 | Buttons and chips easily exceed AA across all states. |

## Status & Feedback Tokens

- Info/Success/Warning/Critical/Neutral surfaces sit around `L = 0.31–0.34` with borders at `L = 0.43–0.46`, giving room for outlines without flattening.
- Text tokens for each status track between `L = 0.78–0.9`, keeping ≥4.5:1 contrast inside banners and chips.
- Icons reuse the same ramps so StatusChip and future banner components remain token-driven.

## Elevation Strategy

- Cards and panels: `--theme-dark-shadow-elevation-card` (`rgba(4, 10, 22, 0.48)` with 18px/48px/-28px) paired with the stronger border mix yields depth without glare.
- Overlays: `--theme-dark-shadow-elevation-overlay` increases blur to 68px and opacity to `0.55` for modals/trays while respecting backdrop scrim darkness.
- Guidance: keep low-contrast shells (chips, tables, banners) outline-first—prefer a `color-mix` border using `--cmp-border-default` before adding additional glow.

## Accessibility & Guardrails

1. Build tokens after editing JSON to regenerate CSS/TS/Tailwind outputs:
   ```sh
   npm run build:tokens
   ```
2. Toggle the document theme before running accessibility tooling:
   ```js
   document.documentElement.setAttribute('data-theme', 'dark');
   ```
3. Run both checks and diffs, ensuring zero new critical/serious violations:
   ```sh
   npm run a11y:check
   npm run a11y:diff
   ```
4. Hover/pressed states stay within the relative-colour guardrails (`ΔL ≤ +0.08`, `ΔC ≤ +0.02`). If `npm run a11y:check` reports a guardrail breach, adjust the OKLCH delta rather than introducing a component override.

## Usage Checklist

- [ ] `html[data-theme='dark']` is set in docs and smoke stories (see `DarkModeDemo` and `Contexts.Dark`).
- [ ] New tokens include SRGB fallbacks via `$extensions.ods.fallback` for legacy browsers.
- [ ] Documentation and stories point to the mission deliverables so humans know where to validate dark mode.
- [ ] No component CSS was duplicated; everything still flows through the four-layer architecture.
