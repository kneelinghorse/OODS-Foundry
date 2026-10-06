# OODS Foundry for Claude Code

This plugin gives your assistant the OODS Foundry MCP server and a skill for turning your objects, traits, brand and components into governed React and Vue screens. It also renders charts from your data and reports their certification findings.

The server runs the pinned `npx -y @oods/foundry@0.7.0`. Install with Node.js 22.0.0 or newer on macOS or Linux:

```sh
claude plugin marketplace add https://github.com/kneelinghorse/oods-foundry-claude-plugin.git
claude plugin install oods-foundry@oods-foundry
```

Restart Claude Code, invoke `/oods-foundry:oods-foundry`, and ask the assistant to call `health_check`. Read the returned checks and limits before using generated output.

## What it runs, fetches and writes

The first start downloads the pinned package from npm and unpacks its runtime once into `~/.oods-foundry/runtime/`. Claude Code talks to the server over standard input and output, which opens no network port. The first `design_preview` call starts a preview server on `127.0.0.1` for your browser, and it stops when the server stops. What you make (saved schemas, composed versions, file-mode output, and your own objects, traits and brands) is written under `~/.oods-foundry`. Trace export stays off unless you set `OODS_OTLP_ENDPOINT`. The package's [SECURITY.md](https://cdn.jsdelivr.net/npm/@oods/foundry@0.7.0/SECURITY.md) has the details.

OODS Foundry is free and licensed under Apache-2.0. Visit [oods-foundry.com](https://oods-foundry.com/) for examples and documentation. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
