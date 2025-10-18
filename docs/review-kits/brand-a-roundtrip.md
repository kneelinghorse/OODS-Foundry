# Brand A Roundtrip (2025-10-14)
- Change: Primary interactive ramp warmed to OKLCH(0.58 0.19 43) with hover/pressed remapped to keep ΔL guardrails.
- Storybook: ../../storybook-static/index.html?path=/story/foundations-colors-brand-a--primary-interactive
- Chromatic: https://www.chromatic.com/build?appId=oods-brand-a&id=chromatic-diff-2025-10-14
- VR baseline: Captured via Chromatic allowlist (`branda-timeline--dark`) — see `testing/vr/baseline/manifest.json`.
- Before/After specimen:
  - ![](../brand-a/specimen.before.png)
  - ![](../brand-a/specimen.after.png)
- AA/Δ summary: Canvas vs primary interactive = 4.9:1; ΔL +0.02 baseline, ΔC +0.00.
- Notes: Figma variable `BrandA/Interactive/Primary` nudged +2° hue to balance new marketing gradients; pipeline rebuilt tokens + Storybook + Chromatic.
