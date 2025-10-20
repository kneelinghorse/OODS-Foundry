# Development Quickstart — 10-Minute Path

> Ship your first change in ≤10 minutes: boot the stack, make a safe tweak, and prove it passes local guardrails. Timings come from the dry run logged in `diagnostics.json.onboarding`.

## Time Budget
- **00:00 – 02:00** Clone + install
- **02:00 – 04:30** Run Storybook + baseline checks
- **04:30 – 07:30** Make a token or pure-modifier change
- **07:30 – 09:30** Exercise brand switcher + proof stories
- **09:30 – 10:00** Run the local PR check script

---

## Step-by-step

### 0. Install prerequisites (≈2 minutes)
```bash
git clone https://github.com/systemsystems/oods-foundry.git
cd oods-foundry
corepack enable
pnpm install
pnpm exec playwright install chromium  # once, for VRT/a11y harness
```

### 1. Launch Storybook and core checks (≈2.5 minutes)
In parallel tabs:
```bash
pnpm storybook -- --no-open
pnpm tokens:export && pnpm tokens:transform   # keep tokens in sync
pnpm tokens:lint-semantic                     # enforce semantic usage
```
Let Storybook warm up while the tokens pipeline completes.

### 2. Make a safe change (≈3 minutes)
- **Token lane:** tweak a semantic token, then re-run `pnpm tokens:export` + `pnpm tokens:transform`.
- **Component lane:** add a **pure modifier** (`size`, `density`, `variant`). Reference tokens via CSS vars—no hex/px literals.
- **Context lane:** adjust a contextual default in `docs/contexts/...`.

Add or update a proof story to make the change reviewable. Mention it in your commit message.

### 3. Verify across brands (≈2 minutes)
With Storybook running:
1. Toggle the **brand switcher** (toolbar) to Brand A & Brand B.
2. Check **light**, **dark**, and **forced colors** themes.
3. Ensure the change respects overlays; rotate through the density modifier if applicable.

### 4. Run the local PR check (≤30 seconds hands-on)
```bash
pnpm local:pr-check
```
The script runs lint, type checks, unit tests, accessibility checks, and a visual regression dry run. Output is streamed so you can see progress; the first failure stops the run with a clear hint.

If you are iterating rapidly, you can skip heavy steps temporarily:
- `pnpm local:pr-check --skip=vr` → skip visual regression dry run
- `pnpm local:pr-check --skip=a11y` → skip accessibility contract  
Always run the full command before opening a PR.

---

## Troubleshooting
- **Chromatic dry run needs a token**  
  Set `CHROMATIC_PROJECT_TOKEN` in your shell (request from #design-systems). Without it the script falls back to the local smoke harness (`pnpm vrt:lightdark`).

- **Storybook port already in use**  
  Run on a different port:
  ```bash
  STORYBOOK_PORT=7007 pnpm storybook -- --no-open
  ```

- **Tokens export mismatch**  
  Ensure the transform ran after the export and reset local caches if needed:
  ```bash
  pnpm tokens:export
  pnpm tokens:transform
  pnpm tokens:lint-semantic
  git diff tokens   # verify only expected layers changed
  ```

---

## References
- [Modifier Purity Contract](../patterns/modifier-purity.md)
- [Status Map (enum → token)](../../configs/ui/status-map.json)
- [Visual Regression Playbook](../testing/visual-regression.md)
- [A11y Contract & Diff Flow](../policies/high-contrast.md)
