
````markdown
# Agent Recipes — Quick Index

These recipes let the Agent Panel (or CLI) do common contributor chores safely.
All recipes follow the same flow:

1) **Dry-run**: produce a proposed diff + artifacts  
2) **Approve**: human (or code owner) grants permission  
3) **Execute**: apply changes, open/update PR, attach telemetry

---

## Prereqs

- Policy + connectors configured (`configs/agent/policy.json`)
- PR-first CI enabled (build, lint, types, coverage, tokens, a11y, VR)
- Secrets for preview (e.g., Chromatic) if used by your repo

Useful commands:
```bash
pnpm panel            # Agent Panel UI
pnpm agent:dryrun     # CLI dry-run
pnpm agent:approve    # CLI approve last dry-run (requires token/permission)
````

Artifacts & logs:

* Telemetry: JSONL lines with `CorrelationId` + `IncidentId`
* PR labels: see each recipe
* Diagnostics summary appended to `diagnostics.json`

---

## 1) Token Roundtrip (Figma → Repo → Storybook)

**What it does**

* Pulls token export (Tokens Studio) into `tokens/**/*.json` (DTCG)
* Runs transform to Tailwind v4 CSS vars
* Updates/creates proof stories if provided
* Opens/updates a PR with preview link

**CLI**

```bash
# Dry-run: fetch export, run transform, stage changes, compute VR/a11y impact
pnpm agent:dryrun --recipe tokens.roundtrip --brand all

# Approve + execute: commit, push, open/update PR, attach label
pnpm agent:approve --recipe tokens.roundtrip
```

**Labels**: `qa-tweak`, `tokens`
**Notes**: Prefer **semantic** tokens; avoid literals in components.

---

## 2) VR Baseline Refresh (Curated stories)

**What it does**

* Rebuilds curated story baselines after intentional visual changes
* Posts a human summary (changed stories, diffs) on the PR

**CLI**

```bash
pnpm agent:dryrun --recipe vr.baseline --stories curated
pnpm agent:approve --recipe vr.baseline
```

**Labels**: `vr-baseline`
**Guardrail**: Requires an explanation in PR description (“why this diff is intended”).

---

## 3) A11y Fix Pass (axe/ARIA + HC)

**What it does**

* Runs a11y checks on curated stories
* Suggests targeted fixes (ARIA roles, labels, focus order, contrast)
* Can open one PR per logical group (optional)

**CLI**

```bash
pnpm agent:dryrun --recipe a11y.fix --scope curated
pnpm agent:approve --recipe a11y.fix
```

**Labels**: `a11y-fix`
**Notes**: HC issues often need the transparent-border focus pattern; see `docs/policies/high-contrast.md`.

---

## 4) Enum→Token Drift Repair (statusables + validation)

**What it does**

* Scans for raw status strings/colors in UI
* Rewrites to `configs/ui/status-map.json` lookups
* Adds/updates stories to prove each mapped state

**CLI**

```bash
pnpm agent:dryrun --recipe status.map-repair --domain billing
pnpm agent:approve --recipe status.map-repair
```

**Labels**: `enum-token`, `qa-tweak`
**Guardrail**: CI lint blocks raw status strings after this runs.

---

## 5) Brand Overlay Governance (Sprint 15+)

**What it does**

* Validates brand overlays (no cross-brand leaks, no disallowed overrides)
* Generates a token-diff report (added/removed/aliased) with risk hints
* Optionally splits fixes into separate PRs (by namespace)

**CLI**

```bash
pnpm agent:dryrun --recipe tokens.govern --brands "brand-a,brand-b"
pnpm agent:approve --recipe tokens.govern
```

**Labels**: `token-governance`, `token-change:breaking` (if high-risk)
**Notes**: Overlay rules live in `docs/themes/brand-b/README.md`.

---

## 6) Story Curation (Add/Update Proof Stories)

**What it does**

* Creates minimal proof stories for components/states missing coverage
* Ensures matrix coverage (brand × theme × HC × key modifiers)

**CLI**

```bash
pnpm agent:dryrun --recipe stories.curate --component Button --matrix "brand,theme,HC,size"
pnpm agent:approve --recipe stories.curate
```

**Labels**: `stories`
**Notes**: Curated proofs reduce VR flakes and make intended changes explicit.

---

## 7) Onboarding PR Helper (Docs & Template touch-ups)

**What it does**

* Adds/updates onboarding quickstarts links in `README.md`
* Ensures PR template includes checklist links
* Can fix common doc link rot

**CLI**

```bash
pnpm agent:dryrun --recipe docs.onboarding
pnpm agent:approve --recipe docs.onboarding
```

**Labels**: `docs`, `onboarding`

---

## Telemetry & Approvals

Every recipe writes **JSONL telemetry** with:

* `missionId`, `recipe`, `CorrelationId`, `IncidentId`
* `durationMs`, `outcome`, `errorCode?`
* Affected files and story IDs when applicable

Approvals:

* Agent Panel UI: Review diff → **Approve**
* CLI: `pnpm agent:approve --recipe <name>`
* All executions cross-link PRs to their IncidentId in logs

---

## Safety Gates (what can block execution)

* **tokens-validate**: DTCG schema errors
* **tokens:lint**: literals in components
* **a11y-contract**: failing ARIA/contrast rules
* **vr-test**: unintended visual diffs
* **governance** (brands): disallowed overrides or cross-brand leaks

The agent will refuse to execute if any blocking gate fails during dry-run. Fix locally or approve with the appropriate PR label (e.g., `token-change:breaking`) where allowed by policy.

---

## Troubleshooting

* **“Policy denied”**: Check `configs/agent/policy.json` (tool allowlist, scopes, rate limits).
* **“Missing secrets”**: Preview/Chromatic token or repo permissions absent—add secrets and retry.
* **“No changes detected”**: Ensure you exported tokens or selected the correct story/component scope.
* **VR flakes**: Make stories deterministic (no time/random/remote data). See `docs/testing/visual-regression.md`.

---

## See Also

* `docs/getting-started/design.md`
* `docs/getting-started/dev.md`
* `docs/tokens/4-layer-overview.md`
* `docs/figma/roundtrip-checklist.md`
* `docs/policies/high-contrast.md`, `docs/policies/hc-quickstart.md`
* `docs/patterns/modifier-purity.md`
* `docs/mcp/Panel-UX.md`

```

```
