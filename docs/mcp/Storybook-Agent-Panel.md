# Storybook Agent Panel

The Storybook Agent panel embeds MCP tools inside Explorer Storybook. The Sprint 14 refresh added a persistent task queue, policy-gated approvals, and telemetry surfacing so contributors can line up work, preview diffs, approve writes, and audit outcomes (incident + correlation IDs) without leaving Storybook.

## Task Queue

- **Statuses:** every entry progresses through `Queued` → `WaitingApproval` → `Running` → `Done`, with `Denied` available when an operator stops the task after review.
- **Metadata:** queue items store the tool name, canonicalised inputs, created-on timestamp, most recent `incidentId`, shared `correlationId`, denial reason (if any), and a telemetry link. Selecting an item hydrates the form so you can replay plans or applies.
- **Approvals:** tasks that require write access stay in `WaitingApproval` until the confirmation dialog succeeds. The approval banner references policy docs and mirrors the CLI copy deck.
- **Reruns:** re-queuing or retrying a task keeps the existing item at the top of the list, updating status badges and telemetry pointers instead of creating duplicates.

## Prerequisites

1. Start the MCP server (`pnpm --filter @oods/mcp-server run build && pnpm --filter @oods/mcp-server run dev`).
2. Start the HTTP bridge in another terminal (`pnpm --filter @oods/mcp-bridge run dev`).
3. Launch Storybook (`pnpm run storybook`). The panel assumes the bridge is reachable at `http://127.0.0.1:4466`; override by setting `window.__OODS_AGENT_BRIDGE_ORIGIN__` in the Storybook console if needed.

Write flows depend on the bridge and MCP server allowing `apply:true`. Approval happens entirely in the panel; the bridge enforces artifact directory constraints.

The bridge automatically serves files under `packages/mcp-server/artifacts/` at `/artifacts/*`, which allows the panel to open transcripts, bundle indexes, diagnostics, and generated artifacts in a new tab.

## Using the panel

1. Open Storybook and switch to any story view (the panel hides itself in Docs mode).
2. Queue work: choose a tool, fill inputs, and click **Add to queue**. The item appears in the task list as `Queued` and selection snaps to it.
3. Preview: press **Preview changes**. The panel issues a dry run (`apply:false`), announcing “Plan ready. Review the proposed changes.” Status advances to `WaitingApproval`.
4. Review artifacts: inspect the **Diff Viewer** (Unified default with Split toggle) and **Preview artifacts** table. Both link to bridge-served files under `/artifacts/current-state/YYYY-MM-DD`. Incident + correlation IDs from the dry run display alongside telemetry links.
5. Approval dialog: click **Approve & Apply…**. `Cancel` receives initial focus, `Escape` closes the modal, and `Enter` activates the primary action. The task badge shows `WaitingApproval` until confirmation.
6. Execute: confirm to run with `apply:true`. The panel announces “Applying approved changes now.” Status switches to `Running` and the queue entry records the correlation ID for the apply run.
7. Summary: on success the task moves to `Done`, displays the applied artifacts table, and retains the latest incident/correlation IDs. Use **Deny** to stop a task; supply a reason and the badge flips to `Denied`.

If the bridge reports an error, the panel surfaces an **Apply Failed** banner with the error code and optional Incident ID. `Retry` replays the last stage (plan vs apply) without clearing the review context.

## Troubleshooting

* **Bridge unreachable** – check that the MCP bridge is running and that CORS allows `http://localhost:6006`.
* **Approval dialog blocked** – ensure Storybook is not inside a sandboxed iframe; the modal uses `position: fixed` at the top window.
* **Artifacts missing** – confirm the MCP server wrote files under `packages/mcp-server/artifacts/current-state/…`. The bridge only exposes paths containing the `artifacts/` segment.
* **Custom origin** – call `window.__OODS_AGENT_BRIDGE_ORIGIN__ = 'http://localhost:5566';` in the Storybook console before reloading to point at a different bridge host/port.
