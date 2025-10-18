# 4-Layer Token Architecture

Mission **B5.1** establishes a deterministic token ladder that keeps authoring responsibilities separated across four layers. Every layer exports a distinct namespace so designers, themers, and component authors can reason about ownership without guessing.

| Layer | Namespace | Purpose | Example |
| ----- | --------- | ------- | ------- |
| Reference | `--ref-*` | Raw scales and ramps. No product or brand semantics. | `--ref-color-neutral-100` |
| Theme | `--theme-*` | Adapts reference values for a given brand mode (Light Theme 0 by default, Dark seed in `themes/dark`). | `--theme-status-info-surface` |
| System/Semantic | `--sys-*` | Contracts teams and components consume: surface, text, status, focus, spacing. | `--sys-status-success-text` |
| Context / Component Slots | `--cmp-*` | Assigned inside regions or components; the only namespace React components read. | `--cmp-chip-background` |

## Layer responsibilities

### 1. Reference (`--ref-*`)
- JSON location: `packages/tokens/src/tokens/base/reference/`
- Contains color ramps (`neutral`, `blue`, `green`, `amber`, `red`, `violet`) and spacing primitives.
- Values are raw hex or dimensions, never chained.

### 2. Theme (`--theme-*`)
- Light Theme 0 lives in `themes/theme0/**`. Dark placeholders live in `themes/dark/**` under the `theme-dark` namespace.
- Theme tokens reference only `--ref-*` variables.
- Dark mode is exposed as `--theme-dark-*` tokens; the CSS layer maps them back to the shared `--theme-*` hooks when `[data-theme="dark"]` is present.

### 3. System / Semantic (`--sys-*`)
- JSON location: `tokens/semantic/system.json`.
- Entries reference `--theme-*` tokens to emit canonical system contracts.
- Provides high-level language: surfaces, borders, text states, status roles (info/success/warning/accent/critical/neutral), focus rings, and spacing.
- These are the contracts product teams bind to when defining contexts.

### 4. Context & Component Slots (`--cmp-*`)
- JSON location: `tokens/semantic/components.json` (emitted) + `apps/explorer/src/styles/layers.css` (context overrides).
- Slots cascade from `--sys-*` values, e.g. `--cmp-chip-background: var(--sys-status-info-surface)`.
- Regions or pages override `--cmp-*` using attributes (e.g. `[data-context="list"]`) without touching reference scales.
- Components (such as `StatusChip`) **never** read `--ref-*` or `--theme-*`; they style exclusively with `--cmp-*`.
- Storybook’s toolbar now exposes a Light/Dark toggle that flips `[data-theme]` to prove the composite chain live.

## Forced colors and dark mode precedence

1. Light Theme 0 defines the default `--theme-*`.
2. `[data-theme="dark"]` remaps those variables to the `--theme-dark-*` tokens.
3. `@media (forced-colors: active)` overrides the same `--theme-*` hooks with system colors, so high-contrast wins over dark mode automatically.
4. Because `--sys-*` and `--cmp-*` are chained, every downstream consumer respects the cascade without extra logic.

## Explorer proof (StatusChip)

- `StatusChip.tsx` now infers a status tone (`info`, `accent`, `success`, `warning`, `critical`, `neutral`) and sets `data-tone` only.
- `layers.css` maps each tone to `--cmp-chip-*` slots that reference the appropriate `--sys-status-*` tokens.
- Context wrappers (`data-context="list"` / `"detail"`) adjust slot padding and sizing exclusively via `--cmp-*`.
- The component has no awareness of raw colors or themes—forcing the contract promised in the roadmap.

## Working with the stack

- **Adding a new surface role?** Define it in `tokens/semantic/system.json`, regenerate tokens, then expose a slot in `layers.css`.
- **New brand theme?** Add a sibling folder under `themes/` and provide `theme-foo` tokens; update the CSS theme switcher to point at it.
- **Component needs a token?** Add it to `tokens/semantic/components.json`, regenerate, then wire overrides in `layers.css` or the component stylesheet.

This layering keeps references pure, allows multiple themes to coexist, and guarantees forced-colors wins last without brittle overrides.

## Tailwind roundtrip

`tailwind.config.ts` now extends colours with `var(--sys-...)` custom properties emitted by `scripts/tokens/transform.ts`. The generated CSS lives at `apps/explorer/src/styles/tokens.css` and is imported by Storybook so the **Foundations/Tokens Roundtrip** story demonstrates the live handshake.
