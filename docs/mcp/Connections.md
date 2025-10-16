# OODS MCP Connections

Local developers can point external agent clients at the OODS MCP bridge to exercise the read-only toolchain. This guide covers setup, connection profiles for Claude Desktop and the OpenAI Responses/Agents API, and the `agents-smoke` harness used to validate the bridge.

## Prerequisites

- Build the stdio MCP server once so the bridge can spawn its entry point:

  ```bash
  pnpm --filter @oods/mcp-server run build
  ```

- Start the HTTP bridge (spawns the server subprocess automatically):

  ```bash
  pnpm --filter @oods/mcp-bridge run dev
  ```

- The bridge logs the bound port (example: `[mcp-bridge] listening on :53726`). It defaults to `4466`, but if that port is busy it picks an ephemeral port. Set `MCP_BRIDGE_PORT=<port>` before launching to pin a specific port.

- Optional: export `BRIDGE_TOKEN` to enforce the `X-Bridge-Token` header. Leave it unset when pairing with Claude Desktop, which cannot forward custom headers for remote MCP servers.

The bridge listens on `http://127.0.0.1:${MCP_BRIDGE_PORT:-4466}` and exposes `GET /health`, `GET /tools`, `POST /run`, and `/artifacts/*`.

## Claude Remote MCP

`configs/agents/claude.remote-mcp.json` contains a ready-to-drop profile. Copy the `claudeDesktopConfig` block into `~/.claude/mcp.json` (or the per-OS Claude Desktop configuration path):

```json
{
  "mcpServers": {
    "oods-foundry-bridge": {
      "type": "remote",
      "url": "http://127.0.0.1:4466"
    }
  }
}
```

Key points:

- The bridge serves read-only tools (`a11y.scan`, `purity.audit`, `vrt.run`, `diag.snapshot`), plus write-gated tools that remain locked until an approval header is supplied.
- Because Claude Desktop omits custom headers for remote servers, keep token enforcement disabled when using this profile.
- If the default port is busy, start the bridge with `MCP_BRIDGE_PORT=<port>` and update the `url` accordingly.

## OpenAI Responses/Agents

`configs/agents/openai.agents.json` captures a thin agent profile pointing to the bridge:

- Default base URL: `http://127.0.0.1:4466`
- Function tool definition: `diag_snapshot` (maps to the bridge tool `diag.snapshot`)
- Request template: `POST /run` with `{"tool":"diag.snapshot","input":{"apply":false}}`

Integrate it by:

1. Loading the JSON and registering the function schema with the Responses/Agents API.
2. Supplying a tool-calling callback that issues the documented `POST /run` request. Forward `X-Bridge-Token` when the bridge enforces tokens, and only pass `X-Bridge-Approval` when escalating to write tools.
3. Keeping `apply` set to `false` for diagnostics-only runs.

Before each session, call `GET /tools` to refresh the allowlisted names; the harness logs them for reference.

## Smoke Harness

The mission ships `tools/agents-smoke`, a minimal TypeScript CLI that exercises the bridge end-to-end:

```bash
pnpm --filter @oods/agents-smoke run
```

Behaviour:

- Reads `BRIDGE_URL`, `BRIDGE_TOKEN`, and `BRIDGE_APPROVAL` (defaults: `http://127.0.0.1:4466`, no token, no approval).
- Checks `/health`, lists tools, then runs `diag.snapshot` with `apply:false`.
- Prints artifact paths, bundle index, and diagnostics summary to verify the toolchain.

When the bridge picks an ephemeral port, start the harness with `BRIDGE_URL=http://127.0.0.1:<actualPort> pnpm --filter @oods/agents-smoke run`.
`diag.snapshot` can take up to two minutes to collect diagnostics; extend the wait with `BRIDGE_TIMEOUT=120000` (default) or higher if your environment is slower.

Flags:

- `--tool <name>` – choose a different bridge tool (must be allowlisted).
- `--apply` – send `apply:true` plus `X-Bridge-Approval` (requires the header value in `BRIDGE_APPROVAL`).

Use the harness after any connector or policy change to confirm the bridge still returns artifacts under `artifacts/current-state/<date>/`.
