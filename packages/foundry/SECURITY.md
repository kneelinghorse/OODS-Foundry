# Security

This note describes OODS Foundry 0.10.2. It does not claim a completed network audit.

## What runs on your machine

OODS Foundry is a local MCP server. Your client starts it and speaks to it over standard input and output, which opens
no network port.

Two local HTTP servers are part of the runtime. Both listen only on `127.0.0.1`:

- **The preview host.** The first `design_preview` call starts it on a free port, and it stops when the server stops.
  It serves the generated app and its version pages to your browser.
- **The HTTP bridge**, for tools that call OODS Foundry over HTTP. It runs only if you start it yourself, on port 4466
  by default.

Both answer only requests addressed to `127.0.0.1:<port>` or `localhost:<port>`. A request that names any other host
gets `403`, which stops a web page from reaching them through DNS rebinding. Neither generates an access token; the
bridge requires one only when you set `BRIDGE_TOKEN`.

What you make (saved schemas, composed versions and file-mode output) is written to `~/.oods-foundry` when the server
starts from npm, or inside the extracted directory when it starts from the archive.

## Optional export and other traffic

In the server implementation, trace export is disabled when `OODS_OTLP_ENDPOINT` is absent or blank. Configuring an
endpoint enables the OpenTelemetry exporter; optional `OODS_OTLP_HEADERS` are sent to that endpoint. The default
preview host is local. Explicit preview-host settings and caller-supplied URLs can change the destinations involved.
Package downloads, browser asset requests and your AI client's model traffic are separate from server trace export.
These are source-qualified configuration statements, not a claim that every execution is offline.

## Dependencies

Before a release is published, every package in its runtime archive is checked, name and version, against npm's
advisory data. The package's own manifest declares no dependencies because the runtime travels inside it, so the check
reads the archive itself. A high or critical advisory stops the release unless an exception names that package,
version and advisory with a reason and a decision. 0.10.2 has no exception.

Earlier releases fixed these advisories by upgrading or removing the affected dependency. The
[CHANGELOG](CHANGELOG.md) names the release that made each change.

- `brace-expansion` 5.0.9: GHSA-6j4f-fj2g-mc7p and GHSA-qhr7-859c-m2p7 (high, denial of service through
  uncontrolled recursion) and GHSA-q2hr-2g5m-vwhr (moderate, quadratic-time expansion). Upgraded to 5.0.12.
- `style-dictionary` 4.4.0: GHSA-vj5c-m527-mpff (high, prototype pollution in a token-conversion utility). The token
  build moved to Style Dictionary 5.5.5.
- `expr-eval-fork` 2.0.2: GHSA-jc85-fpwf-qm7x (high, unsafe evaluation of supplied functions). Upgraded to 3.0.3.
- `tmp` 0.2.5: GHSA-ph9p-34f9-6g65 (high, path traversal through temporary-file options). Removed with
  `patch-package`, which brought it.
- `@modelcontextprotocol/sdk` 1.30.0: GHSA-6qxp-vccf-f47h (high, an OAuth client could send credentials to an
  authorization server the MCP server chose). Upgraded to 1.31.0.
- Apache ECharts 6.0.0: GHSA-fgmj-fm8m-jvvx (moderate, cross-site scripting). Upgraded to 6.1.0.

These were matches by package name and version; they did not establish that an OODS Foundry tool reached the
affected code. The current token build requires Node.js 22 or later.

## Reporting a problem

Email derek@derekn.com with what you found and how to reproduce it.
