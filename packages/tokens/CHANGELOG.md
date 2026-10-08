# Changelog

`@oods/tokens` is released at the same version as `@oods/foundry`. The [`@oods/foundry` changelog](https://github.com/kneelinghorse/OODS-Foundry/blob/main/packages/foundry/CHANGELOG.md) lists what each release changed in the product.

## 0.10.1

- The README names `brand_create`, the tool that makes a brand from your colour tokens (it was `brand_intake` before 0.7.0), and all three bundled typefaces, Geist, Geist Mono and DM Sans. Token values, fonts and the stylesheet are unchanged.

## 0.4.4 to 0.10.0

Only the version changed, and the README links that name it: every file in `dist`, and NOTICE, are 0.4.3's. From 0.8.0 the package's issue link points to the public repository's Issues, and its repository field names `packages/tokens` there.

## 0.4.3

The package follows the 0.4.3 release; its token values and brand recipes are unchanged from 0.4.2.

## 0.4.2

- The three presets (corporate-blue, dark-minimal and startup-warm) carry chart colours made from their own recipe: 27
  chart slots per theme beside their 69 colour roles, so `dist/brand-template.json` lists 96 values for each preset.
  dark-minimal's light theme has a dark canvas, and it no longer starts from brand A's light chart palette, two of whose
  series measured 2.15:1 and 1.74:1 there. The CSS and every other file in `dist` are 0.4.1's.

## 0.4.1

Only the version changed, and the links in the README that name it; the contents are those of 0.4.0.

## 0.4.0 — published 2026-09-30

- A brand is a recipe. `@oods/tokens/recipe` turns six values (neutral hue and chroma, accent hue, which hue is
  primary, radius and font) into every colour role, the radius set and the font stacks; brands A and B, the presets and
  `brand_intake` all use it. A brand made from the 0.3 template must be made again: `dist/brand-template.json` has 103 base, 96 dark
  and 96 high-contrast slots (0.3.3 had 49, 75 and 75) and no fixed slot.
- Every hue is a 12-step scale with a job per step, in light and dark, calibrated on Radix Colors 3.0.0 (MIT; see
  NOTICE). Brand A is neutral-first with an indigo accent and Geist; brand B has a violet primary and DM Sans.
- Type roles as `--sys-text-scale-*`: display 80/64/48, heading 30/24/18/16, body 16/24 and 14/20, label 14/20 at 500,
  caption 12/16 at 500 (not uppercase) and mono 13/20. Fonts are brand-scoped (`--sys-font-sans`, `--sys-font-mono`).
- Shape and density: control heights 24/28/32/40, padding 8/10/12/16, card padding 24/16, table rows 44/36, badge 20,
  a 4px spacing ramp, radius from the brand, border-only cards, overlays with a soft shadow, dark elevation as rings.
- Geist and Geist Mono ship in `dist/fonts` (Latin and Latin Extended woff2) under the SIL Open Font License 1.1, whose
  text and the files' provenance are in NOTICE, beside DM Sans.
- High contrast: only the primary action is Highlight on HighlightText; every other intent is Canvas and CanvasText.
- Charts take each brand's palette from its recipe, in light and dark.

**Removed custom properties (90):**
- `--ref-color-{accent,archive,critical,info,success,warning}-{50,100,200,300,400,500,600,700,800,900,950}`, now
  `--ref-color-<family>-1` to `-12` and `--ref-color-<family>-dark-1` to `-12`.
- `--ref-color-neutral-{0,50,100,200,300,400,500,600,700,800,900,950}`, now `--ref-color-neutral-1` to `-12` and
  `--ref-color-neutral-dark-1` to `-12`.
- `--ref-color-primary-{50,100,200,300,400,500,600,700,800,900,950}`: a brand's primary is one of its scales; use the
  `--sys-*` roles.
- `--ref-typography-families-display`: display text uses `--ref-typography-families-sans`.

## 0.3.3 — published 2026-09-30

- DM Sans ships in the package: two woff2 files in `dist/fonts` (Latin and Latin Extended, variable weight), under the
  SIL Open Font License 1.1, whose text and the files' provenance are in NOTICE. An `@font-face` rule in `tokens.css`
  loads them from beside the stylesheet, never from the network. A bundler must emit `.woff2` files: Vite does, esbuild
  needs `--loader:.woff2=file` and webpack an asset rule. The two font files are 55,160 bytes.
- High contrast, in brands A and B and in brands made from the template: secondary and muted text, status text and
  icons, accent text, the focus ring and focus text are `CanvasText`. They were `GrayText`, `HighlightText` or
  `Highlight`, which lose contrast when forced colours are off. Disabled text keeps `GrayText`, and text on the
  interactive surface keeps `HighlightText` on `Highlight`. `dist/brand-template.json` gains `systemColourValues`: the
  system colours as Chromium resolves them without forced colours, on macOS and Linux, in light and dark.
- A brand and theme work on any element: the 197 `:root` custom properties that read a brand or theme value are declared
  again under `[data-brand][data-theme]`, so a panel with its own `data-brand` and `data-theme` is themed throughout.
  `tokens.css` grows from 210,875 to 224,319 bytes: 12,449 for these declarations and 768 for the `@font-face` rules.
- The font stacks quote "Helvetica Neue" and "Times New Roman" with single quotes, as they do the other names. The
  families are unchanged.
- The typography descriptions name the shipped fonts.

## 0.3.2 — published 2026-09-29

- Built with Style Dictionary 5.5.5 and `@tokens-studio/sd-transforms` 2.0.3 (they were 4.4.0 and 1.3.0). Building
  needs Node.js 22.0.0 or newer.
- The sans and display font stacks name "Helvetica Neue" and "Times New Roman" correctly. 0.3.1 quoted them twice, so
  browsers never matched those fallbacks.
- Transition timing functions hold their values instead of `var()` references to the easing tokens. The computed
  values are unchanged; a stylesheet that overrides `--oods-motion-easing-*` no longer changes them.
- The `tokens` export and the `@oods/tokens/tailwind` payload carry a `key` on each token, and no longer carry five
  entries that held no token: `$schema`, `description` and `mappings` (from the forced-colors map) and the
  `$description` of `brand.A` and `brand.B`. The declared types are unchanged.
- The package metadata names OODS Foundry, its homepage and a support email.

## 0.3.1 — published 2026-09-27

Only the version changed; the contents are those of 0.3.0.

## 0.3.0 — published 2026-09-26

The first version on npm, under the Apache License 2.0. It holds the shipped brands A and B in light, dark and
high-contrast scopes: the stylesheet (`@oods/tokens/css`), the resolved values of each scope in JavaScript
(`cssVariablesByScope`), the brand list (`@oods/tokens/brands`) and a Tailwind token payload (`@oods/tokens/tailwind`).

## 0.1.0 — 2025-10-14

Prepared under the MIT license; it was never published to npm.

- Publish deterministic Style Dictionary outputs for the Brand A baseline.
- Add dual ESM/CJS entry points with JSON, CSS, and Tailwind exports.
- Include MIT license and release metadata for npm distribution.
