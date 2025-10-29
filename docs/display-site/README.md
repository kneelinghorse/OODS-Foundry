# Storybook Display Site

This repository publishes the Storybook static build to GitHub Pages so reviewers can browse the design system without cloning the project. Deployment runs automatically through `.github/workflows/deploy-storybook.yml` whenever `main` is updated or a maintainer triggers the workflow manually.

## Prerequisites

1. In GitHub → **Settings ▸ Pages**, set **Build and deployment** to **GitHub Actions**.
2. Ensure the repository has the `GitHub Pages` environment available (created automatically the first time the workflow runs).

No checked-in `storybook-static` directory is required—the workflow builds fresh assets on each run and uploads them as a Pages artifact.

## Deployment Flow

1. Checkout, install dependencies with `pnpm`, and warm token/package builds.
2. Cache Storybook's build artifacts (`node_modules/.cache/storybook`) for faster rebuilds.
3. Generate the static Storybook via `pnpm run build-storybook`.
4. Upload the bundle with `actions/upload-pages-artifact`.
5. Release to Pages through `actions/deploy-pages`. GitHub exposes the URL in the deployment summary.

### Triggers

- `push` to `main` (ignores `cmos/**` updates).
- Manual `workflow_dispatch` from the **Actions** tab.

Each run lands in the `Deployments ▸ github-pages` section. The public URL resolves to:

```
https://kneelinghorse.github.io/OODS-Foundry/
```

## Validating a Deploy

1. Open the latest `Deploy Storybook` workflow run.
2. Confirm `build-storybook` and `deploy` jobs succeeded.
3. Follow the deployment URL (`View deployment` button) to load the hosted Storybook.
4. Smoke-check a few critical stories (Progress, Tabs, Pagination) in light/dark/high-contrast modes.
5. If regressions appear, roll back by redeploying a known-good commit via **Run workflow**.

## Troubleshooting & Recovery

| Scenario | Mitigation |
| --- | --- |
| Workflow fails during `pnpm install` | Re-run with `workflow_dispatch`; if persistent, refresh the pnpm lockfile locally, commit, and retrigger. |
| Pages deploy is flaky | Visit **Settings ▸ Pages**, ensure the environment is active, then redeploy from the Actions run. |
| Stale cache causes build mismatch | Bump the cache key suffix in `.github/workflows/deploy-storybook.yml` (for example `-v2`) and rerun; optionally clear caches via `gh cache delete --repo kneelinghorse/OODS-Foundry --all`. |
| Need to publish immediately | Run `pnpm run build-storybook`, upload `storybook-static` via `actions/upload-pages-artifact` from a manual workflow dispatch. |

## Maintenance Checklist

- Keep `pnpm` and Node versions aligned with CI (`NODE_VERSION: 20`).
- Update documentation when the Storybook base path or deployment URL changes.
- When Stories move to a different router base, adjust Storybook's `managerHead` & preview settings to respect `process.env.STORYBOOK_BASE_URL`.

## Related Resources

- Workflow definition: `.github/workflows/deploy-storybook.yml`
- Sprint changelog entry: `docs/changelog/sprint-19.md`
- Hosting research: `cmos/missions/research/R19.5_Low-Maintenance-Storybook-Hosting-Strategy.md`
