#!/usr/bin/env node

// One template, five rendered files: the npm package's README (packages/foundry/README.md), the archive's own install
// guide (docs/runtime/install.md) and the three client config snippets under configs/agents/. Every name comes from
// the product's one name source (configs/product/name.json) and every number from the tool registry, the adapter
// manifest and the runtime manifest module, so the pages cannot drift from the runtime they describe (s211-m03).
//
//   node scripts/runtime/client-configs.mjs          # write
//   node scripts/runtime/client-configs.mjs --check  # fail when any output is stale

import assert from "node:assert/strict";
import { advertisedName } from "./tool-names.mjs";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  RUNTIME_ARCHIVE_FILE,
  RUNTIME_ARCHIVE_SHA256_FILE,
  PREVIEW_PLATFORMS,
  RUNTIME_MANIFEST_FILE,
  RUNTIME_PACKAGES,
  RUNTIME_SBOM_FILE,
} from "./manifest.mjs";
import { GENERATED_OUTPUT } from "../license/render-license.mjs";

/** "macOS (arm64, x64) and Linux (arm64, x64)" from the shipped esbuild platform list. */
export function previewPlatformMatrix(platforms = PREVIEW_PLATFORMS) {
  const names = { darwin: "macOS", linux: "Linux", win32: "Windows" };
  const groups = new Map();
  for (const platform of platforms) {
    const [os, arch] = platform.split("-");
    if (!groups.has(os)) groups.set(os, []);
    groups.get(os).push(arch);
  }
  return [...groups.entries()].map(([os, arches]) => `${names[os] ?? os} (${arches.join(", ")})`).join(" and ");
}

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const NAME = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "configs/product/name.json"), "utf8"));

/** The one placeholder of the archive guide: the directory the archive was extracted into. */
export const RUNTIME_DIR_PLACEHOLDER = `/path/to/${NAME.archiveBase}`;
/** The key every client registers the server under (#2296: never `forge`). */
export const SERVER_NAME = NAME.installKey;
export const ADAPTER_ENTRY = "packages/mcp-adapter/index.js";
/** What every client runs for the npm package. */
export const NPX_ARGS = Object.freeze(["-y", NAME.npmPackage]);
export const PACKAGE_README = "packages/foundry/README.md";
export const INSTALL_DOC = "docs/runtime/install.md";
/** Where the Claude Code plugin is hosted (Sprint 219 m04), and the server's official MCP registry name. */
export const PLUGIN_MARKETPLACE = "https://github.com/kneelinghorse/oods-foundry-claude-plugin.git";
/** The plugin and the marketplace it is listed in, as `claude plugin install` names them. */
export const PLUGIN_INSTALL = "oods-foundry@oods-foundry";
export const MCP_REGISTRY_NAME = "com.oods-foundry/foundry";
/**
 * s223-m03 (#2527 ruling 16): the platforms the runtime supports and the clients it documents. The README and the install
 * guide render their sentences from these, and the package's facts.json publishes them, so the prose and the data agree.
 */
export const SUPPORTED_PLATFORMS = Object.freeze(["macOS", "Linux"]);
export const SUPPORTED_CLIENTS = Object.freeze(["Claude Desktop", "Claude Code", "Cursor"]);
/** "A or B", "A, B or C": the product's prose lists. */
export const orList = (items) => items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;
/** The two commands that add the plugin's marketplace and install the plugin from it. */
export const PLUGIN_INSTALL_COMMANDS = Object.freeze([`claude plugin marketplace add ${PLUGIN_MARKETPLACE}`, `claude plugin install ${PLUGIN_INSTALL}`]);
export const CONFIG_FILES = Object.freeze({
  claudeDesktop: "configs/agents/claude-desktop.stdio-mcp.json",
  claudeCode: "configs/agents/claude-code.stdio-mcp.json",
  cursor: "configs/agents/cursor.stdio-mcp.json",
});

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relative), "utf8"));
}

/** The runtime's Node floor: the highest `>=x.y.z` its first-party packages declare (s206-m03 exports it for the closure check). */
export function nodeFloor() {
  let floor = null;
  for (const name of RUNTIME_PACKAGES) {
    const range = readJson(`packages/${name}/package.json`).engines?.node;
    if (!range) continue;
    const match = /^>=\s*(\d+)\.(\d+)\.(\d+)$/.exec(range.trim());
    assert(match, `packages/${name}: unsupported engines.node range ${range}`);
    const tuple = match.slice(1).map(Number);
    if (!floor || tuple.some((part, index) => part !== floor[index] && part > floor[index] && tuple.slice(0, index).every((left, at) => left === floor[at]))) {
      floor = tuple;
    }
  }
  assert(floor, "no runtime package declares engines.node");
  return floor.join(".");
}

/**
 * The calls a minute the server's token bucket allows each tool (security/policy.ts reads security/policy.json): a
 * tool's own ratePerMinute, else the policy default. Tools off the default are grouped by rate, slowest first, in
 * registry order (s222-m03, #2502 ruling 16).
 */
export function rateLimits() {
  const policy = readJson("packages/mcp-server/src/security/policy.json");
  const registry = readJson("packages/mcp-server/src/tools/registry.json");
  const fallback = Math.max(1, policy.limits.ratePerMinute ?? 60);
  const groups = new Map();
  for (const tool of [...registry.auto, ...registry.onDemand]) {
    const configured = (policy.rules.find((rule) => rule.tool === tool) ?? policy.rules.find((rule) => rule.tool === "*"))?.ratePerMinute;
    const rate = typeof configured === "number" && Number.isFinite(configured) && configured > 0 ? configured : fallback;
    if (rate === fallback) continue;
    if (!groups.has(rate)) groups.set(rate, []);
    groups.get(rate).push(advertisedName(tool));
  }
  return { default: fallback, exceptions: [...groups.entries()].sort(([left], [right]) => left - right).map(([rate, tools]) => ({ rate, tools })) };
}

/** "a, b and c" */
const prose = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

/** The README's one line on rate limits, from rateLimits(). */
export function rateLimitLine(limits) {
  const groups = limits.exceptions.map(({ rate, tools }) => `${prose(tools.map((tool) => `\`${tool}\``))} (${rate})`);
  const except = groups.length ? `, except ${groups.length < 2 ? groups[0] : `${groups.slice(0, -1).join("; ")}; and ${groups.at(-1)}`}` : "";
  return `Each tool accepts ${limits.default} calls a minute${except}. A call past its tool's limit is refused with a rate-limit error; wait a few seconds and call again.`;
}

/** Everything the template renders, measured from the repository. */
export function collectInstallFacts() {
  const registry = readJson("packages/mcp-server/src/tools/registry.json");
  const adapter = readJson("packages/mcp-adapter/package.json");
  const root = readJson("package.json");
  const foundry = readJson("packages/foundry/package.json");
  return {
    previewPlatforms: previewPlatformMatrix(),
    version: root.version,
    headline: foundry.description.split(". ")[0] + ".",
    product: NAME.product,
    npmPackage: NAME.npmPackage,
    contact: readJson("configs/license/holder.json").contact,
    // Images and the terms files resolve on the npm page and in the package alike: the CDN serves published files.
    cdnBase: `https://cdn.jsdelivr.net/npm/${NAME.npmPackage}@${root.version}/`,
    // Guides link to the public source at this release's tag, where GitHub renders them and #fragments scroll; the CDN
    // serves Markdown as raw text.
    sourceBase: `${foundry.repository.url.replace(/^git\+/, "").replace(/\.git$/, "")}/blob/v${root.version}/`,
    npmPage: `https://www.npmjs.com/package/${NAME.npmPackage}`,
    autoTools: registry.auto.length,
    allTools: registry.auto.length + registry.onDemand.length,
    toolNames: registry.auto.map((name) => advertisedName(name)),
    adapterVersion: adapter.version,
    nodeFloor: nodeFloor(),
    rateLimits: rateLimits(),
    // s223-m03 (#2529): the chart types a dashboard panel takes, of those viz_render draws, from the two input schemas.
    dashboardChartTypes: readJson("packages/mcp-server/src/schemas/dashboard.render.input.json").$defs.ChartPanel.properties.chartType.enum.length,
    chartTypes: readJson("packages/mcp-server/src/schemas/viz.render.input.json").properties.chartType.enum.length,
  };
}

/** A document in the public source at this release's tag. The file must exist here, so a link cannot point at nothing. */
export function sourceLink(facts, file) {
  assert(fs.existsSync(path.join(REPO_ROOT, file.split("#")[0])), `no ${file} to link to`);
  return `${facts.sourceBase}${file}`;
}

/** "the on-demand tool", or "the 2 on-demand tools". */
const onDemandTools = (facts) => facts.allTools - facts.autoTools === 1 ? "the on-demand tool" : `the ${facts.allTools - facts.autoTools} on-demand tools`;

/**
 * Preview documentation: the README lists dashboard_render among the tools, and the first
 * run says what it does, and nothing it does not: its page is the fixed metric-overview layout, drawn once as static HTML.
 */
export function dashboardRenderSentences(facts) {
  return `For several charts on one page, \`dashboard_render\` lays out shared datasets and panels (KPI tiles and ${facts.dashboardChartTypes} of the ${facts.chartTypes} chart types) in one fixed metric-overview layout: a row of KPIs, a trend, a breakdown and an optional map, each chart rendered as \`viz_render\` renders it. With \`"output": {"html": true}\` it also returns the page as static HTML in light, dark or high contrast; the page does not fetch or refresh its data.`;
}

const npmBlock = () => ({ command: "npx", args: [...NPX_ARGS] });
const archiveBlock = () => ({ command: "node", args: [`${RUNTIME_DIR_PLACEHOLDER}/${ADAPTER_ENTRY}`] });
// Cursor's configuration reference lists `type` as required for a stdio server (its examples omit it); s206-m03 sends it.
const claudeDesktopConfig = (block) => ({ mcpServers: { [SERVER_NAME]: block } });
const cursorConfig = (block) => ({ mcpServers: { [SERVER_NAME]: { type: "stdio", ...block } } });
// Options go after the name: `-e` before it reads the name as a variable ("Invalid environment variable format").
function claudeCodeCommands(command) {
  return {
    add: `claude mcp add ${SERVER_NAME} -- ${command}`,
    addWithOptions: `claude mcp add ${SERVER_NAME} -s user -e MCP_TOOLSET=all -- ${command}`,
    get: `claude mcp get ${SERVER_NAME}`,
    remove: `claude mcp remove ${SERVER_NAME}`,
  };
}
const NPX_COMMAND = `npx ${NPX_ARGS.join(" ")}`;
const ARCHIVE_COMMAND = `node ${RUNTIME_DIR_PLACEHOLDER}/${ADAPTER_ENTRY}`;

const ENVIRONMENT = (facts) => ({
  MCP_TOOLSET: `default (${facts.autoTools} tools) | all (${facts.allTools} tools)`,
  MCP_EXTRA_TOOLS: "comma-separated on-demand tools to add to the default surface, for example a11y_scan",
  MCP_ROLE: "designer (default) | maintainer",
  MCP_SCHEMA_STORE_ROOT: "where saved schemas, composed versions and file-mode output are kept; default ~/.oods-foundry from npm, the extracted directory from the archive",
  OODS_NODE_PATH: "absolute path of the Node binary the adapter should start the server with; default: the Node running the adapter",
  OODS_MCP_APPS_UI: "1 offers the design preview app to a client that did not negotiate the MCP Apps extension; default: unset, only clients that negotiated it",
  OODS_FOUNDRY_HOME: "folder where import and intake drafts are staged and, when started with npx, the runtime and the default folders for saved schemas, objects, traits, brands and mappings are kept; default ~/.oods-foundry",
  OODS_OBJECTS_DIR: "folder your own objects are read from, after the ones OODS Foundry ships; default ~/.oods-foundry/objects from npm, unset from the archive",
  OODS_TRAITS_DIR: "folder your own traits are read from, after the ones OODS Foundry ships; default ~/.oods-foundry/traits from npm, unset from the archive",
  OODS_BRANDS_DIR: "folder your own brands are kept and built in, outside the runtime; default ~/.oods-foundry/brands from npm, unset from the archive",
});

// The design preview inside the conversation (s202-m05): a client that renders MCP Apps shows design_preview as the
// running app, every other client gets the text result. Only what the Sprint 202 research recorded is stated, and it is
// labelled as the clients' documentation: no Claude Desktop or Cursor run is recorded (s213-m02).
const TEXT_FALLBACK = "otherwise the result is text with links to the preview in the browser, served on 127.0.0.1";
const DIRECT_REGISTRATION = `Register ${SERVER_NAME} directly, beside any other entry such as an MCP hub, not behind it: the preview app reaches the conversation only when the client talks to the server itself or a hub passes the MCP Apps extension, the tool's _meta.ui and resources/read through.`;
const ARCHIVE_ALTERNATIVE = `To run the runtime archive instead (the npm package carries it at runtime/${RUNTIME_ARCHIVE_FILE}), use command node with args ["${RUNTIME_DIR_PLACEHOLDER}/${ADAPTER_ENTRY}"], where ${RUNTIME_DIR_PLACEHOLDER} is the absolute path you extracted it into; ${INSTALL_DOC} in the public source gives the steps.`;
const NOTES = (facts) => [
  `The client runs ${NPX_COMMAND}. The first start downloads the package and unpacks its runtime once into ~/.oods-foundry/runtime/; later starts reuse it.`,
  `The node and npx the client starts must be Node ${facts.nodeFloor} or newer; if the client cannot find npx, put its full path (what which npx prints) in command and give the client an env PATH that includes the directory of node.`,
  `Default surface: ${facts.autoTools} tools. MCP_TOOLSET=all adds ${onDemandTools(facts)} (${facts.allTools} in all).`,
  ARCHIVE_ALTERNATIVE,
];

export function renderConfigs(facts) {
  const transport = { type: "stdio", ...npmBlock() };
  const desktop = {
    name: `${facts.product} — Claude Desktop (stdio)`,
    summary: `Connect Claude Desktop to ${facts.product}; the client starts it with npx.`,
    transport,
    placement: {
      macOS: "~/Library/Application Support/Claude/claude_desktop_config.json",
      windows: "%APPDATA%\\Claude\\claude_desktop_config.json",
      key: `mcpServers.${SERVER_NAME}`,
    },
    claudeDesktopConfig: claudeDesktopConfig(npmBlock()),
    env: ENVIRONMENT(facts),
    notes: [
      ...NOTES(facts),
      `Restart Claude Desktop after saving the file; the tools appear under the ${SERVER_NAME} server.`,
      `Claude Desktop's documentation says it renders apps from a local server only with Developer Mode on, so design_preview could show the running app inside the conversation there; this has not been tried with ${facts.product}, and ${TEXT_FALLBACK}.`,
      DIRECT_REGISTRATION,
      "After a newer version installs, choose Reload MCP Configuration: by its documentation, Claude Desktop keeps the tool list and the preview app it fetched until then.",
    ],
  };
  const code = {
    name: `${facts.product} — Claude Code (stdio)`,
    summary: `Register ${facts.product} with Claude Code as a local stdio MCP server; the client starts it with npx.`,
    transport,
    placement: {
      scope: "local (the project you run the command in); add -s user to make it available everywhere",
      key: `mcpServers.${SERVER_NAME}`,
    },
    claudeCodeCommands: claudeCodeCommands(NPX_COMMAND),
    claudeCodeConfig: { mcpServers: { [SERVER_NAME]: { type: "stdio", ...npmBlock(), env: {} } } },
    env: ENVIRONMENT(facts),
    notes: [
      ...NOTES(facts),
      `Pass environment with -e, for example: claude mcp add ${SERVER_NAME} -e MCP_TOOLSET=all -- ${NPX_COMMAND}`,
      "Claude Code does not render MCP Apps: design_preview answers with text and links to the preview in the browser, served on 127.0.0.1.",
    ],
  };
  const cursor = {
    name: `${facts.product} — Cursor (stdio)`,
    summary: `Connect Cursor to ${facts.product}; the client starts it with npx.`,
    transport,
    placement: { file: ".cursor/mcp.json (project) or ~/.cursor/mcp.json (all projects)", key: `mcpServers.${SERVER_NAME}` },
    cursorConfig: cursorConfig(npmBlock()),
    env: ENVIRONMENT(facts),
    notes: [
      ...NOTES(facts),
      "Cursor reads the file on start; reload the window after saving.",
      `Cursor's documentation says version 2.6 and later render MCP Apps, so design_preview could show the running app inside the chat; this has not been tried with ${facts.product}, and ${TEXT_FALLBACK}.`,
      DIRECT_REGISTRATION,
      "Reload the window after a newer version installs.",
    ],
  };
  return {
    [CONFIG_FILES.claudeDesktop]: `${JSON.stringify(desktop, null, 2)}\n`,
    [CONFIG_FILES.claudeCode]: `${JSON.stringify(code, null, 2)}\n`,
    [CONFIG_FILES.cursor]: `${JSON.stringify(cursor, null, 2)}\n`,
  };
}

const json = (value) => `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
const GENERATED = (from) => `<!-- Generated by scripts/runtime/client-configs.mjs from ${from}. Do not edit; run \`node scripts/runtime/client-configs.mjs\` and verify with \`--check\`. -->`;

/**
 * The clients' design-preview behaviour, the same in both guides. The reference-host run was made on a 0.2.1
 * pre-release build (artifacts/product-reality/sprint-218/m03/packed-identity.json), so the paragraph names that version
 * and carries the history mark that keeps a release bump from rewriting it.
 */
const PREVIEW_IN_CONVERSATION = (facts, replaced) => [
  "`design_preview` returns the generated screen running in a browser. A client that renders MCP Apps can show it inside the conversation, where you edit the composition, compare two versions side by side, accept one and request changes. On a 0.2.1 pre-release build, the MCP Apps SDK reference host v1.7.5 rendered React and Vue inside the conversation with `OODS_MCP_APPS_UI=1` through a local HTTP-to-stdio relay; its default initialize request advertises no UI capability and receives text instead. That host ran with a one-line change to how it serves its sandbox page. No Claude Desktop or Cursor run is recorded; the two lines below come from their documentation. Any other client gets the same result as text, with links to the preview in your browser, served on 127.0.0.1. <!-- history -->",
  "",
  `- **Claude Desktop**, by its documentation, renders an app from a local server only with Developer Mode on, and keeps the tool list and the app it fetched until you choose Reload MCP Configuration after ${replaced}.`,
  `- **Cursor**, by its documentation, renders MCP Apps from version 2.6. Reload the window after ${replaced}.`,
  "- **Claude Code** does not render MCP Apps; it shows the text result.",
  "",
  `Register \`${SERVER_NAME}\` directly, beside any other entry such as an MCP hub, not behind it. The app reaches the conversation only when the client talks to the server itself, or when a hub passes the MCP Apps extension (\`io.modelcontextprotocol/ui\`), the tool's \`_meta.ui\` and \`resources/read\` through to it. When a client connects, the server writes one line to its standard error naming the client and whether it negotiated the extension; the client's log for the \`${SERVER_NAME}\` server shows whether the app was offered.`,
];

const SETTINGS = (facts, storeDefault, folderDefault) => [
  "Environment variables are optional; every default is the documented one. Set them in the client's `env` block (Claude Desktop, Cursor) or with `-e KEY=value` after the name on `claude mcp add`.",
  "",
  "| Variable | Default | Effect |",
  "| --- | --- | --- |",
  `| \`MCP_TOOLSET\` | \`default\` | \`default\` advertises ${facts.autoTools} tools; \`all\` adds ${onDemandTools(facts)}, ${facts.allTools} in all. |`,
  "| `MCP_EXTRA_TOOLS` | (none) | Comma-separated on-demand tools added to the default surface, for example `a11y_scan`. |",
  "| `MCP_ROLE` | `designer` | Policy role (`designer` or `maintainer`). |",
  `| \`MCP_SCHEMA_STORE_ROOT\` | ${storeDefault} | Where saved schemas, every composed and previewed version, and file-mode output are kept. |`,
  "| `OODS_NODE_PATH` | the Node running the adapter | Node binary used to start the native server. |",
  "| `OODS_MCP_APPS_UI` | (unset) | `1` offers the preview app on `design_preview` even to a client that did not negotiate the MCP Apps extension. |",
  "| `OODS_FOUNDRY_HOME` | `~/.oods-foundry` | Where import and intake drafts are staged and, when started with npx, where the runtime and every default folder below are kept. The Docker image sets it to `/data`. |",
  `| \`OODS_OBJECTS_DIR\` | ${folderDefault("objects")} | Folder your own objects are read from, after the ones ${facts.product} ships; the \`object_register\` tool's \`register\` writes there. |`,
  `| \`OODS_TRAITS_DIR\` | ${folderDefault("traits")} | Folder your own traits are read from, after the ones ${facts.product} ships. |`,
  `| \`OODS_BRANDS_DIR\` | ${folderDefault("brands")} | Folder your own brands are kept in and built in, outside the runtime; \`brand_create\`'s \`create\` writes there. |`,
  "| `OODS_MAPPINGS_DIR` | `~/.oods-foundry/mappings` | Folder your component mappings are kept in (`component-mappings.json`), outside the runtime; `component_map` writes there. |",
  "| `MCP_MAPPINGS_PATH` | (unset) | A mappings file used instead of that folder's; it takes precedence. A relative path resolves against the runtime directory. |",
];

const REQUIREMENTS = (facts, extra) => [
  `- Node.js ${facts.nodeFloor} or newer, as the \`node\` your client starts. Use a current LTS release; ${facts.nodeFloor} is the floor, and the runtime says so in one sentence on a Node below it.`,
  `- ${orList(SUPPORTED_PLATFORMS)}. The running-app preview (\`design_preview\`) compiles generated screens with a bundled esbuild binary on ${facts.previewPlatforms}; other tools do not need that compiler, and on other platforms \`design_preview\` returns \`OODS-N021\` naming the platform. **Windows is untested**: no run there has been recorded, and no Windows esbuild binary ships.`,
  ...extra,
  `- One of ${orList(SUPPORTED_CLIENTS)}.`,
];

/** Identifiers that keep the product's earlier name (lock ruling #2463e): saved files and clients depend on them. */
const LEGACY_IDENTIFIERS = "Some identifiers keep the product's earlier name: the runtime manifest and SBOM formats (`forge-runtime-manifest/v1`, `forge-runtime-sbom-lite/v1`), the readiness attestation (`forge-readiness-attestation/v1`) and the preview app's resource address (`ui://oods-forge/preview/…`). Saved files and clients depend on them, so they stay as they are. They are identifiers, not product names.";

const FEEDBACK = (facts) => `Bug reports and feedback are welcome in [Issues](https://github.com/kneelinghorse/OODS-Foundry/issues): a screen that reads wrong, a certification you disagree with, install friction, a sentence that did not make sense. Include the tool call as you made it, what came back and what you expected. A short note is worth more than a polished one.`;

const ADOPTION = (facts) => [
  "### Agent skill, plugin and registry entry",
  "",
  `The Claude Code plugin bundles the ${facts.product} server with the \`oods-foundry\` skill. Add its marketplace, then install it by name:`,
  "",
  "```sh",
  ...PLUGIN_INSTALL_COMMANDS,
  "```",
  "",
  `The server is also listed in the official MCP registry as \`${MCP_REGISTRY_NAME}\`. The manual connection above remains available.`,
  "",
  `The npm package also carries the skill as plain files at \`skills/oods-foundry/\`. Claude Code does not discover skills in \`node_modules\`, so install the package in your project first, then copy the whole folder into your project's skill directory:`,
  "",
  "```sh",
  `npm install ${facts.npmPackage}@${facts.version}`,
  "mkdir -p .claude/skills",
  "cp -R node_modules/@oods/foundry/skills/oods-foundry .claude/skills/",
  "```",
  "",
  `Restart Claude Code and invoke \`/oods-foundry\`, with the server connected as above. Other agents can read [SKILL.md](${sourceLink(facts, "packages/foundry/skills/oods-foundry/SKILL.md")}) and its bundled quickstart reference directly, or copy the folder into their own supported skill location. The skill explains the calls, receipts and unchecked work; installing the plain files does not register an MCP server.`,
  "",
];

export function renderPackageReadme(facts) {
  const cdn = (file) => `${facts.cdnBase}${file}`;
  const guide = (file) => sourceLink(facts, `packages/foundry/${file}`);
  const commands = claudeCodeCommands(NPX_COMMAND);
  const lines = [
    GENERATED("the product name source, the tool registry and the runtime manifest module"),
    `# ${facts.product}`,
    "",
    `${facts.headline} Your AI assistant drives it over MCP. You name a screen by its object and its context, such as \`Subscription\` and \`detail\`; ${facts.product} composes it from its governed components (each has a versioned contract, React and Vue implementations and verified accessibility and theme evidence) and design tokens, generates it as React or Vue code, renders charts from your data, and certifies the charts it renders against accuracy, accessibility, contrast and determinism rules. It runs on your machine as a local MCP server for ${orList(SUPPORTED_CLIENTS)}, and advertises ${facts.autoTools} tools by default (${facts.allTools} in all).`,
    "",
    `![The page a preview link opens: a generated Subscription detail screen running in React](${cdn("images/preview-page-subscription-detail-light.png")})`,
    "",
    `This document describes version ${facts.version}. Check the [npm package page](${facts.npmPage}) for published availability.`,
    "",
    `See [a real schema become React and Vue screens](${sourceLink(facts, "docs/demo/README.md")}) in the five-minute walkthrough, including the prompts, review steps and light/dark screenshots.`,
    "",
    "## Requirements",
    "",
    ...REQUIREMENTS(facts, ["- `npx` (it comes with Node.js) and `tar` on the PATH your client starts with. macOS and the common Linux distributions include `tar`; the first start unpacks the runtime with it."]),
    "",
    "## Install",
    "",
    `Every client starts the same command, \`${NPX_COMMAND}\`, and registers it under the name \`${SERVER_NAME}\`. The first start downloads the package and unpacks its runtime once into \`~/.oods-foundry/runtime/\`; it answers your client straight away, tool calls wait until the runtime is in place, and the unpack finishes even if the client stops waiting. Later starts reuse it. With \`MCP_EXTRA_TOOLS\` set, the first start answers only once the runtime is unpacked; \`MCP_TOOLSET=all\` does not wait.`,
    "",
    "### Claude Code",
    "",
    "```sh",
    commands.add,
    commands.get,
    "```",
    "",
    `The second command prints the registration and its status; \`Status: ✓ Connected\` means the server started and answered. Options go after the name: \`${commands.addWithOptions}\` registers it for every project (\`-s user\`) and adds the on-demand tools (\`-e MCP_TOOLSET=all\`, ${facts.allTools} in all). \`${commands.remove}\` undoes it.`,
    "",
    ...ADOPTION(facts),
    "### Claude Desktop",
    "",
    "Open the configuration file (create it if it does not exist): `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\\Claude\\claude_desktop_config.json` on Windows. Add the entry under `mcpServers`:",
    "",
    json(claudeDesktopConfig(npmBlock())),
    "",
    `Restart Claude Desktop. The tools appear under the \`${SERVER_NAME}\` server. If they do not, the server's log says why: \`~/Library/Logs/Claude/mcp-server-${SERVER_NAME}.log\` on macOS. If the log says \`spawn npx ENOENT\`, which can happen when Node comes from a version manager, put the full path of \`npx\` (what \`which npx\` prints) in \`command\` and add an \`env\` block whose \`PATH\` includes the directory of \`node\`.`,
    "",
    "### Cursor",
    "",
    "Create `.cursor/mcp.json` in the project (or `~/.cursor/mcp.json` for every project):",
    "",
    json(cursorConfig(npmBlock())),
    "",
    "Reload the Cursor window. The server shows up in the MCP settings with its tools.",
    "",
    "### The design preview inside the conversation",
    "",
    ...PREVIEW_IN_CONVERSATION(facts, "a newer version installs"),
    "",
    "## The first run",
    "",
    `To change one trait and predict which screens follow, start with [the first change in the QUICKSTART](${guide("QUICKSTART.md")}#the-first-change).`,
    "",
    `Your client lists these tool names: ${facts.toolNames.map((name) => `\`${name}\``).join(", ")}. Ask your assistant for each step below; it makes the call. Detailed parameters and limits are in [TOOL-REFERENCE.md](${guide("TOOL-REFERENCE.md")}). One rule shapes the run: a \`schemaRef\` lives in the server your client started, for 30 minutes and for that conversation, so make steps 2 to 6 in one conversation.`,
    "",
    `1. **Check the server.** Ask for \`health_check\`. It answers \`status: "ok"\` with the registry counts (objects, traits, components), \`server.version\` (\`${facts.version}\`) and \`server.uptime\` in milliseconds.`,
    "2. **Compose one screen.** `design_compose` with `{\"object\": \"Subscription\", \"context\": \"detail\"}` answers `status: \"ok\"`, a `schemaRef` such as `compose-dae744a8`, `objectUsed` (the object, its version, the traits and the fields it composed) and one entry in `selections` per slot, naming the component chosen, the reason and any available review evidence. Missing confidence is not inferred; layout detection and intent selection use keyword rules.",
    "3. **See it running.** `design_preview` with `{\"object\": \"Subscription\", \"context\": \"detail\"}` answers with one link per framework to the generated React and Vue screen, mounted with generated sample records and running on 127.0.0.1. Open one in your browser.",
    "4. **Certify a chart.** Ask for `viz_render` with",
    "   ```json",
    "   {\"chartType\": \"bar\", \"rows\": [{\"status\": \"active\", \"count\": 17}, {\"status\": \"draft\", \"count\": 5}, {\"status\": \"archived\", \"count\": 3}],",
    "    \"encodings\": {\"x\": {\"field\": \"status\", \"type\": \"nominal\"}, \"y\": {\"field\": \"count\", \"type\": \"quantitative\", \"aggregate\": \"sum\"}},",
    "    \"output\": {\"includeNormalizedSpec\": true, \"includeA11y\": true}}",
    "   ```",
    `   It returns the spec, a \`contentHash\`, a narrative and data table, and \`normalizedSpec\`. Then \`artifact_certify\` with \`{"spec": <that normalizedSpec>}\` answers \`coverage: "certified"\`, \`conformant: true\` and \`pillars: {"a11yEquivalence": "pass", "determinism": "pass", "contrast": "pass", "accuracy": "pass"}\`, with \`accuracyRules\` naming the rules it checked. ${dashboardRenderSentences(facts)}`,
    "5. **Generate the code.** `code_generate` with `{\"schemaRef\": \"<from step 2>\", \"framework\": \"react\", \"profile\": \"build\", \"options\": {\"payloadMode\": \"file\"}}` writes the files (`src/GeneratedUI.tsx`, the screen's chart and `artifact.json` with the content hash and exact dependency versions) to the directory the result names as `payload.directory`, and answers with a `validationReceipt` listing the checks that ran and, under `notChecked`, the ones that did not. The file is this one screen as a component to mount in your own app; `\"context\": \"workflow\"` in step 2 composes a whole application instead. Its `install` block names the `@oods` packages the code imports, at exact versions, and the `npm install` command that fetches them from npm. `\"framework\": \"vue\"` gives the Vue component.",
    "6. **Open the sample HTML.** `schema_render` with `{\"action\": \"render\", \"schemaRef\": \"<from step 2>\", \"apply\": true, \"output\": {\"compact\": false, \"payloadMode\": \"file\"}}` writes `index.html` to the directory the result names as `payload.directory`: a static sample HTML screen with the record, chart, working tabs and token CSS inline. Open it in your browser. Domain actions show an integration notice and do not persist records. For an HTML artifact with a content hash, use code_generate with framework html and profile build.",
    "",
    "Steps 5 and 6 use file mode in every client: their inline results are larger than some clients accept from one tool (Claude Code accepts 25,000 tokens by default, `MAX_MCP_OUTPUT_TOKENS`), and a file is easier to open anyway.",
    "",
    `![A generated Subscription list in the dark theme](${cdn("images/subscription-list-dark.png")})`,
    "",
    `![A four-bar chart from viz_render with no size given](${cdn("images/chart-bar-default-light.png")})`,
    "",
    "## Your own objects and traits",
    "",
    `${facts.product} ships 11 business objects, plus 5 internal capture objects (16 in the runtime).`,
    "",
    `${facts.product} composes from the objects and traits it ships and from yours. Put a \`*.object.yaml\` file in \`~/.oods-foundry/objects\` and a \`*.trait.yaml\` file in \`~/.oods-foundry/traits\`, or ask your assistant to use the \`object_registry\` tool: \`validate\` checks a definition without writing it, \`object_register\` with \`register\` writes it into your folder once it validates and composes in every context it declares, and \`reload\` reads the folders again without a restart. An object of yours with a shipped object's name is used in its place; a trait of yours cannot reuse a shipped trait's name. \`object_registry\` \`list\` and \`health_check\` name every file that is not in use and why. Your folders are outside the unpacked runtime, so they survive upgrades. A trait of yours can place only the components ${facts.product} ships (\`catalog_list\` names them); mapped implementations can come from your own components by substitution. The authoring guide is [OBJECTS-AND-TRAITS.md](${guide("OBJECTS-AND-TRAITS.md")}).`,
    "",
    "## Import your objects",
    "",
    `\`object_import\` drafts ${facts.product} objects from the schema files your team already has: OpenAPI or Swagger, JSON Schema, Postgres DDL and migrations, Prisma, dbt, OData and GraphQL. It reads local files, or content you pass inline; it never fetches a URL, connects to an API or database, or runs your code. \`draft\` writes reviewable drafts to \`~/.oods-foundry/imports/\` and registers nothing, \`object_import_read\` with \`show\` returns one draft with its trait proposals and their evidence, and \`apply\` registers only the objects and proposals you accept. The guide is [IMPORTING-OBJECTS.md](${guide("IMPORTING-OBJECTS.md")}).`,
    "",
    "## Your own brands",
    "",
    `${facts.product} renders in the brands it ships and in yours. Ask your assistant to use \`brand_read\` with \`derive\` with your own DTCG tokens or shadcn theme CSS to get a recipe with source paths and named gaps, then review it and fill the gaps before \`brand_create\` with \`create\`. The recipe has six values: the neutral's hue and tint, the accent's hue, whether the primary action is the neutral or the accent, the corner radius and the font. \`template\` with \`from.recipe\` returns the complete brand it gives, graded; \`template\` alone returns every slot of a brand with what it paints and a starting value, for you to fill. \`validate\` checks a recipe or your values (the contrast of every pair included) without writing, and \`brand_create\` with \`create\` writes the brand into \`~/.oods-foundry/brands\` and builds it there, outside the unpacked runtime, so every tool, the preview and the apps you generate use it at once. \`brand_apply\` changes your brand the same checked way. A generated React or Vue app for your brand carries its stylesheet. To keep your team's token names, \`brand_create\` with \`draft\` stages a local DTCG token file, \`brand_read\` with \`show\` returns the draft for review and \`brand_create\` with \`apply\` builds the brand once you accept it; its CSS then uses your names. Your brands survive upgrades; the first start of a new version rebuilds them. The guide is [BRANDS.md](${guide("BRANDS.md")}).`,
    "",
    "## Your own components",
    "",
    `${facts.product} supports your own components by substitution in React and Vue: map a shipped component id to your package, exact version and export, then compose as usual. One \`component_map\` create call can check a list from \`mappingsPath\` before writing all of it. The preview bundles your local package and code generation imports it. React projects on shadcn/ui’s Radix or Base UI base and Tailwind 4 can map their copied source files, install the sixteen shipped registry adapters and use their own theme in previews and generated apps. Vue projects on shadcn-vue with Reka UI do the same with the sixteen Vue adapters. Mapped components carry advisory contract reports with met, unmet and not-checked obligations; this is not blanket conformance. New components beyond the shipped catalog are not supported. See [COMPONENTS.md](${guide("COMPONENTS.md")}).`,
    "",
    // The library pins are deliberate (GENERATED-APPS.md says the same), so the line carries the history mark.
    `For a single screen, ask for code_generate with options.output set to application. It includes an entry, Vite configuration and a package.json that pins the @oods libraries and your mapped packages at exact versions; run \`npm install\`, then \`npm run build\`. A mapped package that is not on a registry installs from its own tarball or folder. The sample app marks its data and actions that still need your application's handlers. Generated code pins the tested 0.6.2 set of OODS libraries. Use one version of the OODS packages together: keep those pins unless you upgrade all of them together. <!-- history -->`,
    "",
    `When a definition changes, [GENERATED-APPS.md](${guide("GENERATED-APPS.md")}) explains which generated files to replace, which are your starting points, and how to keep your data and action wiring in your own files.`,
    "",
    "## Bring your own design system",
    "",
    `Follow [the quickstart](${guide("QUICKSTART.md")}): your colour tokens become a brand, your trait and object define a Warehouse, and your component package replaces a shipped Button. The same sequence composes a screen, certifies a chart, opens a running preview, and generates React and Vue application files. All example inputs ship in the package's quickstart/ folder; you need nothing from the source repository. The package also ships \`quickstart/expected.json\`, the hashes the quickstart's React app, Vue app and chart come out with, and \`facts.json\`, the facts this page states, each with where it comes from. Beside \`facts.json\`, \`errors.json\` lists the runtime's error codes, severity, cause, fix and tools.`,
    "",
    "## Limits",
    "",
    "Composition matches object definitions and keyword rules; it does not interpret arbitrary natural language. Chart certification measures the chart operand and declared scope, not the surrounding screen or application. Read each pillar and its exemptions. Static HTML is sample output with local controls, not a persistent app. Generated applications still need your data, navigation and persistence handlers. Mapped-component reports are advisory and can contain unmet or not-checked obligations. Measured runtime and browser evidence is bounded by its recorded head, inputs and platform; health distinguishes historical proof from this build.",
    "",
    rateLimitLine(facts.rateLimits),
    "",
    "## Settings",
    "",
    ...SETTINGS(facts, "`~/.oods-foundry`", (kind) => `\`~/.oods-foundry/${kind}\``),
    "",
    "## Network and tracing",
    "",
    "In the server implementation, trace export is disabled unless `OODS_OTLP_ENDPOINT` is configured. When set, OpenTelemetry exports spans to that endpoint; `OODS_OTLP_HEADERS` supplies optional request headers. Generated previews use a local host on `127.0.0.1` by default. Installation downloads, caller-supplied URLs, configured preview hosts and your AI client's own traffic are separate. This describes configuration and source behavior, not a measurement of all network activity.",
    "",
    "## Where to see it",
    "",
    "See [OODS Foundry](https://oods-foundry.com/), [a trait change across screens](https://oods-foundry.com/demos/trait-change), [the Harbor walkthrough](https://oods-foundry.com/demos/harbor), and [the chart playground](https://oods-foundry.com/charts/playground).",
    "",
    // The endpoint answers MCP POSTs only, so a browser that follows a link to it gets 405: show it as code and link the
    // words to the website's guide. The website owns the hosted surface: 9 read-only tools at the version it pins.
    `The website's [read-only MCP endpoint](https://oods-foundry.com/agents#hosted-tools), \`https://oods-foundry.com/mcp\`, uses Streamable HTTP. It is the hosted connector for claude.ai and other remote clients: a read-only subset of 9 tools, among them catalog, registry and chart tools, with narrower inputs. Hosted names follow the version pinned by the website. Local stdio provides the full toolset for your own files, objects, brands and generated applications: this package advertises ${facts.autoTools} tools by default (${facts.allTools} in all), and the Claude Code plugin runs this package. In Claude Code, use the plugin; you do not need both.`,
    "",
    "## Where things go",
    "",
    "- `~/.oods-foundry/runtime/<version>-<digest>/` holds the unpacked runtime, one directory per version. Delete an old one to reclaim its space; the current one is unpacked again if it is missing.",
    "- `~/.oods-foundry/schemas/`, `compositions/` and `payloads/` hold your saved schemas, every composed and previewed version, and file-mode output. They survive upgrades; delete them to start over.",
    "- `~/.oods-foundry/objects/` and `traits/` hold your own objects and traits. They survive upgrades.",
    "- `~/.oods-foundry/brands/` holds your own brands, and `brands/.build/` the token build made from them. They survive upgrades.",
    "- `~/.oods-foundry/mappings/component-mappings.json` holds your component mappings. It survives upgrades. `OODS_MAPPINGS_DIR` moves the folder; `MCP_MAPPINGS_PATH` names a mappings file instead, and takes precedence.",
    "- Run records from `apply: true` calls are written inside the unpacked runtime, under `artifacts/current-state/<date>/`, and go when you delete that version.",
    "",
    `To remove ${facts.product}, remove the client entry and delete \`~/.oods-foundry\`.`,
    "",
    "## The runtime archive",
    "",
    `The npm package carries the same runtime as an archive, at \`runtime/${RUNTIME_ARCHIVE_FILE}\`. The archive runs without a package manager: you extract it and point your client at \`node\` and its adapter. [The archive install guide](${sourceLink(facts, INSTALL_DOC)}) gives the steps.`,
    "",
    "## Legacy identifiers",
    "",
    LEGACY_IDENTIFIERS,
    "",
    "## Feedback",
    "",
    FEEDBACK(facts),
    "",
    "## License",
    "",
    `${facts.product} is licensed under the Apache License 2.0 ([LICENSE](${cdn("LICENSE")}), [NOTICE](${cdn("NOTICE")})). ${GENERATED_OUTPUT} The third-party packages inside keep their own licenses ([THIRD-PARTY-NOTICES.md](${cdn("THIRD-PARTY-NOTICES.md")})). Security notes are in [SECURITY.md](${guide("SECURITY.md")}) and changes by version in [CHANGELOG.md](${guide("CHANGELOG.md")}).`,
    "",
  ];
  return lines.join("\n");
}

export function renderInstallDoc(facts) {
  const commands = claudeCodeCommands(ARCHIVE_COMMAND);
  const lines = [
    GENERATED("the product name source, the tool registry and the runtime manifest module"),
    `# Install ${facts.product} from the archive`,
    "",
    `Most people install ${facts.product} from npm: every client runs \`${NPX_COMMAND}\`, and the package page, <${facts.npmPage}>, gives the first run. This page is for running the runtime archive itself, which needs no package manager. The npm package carries it at \`runtime/${RUNTIME_ARCHIVE_FILE}\`, and [building from source](build.md) produces it too.`,
    "",
    "## What you need",
    "",
    `- \`${RUNTIME_ARCHIVE_FILE}\`: the runtime (MCP server, stdio adapter, preview host, tokens, component packages, registry data and the production dependency closure).`,
    `- \`${RUNTIME_MANIFEST_FILE}\`, beside it: the source commit, package versions, Node floor and payload digests, and the archive's SHA-256 as \`archive.sha256\`. Building from source also writes \`${RUNTIME_ARCHIVE_SHA256_FILE}\` and \`${RUNTIME_SBOM_FILE}\` (every third-party package in the archive with its integrity hash).`,
    "",
    `Inside the archive, \`LICENSE\`, \`NOTICE\` and \`THIRD-PARTY-NOTICES.md\` sit at the root. ${facts.product} is licensed under the Apache License 2.0. ${GENERATED_OUTPUT}`,
    "",
    "## Requirements",
    "",
    ...REQUIREMENTS(facts, ["- A shell that can run `tar`."]),
    "",
    "## Verify and extract",
    "",
    `Run these in the directory that holds the archive, and compare the digest the first command prints with \`archive.sha256\` in the manifest. The archive has no top-level folder, so always extract into a directory you created for it; the commands use \`~/${NAME.archiveBase}\`, and any absolute path works.`,
    "",
    "```sh",
    `shasum -a 256 ${RUNTIME_ARCHIVE_FILE}        # macOS`,
    `sha256sum ${RUNTIME_ARCHIVE_FILE}            # Linux`,
    `mkdir -p ~/${NAME.archiveBase}`,
    `tar -xzf ${RUNTIME_ARCHIVE_FILE} -C ~/${NAME.archiveBase}`,
    "```",
    "",
    `The extracted directory is what every configuration below calls \`${RUNTIME_DIR_PLACEHOLDER}\`; use its absolute path wherever the placeholder appears. The server entry point is \`${RUNTIME_DIR_PLACEHOLDER}/${ADAPTER_ENTRY}\`, and the adapter starts the bundled native server itself.`,
    "",
    "## Connect a client",
    "",
    `All three clients speak to the same stdio adapter and see the same ${facts.autoTools} tools by default. The server is registered under the name \`${SERVER_NAME}\`.`,
    "",
    "### Claude Code",
    "",
    "```sh",
    commands.add,
    commands.get,
    "```",
    "",
    `\`Status: ✓ Connected\` means the adapter started and answered. Options go after the name: \`${commands.addWithOptions}\` registers it for every project and adds the on-demand tools (${facts.allTools} in all); an \`-e\` before the name is read as a variable and refused. \`${commands.remove}\` undoes it.`,
    "",
    ...ADOPTION(facts),
    "### Claude Desktop",
    "",
    "Add the entry under `mcpServers` in `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\\Claude\\claude_desktop_config.json` (Windows):",
    "",
    json(claudeDesktopConfig(archiveBlock())),
    "",
    `Restart Claude Desktop. The tools appear under the \`${SERVER_NAME}\` server. If they do not, the server's log says why, in one sentence: \`~/Library/Logs/Claude/mcp-server-${SERVER_NAME}.log\` on macOS. If the client cannot start \`node\`, or the adapter says your Node is too old, put the full path of a newer \`node\` (what \`which node\` prints) in \`command\`.`,
    "",
    "### Cursor",
    "",
    "Create `.cursor/mcp.json` in the project (or `~/.cursor/mcp.json` for every project):",
    "",
    json(cursorConfig(archiveBlock())),
    "",
    "Reload the Cursor window.",
    "",
    "### The design preview inside the conversation",
    "",
    ...PREVIEW_IN_CONVERSATION(facts, "you replace the runtime with a newer one"),
    "",
    "## First run",
    "",
    `Ask the assistant to run \`health_check\`: it answers \`status: "ok"\` with the registry counts and \`server.version\` (\`${facts.version}\`). The first run on the package page (<${facts.npmPage}>) works the same from the archive.`,
    "",
    "## Settings",
    "",
    ...SETTINGS(facts, "the extracted directory's `packages/mcp-server`", () => "(unset)"),
    "",
    "## Component substitution and runnable screens",
    "",
    `${facts.product} supports your own components by substitution in React and Vue: map a shipped id to a package, exact version and export. Set localPath to your absolute package folder for preview bundling; keep it outside the runtime. Mappings default to ~/.oods-foundry/mappings/component-mappings.json; MCP_MAPPINGS_PATH overrides that file. New components beyond the shipped catalog are not supported. The package's [COMPONENTS.md](${sourceLink(facts, "packages/foundry/COMPONENTS.md")}) explains prop translations, frozen previews and advisory contract reports.`,
    "",
    "For a runnable single screen request code_generate with options.output set to application. Its package.json pins the @oods libraries and your mapped packages at exact versions; run npm install, then npm run build and npm run dev. A mapped package that is not on a registry installs from its own tarball or folder. The sample app labels its data and actions that need your application's handlers.",
    "",
    "## Network and tracing",
    "",
    "In the server implementation, trace export is disabled unless `OODS_OTLP_ENDPOINT` is configured. When set, OpenTelemetry exports spans to that endpoint; `OODS_OTLP_HEADERS` supplies optional request headers. Generated previews use a local host on `127.0.0.1` by default. Installation downloads, caller-supplied URLs, configured preview hosts and your AI client's own traffic are separate. This describes configuration and source behavior, not a measurement of all network activity.",
    "",
    "## Where things go",
    "",
    `${facts.product} keeps what it makes inside the extracted directory: every composed and previewed version, saved schemas and file-mode output under \`packages/mcp-server/.oods/\`, run records from \`apply: true\` calls under \`artifacts/current-state/<date>/\`, and mapping conflicts under \`.oods/conflicts/\`. Delete those to start over. The shipped files never change, and the runtime checks them before it generates code: if one was edited, generation refuses and says to extract the archive again. Your own objects and traits are read from the folders \`OODS_OBJECTS_DIR\` and \`OODS_TRAITS_DIR\` name, after the shipped ones; set them to folders outside the extracted directory so they survive replacing it (the package page's authoring guide, <${facts.npmPage}>, describes the files). To remove the runtime, remove the client entry and delete \`${RUNTIME_DIR_PLACEHOLDER}\`.`,
    "",
    "## Legacy identifiers",
    "",
    LEGACY_IDENTIFIERS,
    "",
    "## Feedback",
    "",
    `This page describes version ${facts.version} with adapter ${facts.adapterVersion}; the manifest inside the archive names the exact source commit. ${FEEDBACK(facts)}`,
    "",
  ];
  return lines.join("\n");
}

/**
 * s239 (plugin directory review, F-12/F-15/F-17): a skill folder is copied whole, into the plugin or a project's
 * .claude/skills, so its references must stand alone. The skill's QUICKSTART drops the walkthrough's test markers (the
 * release proofs and tests read them from packages/foundry/QUICKSTART.md, never from a skill copy) and links the files the
 * skill does not carry at this release's public tag. `<!-- history -->` marks stay: the version checks read them.
 */
const SKILL_QUICKSTART_WORDING = (facts) => [
  ["connect your MCP client as the package README describes.",
    `connect your MCP client as [the package README](${sourceLink(facts, "packages/foundry/README.md")}) describes; the Claude Code plugin connects it for you.`],
  ["See `OBJECTS-AND-TRAITS.md` for field types, money semantics, number formats, form controls and name-collision rules.",
    `[OBJECTS-AND-TRAITS.md](${sourceLink(facts, "packages/foundry/OBJECTS-AND-TRAITS.md")}) documents field types, money semantics, number formats, form controls and name-collision rules.`],
  ["are in the package's `quickstart/expected.json`.", "are in `quickstart/expected.json` in the `@oods/foundry` package you installed above."],
];
const TEST_MARKER = /^<!-- (?:quickstart|first-change|first-change-edit): [^\n]*-->\n/gm;

export function skillQuickstart(text, facts) {
  let out = text.replace(TEST_MARKER, "");
  for (const [from, to] of SKILL_QUICKSTART_WORDING(facts)) {
    assert(out.includes(from), `packages/foundry/QUICKSTART.md no longer says "${from}"; update the skill copy's wording in client-configs.mjs`);
    out = out.split(from).join(to);
  }
  assert(!/<!--(?! history -->)/.test(out), "an HTML comment other than a history mark survived in the skill's QUICKSTART copy");
  return out;
}

/**
 * The skill's COMPONENTS.md is the package guide the skill used to send Claude to on a CDN (F-12), bundled: everything
 * before its versioned registry URLs, whose remote installs the skill does not need, with BRANDS.md linked at the tag.
 */
export function skillComponents(text, facts) {
  const end = text.indexOf("\n### Versioned registry URLs\n");
  assert(end > 0, "packages/foundry/COMPONENTS.md no longer has its versioned registry URLs section; update skillComponents in client-configs.mjs");
  assert(text.includes("](./BRANDS.md)"), "packages/foundry/COMPONENTS.md no longer links ./BRANDS.md; update skillComponents in client-configs.mjs");
  return `${text.slice(0, end).replaceAll("](./BRANDS.md)", `](${sourceLink(facts, "packages/foundry/BRANDS.md")})`).trimEnd()}\n`;
}

export function renderAll() {
  const facts = collectInstallFacts();
  const skill = fs.readFileSync(path.join(REPO_ROOT, "plugins/oods-foundry/skills/oods-foundry/SKILL.md"), "utf8");
  const quickstart = skillQuickstart(fs.readFileSync(path.join(REPO_ROOT, "packages/foundry/QUICKSTART.md"), "utf8"), facts);
  const generatedApps = fs.readFileSync(path.join(REPO_ROOT, "packages/foundry/GENERATED-APPS.md"), "utf8");
  const components = skillComponents(fs.readFileSync(path.join(REPO_ROOT, "packages/foundry/COMPONENTS.md"), "utf8"), facts);
  return { [PACKAGE_README]: renderPackageReadme(facts), [INSTALL_DOC]: renderInstallDoc(facts), ...renderConfigs(facts),
    "packages/foundry/skills/oods-foundry/SKILL.md": skill,
    "packages/foundry/skills/oods-foundry/references/QUICKSTART.md": quickstart,
    "plugins/oods-foundry/skills/oods-foundry/references/QUICKSTART.md": quickstart,
    "packages/foundry/skills/oods-foundry/references/GENERATED-APPS.md": generatedApps,
    "plugins/oods-foundry/skills/oods-foundry/references/GENERATED-APPS.md": generatedApps,
    "packages/foundry/skills/oods-foundry/references/COMPONENTS.md": components,
    "plugins/oods-foundry/skills/oods-foundry/references/COMPONENTS.md": components };
}

const isCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const check = process.argv.includes("--check");
    const rendered = renderAll();
    const stale = [];
    for (const [relative, text] of Object.entries(rendered)) {
      const target = path.join(REPO_ROOT, relative);
      const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
      if (current === text) continue;
      if (check) stale.push(relative);
      else {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, text, "utf8");
        process.stdout.write(`wrote ${relative}\n`);
      }
    }
    if (check) {
      if (stale.length) throw new Error(`stale client configs: ${stale.join(", ")}; run node scripts/runtime/client-configs.mjs`);
      process.stdout.write(`client configs are fresh (${Object.keys(rendered).length} files).\n`);
    }
  } catch (error) {
    process.stderr.write(`client-configs: ${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  }
}
