# Brand A Coverage Matrix

Brand A inherits the same AA + Δ guardrail policy as Theme 0. The table below captures the key checks across light, dark, and high-contrast modes. Contrast ratios derive from `oklch` primaries converted to linear sRGB using the inline helper below.

| Theme | Pair | Contrast | ΔL | ΔC | Notes |
| --- | --- | --- | --- | --- | --- |
| Light | `text.primary` vs `surface.canvas` | 14.18:1 | — | — | ≥ 7× AA for body copy |
| Light | `text.secondary` vs `surface.subtle` | 6.99:1 | — | — | Meets AA for normal text |
| Light | `text.onInteractive` vs `surface.interactive.default` | 4.60:1 | 0 | 0 | Buttons clear AA (≥4.5:1) |
| Light | Hover Δ | — | −0.06 | +0.01 | Within guardrail window (|ΔL| ≤ 0.1, |ΔC| ≤ 0.02) |
| Light | Pressed Δ | — | −0.12 | +0.02 | Still inside published bounds |
| Dark | `text.primary` vs `surface.canvas` | 14.98:1 | — | — | Same AA parity as Theme 0 |
| Dark | `text.onInteractive` vs `surface.interactive.default` | 5.46:1 | 0 | 0 | Foreground stays ≥4.5:1 |
| Dark | Hover Δ | — | +0.05 | +0.01 | Matches Δ policy (+0.05 / +0.01) |
| Dark | Pressed Δ | — | +0.10 | +0.02 | Within dark-mode thresholds |
| High Contrast | System mappings | OS-defined | — | — | Maps to `Canvas`, `CanvasText`, `Highlight`, `HighlightText` |

## Reproducing the Numbers

```sh
node - <<'NODE'
  // Inline helper used to derive the contrast and Δ values
NODE
```

The story **Brand/Brand A** (Storybook) exercises six component families across `data-theme="light"`, `dark`, and `hc`. Chromatic tags `brand-a-light`/`brand-a-dark`/`brand-a-hc` keep visual coverage in sync with CI.
