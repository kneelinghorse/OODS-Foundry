#!/usr/bin/env node
/**
 * The npm package's first run, as a tester's client makes it (s211-m03).
 *
 *   node scripts/runtime/e2e-npm.mjs --tarball <oods-foundry-<version>.tgz> --work-dir <empty dir> [--out <receipt.json>]
 *     [--library-tarballs <folder of the five @oods library tarballs, before they are published>]
 *
 * A clean HOME and npm cache and no npm configuration; then the client-shaped stdio session `npx -y --package=<tarball>
 * oods-foundry` starts (published, `npx -y @oods/foundry`):
 * initialize and tools/list as a client that declares nothing, then the package README's first run: health,
 * design_compose, design_preview (each framework's page, app and compiled module answered by the preview host),
 * viz_render and artifact_certify, code_generate and a repl render in file mode. A second start must reuse the
 * unpacked runtime. Everything the run writes stays under the work directory.
 *
 * s213-m07: then a team's journey, in the same home: its token file becomes a brand (the contrast report kept), its
 * trait and object register, a detail screen composes in that brand, and React and Vue apps are generated, installed
 * in a fresh folder, built with vite, mounted and photographed (scripts/product-reality/s214-team-journey.ts). The
 * journey reuses the TypeScript consumer harness the other proofs use, so it runs as a child of this same node binary
 * under the tsx loader; its receipt and screenshots go beside --out (<out>-team/), or under the work directory.
 */
import assert from "node:assert/strict";
import { toolSurface } from "./tool-names.mjs";
const surface = toolSurface();
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpClient } from "./e2e.mjs";
import { RUNTIME_MANIFEST_FILE } from "./manifest.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIRST_START_TIMEOUT_MS = 600_000;
const TEAM_JOURNEY = path.join(REPO_ROOT, "scripts/product-reality/s214-team-journey.ts");
const TEAM_JOURNEY_TIMEOUT_MS = 3_600_000;
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const isInside = (parent, child) => { const relative = path.relative(parent, child); return relative && !relative.startsWith("..") && !path.isAbsolute(relative); };

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = { "--tarball": "tarball", "--work-dir": "workDir", "--out": "out", "--library-tarballs": "libraryTarballs" }[argv[index]];
    assert(key && argv[index + 1], "usage: e2e-npm.mjs --tarball <tgz> --work-dir <empty dir> [--out <receipt.json>] [--library-tarballs <folder>]");
    args[key] = path.resolve(argv[++index]);
  }
  assert(args.tarball && args.workDir, "--tarball and --work-dir are required");
  return args;
}

/** A tester's machine: a home and npm cache of its own, the PATH to node and npx, nothing else inherited. */
export function testerEnvironment(workDir) {
  const home = path.join(workDir, "home");
  const tmp = path.join(workDir, "tmp");
  for (const directory of [home, tmp]) fs.mkdirSync(directory, { recursive: true });
  // Empty user and global npm configuration, one file each (npm refuses one file for both).
  for (const config of ["npmrc-user", "npmrc-global"]) fs.writeFileSync(path.join(workDir, config), "");
  return {
    home,
    env: {
      PATH: process.env.PATH ?? "",
      NODE_OPTIONS: "--no-global-search-paths",
      HOME: home,
      TMPDIR: tmp,
      LANG: "C.UTF-8",
      TZ: "UTC",
      NO_COLOR: "1",
      npm_config_cache: path.join(workDir, "npm-cache"),
      npm_config_userconfig: path.join(workDir, "npmrc-user"),
      npm_config_globalconfig: path.join(workDir, "npmrc-global"),
      npm_config_update_notifier: "false",
      npm_config_fund: "false",
      npm_config_audit: "false",
    },
  };
}

/** Deny every ancestor module directory: an in-repo HOME alone does not isolate resolution. */
export function isolatedCommand(workDir, command, args) {
  const blocked = [];
  for (let directory = path.dirname(fs.realpathSync(workDir)); ; directory = path.dirname(directory)) {
    blocked.push(path.join(directory, "node_modules"));
    if (path.dirname(directory) === directory) break;
  }
  if (process.platform === "darwin") {
    const profile = `(version 1)(allow default)(deny file-read* ${blocked.map(directory => `(subpath ${JSON.stringify(directory)})`).join(" ")})`;
    return { command: "/usr/bin/sandbox-exec", args: ["-p", profile, command, ...args], blocked };
  }
  // Linux callers use the part-B mount containing only the artifact, harness and scratch.
  // Refuse a host run with ancestor dependencies instead of silently accepting them.
  assert(blocked.every(directory => !fs.existsSync(directory)), "npm E2E requires an isolated mount without ancestor node_modules");
  return { command, args, blocked };
}

/** A real missing React peer must fail even when the checkout could satisfy it. Restore before the warm start. */
export function missingPeerControl(runtimeDir, workDir, env) {
  const peer = fs.realpathSync(path.join(runtimeDir, "packages/components-react/node_modules/react"));
  const held = path.join(path.dirname(peer), ".s212-held-react");
  assert(fs.existsSync(peer), "the packaged React peer must exist before the negative control");
  const importer = path.join(runtimeDir, "packages/components-react/package.json");
  const args = ["--input-type=module", "-e", "import { createRequire } from 'node:module'; console.log(createRequire(process.argv[1]).resolve('react'));", importer];
  const run = () => {
    const invocation = isolatedCommand(workDir, process.execPath, args);
    return spawnSync(invocation.command, invocation.args, { cwd: workDir, env, encoding: "utf8" });
  };
  const positive = run();
  assert.equal(positive.status, 0, positive.stderr);
  assert(isInside(runtimeDir, positive.stdout.trim()), "the positive control resolves the packaged peer");
  fs.renameSync(peer, held);
  let negative;
  try { negative = run(); } finally { fs.renameSync(held, peer); }
  assert.notEqual(negative.status, 0, "missing React resolved outside the artifact");
  assert.match(negative.stderr, /MODULE_NOT_FOUND|Cannot find module/);
  return { package: "react", positive: { exitCode: positive.status, resolved: path.relative(runtimeDir, positive.stdout.trim()) }, negative: { exitCode: negative.status, code: "MODULE_NOT_FOUND" }, restored: true };
}

async function start(tarball, workDir, env, timeoutMs) {
  // A local tarball is named as the package and its bin as the command; published, the spec is `npx -y @oods/foundry`.
  const invocation = isolatedCommand(workDir, "npx", ["-y", `--package=${tarball}`, "oods-foundry"]);
  const client = new McpClient({ command: invocation.command, args: invocation.args, cwd: workDir, env });
  const began = Date.now();
  const initialized = await client.request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "oods-foundry-npm-e2e", version: "0.1.0" } }, timeoutMs);
  const startMs = Date.now() - began;
  client.notify("notifications/initialized");
  const { tools } = await client.request("tools/list", {});
  return { client, initialized, tools, startMs, began };
}

/** The team's journey (s213-m07), run by this node binary under tsx so the floor run covers it too. */
export function runTeamJourney({ tarball, workDir, teamOut, libraryTarballs }) {
  // s220-m03: generated apps install the @oods libraries from npm; before a release is published, its frozen library
  // tarballs stand in for the registry (scripts/product-reality/s214-team-journey.ts).
  const child = spawnSync(process.execPath, ["--import", "tsx", TEAM_JOURNEY, "--tarball", tarball, "--work-dir", workDir, "--out", teamOut, ...(libraryTarballs ? ["--library-tarballs", libraryTarballs] : [])], {
    cwd: REPO_ROOT, env: process.env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: TEAM_JOURNEY_TIMEOUT_MS,
  });
  fs.mkdirSync(teamOut, { recursive: true });
  fs.writeFileSync(path.join(teamOut, "journey.stderr.log"), child.stderr ?? "");
  const receiptFile = path.join(teamOut, "receipt.json");
  assert(fs.existsSync(receiptFile), `the team journey wrote no receipt (exit ${child.status}, signal ${child.signal}):\n${(child.stderr ?? "").slice(-4000)}`);
  const journey = readJson(receiptFile);
  assert.equal(child.status, 0, `the team journey failed:\n${(child.stderr ?? "").slice(-4000)}`);
  assert.equal(journey.status, "pass");
  return journey;
}

export async function runNpmE2E({ tarball, workDir, out, libraryTarballs }) {
  fs.mkdirSync(workDir, { recursive: true });
  assert.equal(fs.readdirSync(workDir).length, 0, `--work-dir must be empty: ${workDir}`);
  const packageManifest = readJson(path.join(REPO_ROOT, "packages/foundry/package.json"));
  const adapterVersion = readJson(path.join(REPO_ROOT, "packages/mcp-adapter/package.json")).version;
  const registry = readJson(path.join(REPO_ROOT, "packages/mcp-server/src/tools/registry.json"));
  const { home, env } = testerEnvironment(workDir);
  const oodsHome = path.join(home, ".oods-foundry");
  const receipt = {
    tarball: { file: path.basename(tarball), bytes: fs.statSync(tarball).size, sha256: sha256(fs.readFileSync(tarball)) },
    node: process.version,
    npm: spawnSync("npm", ["--version"], { env, encoding: "utf8" }).stdout.trim(),
    builderSelfCertified: false, status: "fail", startedAt: new Date().toISOString(),
  };

  const writeReceipt = () => { if (out) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(receipt, null, 2) + "\n"); } };
  writeReceipt();
  // First start: npx installs the tarball into the clean cache and the launcher unpacks the runtime once.
  const first = await start(tarball, workDir, env, FIRST_START_TIMEOUT_MS);
  const calledTools = new Set();
  const originalCall = first.client.callTool.bind(first.client);
  first.client.callTool = async (name, args) => {
    calledTools.add(name); receipt.lastCall = { tool: name, state: 'started' }; writeReceipt();
    const result = await originalCall(name, args);
    receipt.lastCall = { tool: name, state: 'returned' }; writeReceipt(); return result;
  };
  try {
    // 0.10.1: serverInfo also carries the title, website and icon the registry entry declares.
    assert.deepEqual(first.initialized.serverInfo, { name: "oods-foundry-adapter", version: adapterVersion, title: "OODS Foundry", websiteUrl: "https://oods-foundry.com/", icons: [{ src: "https://oods-foundry.com/icon-512.png", mimeType: "image/png", sizes: ["512x512"] }] });
    assert.deepEqual(first.tools.map((tool) => tool.name), registry.auto.map((name) => surface[name].name), "the client lists the default surface with underscore names");
    // s239: the launcher answers initialize and tools/list while it unpacks, and tool calls wait for the server, so the
    // unpack is awaited here on the first start's budget.
    const runtimeRoot = path.join(oodsHome, "runtime");
    const isUnpacked = () => fs.existsSync(runtimeRoot) && fs.readdirSync(runtimeRoot).some((entry) => fs.existsSync(path.join(runtimeRoot, entry, ".unpacked.json")));
    while (!isUnpacked()) {
      assert(Date.now() - first.began < FIRST_START_TIMEOUT_MS, "the first start did not unpack the runtime in time");
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const runtimeReadyMs = Date.now() - first.began;
    const health = await first.client.callTool("health_check", {});
    assert.match(first.client.stderrBuffer, /\[oods-foundry\] first start of .*: unpacking the runtime into .* \(once\)\./);
    const [runtimeEntry, ...others] = fs.readdirSync(runtimeRoot);
    assert.equal(others.length, 0, "one unpacked runtime");
    assert.match(runtimeEntry, new RegExp(`^${packageManifest.version.replace(/\./g, "\\.")}-[0-9a-f]{12}$`));
    const runtimeDir = path.join(oodsHome, "runtime", runtimeEntry);
    assert.equal(readJson(path.join(runtimeDir, ".unpacked.json")).version, packageManifest.version);
    receipt.manifest = readJson(path.join(runtimeDir, RUNTIME_MANIFEST_FILE));
    receipt.firstStart = { ms: first.startMs, runtimeReadyMs, runtime: path.relative(home, runtimeDir) };
    assert.deepEqual((await first.client.request("tools/list", {})).tools, first.tools, "the server lists what the first start answered before it ran");

    assert.equal(health.status, "ok", JSON.stringify(health));
    assert.equal(health.server.version, readJson(path.join(REPO_ROOT, "package.json")).version, "health reports the release version");

    const composed = await first.client.callTool("design_compose", { object: "Subscription", context: "detail" });
    assert.equal(composed.status, "ok");
    assert.match(composed.schemaRef, /^compose-[0-9a-f]+$/);
    assert(composed.schema.screens.length > 0 && Object.keys(composed.schema.objectSchema).includes('subscription_id'));

    const preview = await first.client.callTool("design_preview", { object: "Subscription", context: "detail" });
    assert.equal(preview.status, "ok");
    assert.equal(preview.previews.length, 2, "both frameworks compile from the unpacked runtime");
    assert(isInside(oodsHome, preview.recordPath), `the version is kept in ~/.oods-foundry: ${preview.recordPath}`);
    const previewPages = [];
    for (const entry of preview.previews) {
      const page = await fetch(entry.url, { signal: AbortSignal.timeout(120_000) });
      assert(page.ok, `preview page ${entry.url}`);
      const app = await fetch(entry.appUrl, { signal: AbortSignal.timeout(120_000) });
      assert(app.ok, `preview app ${entry.appUrl}`);
      const module = await fetch(entry.moduleUrl, { signal: AbortSignal.timeout(120_000) });
      assert(module.ok, `preview module ${entry.moduleUrl}`);
      assert.equal(`sha256:${sha256(await module.text())}`, entry.compiled.sha256, "compiled module digest");
      previewPages.push({ framework: entry.framework, page: page.status, app: app.status, module: module.status });
    }

    const viz = await first.client.callTool("viz_render", {
      chartType: "bar",
      rows: [{ status: "active", count: 17 }, { status: "draft", count: 5 }, { status: "archived", count: 3 }],
      encodings: { x: { field: "status", type: "nominal" }, y: { field: "count", type: "quantitative", aggregate: "sum" } },
      output: { includeNormalizedSpec: true, includeA11y: true },
    });
    const certified = await first.client.callTool("artifact_certify", { spec: viz.normalizedSpec });
    assert.equal(certified.coverage, "certified");
    assert.equal(certified.conformant, true);
    assert.deepEqual(certified.pillars, { a11yEquivalence: "pass", determinism: "pass", contrast: "pass", accuracy: "pass" });

    const generated = await first.client.callTool("code_generate", { schemaRef: composed.schemaRef, framework: "react", profile: "build", options: { payloadMode: "file" } });
    assert(isInside(oodsHome, generated.payload.directory), `file mode writes into ~/.oods-foundry: ${generated.payload.directory}`);
    for (const file of ["src/GeneratedUI.tsx", "artifact.json"]) assert(fs.existsSync(path.join(generated.payload.directory, file)), `${file} written`);

    const rendered = await first.client.callTool("schema_render", { action: "render", schemaRef: composed.schemaRef, apply: true, output: { compact: false, payloadMode: "file" } });
    assert(isInside(oodsHome, rendered.payload.directory), `the document is written into ~/.oods-foundry: ${rendered.payload.directory}`);
    const document = fs.readFileSync(path.join(rendered.payload.directory, "index.html"), "utf8");
    assert(document.includes("<title>Subscription detail</title>"), "the rendered document is titled after the screen");

    const imported = await first.client.callTool("object_import", { action: "draft", source: { name: "installed.json", content: JSON.stringify({ title: "InstalledImport", type: "object", properties: { id: { type: "string" }, label: { type: "string" } } }) } });
    assert.equal(imported.action, 'draft'); assert.equal(imported.objects.length, 1);
    const reviewed = await first.client.callTool("object_import", { action: "show", importId: imported.importId, object: "InstalledImport" });
    assert(reviewed.yaml.includes('InstalledImport'));
    const applied = await first.client.callTool("object_import", { action: "apply", importId: imported.importId, objects: [{ name: "InstalledImport" }] });
    assert.equal(applied.action, 'apply'); assert.equal(applied.applied.length, 1);
    receipt.objectImport = { importId: imported.importId, stagingOutsideInstall: isInside(oodsHome, imported.directory), applied: applied.applied };
    assert(receipt.objectImport.stagingOutsideInstall);
    fs.rmSync(path.join(oodsHome, 'objects/InstalledImport.object.yaml'));
    await first.client.callTool("object_registry", { action: "reload" });

    receipt.firstRun = {
      tools: first.tools.length,
      health: { status: health.status, serverVersion: health.server.version, proofs: health.productReality },
      compose: { status: composed.status, schemaRef: composed.schemaRef },
      preview: { status: preview.status, versionRecord: path.relative(home, preview.recordPath), pages: previewPages },
      certify: { coverage: certified.coverage, conformant: certified.conformant, pillars: certified.pillars },
      codeGenerate: { payload: path.relative(home, generated.payload.directory), contentHash: readJson(path.join(generated.payload.directory, "artifact.json")).contentHash },
      render: { payload: path.relative(home, rendered.payload.directory), bytes: Buffer.byteLength(document) },
    };
  } finally {
    receipt.firstClose = await first.client.closeStdinAndObserve(); writeReceipt();
  }

  const runtimeDir = path.join(oodsHome, "runtime", fs.readdirSync(path.join(oodsHome, "runtime"))[0]);
  receipt.isolation = { method: process.platform === "darwin" ? "sandbox-exec ancestor module denial" : "isolated mount with no ancestor modules", blockedAncestors: isolatedCommand(workDir, process.execPath, []).blocked, nodeGlobalSearch: false, missingPeer: missingPeerControl(runtimeDir, workDir, env) };

  // Second start: the same package, the runtime already unpacked.
  const second = await start(tarball, workDir, env, FIRST_START_TIMEOUT_MS);
  try {
    assert.doesNotMatch(second.client.stderrBuffer, /unpacking the runtime/);
    assert.equal((await second.client.callTool("health_check", {})).status, "ok");
    assert.equal(fs.readdirSync(path.join(oodsHome, "runtime")).length, 1);
    receipt.secondStart = { ms: second.startMs, unpackedAgain: false };
  } finally {
    receipt.secondClose = await second.client.closeStdinAndObserve();
  }
  // The team's journey, in the same home, after the tester's first run.
  receipt.teamJourney = runTeamJourney({ tarball, workDir, teamOut: out ? out.replace(/\.json$/, "-team") : path.join(workDir, "team-journey"), libraryTarballs });

  // Nothing escaped the work directory: the npm cache, the home and the temporary files all live under it.
  const assertions = {
    'object.import': receipt.objectImport,
    health: receipt.firstRun.health, 'design.compose': receipt.firstRun.compose,
    'design.preview': receipt.firstRun.preview, 'viz.render': receipt.firstRun.certify,
    'artifact.certify': receipt.firstRun.certify, 'code.generate': receipt.firstRun.codeGenerate,
    repl: receipt.firstRun.render, ...receipt.teamJourney.toolAssertions,
  };
  assert.deepEqual(Object.keys(assertions).sort(), [...registry.auto].sort(), 'Every advertised tool has a substantive successful assertion');
  assert.deepEqual([...new Set([...calledTools, ...receipt.teamJourney.calledTools])].sort(), registry.auto.map(name => surface[name].name).sort(), 'Every advertised tool was actually called');
  receipt.toolAssertions = Object.fromEntries(Object.entries(assertions).map(([name, evidence]) => [name, { outcome: 'pass', bundleHead: receipt.manifest.commit, evidence }]));
  receipt.status = 'pass'; receipt.completedAt = new Date().toISOString();
  receipt.homeTop = fs.readdirSync(home).sort();
  receipt.oodsHome = fs.readdirSync(oodsHome).sort();
  writeReceipt();
  return receipt;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  runNpmE2E(args).then((receipt) => {
    const text = `${JSON.stringify(receipt, null, 2)}\n`;
    if (args.out) { fs.mkdirSync(path.dirname(args.out), { recursive: true }); fs.writeFileSync(args.out, text); }
    process.stdout.write(text);
  }).catch((error) => {
    process.stderr.write(`e2e-npm: ${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
