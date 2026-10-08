# OODS Foundry

OODS Foundry is an object-oriented design system that extends the one you already have. Your AI assistant drives it over MCP. Describe a screen by its object and context, such as a subscription detail view. OODS Foundry composes governed components and design tokens, generates React or Vue code, and renders charts from your data.

Use it when your product has recurring objects and workflows, your screens need to share rules across frameworks and themes, or you want generated UI to follow an existing design system. You can define your own objects, traits, brand and component mappings.

Generated code comes with a receipt naming the static checks performed and the work still needed. Chart certification measures the rendered specification's accuracy, accessibility equivalence, contrast and determinism. It does not certify an entire application.

The optional `a11y_scan` tool checks the text and icon contrast pairs declared by the component stylesheet in every built brand and theme. Given a screen schema, it also renders the screen and checks its document accessibility rules; see the [tool reference](packages/foundry/TOOL-REFERENCE.md#a11y_scan) for scope and thresholds.

## Install

Use Node.js 22.0.0 or newer on macOS or Linux. For a local server in Claude Code:

```sh
claude mcp add oods-foundry -- npx -y @oods/foundry
claude mcp get oods-foundry
```

For the Claude Code plugin, which includes the server and its guided skill:

```sh
claude plugin marketplace add https://github.com/kneelinghorse/oods-foundry-claude-plugin.git
claude plugin install oods-foundry@oods-foundry
```

Restart Claude Code and invoke `/oods-foundry:oods-foundry`. Ask your assistant to call `health_check`, then compose a `Subscription` in `detail` context. [The package guide](packages/foundry/README.md) includes Claude Desktop and Cursor configuration and explains local files and network access. [The walkthrough](packages/foundry/QUICKSTART.md) takes you from an object definition to a generated application.

For a hosted connection, use the streamable HTTP endpoint `https://oods-foundry.com/mcp` in a compatible MCP client. The [website](https://oods-foundry.com/) describes its available tools. Local installation provides the full authoring workflow; the hosted service has its own tool surface and release schedule.

### Docker stdio server

Build the supplied Dockerfile, then keep stdin open for your MCP client:

```sh
docker build -t oods-foundry .
docker run --rm -i -v oods-data:/data oods-foundry
```

The image runs as the unprivileged `node` user. The volume preserves registered objects and import drafts. Mount schema files separately, for example `-v "$PWD/schemas:/schemas:ro"`, and give `object_import` their container paths. The running-app preview binds to loopback inside the container; use the local npm installation for browser previews on the host.

## Source and releases

This repository mirrors each release, one commit per version. The source includes the design system, React and Vue libraries, MCP server, bridge, adapter and packaging scripts. [The tool reference](packages/foundry/TOOL-REFERENCE.md) describes the calls and their contracts.

To install the workspace from this snapshot:

```sh
corepack pnpm install --frozen-lockfile
```

[Building and testing from source](docs/runtime/build.md) describes the package builds, runtime assembly and public test command.

Bug reports and feedback are welcome in [Issues](https://github.com/kneelinghorse/OODS-Foundry/issues). This release mirror does not accept pull requests; they will be closed. See [CONTRIBUTING](CONTRIBUTING.md) and [SECURITY](SECURITY.md).

## License

OODS Foundry is licensed under [Apache-2.0](LICENSE); see [NOTICE](NOTICE) for the copyright holder, [third-party notices](THIRD-PARTY-NOTICES.md) and the [license FAQ](docs/LICENSE-FAQ.md).

Commits before the release snapshot carried an MIT declaration in `package.json` and no LICENSE file.
