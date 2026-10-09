# OODS Foundry

OODS Foundry is an object-oriented design system that extends the one you already have. This plugin gives Claude the OODS Foundry MCP server and the `oods-foundry` skill. With them, Claude registers your objects, traits and brand, substitutes your components for shipped ones, composes screens, previews them running in React and Vue, and generates React or Vue code. It also renders charts from data you give it and certifies the chart specifications it renders; that certification does not cover the surrounding screen or app.

OODS Foundry is open source under the Apache License 2.0. The source of this release is tagged [v0.11.0](https://github.com/kneelinghorse/OODS-Foundry/tree/v0.11.0) in the [OODS Foundry repository](https://github.com/kneelinghorse/OODS-Foundry). Bug reports and feedback go to its [Issues](https://github.com/kneelinghorse/OODS-Foundry/issues).

## Install

The plugin runs the pinned `npx -y @oods/foundry@0.11.0`. It needs Node.js 22.0.0 or newer on macOS or Linux.

If you found OODS Foundry in Anthropic's plugin directory, add it from there: run `/plugin directory` in Claude Code 2.1.287 or later, or open Customize > Plugins on claude.ai or in the Claude desktop app. A plugin you add on claude.ai reaches Claude Code as a synced plugin the next time you start a session signed in to the same account.

To install it from this plugin's own marketplace instead:

```sh
claude plugin marketplace add https://github.com/kneelinghorse/oods-foundry-claude-plugin.git
claude plugin install oods-foundry@oods-foundry
```

Then restart Claude Code, or run `/reload-plugins` in a session that is already open. The skill is `/oods-foundry:oods-foundry`. Ask Claude to call `health_check` first, and read the checks and limits it returns before you rely on generated output.

## Try it

Example prompts that use the plugin's tools:

- "Check that OODS Foundry is running and list the business objects it ships." Claude calls `health_check` and `object_registry`.
- "Compose a detail screen for the Subscription object and give me the link to preview it in React." Claude calls `design_compose` and `design_preview`; open the link in your browser.
- "Draw a bar chart of these counts and certify it: active 17, draft 5, archived 3." Claude calls `viz_render`, then `artifact_certify` with the chart's normalized specification.
- "Generate a React application for that Subscription screen and write its files to disk." Claude calls `code_generate`; the reply names the folder it wrote and lists, under `notChecked`, the checks that did not run.
- "Draft OODS Foundry objects from my OpenAPI file at /absolute/path/to/openapi.yaml and show me the proposals before applying anything." Claude calls `object_import` with `draft`, then `show`.

The skill's quickstart reference walks through bringing your own colour tokens, trait, object and component.

## Where it works

- **Claude Code** (the terminal, the IDE extensions and the desktop app's Code tab): the whole plugin, meaning the local MCP server, which advertises 26 tools by default, and the skill.
- **Cowork**: the local server starts only when the Cowork session runs on your computer, and it needs Node.js 22 or newer there. This has not been tested.
- **Chat** on claude.ai and in the Claude apps: only the skill loads, because chat does not start local MCP servers. For tools in chat, add the hosted connector at `https://oods-foundry.com/mcp`. It gives 9 read-only tools: health, the component catalog and registry, chart rendering and certification, recorded screens and tool schemas. Some share a name with a local tool but do less: the hosted `design_preview` looks up recorded screens, and the hosted `artifact_certify` takes the `viz_render` input. Registering, mapping, composing, previewing and generating need this plugin's local server. In Claude Code, use this plugin; you do not need both.

## What it runs, fetches and writes

By default it sends nothing to OODS Foundry or anyone else.

- **Download and unpack.** On the first start of a version, npx downloads the pinned package from the npm registry, about 70 MB, and keeps it in npm's cache. The package's launcher checks the runtime archive inside it against the SHA-256 that its manifest records, then runs `tar` to unpack it into `~/.oods-foundry/runtime/<version>-<digest>/`: about 344 MB in 23,569 files, once per version.
- **Connection.** Claude Code talks to the server over standard input and output, which opens no network port.
- **Local preview host.** The first `design_preview` or `code_generate` call starts a preview server on `127.0.0.1`. It serves generated apps to your browser, and `code_generate` uses it for the contract checks of mapped components. It stops when the server stops.
- **Other programs it starts.** For a mapped shadcn/ui or shadcn-vue project, previews compile the CSS with that project's own installed Tailwind compiler, in a separate Node process inside the project folder; no package scripts run. Contract checks of mapped components run in a headless Chromium already installed for Playwright, or in the browser that `OODS_CONTRACT_BROWSER_EXECUTABLE` names; the server never downloads a browser.
- **Files it reads.** Tools read the files and folders at the absolute paths that you or Claude give them, such as a component package (`localPath`), a mappings file (`mappingsPath`), a theme stylesheet (`cssPath`), a schema to import (`source.path`) or a shadcn project folder.
- **Files it writes.** What you make is written under `~/.oods-foundry`: saved schemas, composed versions and file-mode output, and your own objects, traits, brands, component mappings and drafts. Applying an accepted shadcn component draft also writes the new adapter files into that project; it never overwrites an existing file.
- **Optional traffic.** Trace export stays off unless you set `OODS_OTLP_ENDPOINT`. Contract checks connect to a remote browser only if you name one with `OODS_PLAYWRIGHT_WS_ENDPOINT`.

The package's [SECURITY.md](https://cdn.jsdelivr.net/npm/@oods/foundry@0.11.0/SECURITY.md) has more detail. The runtime archive's SHA-256 is recorded in the package's `runtime/oods-foundry-runtime.manifest.json`.

## Troubleshooting

- **Requirements.** The server needs Node.js 22 or newer, with `npx` and `tar`, on the PATH that Claude Code starts it with. It runs on macOS and Linux; Windows is untested.
- **Installing fails with "Unrecognized key(s)".** An older Claude Code, such as 2.0.76, refuses the directory listing fields in this plugin's manifest. Update Claude Code, then install again.
- **The first start.** It unpacks a runtime of about 344 MB into `~/.oods-foundry/runtime/`. On a slow disk this can take a minute, and the tools are not ready until it finishes.
- **Check the connection.** Run `/mcp` in Claude Code to see whether the `oods-foundry` server connected, then ask Claude to call `health_check`. If the server failed to connect on its first start, start Claude Code with a longer MCP startup limit, for example `MCP_TIMEOUT=120000 claude`; the default is 30 seconds.
- **Where data lives.** The server keeps its data under `~/.oods-foundry`. `runtime/` holds one unpacked runtime per version, and old versions are never pruned: with Claude Code closed, delete the version folders you no longer use. `schemas/`, `compositions/` and `payloads/` hold saved schemas, composed versions and file-mode output. `objects/`, `traits/`, `brands/` and `mappings/` hold your definitions, brands and component mappings, and `imports/` and `intake/` hold drafts. These data folders survive upgrades.
- **Remove it.** Uninstall the plugin from `/plugin` in Claude Code, or remove it in Customize > Plugins if you added it on claude.ai. Uninstalling leaves `~/.oods-foundry` in place; delete that folder to remove the server's data, every runtime version included.

## Security

Report a suspected vulnerability privately, as the plugin repository's [SECURITY.md](https://github.com/kneelinghorse/oods-foundry-claude-plugin/blob/main/SECURITY.md) describes. Use [Issues](https://github.com/kneelinghorse/OODS-Foundry/issues) for everything else.

## License

OODS Foundry is free and licensed under the Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE). Visit [oods-foundry.com](https://oods-foundry.com/) for examples and documentation.
