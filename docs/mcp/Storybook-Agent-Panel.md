# Storybook Agent Panel

The Storybook Agent panel embeds MCP tools inside Explorer Storybook. It now supports both read-only diagnostics (a11y.scan, purity.audit, vrt.run, diag.snapshot) and write-capable flows (reviewKit.create) behind an approval gate. Designers and developers can preview changes, approve writes, and inspect generated artifacts without leaving Storybook.

## Prerequisites

1. Start the MCP server (`pnpm --filter @oods/mcp-server run build && pnpm --filter @oods/mcp-server run dev`).
2. Start the HTTP bridge in another terminal (`pnpm --filter @oods/mcp-bridge run dev`).
3. Launch Storybook (`pnpm run storybook`). The panel assumes the bridge is reachable at `http://127.0.0.1:4466`; override by setting `window.__OODS_AGENT_BRIDGE_ORIGIN__` in the Storybook console if needed.

Write flows depend on the bridge and MCP server allowing `apply:true`. Approval happens entirely in the panel; the bridge enforces artifact directory constraints.

The bridge automatically serves files under `packages/mcp-server/artifacts/` at `/artifacts/*`, which allows the panel to open transcripts, bundle indexes, diagnostics, and generated artifacts in a new tab.

## Using the panel

1. Open Storybook and switch to any story view (the panel hides itself in Docs mode).
2. Pick a tool. The input schema renders with boolean toggles; `apply` remains locked until approval.
3. Press **Preview changes**. The panel issues a dry run (`apply:false`), announcing “Plan ready. Review the proposed changes.”
4. Review the **Diff Viewer** (Unified default with Split toggle) and the **Preview artifacts** table. Both link to bridge-served files under `/artifacts/current-state/YYYY-MM-DD`.
5. Click **Approve & Apply…** to open the confirmation dialog. `Cancel` receives initial focus, `Escape` closes the modal, and `Enter` activates the primary action.
6. Confirm to run with `apply:true`. During execution the panel announces “Applying approved changes now.” After success, the **Summary** section appears with a success banner and the applied artifacts table.

If the bridge reports an error, the panel surfaces an **Apply Failed** banner with the error code and optional Incident ID. `Retry` replays the last stage (plan vs apply) without clearing the review context.

## Troubleshooting

* **Bridge unreachable** – check that the MCP bridge is running and that CORS allows `http://localhost:6006`.
* **Approval dialog blocked** – ensure Storybook is not inside a sandboxed iframe; the modal uses `position: fixed` at the top window.
* **Artifacts missing** – confirm the MCP server wrote files under `packages/mcp-server/artifacts/current-state/…`. The bridge only exposes paths containing the `artifacts/` segment.
* **Custom origin** – call `window.__OODS_AGENT_BRIDGE_ORIGIN__ = 'http://localhost:5566';` in the Storybook console before reloading to point at a different bridge host/port.
