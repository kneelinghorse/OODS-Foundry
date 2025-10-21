# Overlay Agent Recipe

Automates the overlay contract checks and approval flow so agents can prove overlays locally before applying token changes.

## Prerequisites
- Storybook static assets are available (`pnpm run build-storybook` when running in CI).
- Bridge credentials set as environment variables when executing apply (`OODS_AGENT_TOKEN`, optional `OODS_AGENT_APPROVAL`).

## Dry-Run Workflow
1. Run overlay proof checks:
   ```sh
   pnpm overlays:proof
   ```
2. Verify packaging compatibility:
   ```sh
   pnpm pkg:compat
   ```
3. Stage the bridge request (dry-run by default) for transcript + artifact capture:
   ```sh
   pnpm agent:overlays --execute
   ```
   The script forwards to `scripts/agent/approval.ts` with the overlay recipe payload and prints the bridge response.

## Escalating To Apply
- Obtain approval token, then append `--apply`:
  ```sh
  pnpm agent:overlays --execute --apply
  ```
- Optionally override bridge details:
  ```sh
  pnpm agent:overlays --execute --base-url https://bridge.internal --token "$BRIDGE_TOKEN"
  ```

The helper keeps dry-run as the default. Only combine `--execute` with `--apply` after reviewers acknowledge the overlay proof artifacts.
