# Security

This note describes OODS Foundry 0.21.0. It does not claim a completed network audit.

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
version and advisory with a reason and a decision. 0.21.0 has no exception.

Releases up to this one fixed these advisories by upgrading or removing the affected dependency. The
[CHANGELOG](CHANGELOG.md) names the release that made each change.

- OODS Foundry 0.15.0 shipped `@hono/node-server` 1.19.19, clearing GHSA-jpvv-r467-5p4w, and `hono` 4.13.18, clearing GHSA-3gg2-335m-rxc6, GHSA-46wx-v44x-9hh2, GHSA-4h7h-rv7c-7m2v, GHSA-4m76-xfj5-7975 and GHSA-h7mg-cq63-vhpq. <!-- history -->
- `brace-expansion` 5.0.9: GHSA-6j4f-fj2g-mc7p and GHSA-qhr7-859c-m2p7 (high, denial of service through
  uncontrolled recursion) and GHSA-q2hr-2g5m-vwhr (moderate, quadratic-time expansion). Upgraded to 5.0.12.
- `style-dictionary` 4.4.0: GHSA-vj5c-m527-mpff (high, prototype pollution in a token-conversion utility). The token
  build moved to Style Dictionary 5.5.5.
- `expr-eval-fork` 2.0.2: GHSA-jc85-fpwf-qm7x (high, unsafe evaluation of supplied functions). Upgraded to 3.0.3.
- `tmp` 0.2.5: GHSA-ph9p-34f9-6g65 (high, path traversal through temporary-file options). Removed with
  `patch-package`, which brought it.
- `@modelcontextprotocol/sdk` 1.30.0: GHSA-6qxp-vccf-f47h (high, an OAuth client could send credentials to an
  authorization server the MCP server chose). Upgraded to 1.31.0.
- `@modelcontextprotocol/sdk` 1.31.0: GHSA-22jm-h49p-29qw (high, experimental tasks were not tied to the session that
  created them) and GHSA-46jr-4wx8-v453 (high, one HTTP request within the default size limit could exhaust server
  memory during validation). Upgraded to 1.32.2 in 0.11.3. <!-- history -->
- `body-parser` 2.3.0: GHSA-27r3-jxmh-p828 (high, denial of service through trailing bytes after a compressed request
  body). Upgraded to 2.4.0 in 0.11.3. <!-- history -->
- `zod` 3.25.76: GHSA-mrhx-c7xc-m3w5 (high, memory exhaustion while validating oversized constrained collections).
  Upgraded to 4.6.7 in 0.11.3. <!-- history -->
- Apache ECharts 6.0.0: GHSA-fgmj-fm8m-jvvx (moderate, cross-site scripting). Upgraded to 6.1.0.
- `fast-xml-parser` 5.11.2: GHSA-474x-hrwr-fgx4 (low, quadratic CPU use when scanning unterminated stop-node tags; the
  OData reader sets no stop nodes). Upgraded to 5.12.0 in 0.13.1. <!-- history -->

The runtime dependency update covers these packages.

- `fast-uri` 3.1.8 and 4.2.1 move to 3.1.9 and 4.2.3. Both branches clear GHSA-333x-w4r6-6crp, GHSA-w74x-v6f9-j3xg, GHSA-wjr9-j795-jxcr and GHSA-xhq7-xmqj-769h.
- `fastify` 5.12.5 moves to 5.12.6 for GHSA-389g-gv7q-r4x8.
- `qs` 6.16.0 moves to 6.16.1 for GHSA-6pq8-jhm2-2vcw.
- `ip-address` 10.7.2 moves to 10.7.4 for GHSA-rxp7-6hxx-x8q5.
- `@hono/node-server` 1.19.19 moves to 2.1.9 for GHSA-rmxm-3fg6-px4f.

Two moderate advisories remain in the runtime, in `glob` (GHSA-3g3m-2fjr-6pw4) and `minimatch` (GHSA-g3hv-75wg-m249).
The token build uses Style Dictionary, whose glob wrapper requires glob 13. Moving that path to a fixed version of glob would
require overriding the wrapper’s declared major version. The bridge also brings in both packages through `@fastify/static` 10.1.3.
Version 10.1.12 of that package uses glob 14, but changing the bridge alone would leave both findings in the token build.
OODS Foundry supplies fixed glob patterns.

These were matches by package name and version; they did not establish that an OODS Foundry tool reached the
affected code. The current token build requires Node.js 22 or later.

## Reporting a problem

Email derek@derekn.com with what you found and how to reproduce it.
