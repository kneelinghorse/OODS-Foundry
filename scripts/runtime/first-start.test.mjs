/**
 * s239: the npm package's first start (packages/foundry/bin/oods-foundry.js, scripts/runtime/first-start.mjs).
 *
 * Claude Code stops waiting for a stdio server's initialize answer after 30 s, and 0.10.1 unpacked its 344 MB runtime
 * for 44-75 s before it answered: a first install failed, and every retry unpacked again from zero and left another
 * folder behind. These tests run the launcher against a small archive whose server is built on the real MCP SDK and
 * negotiates as the adapter does, under a scratch HOME, with a tar that takes its time.
 */
import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { FIRST_START_FILE } from "./first-start.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RECORDER = path.join(ROOT, "scripts/runtime/first-start.mjs");
const SDK = fs.realpathSync(path.join(ROOT, "packages/mcp-adapter/node_modules/@modelcontextprotocol/sdk"));
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, "packages/foundry/package.json"), "utf8")).version;
const UI = "io.modelcontextprotocol/ui";
const INIT = (ui) => ({ protocolVersion: "2025-06-18", capabilities: ui ? { extensions: { [UI]: { mimeTypes: ["text/html;profile=mcp-app"] } } } : {}, clientInfo: { name: "first-start-test", version: "1.0.0" } });

// Like packages/mcp-adapter: reads every initialize as sent, lists one more tool for MCP_TOOLSET=all, and marks a tool
// and lists its app for a client that declares the MCP Apps UI extension; it serves tools and resources, no prompts.
// Its tool reports what the server received.
const SERVER = `import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListResourcesRequestSchema, ListResourceTemplatesRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
const UI = ${JSON.stringify(UI)};
const server = new Server({ name: "fixture-server", version: "9.9.9", title: "Fixture" }, { capabilities: { tools: {}, resources: {}, extensions: { [UI]: {} } }, instructions: "A fixture." });
const tools = [{ name: "probe", title: "Probe", description: "Reports what the server received.", inputSchema: { type: "object" }, annotations: { title: "Probe", readOnlyHint: true } }];
if ((process.env.MCP_TOOLSET || "default").toLowerCase() === "all") tools.push({ name: "extra", description: "On demand.", inputSchema: { type: "object" } });
let initializeParams = null;
let initialized = false;
const ui = () => Boolean(initializeParams?.capabilities?.extensions?.[UI] ?? initializeParams?.capabilities?.experimental?.[UI]) || process.env.OODS_MCP_APPS_UI === "1";
server.oninitialized = () => { initialized = true; };
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: tools.map((tool) => (ui() && tool.name === "probe" ? { ...tool, _meta: { ui: { resourceUri: "ui://fixture/app.html" } } } : tool)) }));
server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [...(ui() ? [{ uri: "ui://fixture/app.html", name: "app", mimeType: "text/html;profile=mcp-app" }] : []),
  ...tools.map((tool) => ({ uri: \`fixture://schemas/\${tool.name}.json\`, name: \`\${tool.name} schema\`, mimeType: "application/schema+json" }))] }));
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({ resourceTemplates: [{ uriTemplate: "fixture://schemas/{file}", name: "schemas" }] }));
server.setRequestHandler(CallToolRequestSchema, async (request) => ({ content: [{ type: "text", text: JSON.stringify({ initializeParams, initialized, arguments: request.params.arguments, server: import.meta.url }) }] }));
const transport = new StdioServerTransport();
let onmessage;
Object.defineProperty(transport, "onmessage", { get: () => onmessage, set: (handler) => { onmessage = (message, extra) => { if (message?.method === "initialize") initializeParams = message.params; return handler(message, extra); }; } });
process.stdin.once("end", () => process.exit(0));
await server.connect(transport);
`;

/** A package as the builder stages it: the launcher, the archive with its manifest, and answers recorded from its server. */
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "first-start-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const payload = path.join(root, "payload");
  fs.mkdirSync(path.join(payload, "packages/mcp-adapter"), { recursive: true });
  fs.mkdirSync(path.join(payload, "node_modules/@modelcontextprotocol"), { recursive: true });
  fs.symlinkSync(SDK, path.join(payload, "node_modules/@modelcontextprotocol/sdk"));
  // Scratch inside the checkout must not inherit its package scope; this server is ESM either way.
  fs.writeFileSync(path.join(payload, "package.json"), JSON.stringify({ type: "module" }));
  fs.writeFileSync(path.join(payload, "packages/mcp-adapter/index.js"), SERVER);
  fs.writeFileSync(path.join(payload, "oods-foundry-runtime.manifest.json"), JSON.stringify({ commit: "fixture" }));
  const pkg = path.join(root, "pkg");
  fs.mkdirSync(path.join(pkg, "bin"), { recursive: true });
  fs.mkdirSync(path.join(pkg, "runtime"));
  fs.copyFileSync(path.join(ROOT, "packages/foundry/package.json"), path.join(pkg, "package.json"));
  fs.copyFileSync(path.join(ROOT, "packages/foundry/bin/oods-foundry.js"), path.join(pkg, "bin/oods-foundry.js"));
  const archive = path.join(pkg, "runtime/oods-foundry-runtime.tar.gz");
  execFileSync("tar", ["-czf", archive, "-C", payload, "."]);
  const sha256 = crypto.createHash("sha256").update(fs.readFileSync(archive)).digest("hex");
  fs.writeFileSync(path.join(pkg, "runtime/oods-foundry-runtime.manifest.json"), JSON.stringify({ archive: { file: "oods-foundry-runtime.tar.gz", sha256 }, commit: "fixture" }));
  execFileSync(process.execPath, [RECORDER, "write", "--runtime", payload, "--archive-sha256", sha256, "--out", path.join(pkg, "runtime", FIRST_START_FILE)]);
  // A tar that takes SLOW_TAR seconds, as the real archive does on a busy machine, and logs every run.
  const bin = path.join(root, "bin");
  fs.mkdirSync(bin);
  const tar = execFileSync("sh", ["-c", "command -v tar"], { encoding: "utf8" }).trim();
  fs.writeFileSync(path.join(bin, "tar"), `#!/bin/sh\necho run >> "$TAR_LOG"\nsleep "$SLOW_TAR"\nexec ${tar} "$@"\n`, { mode: 0o755 });
  return { payload, pkg, bin, home: () => fs.mkdtempSync(path.join(root, "home-")), target: (home) => path.join(home, ".oods-foundry/runtime", `${VERSION}-${sha256.slice(0, 12)}`) };
}

/** A client on a server's stdio, keeping every line it reads with when it came and whether the runtime was unpacked by then. */
function connect(t, args, env, target) {
  const child = spawn(process.execPath, args, { env, stdio: ["pipe", "pipe", "pipe"] });
  t.after(() => child.kill("SIGKILL"));
  const session = { child, replies: [], stderr: "", began: Date.now() };
  const waiting = new Map();
  let buffer = "";
  child.stderr.setEncoding("utf8").on("data", (chunk) => { session.stderr += chunk; });
  child.stdout.setEncoding("utf8").on("data", (chunk) => {
    buffer += chunk;
    for (let newline; (newline = buffer.indexOf("\n")) >= 0;) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      const reply = { line, message: JSON.parse(line), ms: Date.now() - session.began, unpacked: fs.existsSync(path.join(target, ".unpacked.json")) };
      session.replies.push(reply);
      waiting.get(reply.message.id)?.(reply);
    }
  });
  session.closed = new Promise((resolve) => child.on("close", resolve));
  session.send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
  session.request = (id, method, params) => new Promise((resolve) => {
    waiting.set(id, resolve);
    session.send({ jsonrpc: "2.0", id, method, params });
  });
  session.close = async () => {
    child.stdin.end();
    return session.closed;
  };
  return session;
}

/** This environment without the OODS and MCP settings a developer's shell may carry. */
const clean = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(OODS_|MCP_)/.test(key)));

/** The launcher as an MCP client starts it, with a tar that takes `slow` seconds. */
function launch(t, fx, home, { slow = 0, env = {} } = {}) {
  return connect(t, [path.join(fx.pkg, "bin/oods-foundry.js")], { ...clean(), HOME: home, PATH: `${fx.bin}${path.delimiter}${process.env.PATH}`,
    SLOW_TAR: String(slow), TAR_LOG: path.join(home, "tar.log"), ...env }, fx.target(home));
}

async function waitFor(condition, ms) {
  for (const end = Date.now() + ms; !condition();) {
    assert(Date.now() < end, `still waiting after ${ms} ms`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

const received = (reply) => JSON.parse(reply.message.result.content[0].text);
const tarRuns = (home) => fs.readFileSync(path.join(home, "tar.log"), "utf8").split("\n").filter(Boolean).length;

// What a client asks while it connects, before any tool runs (notifications/initialized follows initialize).
const CONNECTING = [["initialize"], ["tools/list", {}], ["ping"], ["resources/list", {}], ["resources/templates/list", {}], ["prompts/list", {}]];
async function connecting(session, ui) {
  const replies = [];
  for (const [index, [method, params]] of CONNECTING.entries()) {
    replies.push(await session.request(index + 1, method, method === "initialize" ? INIT(ui) : params));
    if (method === "initialize") session.send({ jsonrpc: "2.0", method: "notifications/initialized" });
  }
  return replies;
}

test("a cold start answers what a client asks while connecting at once, byte for byte as the server does, for both UI variants, then hands the server the session", { timeout: 90_000 }, async (t) => {
  const fx = fixture(t);
  await Promise.all([false, true].map(async (ui) => {
    const home = fx.home();
    const target = fx.target(home);
    const client = launch(t, fx, home, { slow: 3 });
    const early = await connecting(client, ui);
    early.forEach((reply, index) => assert.equal(reply.unpacked, false, `${CONNECTING[index][0]} is answered before the runtime is in place`));
    assert(early.at(-1).ms < 2000, `all answered within ${early.at(-1).ms} ms of the start`);
    assert.deepEqual(early.at(-1).message.error, { code: -32601, message: "Method not found" }, "prompts/list is refused at once, as the SDK refuses it");
    assert.equal(Boolean(early[1].message.result.tools[0]._meta), ui, "the tool list of this client's variant");
    assert.equal(early[3].message.result.resources.some((resource) => resource.uri.startsWith("ui://")), ui, "the resource list of this client's variant");

    // A tool call waits for the server, which receives the client's own initialize (its capabilities decide the UI
    // lists) and notifications/initialized before it.
    const probe = await client.request(CONNECTING.length + 1, "tools/call", { name: "probe", arguments: { held: true } });
    const { server, ...seen } = received(probe);
    assert.deepEqual(seen, { initializeParams: INIT(ui), initialized: true, arguments: { held: true } });
    assert.equal(fs.realpathSync(fileURLToPath(server)), fs.realpathSync(path.join(target, "packages/mcp-adapter/index.js")));
    assert.match(client.stderr, /\[oods-foundry\] first start of .*: unpacking the runtime into .* \(once\)\./);
    // One answer per request: the server's own answers to what was answered already never reach the client.
    assert.deepEqual(client.replies.map((reply) => reply.message.id), [1, 2, 3, 4, 5, 6, 7]);
    assert.equal(await client.close(), 0);

    // The server started straight from the unpacked runtime answers the same requests byte for byte.
    const direct = connect(t, [path.join(target, "packages/mcp-adapter/index.js")], clean(), target);
    assert.deepEqual((await connecting(direct, ui)).map((reply) => reply.line), early.map((reply) => reply.line));
    await direct.close();
  }));
});

test("a client that gives up mid-unpack does not stop it: the unpack finishes in place and the next start is warm", { timeout: 60_000 }, async (t) => {
  const fx = fixture(t);
  const home = fx.home();
  const target = fx.target(home);
  // An SDK client's close() ends the server's input first: the answer already written still arrives, and the launcher
  // leaves at once instead of waiting for the unpack.
  const leaving = launch(t, fx, home, { slow: 3 });
  leaving.send({ jsonrpc: "2.0", id: 1, method: "initialize", params: INIT(false) });
  leaving.child.stdin.end();
  assert.equal(await leaving.closed, 0);
  assert.deepEqual(leaving.replies.map((reply) => [reply.message.id, reply.unpacked]), [[1, false]]);
  // A retry while the unpack runs, killed the way a client kills a server it stopped waiting for.
  const killed = launch(t, fx, home, { slow: 3 });
  await killed.request(1, "initialize", INIT(false));
  killed.child.kill("SIGKILL");
  await killed.closed;
  await waitFor(() => fs.existsSync(path.join(target, ".unpacked.json")) && !fs.existsSync(`${target}.lock`), 20_000);
  assert.deepEqual(fs.readdirSync(path.dirname(target)), [path.basename(target)], "renamed into place, nothing partial left");

  const warm = launch(t, fx, home);
  await warm.request(1, "initialize", INIT(false));
  assert.deepEqual(received(await warm.request(2, "tools/call", { name: "probe", arguments: {} })).arguments, {});
  assert.doesNotMatch(warm.stderr, /\[oods-foundry\]/, "the third start found the runtime in place");
  assert.equal(tarRuns(home), 1, "unpacked once");
  assert.equal(await warm.close(), 0);
});

test("a second start during an unpack waits for it instead of unpacking again", { timeout: 60_000 }, async (t) => {
  const fx = fixture(t);
  const home = fx.home();
  const target = fx.target(home);
  const first = launch(t, fx, home, { slow: 3 });
  await waitFor(() => fs.existsSync(`${target}.lock`), 10_000);
  const second = launch(t, fx, home, { slow: 3 });
  const sessions = await Promise.all([first, second].map(async (client) => ({
    initialized: await client.request(1, "initialize", INIT(false)),
    probe: await client.request(2, "tools/call", { name: "probe", arguments: {} }),
  })));
  for (const { initialized, probe } of sessions) {
    assert.equal(initialized.unpacked, false, "both answered while the one unpack ran");
    assert.deepEqual(received(probe).initializeParams, INIT(false), "and both handed their session to a server");
  }
  assert.match(second.stderr, /waiting for the runtime another start is unpacking into/);
  assert.equal(tarRuns(home), 1, "one unpack served both");
  assert.deepEqual(fs.readdirSync(path.dirname(target)), [path.basename(target)]);
  for (const client of [first, second]) assert.equal(await client.close(), 0);
});

test("folders and a lock left by unpacks that died are cleared; ones that may be in use are kept", { timeout: 60_000 }, async (t) => {
  const fx = fixture(t);
  const home = fx.home();
  const target = fx.target(home);
  const root = path.dirname(target);
  fs.mkdirSync(root, { recursive: true });
  const folder = (name, when) => {
    fs.mkdirSync(path.join(root, name));
    fs.writeFileSync(path.join(root, name, "file"), "x");
    fs.utimesSync(path.join(root, name), when, when);
  };
  const minuteAgo = new Date(Date.now() - 60_000);
  const hoursAgo = new Date(Date.now() - 2 * 3_600_000);
  fs.writeFileSync(`${target}.lock`, "99999\n");
  fs.utimesSync(`${target}.lock`, minuteAgo, minuteAgo); // its unpack stopped touching it a minute ago
  folder(`${path.basename(target)}.partial-dead01`, minuteAgo);
  folder("0.10.1-8f7d4c36f4a2.partial-cH3RGT", hoursAgo); // what 0.10.1 left behind
  folder("0.10.1-8f7d4c36f4a2.partial-55YWDq", new Date()); // 0.10.1 may still be unpacking it
  folder("0.0.9-cccccccccccc.partial-xyz", hoursAgo);
  fs.writeFileSync(path.join(root, "0.0.9-cccccccccccc.lock"), "1\n"); // that version's unpack is alive
  const client = launch(t, fx, home);
  await client.request(1, "initialize", INIT(false));
  await client.request(2, "tools/call", { name: "probe", arguments: {} });
  assert.match(client.stderr, /first start of .*: unpacking/, "a dead unpack's lock is taken over, not waited for");
  await waitFor(() => !fs.existsSync(path.join(root, "0.10.1-8f7d4c36f4a2.partial-cH3RGT")), 10_000);
  assert.deepEqual(fs.readdirSync(root).sort(), [path.basename(target), "0.0.9-cccccccccccc.lock", "0.0.9-cccccccccccc.partial-xyz", "0.10.1-8f7d4c36f4a2.partial-55YWDq"].sort());
  assert.equal(await client.close(), 0);
});

test("MCP_TOOLSET=all is answered from its own recorded list; MCP_EXTRA_TOOLS and answers recorded for another archive wait for the server", { timeout: 60_000 }, async (t) => {
  // Answers from another build could list tools this runtime does not have, and MCP_EXTRA_TOOLS lists are not recorded.
  const fx = fixture(t);
  const foreign = fixture(t);
  const file = path.join(foreign.pkg, "runtime", FIRST_START_FILE);
  fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file, "utf8")), archiveSha256: "0".repeat(64) }));
  const [all, extra, other] = await Promise.all([[fx, { MCP_TOOLSET: "all" }], [fx, { MCP_EXTRA_TOOLS: "a11y_scan" }], [foreign, {}]].map(async ([which, env]) => {
    const client = launch(t, which, which.home(), { slow: 2, env });
    const initialized = await client.request(1, "initialize", INIT(false));
    const listed = await client.request(2, "tools/list", {});
    await client.close();
    return { initialized, listed };
  }));
  assert.equal(all.listed.unpacked, false);
  assert.deepEqual(all.listed.message.result.tools.map((tool) => tool.name), ["probe", "extra"]);
  assert.equal(extra.initialized.unpacked, true, "MCP_EXTRA_TOOLS: initialize waited for the server");
  assert.equal(other.initialized.unpacked, true, "another archive's answers: initialize waited for the server");
});

test("the release check passes on recorded answers and fails on a hand-edited tool or resource, or on another archive's answers", { timeout: 60_000 }, (t) => {
  const fx = fixture(t);
  const check = () => spawnSync(process.execPath, [RECORDER, "check", "--package", fx.pkg, "--runtime", fx.payload], { encoding: "utf8" });
  const passed = check();
  assert.equal(passed.status, 0, passed.stderr);
  const file = path.join(fx.pkg, "runtime", FIRST_START_FILE);
  const recorded = JSON.parse(fs.readFileSync(file, "utf8"));
  const tool = structuredClone(recorded);
  tool.variants.default.results["tools/list"].tools[0].description = "Edited by hand.";
  fs.writeFileSync(file, JSON.stringify(tool));
  const toolDrift = check();
  assert.equal(toolDrift.status, 1);
  assert.match(toolDrift.stderr, /is not what the archive's server answers: default tools\/list \(probe\)/);
  const resource = structuredClone(recorded);
  resource.variants["default+ui"].results["resources/list"].resources.find((entry) => entry.uri === "ui://fixture/app.html").name = "Edited by hand";
  fs.writeFileSync(file, JSON.stringify(resource));
  const resourceDrift = check();
  assert.equal(resourceDrift.status, 1);
  assert.match(resourceDrift.stderr, /is not what the archive's server answers: default\+ui resources\/list \(ui:\/\/fixture\/app\.html\)/);
  fs.writeFileSync(file, JSON.stringify({ ...recorded, archiveSha256: "0".repeat(64) }));
  const foreign = check();
  assert.equal(foreign.status, 1);
  assert.match(foreign.stderr, /must name the archive the package carries/);
});
