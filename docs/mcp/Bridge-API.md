# MCP Bridge API

HTTP facade exposing a secured subset of MCP tools for the Storybook Agent panel.

Base URL (default): `http://127.0.0.1:${MCP_BRIDGE_PORT:-4466}`

---

## CORS Policy

- Allowed origin: `http://localhost:6006`
- Allowed methods: `GET, POST, OPTIONS`
- Allowed headers: `Content-Type`, `Authorization`, `X-Bridge-Token`
- Exposed headers: `Content-Type`
- Credentials: disabled (`Access-Control-Allow-Credentials: false`)
- Preflight cache lifetime: 600 seconds (`Access-Control-Max-Age: 600`)

All non-simple requests trigger an automatic preflight. The bridge responds with `204 No Content` and the headers above, enabling the Storybook panel to reuse the preflight result for 10 minutes.

---

## Authentication & Approval

- `BRIDGE_TOKEN` (optional): when set, every `POST /run` request must include `X-Bridge-Token: <value>`. Missing or incorrect tokens produce `401 Unauthorized`.
- `X-Bridge-Approval` header: required to execute writes (`input.apply: true`) on write-capable tools. Any non-empty value is treated as an approval token; recommended value is `granted`.
- Without the approval header, the bridge enforces read-only mode and rejects apply attempts with `403 READ_ONLY_ENFORCED`.

---

## Rate Limiting

The bridge uses @fastify/rate-limit with per-route windows:

| Route           | Window      | Max Requests |
|-----------------|-------------|--------------|
| `GET /tools`    | 1 minute    | 60           |
| `POST /run`     | 1 minute    | 30           |
| `/artifacts/*`  | 1 minute    | 120          |

Exceeding a window returns `429 Too Many Requests` with body:

```json
{ "error": { "code": "RATE_LIMITED", "message": "Too many requests - please slow down.", "limit": 30, "resetInSeconds": 42 } }
```

---

## Endpoints

### `GET /health`

Returns bridge readiness.

```json
{ "status": "ok", "bridge": "ready" }
```

### `GET /tools`

Lists tools exposed through the bridge.

```json
{
  "tools": [
    "a11y.scan",
    "purity.audit",
    "vrt.run",
    "diag.snapshot",
    "reviewKit.create",
    "brand.apply",
    "billing.reviewKit",
    "billing.switchFixtures"
  ]
}
```

### `POST /run`

Executes a tool via the MCP stdio bridge.

- Content-Type must be `application/json`.
- Body schema: `{ "tool": string, "input"?: Record<string, unknown> }`
- For write-capable tools (`reviewKit.create`, `brand.apply`, `billing.reviewKit`, `billing.switchFixtures`), `input.apply: true` requires `X-Bridge-Approval`.
- Success response:

```json
{
  "ok": true,
  "tool": "a11y.scan",
  "artifacts": ["artifacts/current-state/2025-10-15/a11y/report.json"],
  "transcriptPath": "artifacts/current-state/2025-10-15/a11y/transcript.json",
  "bundleIndexPath": "artifacts/current-state/2025-10-15/bundle_index.json",
  "diagnosticsPath": null,
  "preview": { "summary": "Accessibility scan complete." },
  "artifactsDetail": [
    { "path": "artifacts/current-state/2025-10-15/a11y/report.json", "name": "report.json", "sha256": "<sha256>" }
  ]
}
```

- Error responses:
  - `400 BAD_REQUEST` – malformed payload or MCP error (`{ "error": { "code": "BAD_REQUEST", "message": "Tool name is required." } }`)
  - `401 MISSING_TOKEN` / `401 INVALID_TOKEN` – token enforcement failures
  - `403 FORBIDDEN_TOOL` – tool not allowlisted
  - `403 READ_ONLY_TOOL` – tool cannot apply via the bridge
  - `403 READ_ONLY_ENFORCED` – approval header missing for `apply:true`
  - `415 UNSUPPORTED_MEDIA_TYPE` – wrong content type
  - `429 RATE_LIMITED` – throttled

### `GET /artifacts/<path>`

Static file proxy to `packages/mcp-server/artifacts/`. Only paths containing the `artifacts/` segment are exposed.

---

## Usage Examples

Dry run with `vrt.run`:

```bash
curl -s http://127.0.0.1:4466/run \
  -H 'Content-Type: application/json' \
  -d '{ "tool": "vrt.run", "input": { "apply": false } }'
```

Write attempt without approval (fails with 403):

```bash
curl -s -o - -w '\nHTTP %{http_code}\n' http://127.0.0.1:4466/run \
  -H 'Content-Type: application/json' \
  -d '{ "tool": "reviewKit.create", "input": { "apply": true } }'
```

Write attempt with approval (succeeds once the MCP tool supports it):

```bash
curl -s http://127.0.0.1:4466/run \
  -H 'Content-Type: application/json' \
  -H 'X-Bridge-Approval: granted' \
  -H 'X-Bridge-Token: '$BRIDGE_TOKEN \
  -d '{ "tool": "reviewKit.create", "input": { "apply": true } }'
```

Preflight example (browser-initiated):

```bash
curl -i http://127.0.0.1:4466/run \
  -X OPTIONS \
  -H 'Origin: http://localhost:6006' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type,x-bridge-token'
```

---

## Local Development Checklist

1. Start the MCP server:
   ```bash
   pnpm --filter @oods/mcp-server build
   pnpm --filter @oods/mcp-server dev
   ```
2. Launch the bridge (optionally setting `BRIDGE_TOKEN=<secret>`):
   ```bash
   pnpm --filter @oods/mcp-bridge dev
   ```
3. Run Storybook (`pnpm run storybook`) and interact with the Agent panel at `http://localhost:6006`.
