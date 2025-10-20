# Design Quickstart — 10-Minute Path

> Follow these copy-paste steps to prove the design workflow end-to-end in ≤10 minutes on a clean machine. The timings below come from a dry run captured in `diagnostics.json.onboarding`.

## Time Budget
- **00:00 – 02:00** Prep and install dependencies
- **02:00 – 05:00** Adjust a semantic token in Figma
- **05:00 – 07:30** Export → transform tokens → launch Storybook
- **07:30 – 09:00** Capture or tweak a proof story
- **09:00 – 10:00** Run the local PR check script (`pnpm local:pr-check`)

Stay within the lane and you will finish in under 10 minutes even on a cold clone (M2 MBA baseline).

---

## Step-by-step

### 0. Prep (2 minutes)
1. Clone the repo and install dependencies:
   ```bash
   git clone https://github.com/systemsystems/oods-foundry.git
   cd oods-foundry
   corepack enable
   pnpm install
   ```
2. Make sure you can sign into Figma with Tokens Studio permissions.
3. Optional but recommended: export `CHROMATIC_PROJECT_TOKEN` so the VR dry run can authenticate.

### 1. Update a semantic token in Figma (≈3 minutes)
1. Open the **Tokens Studio** library.
2. Change **one semantic token** (e.g., `color.bg.surface`).
3. Keep values semantic—no hex literals in components. Brand-specific tweaks belong in brand overlays.

### 2. Export and transform tokens (≈2.5 minutes)
Run the pipeline from the repo root:
```bash
pnpm tokens:export
pnpm tokens:transform
pnpm storybook -- --no-open
```
Storybook launches on port **6006**; let it boot while you continue.

### 3. Capture a proof story (≈1.5 minutes)
- Navigate to a story that exercises the updated token (e.g., “Surfaces / Card”).
- If the visual delta is small, add or tweak a proof story so CI can “see” it.
- Commit the story change alongside the token export.

### 4. Validate locally before opening a PR (≤1 minute)
Run the consolidated check script:
```bash
pnpm local:pr-check
```
It runs lint, type checks, unit tests, accessibility checks, and a Chromatic dry run (or falls back to the local VRT smoke harness if the Chromatic token is missing). The script exits non-zero on the first failure so you can fix issues before pushing.

---

## What success looks like
- Tokens export & transform complete with no drift warnings.
- Proof story shows the intended visual change for both brands (check the brand switcher in Storybook).
- `pnpm local:pr-check` finishes in ≤90 seconds with all checks green.
- Commit message references the proof story (e.g., `[proof: surfaces/card]`), so reviewers know where to look.

---

## Troubleshooting
- **Chromatic auth failure (`401` or “missing token”)**  
  Export `CHROMATIC_PROJECT_TOKEN` before running the PR check:  
  ```bash
  export CHROMATIC_PROJECT_TOKEN=******  # request from #design-systems
  pnpm local:pr-check
  ```
  Without it, the script automatically falls back to the local VRT smoke run; supply the token for parity with CI.

- **Storybook port conflict (`EADDRINUSE: 6006`)**  
  ```bash
  STORYBOOK_PORT=7007 pnpm storybook -- --no-open
  ```  
  Remember to update the URL in the docs you share with reviewers.

- **Tokens export mismatch**  
  Run the commands in order and clear cached files if needed:  
  ```bash
  pnpm tokens:export
  pnpm tokens:transform
  git status            # ensure only expected token files changed
  ```  
  If diffs persist, double-check that you edited **semantic** tokens and not resolved brand overlays.

---

## Next steps
- Pair with the [Development Quickstart](./dev.md) if you also write code.
- See `docs/themes/brand-b/README.md` for brand-specific overlays and guardrails.
