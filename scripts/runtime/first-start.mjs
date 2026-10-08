#!/usr/bin/env node
/**
 * The npm package's first-start answers (s239): what the server in the runtime archive answers before any tool runs,
 * recorded from that server when the package is built. A first start unpacks the archive for longer than an MCP client
 * waits for its first answer (Claude Code: 30 s), so the launcher (packages/foundry/bin/oods-foundry.js) answers these
 * from this file while it unpacks, and hands everything else to the server once it runs.
 *
 *   node scripts/runtime/first-start.mjs write --runtime <unpacked archive> --archive-sha256 <hex> --out <file>
 *   node scripts/runtime/first-start.mjs check --package <package dir or .tgz> --runtime <its unpacked archive>
 *
 * Recorded for every setup the launcher answers alone (the default tool list and MCP_TOOLSET=all, each for a client
 * that declares the MCP Apps UI extension and one that does not; with MCP_EXTRA_TOOLS set the launcher waits instead):
 * the server's answers to ping, tools/list, resources/list and resources/templates/list, and its "Method not found" for
 * each request it has no handler for. The initialize answer is recorded with the protocol versions the server's SDK
 * accepts, and recording fails if the server answers initialize differently for any version, list or client.
 *
 * `check` is the release check: it fails when the package's answers name another archive or are not what that
 * archive's server answers now. scripts/runtime/npm-package.mjs runs it on every package it packs.
 */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { RUNTIME_MANIFEST_FILE } from "./manifest.mjs";

/** Beside the runtime manifest in the package's runtime/; the launcher derives the same name from the manifest's. */
export const FIRST_START_FILE = RUNTIME_MANIFEST_FILE.replace(/\.manifest\.json$/, ".first-start.json");
const UI_EXTENSION = "io.modelcontextprotocol/ui";
// No MCP revision has this name, so the server answers it with its latest.
const UNKNOWN_PROTOCOL_VERSION = "1999-01-01";
// Answers that are the same in every session of one setup, and so can be given before the server runs.
const LISTS = ["ping", "tools/list", "resources/list", "resources/templates/list"];
// Requests a client may send that the server may have no handler for; it refuses those before reading their params.
const PROBED = ["prompts/list", "prompts/get", "completion/complete", "logging/setLevel", "resources/subscribe", "resources/unsubscribe",
  "tasks/get", "tasks/result", "tasks/list", "tasks/cancel"];
const METHOD_NOT_FOUND = -32601;

/** One client session with the runtime's server: each message in turn, every answer kept as the server sent it. */
async function session(runtime, toolset, messages) {
  const child = spawn(process.execPath, [path.join(runtime, "packages/mcp-adapter/index.js")], { cwd: runtime, stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, MCP_TOOLSET: toolset, MCP_EXTRA_TOOLS: "", OODS_MCP_APPS_UI: "" } });
  const replies = new Map();
  let buffer = "";
  let stderr = "";
  let arrived = () => {};
  child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-4000); });
  child.stdout.setEncoding("utf8").on("data", (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const message = JSON.parse(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      if ("id" in message) replies.set(message.id, message);
    }
    arrived();
  });
  const closed = new Promise((resolve) => child.on("close", resolve));
  try {
    for (const [id, message] of messages.entries()) {
      const notification = message.method.startsWith("notifications/");
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...(notification ? {} : { id }), ...message })}\n`);
      if (notification) continue;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`the server did not answer ${message.method} within 60 s: ${stderr}`)), 60_000);
        arrived = () => { if (replies.has(id)) { clearTimeout(timer); resolve(); } };
        arrived();
      });
    }
    return messages.map((_, id) => replies.get(id));
  } finally {
    // The server stops when its input ends.
    child.stdin.end();
    const stuck = setTimeout(() => child.kill("SIGKILL"), 10_000);
    await closed;
    clearTimeout(stuck);
  }
}

/** The answers the server of an unpacked runtime gives, for the archive with this SHA-256. */
export async function recordAnswers(runtime, archiveSha256) {
  assert.match(archiveSha256, /^[0-9a-f]{64}$/, "the archive SHA-256");
  // The versions the server's own SDK accepts as asked; it answers any other with its latest.
  const sdk = createRequire(path.join(runtime, "packages/mcp-adapter/index.js"))("@modelcontextprotocol/sdk/types.js");
  const answers = { archiveSha256, protocolVersions: [...sdk.SUPPORTED_PROTOCOL_VERSIONS], latestProtocolVersion: sdk.LATEST_PROTOCOL_VERSION, initialize: null, variants: {} };
  const asked = [...answers.protocolVersions, UNKNOWN_PROTOCOL_VERSION];
  const chosen = asked.map((version) => (answers.protocolVersions.includes(version) ? version : answers.latestProtocolVersion));
  for (const toolset of ["default", "all"]) {
    for (const ui of [false, true]) {
      const setup = `${toolset}${ui ? ", UI client" : ""}`;
      const capabilities = ui ? { extensions: { [UI_EXTENSION]: { mimeTypes: ["text/html;profile=mcp-app"] } } } : {};
      const replies = await session(runtime, toolset, [
        ...asked.map((protocolVersion) => ({ method: "initialize", params: { protocolVersion, capabilities, clientInfo: { name: "oods-foundry-first-start", version: "1.0.0" } } })),
        { method: "notifications/initialized" },
        ...[...LISTS, ...PROBED].map((method) => ({ method })),
      ]);
      const initialized = replies.slice(0, asked.length).map((reply, index) => {
        assert(reply.result, `the server answers initialize (${setup}, asked ${asked[index]}): ${JSON.stringify(reply.error)}`);
        return reply.result;
      });
      answers.initialize ??= initialized[asked.indexOf(answers.latestProtocolVersion)];
      // The launcher sends one initialize answer to every client, with the version the SDK would choose.
      initialized.forEach((result, index) => assert.deepEqual(result, { ...answers.initialize, protocolVersion: chosen[index] },
        `the server answers initialize alike for every client and tool list, choosing protocol versions as its SDK does (${setup}, asked ${asked[index]})`));
      const variant = { results: {}, errors: {} };
      [...LISTS, ...PROBED].forEach((method, index) => {
        const reply = replies[asked.length + 1 + index];
        if (reply.error?.code === METHOD_NOT_FOUND) variant.errors[method] = reply.error;
        else if (LISTS.includes(method) && reply.result) variant.results[method] = reply.result;
      });
      assert(variant.results["tools/list"], `the server lists its tools (${setup})`);
      answers.variants[ui ? `${toolset}+ui` : toolset] = variant;
    }
  }
  return answers;
}

/** What differs between two sets of answers, by part, request and listed item, so the release log says what drifted. */
function differences(shipped, recorded) {
  const parts = Object.keys({ ...shipped, ...recorded }).filter((key) => key !== "variants" && !isDeepStrictEqual(shipped[key], recorded[key]));
  for (const variant of Object.keys({ ...shipped.variants, ...recorded.variants })) {
    for (const kind of ["results", "errors"]) {
      const [was, now] = [shipped.variants?.[variant]?.[kind] ?? {}, recorded.variants[variant]?.[kind] ?? {}];
      for (const method of Object.keys({ ...was, ...now })) {
        if (isDeepStrictEqual(was[method], now[method])) continue;
        const items = (answer) => new Map((Object.values(answer ?? {}).find(Array.isArray) ?? []).map((item) => [item.uri ?? item.uriTemplate ?? item.name, item]));
        const [before, after] = [items(was[method]), items(now[method])];
        const changed = [...new Set([...before.keys(), ...after.keys()])].filter((key) => !isDeepStrictEqual(before.get(key), after.get(key)));
        parts.push(`${variant} ${method} (${changed.length ? changed.join(", ") : "the answer itself"})`);
      }
    }
  }
  return parts;
}

/** The release check: the package's answers name its archive and are what that archive's server answers now. */
export async function checkAnswers({ packagePath, runtime }) {
  const read = (file) => (packagePath.endsWith(".tgz")
    ? execFileSync("tar", ["-xOzf", packagePath, `package/runtime/${file}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    : fs.readFileSync(path.join(packagePath, "runtime", file), "utf8"));
  const { archive, ...payload } = JSON.parse(read(RUNTIME_MANIFEST_FILE));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(runtime, RUNTIME_MANIFEST_FILE), "utf8")), payload, "--runtime must be the archive this package carries, unpacked");
  const shipped = JSON.parse(read(FIRST_START_FILE));
  assert.equal(shipped.archiveSha256, archive.sha256, `${FIRST_START_FILE} must name the archive the package carries; the launcher ignores answers recorded for another`);
  const recorded = await recordAnswers(runtime, archive.sha256);
  const drifted = differences(shipped, recorded);
  if (drifted.length) throw new Error(`${FIRST_START_FILE} is not what the archive's server answers: ${drifted.join("; ")}. Pack the package again; scripts/runtime/npm-package.mjs records the answers from its archive.`);
  return { file: FIRST_START_FILE, archiveSha256: archive.sha256, protocolVersions: recorded.protocolVersions, variants: summary(recorded) };
}

/** Per setup: how many tools, resources and templates it lists, and which requests it refuses. */
const summary = (answers) => Object.fromEntries(Object.entries(answers.variants).map(([variant, { results, errors }]) => [variant, {
  ...Object.fromEntries(Object.entries(results).filter(([method]) => method !== "ping").map(([method, result]) => [method, Object.values(result).find(Array.isArray)?.length])),
  methodNotFound: Object.keys(errors) }]));

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const keys = { write: { "--runtime": "runtime", "--archive-sha256": "archiveSha256", "--out": "out" }, check: { "--package": "packagePath", "--runtime": "runtime" } }[command];
  const usage = "usage: first-start.mjs write --runtime <dir> --archive-sha256 <hex> --out <file> | check --package <dir|tgz> --runtime <dir>";
  assert(keys, usage);
  const args = { command };
  for (let index = 0; index < rest.length; index += 2) {
    assert(keys[rest[index]] && rest[index + 1], usage);
    args[keys[rest[index]]] = rest[index] === "--archive-sha256" ? rest[index + 1] : path.resolve(rest[index + 1]);
  }
  assert(Object.values(keys).every((key) => args[key]), usage);
  return args;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.command === "write") {
      const answers = await recordAnswers(args.runtime, args.archiveSha256);
      fs.writeFileSync(args.out, `${JSON.stringify(answers, null, 2)}\n`);
      process.stdout.write(`${JSON.stringify({ out: args.out, variants: summary(answers) })}\n`);
    } else {
      process.stdout.write(`${JSON.stringify(await checkAnswers(args), null, 2)}\n`);
    }
  } catch (error) {
    process.stderr.write(`first-start: ${error.message}\n`);
    process.exitCode = 1;
  }
}
