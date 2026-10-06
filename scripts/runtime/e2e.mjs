#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  canonicalJson,
  RUNTIME_MANIFEST_FILE,
  RUNTIME_SBOM_FILE,
  sha256,
  sha256File,
  TERMS_FILES,
  treeDigest,
  verifyEmbeddedManifest,
} from "./manifest.mjs";

const PROTOCOL_VERSION = "2024-11-05";
// s202-m05: the client an MCP Apps host is (the reference host's protocol version) and the protocol's own names.
const APPS_PROTOCOL_VERSION = "2025-06-18";
const UI_EXTENSION = "io.modelcontextprotocol/ui";
const APP_MIME_TYPE = "text/html;profile=mcp-app";
const APP_RESOURCE_PREFIX = "ui://oods-forge/preview/";
const COMPOSITION_RESOURCE_PREFIX = "ui://oods-forge/compositions/";
const REQUEST_TIMEOUT_MS = 120_000;
const LIFECYCLE_TIMEOUT_MS = 3_000;
const MAX_STDOUT_BYTES = 32 * 1024 * 1024;
const MAX_STDERR_BYTES = 128 * 1024;
const CONSUMER_COMMIT = "97e9aa8317bdfdf3cf6d85d81e90112c5e5789ff";
const FIXTURE_PINS = Object.freeze([
  {
    id: "twoPanel",
    fixture: "d3-preflight-dashboard.json",
    source_path: "tests/admin-app/fixtures/d3-preflight-dashboard.json",
    sha256: "c3e2c12b61e599f970070cf4af7d3262640a5e48c0cfc58616954cdb8c17d62a",
    bytes: 1145,
  },
  {
    id: "fourPanel",
    fixture: "d3-four-panel-dashboard.json",
    source_path: "tests/admin-app/fixtures/d3-four-panel-dashboard.json",
    sha256: "3901489a7e3bfa703c0a1db4b4dde9611f6ddf02edaa8dcb50dd1bb8b9a5ca04",
    bytes: 2091,
  },
  {
    id: "viz",
    fixture: "d3-viz-bar.json",
    source_path: "tests/admin-app/fixtures/d3-viz-bar.json",
    sha256: "be19ebf524bdcedb0baebec6f4a84a7076bdd563a2da3226b6d646da57464fed",
    bytes: 588,
  },
]);
const TOOL_FIXTURE_PINS = Object.freeze([
  {
    "tool": "health",
    "fixture": "s194-health.json",
    "sha256": "edae244bb0ec90acec8538028f5735e1591d1e9aa3bb6ee0f4cfcd3364f5ac59",
    "bytes": 60
  },
  {
    "tool": "tokens.build",
    "fixture": "s194-tokens-build.json",
    "sha256": "262634f01345c74f9fe4d09dded5fe7b85cda4ffe417161cb20d7b067ac7fb46",
    "bytes": 127
  },
  {
    "tool": "structuredData.fetch",
    "fixture": "s194-structuredData-fetch.json",
    "sha256": "25cb7457d33291a4cee539358c3673cfc305c1ba11c3eff71fd9e31efe35b437",
    "bytes": 105
  },
  {
    "tool": "brand.apply",
    "fixture": "s194-brand-apply.json",
    "sha256": "7bd21cd811cb7e11a171be6ba10383ac3c90ffc574bbe890c8174d02c7d68b47",
    "bytes": 122
  },
  {
    "tool": "brand.intake",
    "fixture": "s194-brand-intake.json",
    "sha256": "839ced48ab0acb29ad45d7fecb228f059265e8739ee2b20b8045eb202b7507be",
    "bytes": 148
  },
  {
    "tool": "catalog.list",
    "fixture": "s194-catalog-list.json",
    "sha256": "1fe037984ba4864821d3545a1d2d4d828570bb25a2839d88af7dc0fc6f87428d",
    "bytes": 111
  },
  {
    "tool": "design.compose",
    "fixture": "s194-design-compose.json",
    "sha256": "0224a94436ee2a8e13a7a1b28a89aff6fcd4ff0548cc00d3bbf321e038ddee00",
    "bytes": 123
  },
  {
    "tool": "design.preview",
    "fixture": "s194-design-preview.json",
    "sha256": "b0d35ed84035b22aa164e4e26821fb4b30e7f4be2e81947dc78d0055f76c790c",
    "bytes": 123
  },
  {
    "tool": "pipeline",
    "fixture": "s194-pipeline.json",
    "sha256": "04022a6046c39f0bec88c42cf71a59afa8ed5dd39ec7909b392faa7a2b0b47cb",
    "bytes": 143
  },
  {
    "tool": "registry.snapshot",
    "fixture": "s194-registry-snapshot.json",
    "sha256": "1979a3750c28176cbcbdb56b73f2add4c650b3cde4b6ce3f3841fbff5795e3ed",
    "bytes": 71
  },
  {
    "tool": "viz.render",
    "fixture": "s194-viz-render.json",
    "sha256": "2a850687881667f403f5a554ce2baa462bcefc4dc88e4d7f3e67d8873b7b8286",
    "bytes": 809
  },
  {
    "tool": "dashboard.render",
    "fixture": "s194-dashboard-render.json",
    "sha256": "1e66463fa39c7da75b9a017dcf0d7a357b6f3a0a184f2231d64118b3e639a854",
    "bytes": 1482
  },
  {
    "tool": "artifact.certify",
    "fixture": "s194-artifact-certify.json",
    "sha256": "de6959711792d74b068724bd860effaabe73d96b29f5fd64bc2105f2a6253a91",
    "bytes": 106
  },
  {
    "tool": "code.generate",
    "fixture": "s194-code-generate.json",
    "sha256": "7257a1995526a8aaeeed8002ce592b052e6e6c417b34f918bb9fb4d992921a9a",
    "bytes": 159
  },
  {
    "tool": "fidelity.preview",
    "fixture": "s194-fidelity-preview.json",
    "sha256": "79a38181c6b593d3e14adc9bc9462493f27045167d2934ae616c87bfe8ab05dc",
    "bytes": 3777
  },
  {
    "tool": "map",
    "fixture": "s194-map.json",
    "sha256": "8d3350cc21ddf3ad1fa1658850b0e4918ba584cabe108ad5dd0b54d3c548a6c0",
    "bytes": 458
  },
  {
    "tool": "schema",
    "fixture": "s194-schema.json",
    "sha256": "0d4c4b37fbae4e653a4492cf7a1fe47905bc2c5821a188cd3c10b605afb2277f",
    "bytes": 393
  },
  {
    "tool": "object",
    "fixture": "s194-object.json",
    "sha256": "0cdd899351e9bd9a6fa3ee7a21d5a33dce16c9d2c2c44c9a482f2022e3df9e9c",
    "bytes": 135
  },
  {
    "tool": "repl",
    "fixture": "s194-repl.json",
    "sha256": "73dbeaafc7be460a95e3d63bfdb18d17a25ab373af44416a84e5e14ca5ba2fe1",
    "bytes": 193
  }
]);
const EPHEMERAL_DASHBOARD_FIELDS = [
  "specRef",
  "specRefCreatedAt",
  "specRefExpiresAt",
];

const FORBIDDEN_CHILD_ENV = [
  "NODE_OPTIONS",
  "NODE_PATH",
  "MCP_CODE_CONNECT_PATH",
  "MCP_EXTRA_TOOLS",
  "MCP_HEALTH_PORT",
  "MCP_MAPPINGS_PATH",
  "MCP_ROLE",
  "MCP_SCHEMA_REF_MAX",
  "MCP_SCHEMA_REF_TTL_MS",
  "MCP_SCHEMA_STORE_DIR",
  "MCP_SCHEMA_STORE_ROOT",
  "MCP_STRUCTURED_DATA_DIR",
  "MCP_TELEMETRY_DIR",
  "MCP_THEME",
  "MCP_TOOLSET",
  "MCP_USER",
  "OODS_NODE_PATH",
  "OODS_OBJECTS_DIR",
  "OODS_OTLP_ENDPOINT",
  "OODS_OTLP_HEADERS",
  "OODS_OTLP_SERVICE_NAME",
  "OODS_TRAITS_DIR",
  "OTEL_PROPAGATORS",
  "OTEL_SERVICE_NAME",
  "PORT",
  "MCP_BRIDGE_PORT",
  "BRIDGE_TOKEN",
  "MCP_BRIDGE_CORS_ORIGIN",
  "OODS_PREVIEW_HOST_URL",
  "ESBUILD_BINARY_PATH",
  "OODS_MCP_APPS_UI",
];

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--extract-dir" || arg === "--repo-root") {
      const value = argv[++index];
      if (!value) throw new Error(`missing value for ${arg}`);
      parsed[arg === "--extract-dir" ? "extractDir" : "repoRoot"] =
        path.resolve(value);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (!parsed.extractDir || !parsed.repoRoot) {
    throw new Error("usage: e2e.mjs --extract-dir <dir> --repo-root <dir>");
  }
  return parsed;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function sanitizedRuntimeEnvironment(healthCanaryPort) {
  const hostileParent = {
    ...process.env,
    NODE_PATH: "/tmp/hostile-node-path",
    MCP_HEALTH_PORT: String(healthCanaryPort),
    MCP_TOOLSET: "all",
    MCP_MAPPINGS_PATH: "/tmp/hostile-mappings.json",
    OODS_OTLP_ENDPOINT: "http://127.0.0.1:9/v1/traces",
    OODS_OTLP_HEADERS: "Authorization=hostile",
    OODS_MCP_APPS_UI: "1",
  };
  const env = {
    PATH: hostileParent.PATH ?? "",
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    TZ: "UTC",
    NODE_ENV: "production",
    NO_COLOR: "1",
  };
  for (const key of FORBIDDEN_CHILD_ENV) {
    assert.equal(
      env[key],
      undefined,
      `forbidden child environment key leaked: ${key}`,
    );
  }
  return env;
}

async function reserveClosedPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  const port = address.port;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function assertLoopbackPortClosed(port) {
  await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const finish = (error) => {
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };
    socket.once("connect", () =>
      finish(new Error(`unexpected loopback listener on port ${port}`)),
    );
    socket.once("error", (error) => {
      if (error.code === "ECONNREFUSED") finish();
      else finish(error);
    });
    socket.setTimeout(2_000, () =>
      finish(new Error(`loopback probe timed out on port ${port}`)),
    );
  });
}

export class McpClient {
  // s211-m03: `command`/`args` start the server another way, as the npm package's `npx -y <tarball>` does.
  constructor({ adapterPath, command = process.execPath, args = [adapterPath], cwd, env }) {
    this.nextId = 0;
    this.pending = new Map();
    this.stdoutBuffer = "";
    this.stderrBuffer = "";
    this.callCount = 0;
    this.calledTools = new Set();
    this.exitInfo = null;
    this.child = spawn(command, args, {
      cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => this.handleStdout(chunk));
    this.child.stderr.on("data", (chunk) => {
      this.stderrBuffer = `${this.stderrBuffer}${chunk}`.slice(
        -MAX_STDERR_BYTES,
      );
    });
    this.exitPromise = new Promise((resolve) => {
      this.child.on("exit", (code, signal) => {
        this.exitInfo = { code, signal };
        const suffix = this.stderrBuffer
          ? `\nstderr:\n${this.stderrBuffer}`
          : "";
        this.failAll(
          new Error(`adapter exited (${code ?? signal ?? "unknown"})${suffix}`),
        );
        resolve(this.exitInfo);
      });
    });
    this.child.on("error", (error) => this.failAll(error));
  }

  handleStdout(chunk) {
    this.stdoutBuffer += chunk;
    if (Buffer.byteLength(this.stdoutBuffer) > MAX_STDOUT_BYTES) {
      this.failAll(
        new Error("adapter stdout buffer exceeded verification limit"),
      );
      this.child.kill("SIGKILL");
      return;
    }
    let newline;
    while ((newline = this.stdoutBuffer.indexOf("\n")) >= 0) {
      const line = this.stdoutBuffer.slice(0, newline).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        this.failAll(
          new Error(`adapter emitted non-JSON stdout: ${line.slice(0, 200)}`),
        );
        this.child.kill("SIGKILL");
        return;
      }
      if (!message || message.jsonrpc !== "2.0") continue;
      if (message.id === undefined || message.id === null) continue;
      const pending = this.pending.get(message.id);
      if (!pending) {
        this.failAll(
          new Error(`adapter returned unknown JSON-RPC id ${message.id}`),
        );
        this.child.kill("SIGKILL");
        return;
      }
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error)
        pending.reject(
          new Error(`JSON-RPC error: ${JSON.stringify(message.error)}`),
        );
      else pending.resolve(message.result);
    }
  }

  failAll(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  request(method, params = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
    if (this.exitInfo)
      return Promise.reject(new Error("adapter is already closed"));
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`JSON-RPC request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(
        `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`,
        "utf8",
        (error) => {
          if (!error) return;
          clearTimeout(timer);
          this.pending.delete(id);
          reject(error);
        },
      );
    });
  }

  notify(method, params = {}) {
    this.child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`,
      "utf8",
    );
  }

  async callTool(name, args, expectedError) {
    this.callCount += 1;
    this.calledTools.add(name);
    const result = await this.request("tools/call", { name, arguments: args });
    // The whole result of the latest call, for what travels beside the text (design_preview's structuredContent).
    this.lastResult = result;
    if (expectedError) {
      assert.equal(result?.isError, true, `${name} must disclose the expected portable limit`);
      const error = JSON.parse(result.content?.[0]?.text ?? "{}").error;
      assert.equal(error?.code, expectedError, `${name} must preserve its native error code`);
      assert.equal(typeof error.retryable, "boolean");
      return { isError: true, ...error };
    }
    if (result?.isError) {
      throw new Error(
        `MCP tool failed: ${name}: ${result.content?.[0]?.text ?? "unknown error"}`,
      );
    }
    assert(Array.isArray(result?.content), `MCP tool content missing: ${name}`);
    assert([1, 2].includes(result.content.length), `MCP tool returned unexpected content count: ${name}`);
    if (result.content.length === 2) {
      assert.equal(result.content[1].type, "text");
      assert.match(result.content[1].text, /^Warning: [\w]+ is deprecated; use [\w]+\. This alias is supported through 0\.7\.x and removed in 0\.8\.0\.$/);
    }
    assert.equal(
      result.content[0]?.type,
      "text",
      `MCP tool returned non-text content: ${name}`,
    );
    return JSON.parse(result.content[0].text);
  }

  async waitForExit(timeoutMs) {
    if (this.exitInfo) return this.exitInfo;
    return Promise.race([
      this.exitPromise,
      new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
  }

  async closeStdinAndObserve() {
    if (this.exitInfo) return { exited: true, ...this.exitInfo };
    this.child.stdin.end();
    const result = await this.waitForExit(LIFECYCLE_TIMEOUT_MS);
    return result
      ? { exited: true, ...result }
      : { exited: false, code: null, signal: null };
  }

  async terminate(signal = "SIGTERM") {
    if (this.exitInfo)
      return {
        ...this.exitInfo,
        requestedSignal: signal,
        forcedKill: false,
        alreadyExited: true,
      };
    this.child.kill(signal);
    let result = await this.waitForExit(LIFECYCLE_TIMEOUT_MS);
    let forcedKill = false;
    if (!result) {
      forcedKill = true;
      this.child.kill("SIGKILL");
      result = await this.exitPromise;
    }
    return {
      ...result,
      requestedSignal: signal,
      forcedKill,
      alreadyExited: false,
    };
  }
}

async function loadJson(filePath) {
  return JSON.parse(await fsp.readFile(filePath, "utf8"));
}

async function loadFixtures(repoRoot) {
  const fixturesRoot = path.join(
    repoRoot,
    "packages/mcp-server/test/fixtures/portable-runtime",
  );
  const provenance = await loadJson(path.join(fixturesRoot, "provenance.json"));
  assert.equal(
    provenance.consumer_repository?.commit,
    CONSUMER_COMMIT,
    "consumer fixture commit drifted",
  );
  assert.deepEqual(
    provenance.fixtures,
    FIXTURE_PINS,
    "fixture provenance differs from the code-pinned operands",
  );
  const fixtures = {};
  for (const entry of FIXTURE_PINS) {
    const bytes = await fsp.readFile(path.join(fixturesRoot, entry.fixture));
    assert.equal(
      bytes.length,
      entry.bytes,
      `fixture byte count drifted: ${entry.fixture}`,
    );
    assert.equal(
      sha256(bytes),
      entry.sha256,
      `fixture sha256 drifted: ${entry.fixture}`,
    );
    fixtures[entry.id] = JSON.parse(bytes.toString("utf8"));
  }
  assert.deepEqual(provenance.s194_tool_fixtures.fixtures, TOOL_FIXTURE_PINS);
  fixtures.tools = {};
  for (const pin of TOOL_FIXTURE_PINS) {
    const bytes = await fsp.readFile(path.join(fixturesRoot, pin.fixture));
    assert.equal(bytes.length, pin.bytes, pin.fixture);
    assert.equal(sha256(bytes), pin.sha256, pin.fixture);
    fixtures.tools[pin.tool] = JSON.parse(bytes.toString('utf8'));
  }
  return fixtures;
}

function assertDashboard(output, label) {
  assert.equal(output.status, "ok", `${label} dashboard status must be ok`);
  assert.equal(
    typeof output.html,
    "string",
    `${label} dashboard HTML is missing`,
  );
  assert(
    output.html.startsWith("<!DOCTYPE html>"),
    `${label} dashboard HTML is not a document`,
  );
  assert.equal(
    output.outputHtmlHash,
    sha256(output.html),
    `${label} outputHtmlHash does not hash returned HTML`,
  );
  const deterministic = structuredClone(output);
  for (const field of EPHEMERAL_DASHBOARD_FIELDS) {
    assert.equal(
      typeof deterministic[field],
      "string",
      `${label} dashboard ${field} is missing`,
    );
    delete deterministic[field];
  }
  return {
    output,
    html: output.html,
    sha256: output.outputHtmlHash,
    deterministicBytes: canonicalJson(deterministic),
  };
}

function assertCertification(viz, positive, negative) {
  assert.equal(viz.status, "ok", "viz.render status must be ok");
  assert(
    viz.normalizedSpec && typeof viz.normalizedSpec === "object",
    "viz.render normalizedSpec is missing",
  );
  assert.equal(
    positive.status,
    "ok",
    "artifact.certify positive status must be ok",
  );
  assert.equal(
    positive.coverage,
    "certified",
    "artifact.certify coverage must be certified",
  );
  assert.equal(
    positive.conformant,
    true,
    "artifact.certify must be conformant",
  );
  assert.deepEqual(positive.pillars, {
    a11yEquivalence: "pass",
    determinism: "pass",
    contrast: "pass",
    accuracy: "pass",
  });
  assert.equal(
    negative.status,
    "error",
    "HTML certification must return a structured error",
  );
  assert.deepEqual(
    negative.errors?.map((error) => error.code),
    ["OODS-V126"],
  );
}

async function initializeAndList(client, expectedVersion, expectedToolNames, negotiate = false) {
  // negotiate (s202-m05): initialize as an MCP Apps host does, declaring io.modelcontextprotocol/ui with its mimeTypes;
  // otherwise the client that declares nothing, as every proof before Sprint 202.
  const protocolVersion = negotiate ? APPS_PROTOCOL_VERSION : PROTOCOL_VERSION;
  const initialized = await client.request("initialize", {
    protocolVersion,
    capabilities: negotiate ? { extensions: { [UI_EXTENSION]: { mimeTypes: [APP_MIME_TYPE] } } } : {},
    clientInfo: { name: "forge-portable-runtime-e2e", version: "0.1.0" },
  });
  assert.equal(initialized.protocolVersion, protocolVersion);
  assert.deepEqual(initialized.serverInfo, {
    name: "oods-foundry-adapter",
    version: expectedVersion,
  });
  // Resources and the extension are advertised to every client; only the tool's pointer to the app is negotiated.
  assert.deepEqual(initialized.capabilities, { tools: {}, resources: {}, extensions: { [UI_EXTENSION]: {} } });
  client.notify("notifications/initialized");
  const listed = await client.request("tools/list", {});
  const names = listed.tools.map((tool) => tool.name);
  assert.deepEqual(
    names,
    expectedToolNames,
    "tools/list differs from extracted registry auto order",
  );
  const negotiation = await negotiationLine(client);
  const pointing = listed.tools.filter((tool) => tool._meta !== undefined);
  if (negotiate) {
    assert.deepEqual(pointing.map((tool) => tool.name), ["design_preview"], "only design_preview points at the preview app");
    assert.equal(negotiation, `[oods-mcp-adapter] client forge-portable-runtime-e2e 0.1.0 (protocol ${APPS_PROTOCOL_VERSION}); MCP Apps ${UI_EXTENSION}: negotiated (mimeTypes ${JSON.stringify([APP_MIME_TYPE])}); preview app offered on design_preview; client capability keys: extensions`);
  } else {
    assert.deepEqual(pointing, [], "a client that did not negotiate MCP Apps gets no _meta.ui");
    assert.equal(negotiation, `[oods-mcp-adapter] client forge-portable-runtime-e2e 0.1.0 (protocol ${PROTOCOL_VERSION}); MCP Apps ${UI_EXTENSION}: not advertised; preview app kept as the text result; client capability keys: none`);
  }
  return { initialized, names, tools: listed.tools, negotiation };
}

/** The adapter's one-line negotiation receipt on stderr (never stdout), awaited because the two pipes are not ordered. */
async function negotiationLine(client) {
  const deadline = Date.now() + LIFECYCLE_TIMEOUT_MS;
  for (;;) {
    const line = client.stderrBuffer.split("\n").find((entry) => entry.startsWith("[oods-mcp-adapter] client "));
    if (line) return line;
    assert(Date.now() < deadline, `the adapter logged no negotiation line on stderr:\n${client.stderrBuffer}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

/**
 * s202-m05: the preview app from the extracted archive. The one listed resource is the shipped app.html under its
 * revision URI (the first 12 hex of its sha256, so a host that caches by URI refetches after an update), design_preview
 * points at it, and resources/read returns the shipped bytes.
 */
async function proveAppResource(client, runtimeRoot, tools) {
  const appRoot = path.join(runtimeRoot, "packages/mcp-bridge/dist/preview-app");
  const appManifest = await loadJson(path.join(appRoot, "manifest.json"));
  const shipped = await fsp.readFile(path.join(appRoot, "app.html"));
  assert.equal(sha256(shipped), appManifest.sha256, "the shipped preview app differs from its build manifest");
  assert.equal(shipped.length, appManifest.bytes);
  assert.equal(appManifest.revision, appManifest.sha256.slice(0, 12));
  const uri = `${APP_RESOURCE_PREFIX}${appManifest.revision}/app.html`;
  const preview = tools.find((tool) => tool.name === "design_preview");
  assert.deepEqual(preview?._meta, { ui: { resourceUri: uri }, "ui/resourceUri": uri }, "design_preview points at the shipped app");
  const listed = await client.request("resources/list", {});
  assert.deepEqual(listed.resources.filter(resource => resource.mimeType === APP_MIME_TYPE).map((resource) => [resource.uri, resource.mimeType]), [[uri, APP_MIME_TYPE]], "the archive lists exactly one preview app beside its full schemas");
  const read = await client.request("resources/read", { uri });
  assert.equal(read.contents.length, 1);
  assert.equal(read.contents[0].uri, uri);
  assert.equal(read.contents[0].mimeType, APP_MIME_TYPE);
  assert.equal(sha256(read.contents[0].text), appManifest.sha256, "resources/read returns the shipped preview app byte for byte");
  return { uri, mimeType: APP_MIME_TYPE, bytes: appManifest.bytes, sha256: appManifest.sha256, revision: appManifest.revision, listed: listed.resources.length, readEqualsShipped: true };
}

/**
 * s202-m05: the same design_preview call as the app receives it. structuredContent is the text result plus the resource
 * URIs, and each resolves from the archive: both frameworks' compiled modules as the inline script the app injects (bound
 * to the app's inlined runtime, no imports), their styles, the version record naming the bundle head and the lineage list.
 */
async function proveCompositionResources(client, raw, preview, appUri, manifest) {
  assert.equal(raw?.content?.length, 1, "the text result is unchanged");
  const { resources, ...rest } = raw.structuredContent ?? {};
  assert.deepEqual(rest, preview, "structuredContent is the text result");
  const base = `${COMPOSITION_RESOURCE_PREFIX}${preview.compositionId}/${preview.version}/`;
  const scope = `?brand=${preview.brand}&theme=${preview.theme}`;
  assert.deepEqual(resources, {
    app: appUri,
    record: `${base}record.json`,
    versions: `${COMPOSITION_RESOURCE_PREFIX}${preview.compositionId}/versions.json`,
    modules: { react: `${base}react.js${scope}`, vue: `${base}vue.js${scope}` },
    styles: { react: `${base}react.css${scope}`, vue: `${base}vue.css${scope}` },
    // s213-m04: the token build's CSS and brand list, which the app reads for its brand switch.
    tokens: "ui://oods-forge/tokens.json",
  }, "structuredContent names the resources the app reads");
  const readOne = async (uri, mimeType) => {
    const read = await client.request("resources/read", { uri });
    assert.equal(read.contents.length, 1, uri);
    assert.equal(read.contents[0].uri, uri);
    assert.equal(read.contents[0].mimeType, mimeType, uri);
    assert.equal(typeof read.contents[0].text, "string", uri);
    return read.contents[0].text;
  };
  const modules = {};
  for (const framework of ["react", "vue"]) {
    const code = await readOne(resources.modules[framework], "text/javascript");
    assert.match(code, /^var __oodsModules;\s*\(__oodsModules \|\|= \{\}\)\.m_[a-f0-9]{16} = /, `${framework} module registers on the app's module table`);
    assert(code.includes("globalThis.__oodsRuntime"), `${framework} module binds its imports to the app's inlined runtime`);
    assert.doesNotMatch(code, /^import /m, `${framework} module must not import`);
    const styles = await readOne(resources.styles[framework], "text/css");
    modules[framework] = { uri: resources.modules[framework], bytes: Buffer.byteLength(code), sha256: sha256(code), stylesBytes: Buffer.byteLength(styles) };
  }
  const record = JSON.parse(await readOne(resources.record, "application/json"));
  assert.equal(record.compositionId, preview.compositionId);
  assert.equal(record.version, preview.version);
  assert.equal(record.head, manifest.commit, "the version record names the bundle head");
  assert.equal(record.schemaHash, preview.schemaHash);
  assert.deepEqual(Object.keys(record.artifacts).sort(), ["react", "vue"]);
  const versions = JSON.parse(await readOne(resources.versions, "application/json"));
  assert.equal(versions.compositionId, preview.compositionId);
  assert.deepEqual(versions.versions.map((entry) => [entry.version, entry.parentVersion, entry.operation]), [[1, null, "compose"]]);
  assert.equal(versions.accepted, null);
  const tokens = JSON.parse(await readOne(resources.tokens, "application/json"));
  assert(Array.isArray(tokens.brands) && tokens.brands.includes("A") && tokens.brands.includes("B"), "the tokens resource lists the brands the archive builds");
  return {
    structuredContentEqualsText: true,
    resources,
    modules,
    record: { uri: resources.record, head: record.head, schemaHash: record.schemaHash },
    versions: { uri: resources.versions, count: versions.versions.length, accepted: versions.accepted },
  };
}

function assertGeneratedArtifact(artifact, framework) {
  assert.equal(artifact?.framework, framework);
  assert.match(artifact.contentHash, /^sha256:[a-f0-9]{64}$/);
  assert(artifact.files.length > 0);
  assert(artifact.files.some(file => /\.(?:tsx|vue)$/.test(file.path)), "real framework source must be emitted");
  for (const file of artifact.files) {
    assert(file.contents.length > 0);
    assert.equal(file.contentHash, `sha256:${sha256(file.contents)}`);
  }
}

async function proveBridge(runtimeRoot, env, manifest, expectedToolNames, input, adapterSvgHash, previewInput) {
  const port = await reserveClosedPort();
  const base = `http://127.0.0.1:${port}`;
  const { isolatedCommand } = await import('./e2e-npm.mjs');
  const invocation = isolatedCommand(runtimeRoot, process.execPath, ['dist/server.js']);
  const child = spawn(invocation.command, invocation.args, {
    cwd: path.join(runtimeRoot, 'packages/mcp-bridge'),
    env: { ...env, MCP_BRIDGE_PORT: String(port), BRIDGE_TOKEN: 'portable-e2e-owned-token' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output = (output + chunk).slice(-32768); });
  child.stderr.on('data', chunk => { output = (output + chunk).slice(-32768); });
  const exited = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  let health;
  try {
    for (const deadline = Date.now() + 15000; Date.now() < deadline;) {
      try {
        const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(1000) });
        if (response.ok) { health = await response.json(); break; }
      } catch { /* Wait for the owned bridge to listen. */ }
      if (child.exitCode !== null) throw new Error(`Bundled bridge exited: ${output}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(health, `Bundled bridge did not become ready: ${output}`);
    assert.deepEqual(health.revision, { commit: manifest.commit,
      structuredDataManifestHash: `sha256:${manifest.structuredDataManifest.sha256}` });
    const toolsResponse = await fetch(`${base}/tools`);
    assert(toolsResponse.ok);
    const tools = await toolsResponse.json();
    assert.deepEqual([...tools.tools].sort(), [...expectedToolNames].sort());
    const response = await fetch(`${base}/run`, { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-bridge-token': 'portable-e2e-owned-token' },
      body: JSON.stringify({ tool: 'viz_render', input }), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    const rendered = await response.json();
    assert(response.ok && rendered.ok, JSON.stringify(rendered));
    assert(adapterSvgHash, 'adapter SVG proof missing');
    assert.equal(rendered.result.svgHash, adapterSvgHash);
    // The bridge hosts the running-app preview in-process: design.preview answers with a URL on its own port.
    const statusResponse = await fetch(`${base}/preview/status`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    assert(statusResponse.ok, 'bundled bridge preview host status');
    const previewStatus = await statusResponse.json();
    assert.equal(previewStatus.running, true);
    assert.equal(previewStatus.platform?.supported, true, JSON.stringify(previewStatus.platform));
    const previewResponse = await fetch(`${base}/run`, { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-bridge-token': 'portable-e2e-owned-token' },
      body: JSON.stringify({ tool: 'design_preview', input: previewInput }), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    const previewRun = await previewResponse.json();
    assert(previewResponse.ok && previewRun.ok, JSON.stringify(previewRun));
    const bridgePreview = previewRun.result;
    assert.equal(bridgePreview.status, 'ok');
    assert.equal(bridgePreview.host.port, port, 'the bridge serves the preview on its own port');
    assert.equal(bridgePreview.previews.length, 2);
    for (const entry of bridgePreview.previews) {
      const page = await fetch(entry.url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      assert(page.ok, `bridge preview page ${entry.url}`);
      const html = await page.text();
      assert(html.includes('data-oods-lineage="true"') && html.includes(`<code>${bridgePreview.compositionId}</code>`), 'bridge preview page lineage');
      const module = await fetch(entry.moduleUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      assert(module.ok, `bridge preview module ${entry.moduleUrl}`);
      assert.equal(`sha256:${sha256(await module.text())}`, entry.compiled.sha256, 'bridge compiled module digest');
    }
    child.kill('SIGTERM');
    const termination = await Promise.race([exited,
      new Promise(resolve => setTimeout(() => resolve(null), LIFECYCLE_TIMEOUT_MS))]);
    assert(termination, 'bridge did not stop cleanly');
    assert(termination.code === 0 || termination.signal === 'SIGTERM');
    await assertLoopbackPortClosed(port);
    return { revision: health.revision, tools: tools.tools, svgHash: adapterSvgHash, parity: true, termination,
      preview: { compositionId: bridgePreview.compositionId, version: bridgePreview.version, hostPort: bridgePreview.host.port, compiled: Object.fromEntries(bridgePreview.previews.map(entry => [entry.framework, entry.compiled.sha256])) } };
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await exited;
  }
}

async function main() {
  assert.equal(
    process.env.NODE_PATH,
    undefined,
    "e2e harness requires NODE_PATH to be undefined",
  );
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = await fsp.realpath(args.repoRoot);
  const runtimeRoot = await fsp.realpath(args.extractDir);
  assert.notEqual(runtimeRoot, repoRoot, "Never run the extracted-runtime proof in the source root");
  // Physical location is not dependency isolation. In-worktree scratch is allowed only with ancestor lookup denied.
  const { isolatedCommand, missingPeerControl } = await import('./e2e-npm.mjs');
  for (const forbidden of [".git", ".env", "cmos"]) {
    assert(
      !fs.existsSync(path.join(runtimeRoot, forbidden)),
      `forbidden runtime-root member present: ${forbidden}`,
    );
  }

  const { manifest, payload } = await verifyEmbeddedManifest(runtimeRoot);
  assert(manifest.thirdPartyCount > 0);
  const sbom = await loadJson(path.join(runtimeRoot, RUNTIME_SBOM_FILE));
  assert.equal(sbom.summary.packageCount, manifest.thirdPartyCount);
  assert.equal(sbom.summary.integrityCount, manifest.thirdPartyCount);
  assert(sbom.packages.every((entry) => entry.integrity.startsWith("sha512-")));
  // The terms ship at the archive root and match the repository copies byte for byte.
  assert.deepEqual(manifest.terms.map((entry) => entry.path), [...TERMS_FILES]);
  for (const entry of manifest.terms) {
    const shipped = await sha256File(path.join(runtimeRoot, entry.path));
    assert.equal(shipped, entry.sha256, `${entry.path} differs from the manifest`);
    assert.equal(shipped, await sha256File(path.join(repoRoot, entry.path)),
      `${entry.path} differs from the repository copy`);
  }
  assert((await fsp.readFile(path.join(runtimeRoot, "LICENSE"), "utf8")).startsWith("\n                                 Apache License\n                           Version 2.0, January 2004\n"),
    "shipped LICENSE is not the Apache License 2.0");
  assert((await fsp.readFile(path.join(runtimeRoot, "THIRD-PARTY-NOTICES.md"), "utf8"))
    .includes(`ships ${manifest.thirdPartyCount} third-party npm packages`), "notices count differs from the closure");
  assert.equal(manifest.brandSourceTree.path, "packages/tokens/src/tokens/brands");
  const brandDirectories = (await fsp.readdir(path.join(runtimeRoot, manifest.brandSourceTree.path), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  // s213-m04: the shipped brand folders are the brands the shipped token build carries (its brand registry).
  const builtBrands = (await loadJson(path.join(runtimeRoot, "packages/tokens/dist/brands.json"))).brands;
  assert.deepEqual(brandDirectories, [...builtBrands].sort(), "shipped brand directories");

  const adapterPackage = await loadJson(
    path.join(runtimeRoot, "packages/mcp-adapter/package.json"),
  );
  assert.equal(
    adapterPackage.version,
    "0.7.0",
    "adapter 0.7.0 preserves structured native errors and hosts the running-app preview",
  );
  assert.equal(
    manifest.packageVersions["@oods/mcp-adapter"],
    adapterPackage.version,
  );
  const registry = await loadJson(
    path.join(runtimeRoot, "packages/mcp-server/dist/tools/registry.json"),
  );
  const surface = await loadJson(path.join(runtimeRoot, "packages/mcp-adapter/tool-surface.json"));
  const expectedToolNames = registry.auto.map((name) =>
    surface[name].name,
  );
  assert.equal(expectedToolNames.length, manifest.registry.autoCount);

  const fixtures = await loadFixtures(repoRoot);
  const fullTreeBefore = await treeDigest(runtimeRoot);
  const healthCanaryPort = await reserveClosedPort();
  const childEnvironment = sanitizedRuntimeEnvironment(healthCanaryPort);
  const scratch = path.join(runtimeRoot, '.oods/s194-e2e');
  const artifactsRoot = path.join(runtimeRoot, 'artifacts/current-state');
  assert(!fs.existsSync(scratch));
  assert(!fs.existsSync(artifactsRoot), 'E2E cleanup owns only a newly created artifact tree');
  const oodsExisted = fs.existsSync(path.join(runtimeRoot, '.oods'));
  await fsp.mkdir(scratch, { recursive: true });
  childEnvironment.TMPDIR = scratch;
  childEnvironment.HOME = path.join(scratch, 'home');
  childEnvironment.npm_config_cache = path.join(scratch, 'npm-cache');
  childEnvironment.NODE_OPTIONS = '--no-global-search-paths';
  await fsp.mkdir(childEnvironment.HOME);
  const missingPeer = missingPeerControl(runtimeRoot, runtimeRoot, childEnvironment);
  await fsp.copyFile(path.join(runtimeRoot, 'artifacts/structured-data/component-mappings.json'), path.join(scratch, 'mappings.json'));
  childEnvironment.MCP_MAPPINGS_PATH = path.join(scratch, 'mappings.json');
  childEnvironment.MCP_SCHEMA_STORE_ROOT = scratch;
  childEnvironment.MCP_SCHEMA_STORE_DIR = 'schemas';
  const state = {};
  const operand = (tool) => {
    const recipe = fixtures.tools[tool];
    const args = structuredClone(recipe.arguments);
    for (const [key, binding] of Object.entries(recipe.bindings)) {
      const [producer, field] = binding.split('.');
      assert(state[producer]?.[field] !== undefined, `Unresolved fixture binding ${binding}`);
      args[key] = state[producer][field];
    }
    return args;
  };
  assert.deepEqual(Object.keys(fixtures.tools).sort(), [...registry.auto].sort());
  const adapterPath = path.join(runtimeRoot, "packages/mcp-adapter/index.js");
  const adapterCwd = path.join(runtimeRoot, "packages/mcp-adapter");
  const runtimeInvocation = isolatedCommand(runtimeRoot, process.execPath, [adapterPath]);
  let previewHostPort;
  const primary = new McpClient({
    ...runtimeInvocation,
    cwd: adapterCwd,
    env: childEnvironment,
  });
  let stdinClose;
  let primaryTermination = null;
  let calls;
  let mcpApps;
  try {
    // s202-m05: the primary client negotiates MCP Apps: the tool's pointer to the archive's preview app, the app
    // resource and the negotiation receipt on stderr are proven before the first call.
    const negotiated = await initializeAndList(primary, adapterPackage.version, expectedToolNames, true);
    mcpApps = {
      protocolVersion: APPS_PROTOCOL_VERSION,
      capabilities: negotiated.initialized.capabilities,
      negotiation: negotiated.negotiation,
      app: await proveAppResource(primary, runtimeRoot, negotiated.tools),
    };
    const health = await primary.callTool("health_check", operand("health")); // 1
    assert.equal(health.status, "ok");
    // s211-m01: health reports the release the archive is part of, not the native package's internal 0.1.0.
    const buildStamp = await loadJson(path.join(runtimeRoot, "packages/mcp-server/dist/build-revision.json"));
    assert.equal(health.server.version, buildStamp.release);
    assert.deepEqual(
      {
        components: health.registry.components,
        traits: health.registry.traits,
        objects: health.registry.objects,
      },
      // Sprint 203 adds five objects born from Derek's own stores: Decision, Sprint and Session from
      // CMOS's record, Person and Cluster from Hive's cohort. health.registry.traits counts the
      // non-viz families and is unchanged by lifecycle/Supersedable's family already being present.
      // Sprint 204 m02 made health's trait and component counts LIVE rather than a snapshot frozen at
      // Sprint 199: the registry has held 47 traits since Sprint 203 added lifecycle/Supersedable, and
      // 46 was the stale advertised number the Sprint 203 review found. Components stayed 110 until Sprint 222 m02 added
      // Switch and Dialog (#2502 ruling 11).
      // Sprint 205 m02 adds three objects born from real Stage1 runs: Run, Finding and CapturedArtifact; m03 the
      // traits core/Assessable (result state) and core/Provenanced. Sprint 209 adds Comparison and ComparisonSignal,
      // the derived Stage1 comparison; its literal moved only in Sprint 211 m01, when the tripwire first ran again.
      { components: 114, traits: 49, objects: 16 },
    );
    assert.deepEqual(health.warnings ?? [], []);
    const builtScopes = await loadJson(path.join(runtimeRoot, 'packages/tokens/dist/css-variables-by-scope.json'));
    assert.deepEqual(health.tokens.scopes, Object.fromEntries(Object.entries(builtScopes).map(([brand, themes]) => [brand, Object.keys(themes).sort()])));
    assert.deepEqual(health.tokens.defaultScope, { brand: 'A', theme: 'light', source: 'default' });
    // s233-m02 projects retained proof to the 16 shipped objects; no new sweep identity.
    const runtimeLedger = await loadJson(path.join(runtimeRoot, "packages/mcp-server/dist/registry/runtime-cells.v1.json"));
    assert.deepEqual(health.productReality.runtime, {
      cells: runtimeLedger.rows.length, pass: runtimeLedger.rows.filter(row => row.status === 'pass').length,
      typedGap: runtimeLedger.rows.filter(row => row.status === 'typed-gap').length, fail: runtimeLedger.rows.filter(row => row.status === 'fail').length,
      head: runtimeLedger.head, thisBuild: runtimeLedger.head === buildStamp.commit,
    });
    const releaseLedger = await loadJson(path.join(runtimeRoot, "packages/mcp-server/dist/registry/release-cells.v1.json"));
    assert.equal(releaseLedger.rows.length, 42, 'The shipped release proof must contain the full reference-app population.');
    assert(releaseLedger.rows.every(row => row.status === 'pass' && row.hashEqualToHost === true
      && row.artifactHash === row.hostArtifactHash), 'Every shipped release cell must have passed with host artifact equality.');
    assert.deepEqual(health.productReality.release, {
      bundleHead: releaseLedger.bundleHead, head: releaseLedger.bundleHead,
      archiveSha256: releaseLedger.archiveSha256,
      apps: [...new Set(releaseLedger.rows.map(row => row.object))].sort(),
      frameworks: [...new Set(releaseLedger.rows.map(row => row.framework))].sort(),
      cells: releaseLedger.rows.length,
      pass: releaseLedger.rows.filter(row => row.status === 'pass').length,
      typedGap: releaseLedger.rows.filter(row => row.status === 'typed-gap').length,
      fail: releaseLedger.rows.filter(row => row.status === 'fail').length,
      // s211-m01: the proof names the archive it measured, and says whether that is this build.
      thisBuild: releaseLedger.bundleHead === buildStamp.commit,
    });
    // s194-m04: retired entries leave the live roster; health must match the shipped ledger.
    const toolLedger = await loadJson(path.join(runtimeRoot, "packages/mcp-server/dist/registry/tool-capability-ledger.v1.json"));
    assert.deepEqual(health.productReality.tools.byTestImportLocation, toolLedger.summary.byTestImportLocation);
    assert.equal(health.productReality.tools.entries, registry.auto.length + registry.onDemand.length);
    assert.equal(health.productReality.tools.head, toolLedger.portableExecution.bundleHead);
    assert.equal(health.productReality.tools.thisBuild, !toolLedger.portableExecution.dirty && toolLedger.portableExecution.bundleHead === buildStamp.commit);
    const visualProofs = await loadJson(path.join(runtimeRoot, 'packages/mcp-server/dist/registry/visual-proofs.v1.json'));
    for (const kind of ['html', 'fidelity']) {
      const proof = health.productReality[kind];
      assert.equal(proof.cells, visualProofs[kind].rows.length);
      assert.equal(proof.thisBuild, proof.head === buildStamp.commit);
    }
    // s195-m02: the extracted runtime carries the authored classification and
    // generated taxonomy; health must expose their reconciled Core Profile.
    const vizTaxonomy = await loadJson(path.join(runtimeRoot, 'packages/mcp-server/dist/registry/viz-taxonomy.v1.json'));
    assert.deepEqual(health.productReality.viz, vizTaxonomy.summary);
    // s222-m02 (#2502 ruling 12, I47): 22 offered patterns plus retiredPatterns: 1.
    assert.deepEqual(Object.fromEntries(['types', 'patterns', 'retiredPatterns', 'families', 'classified', 'coreCells'].map(key => [key, health.productReality.viz[key]])), { types: 13, patterns: 22, retiredPatterns: 1, families: 8, classified: 36, coreCells: 17 });
    assert.equal(health.productReality.viz.coreSurfaceComplete + health.productReality.viz.typedGaps, 17);
    assert(
      isInside(runtimeRoot, path.resolve(health.schemas.storeDir)),
      "health schema store escaped extraction root",
    );

    const two = assertDashboard(
      await primary.callTool("dashboard_render", operand("dashboard.render")),
      "two-panel",
    ); // 2
    const four = assertDashboard(
      await primary.callTool("dashboard_render", fixtures.fourPanel),
      "four-panel",
    ); // 3
    const twoRepeat = assertDashboard(
      await primary.callTool("dashboard_render", fixtures.twoPanel),
      "two-panel repeat",
    ); // 4
    const fourRepeat = assertDashboard(
      await primary.callTool("dashboard_render", fixtures.fourPanel),
      "four-panel repeat",
    ); // 5
    assert.equal(
      twoRepeat.html,
      two.html,
      "two-panel HTML is not byte-deterministic",
    );
    assert.equal(
      fourRepeat.html,
      four.html,
      "four-panel HTML is not byte-deterministic",
    );
    assert.equal(
      twoRepeat.deterministicBytes,
      two.deterministicBytes,
      "two-panel deterministic response projection drifted",
    );
    assert.equal(
      fourRepeat.deterministicBytes,
      four.deterministicBytes,
      "four-panel deterministic response projection drifted",
    );
    assert.notEqual(
      twoRepeat.output.specRef,
      two.output.specRef,
      "two-panel repeat unexpectedly reused ephemeral specRef",
    );
    assert.notEqual(
      fourRepeat.output.specRef,
      four.output.specRef,
      "four-panel repeat unexpectedly reused ephemeral specRef",
    );

    const vizInput = operand("viz.render");
    vizInput.output = { ...vizInput.output, svg: true };
    const viz = await primary.callTool("viz_render", vizInput); // 6
    state.viz = viz;
    const positive = await primary.callTool("artifact_certify", operand("artifact.certify")); // 7
    const negative = await primary.callTool("artifact_certify", {
      spec: { html: four.html },
    }); // 8
    assertCertification(viz, positive, negative);
    const tokens = await primary.callTool("tokens_build", operand("tokens.build"));
    assert.equal(tokens.artifacts.length, 0);
    assert.match(tokens.preview.summary, /brand B \(dark theme\)/);
    assert.equal(tokens.transcriptPath, undefined); assert.equal(tokens.bundleIndexPath, undefined);
    const appliedTokens = await primary.callTool("tokens_build", { ...operand("tokens.build"), apply: true });
    assert.equal(appliedTokens.artifacts.length, 5, "portable token export must emit all five outputs");
    for (const file of appliedTokens.artifacts) {
      assert(isInside(artifactsRoot, file));
      assert((await fsp.stat(file)).size > 0);
    }
    const exportedTokens = Object.fromEntries(appliedTokens.artifacts.map(file => [path.basename(file), file]));
    assert.deepEqual(JSON.parse(await fsp.readFile(exportedTokens['tokens.dark.json'], 'utf8')),
      { cssVariables: builtScopes.B.dark, meta: { brand: 'B', theme: 'dark', scope: 'requested' } });
    for (const [exported, shipped] of [['tokens.css', 'css/tokens.css'], ['tokens.ts', 'ts/tokens.ts'], ['tokens.tailwind.json', 'tailwind/tokens.json']]) {
      assert((await fsp.readFile(exportedTokens[exported])).equals(
        await fsp.readFile(path.join(runtimeRoot, 'packages/tokens/dist', shipped))), `Export changed shipped token bytes: ${exported}`);
    }
    const data = await primary.callTool("structured_data_fetch", operand("structuredData.fetch"));
    assert.equal(data.dataset, 'components'); assert(data.etag);
    const brandSourceRoot = path.join(runtimeRoot, manifest.brandSourceTree.path);
    const brandSourceBefore = await treeDigest(brandSourceRoot);
    const brand = await primary.callTool("brand_apply", operand("brand.apply"));
    assert.equal(brand.receipt.sourceWritten, false); assert.equal(brand.receipt.build, null);
    assert.equal(brand.artifacts.length, 0, "brand.apply dry run writes no review-kit artifacts");
    assert.match(brand.preview.summary, /brand B/);
    assert.equal(brand.transcriptPath, undefined); assert.equal(brand.bundleIndexPath, undefined);
    // apply:true from the bundle emits the review kit only: shipped brand source and dist never move.
    // s213-m07: brand.apply checks the brand as the change would leave it (s213-m05), so the delta must pass the brand
    // contrast rules. The old unscoped delta also reached the dark theme, where a light canvas fails (OODS-V216).
    const brandDelta = { base: { color: { brand: { B: { surface: { canvas: { $value: "oklch(0.98 0.003 265)" } } } } } } };
    const appliedBrand = await primary.callTool("brand_apply", { ...operand("brand.apply"), delta: brandDelta, apply: true });
    assert.equal(appliedBrand.receipt.sourceWritten, false, "portable brand.apply must not write shipped source");
    assert.deepEqual(appliedBrand.receipt.sourceFiles, []);
    assert.equal(appliedBrand.receipt.build, null, "portable brand.apply must not run the token build");
    assert.equal(appliedBrand.receipt.portable?.sourceWrites, "skipped");
    assert.equal(appliedBrand.receipt.portable?.tokenBuild, "skipped");
    assert.equal(typeof appliedBrand.receipt.portable?.reason, "string");
    // No variables.css from the runtime: only a token build says which CSS variables change (s213-m05).
    assert.deepEqual(appliedBrand.artifacts.map((file) => path.basename(file)).sort(),
      ["diagnostics.json", "specimens.json", "tokens.B.base.json", "tokens.B.dark.json", "tokens.B.hc.json"]);
    assert.match(appliedBrand.receipt.portable.reason, /no variables\.css/);
    for (const file of [...appliedBrand.artifacts, appliedBrand.transcriptPath, appliedBrand.bundleIndexPath]) {
      assert(isInside(artifactsRoot, file), `brand.apply review kit escaped extraction artifacts: ${file}`);
      assert((await fsp.stat(file)).size > 0);
    }
    const brandDiagnostics = JSON.parse(await fsp.readFile(appliedBrand.diagnosticsPath, "utf8"));
    assert(brandDiagnostics.tokensChanged >= 1 && brandDiagnostics.themesTouched.includes("base"), JSON.stringify(brandDiagnostics));
    const brandSourceAfter = await treeDigest(brandSourceRoot);
    assert.equal(brandSourceAfter.sha256, brandSourceBefore.sha256, "portable brand.apply changed shipped brand source");
    assert.equal(brandSourceAfter.sha256, manifest.brandSourceTree.sha256);
    const intake = await primary.callTool("brand_create", operand("brand.intake"));
    // s213-m05: brand.intake is template, validate and create; the fixture asks for the template from a shipped preset.
    // s222-m01 added 28 colour, radius and font slots; s222-m02 the 26 light chart slots (a brand's charts are its own).
    assert.deepEqual(intake.slots, { base: 103, dark: 96, hc: 96 }); assert(intake.documents?.base && intake.documents?.dark && intake.documents?.hc);
    const catalog = await primary.callTool("catalog_list", operand("catalog.list"));
    // s222-m02 (#2502 ruling 11): 112 components; s223-m02 (#2527): 114. The fixture still pages 109 of them.
    assert.equal(catalog.totalCount, 114); assert.equal(catalog.returnedCount, 109);
    const composed = await primary.callTool("design_compose", operand("design.compose"));
    assert.equal(composed.status, 'ok'); assert(composed.schemaRef); state.compose = composed;
    // The adapter starts the preview host lazily for this call and reports its port in the result.
    const preview = await primary.callTool("design_preview", operand("design.preview"));
    const previewResult = primary.lastResult;
    assert.equal(preview.status, 'ok');
    assert.match(preview.previewUrl, /^http:\/\/127\.0\.0\.1:\d+\/preview\/cmp-[a-f0-9]{12}\/1\?framework=react&brand=A&theme=light$/);
    assert.equal(preview.version, 1); assert.equal(preview.parentVersion, null); assert.equal(preview.operation, 'compose');
    assert.equal(preview.head, manifest.commit, 'the version records the bundle head');
    assert(Number.isInteger(preview.host.port) && preview.host.port > 0, 'preview host port must be reported');
    assert.equal(preview.host.url, `http://127.0.0.1:${preview.host.port}`);
    assert.equal(preview.previews.length, 2, 'both frameworks compile from the archive');
    assert(isInside(scratch, preview.recordPath), `preview record escaped the scratch store: ${preview.recordPath}`);
    assert(fs.existsSync(preview.recordPath));
    previewHostPort = preview.host.port;
    const previewStatus = await (await fetch(`${preview.host.url}/preview/status`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })).json();
    assert.equal(previewStatus.running, true);
    assert.equal(path.resolve(previewStatus.compositionsDir), path.resolve(preview.host.compositionsDir));
    for (const entry of preview.previews) {
      const page = await fetch(entry.url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      assert(page.ok, `preview page ${entry.url}`);
      const shell = await page.text();
      assert(shell.includes('data-oods-lineage="true"') && shell.includes(`<code>${preview.compositionId}</code>`) && shell.includes('<code>compose</code>') && shell.includes(`<code>${manifest.commit}</code>`), 'preview page lineage');
      const app = await fetch(entry.appUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      assert(app.ok, `preview app ${entry.appUrl}`);
      const html = await app.text();
      assert(html.includes('<script type="importmap">') && html.includes('data-theme="light" data-brand="A"') && html.includes(`data-oods-preview="${preview.compositionId}" data-oods-preview-version="1"`), 'preview app shape');
      const module = await fetch(entry.moduleUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      assert(module.ok, `preview module ${entry.moduleUrl}`);
      const code = await module.text();
      assert.equal(`sha256:${sha256(code)}`, entry.compiled.sha256, 'compiled module digest');
      assert(!code.includes('@oods/component-styles/css'), 'the page links the styles; the module must not import them');
      const runtime = await fetch(`${preview.host.url}/preview/runtime/${entry.framework === 'react' ? 'react.js' : 'vue.js'}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      assert(runtime.ok, 'preview host runtime served');
    }
    mcpApps.preview = await proveCompositionResources(primary, previewResult, preview, mcpApps.app.uri, manifest);
    const generated = await primary.callTool("code_generate", operand("code.generate"));
    assert.equal(generated.status, 'ok');
    assertGeneratedArtifact(generated.artifact, 'react');
    const generatedVue = await primary.callTool("code_generate", { ...operand("code.generate"), framework: 'vue' });
    assert.equal(generatedVue.status, 'ok');
    assertGeneratedArtifact(generatedVue.artifact, 'vue');
    const run = await primary.callTool("pipeline_run", operand("pipeline"));
    assert.equal(run.error, undefined, JSON.stringify(run.error));
    assertGeneratedArtifact(run.code?.artifact, 'react');
    const snapshot = await primary.callTool("registry_snapshot", operand("registry.snapshot"));
    assert(snapshot.objects.Subscription); assert(snapshot.traits.Stateful); assert.match(snapshot.etag, /^[a-f0-9]{64}$/);
    const fidelity = await primary.callTool("fidelity_preview", operand("fidelity.preview"));
    assert.equal(fidelity.status, 'ok'); assert.equal(fidelity.fixture, '(inline)'); assert(fidelity.html.includes('Subscription'));
    const mapped = await primary.callTool("component_map", operand("map"));
    assert.equal(mapped.applied, true); assert(mapped.mapping.id);
    const resolved = await primary.callTool("component_map", fixtures.tools.map.followups[0]);
    assert.equal(resolved.mapping.id, mapped.mapping.id);
    const removedMap = await primary.callTool("component_map", { ...fixtures.tools.map.followups[1], id: mapped.mapping.id });
    assert.equal(removedMap.deleted.id, mapped.mapping.id);
    const saved = await primary.callTool("schema_store", operand("schema"));
    assert.equal(saved.version, 1);
    const loaded = await primary.callTool("schema_store", fixtures.tools.schema.followups[0]);
    assert.equal(loaded.version, 1); assert(loaded.schemaRef);
    const removedSchema = await primary.callTool("schema_store", fixtures.tools.schema.followups[1]);
    assert.equal(removedSchema.deleted, true);
    const object = await primary.callTool("object_registry", operand("object"));
    assert.equal(object.name, 'Subscription'); assert(object.traits.length > 0); assert.deepEqual(Object.keys(object.viewExtensions), ['card']);
    const rendered = await primary.callTool("schema_render", operand("repl"));
    assert.equal(rendered.status, 'ok'); assert(rendered.html.startsWith('<!DOCTYPE html>'));
    assert.deepEqual([...primary.calledTools].sort(), [...expectedToolNames].sort());
    const outcomes = {
      'tokens.build': { outcome: 'pass', apply: true, artifacts: appliedTokens.artifacts.length, preview: tokens.preview.summary },
      'structuredData.fetch': { outcome: 'pass', etag: data.etag },
      'brand.apply': { outcome: 'pass', dryRun: { apply: false, artifacts: 0, summary: brand.preview.summary },
        applied: { apply: true, artifacts: appliedBrand.artifacts.length, tokensChanged: brandDiagnostics.tokensChanged, sourceWritten: false, build: null,
          portable: appliedBrand.receipt.portable, brandSourceSha256: brandSourceAfter.sha256, brandSourceUnchanged: true } },
      'brand.intake': { outcome: 'pass', brand: intake.brand_id ?? 'template', slots: intake.slots },
      'catalog.list': { outcome: 'pass', count: catalog.totalCount },
      'design.compose': { outcome: 'pass', schemaHash: sha256(canonicalJson(composed.schema)) },
      'design.preview': { outcome: 'pass', compositionId: preview.compositionId, version: preview.version, previewUrl: preview.previewUrl, hostPort: preview.host.port, schemaHash: preview.schemaHash,
        compiled: Object.fromEntries(preview.previews.map(entry => [entry.framework, entry.compiled.sha256])) },
      'code.generate': { outcome: 'pass', reactHash: generated.artifact.contentHash, vueHash: generatedVue.artifact.contentHash },
      pipeline: { outcome: 'pass', contentHash: run.code.artifact.contentHash },
      'registry.snapshot': { outcome: 'pass', etag: snapshot.etag },
      'fidelity.preview': { outcome: 'pass', htmlHash: sha256(fidelity.html) },
      map: { outcome: 'pass', createdResolvedDeleted: true },
      schema: { outcome: 'pass', savedLoadedDeleted: true },
      object: { outcome: 'pass', name: object.name },
      repl: { outcome: 'pass', htmlHash: sha256(rendered.html) },
      health: { outcome: 'pass', tokens: health.tokens, viz: health.productReality.viz, release: health.productReality.release },
      'dashboard.render': { outcome: 'pass', repeated: true },
      'viz.render': { outcome: 'pass', contentHash: viz.contentHash },
      'artifact.certify': { outcome: 'pass', pillars: positive.pillars, negativeCode: 'OODS-V126' },
    };
    assert.deepEqual(Object.keys(outcomes).map(name => surface[name].name).sort(), [...expectedToolNames].sort());
    assert.equal(Object.values(outcomes).filter(row => row.outcome === 'pass').length, expectedToolNames.length);
    assert.equal(Object.values(outcomes).filter(row => row.outcome === 'typed').length, 0);
    const bridge = await proveBridge(runtimeRoot, childEnvironment, manifest, expectedToolNames,
      vizInput, viz.svgHash, operand("design.preview"));
    await assertLoopbackPortClosed(healthCanaryPort);
    calls = {
      bridge,
      mcpApps,
      primarySequenceCount: primary.callCount,
      outcomes,
      fixturePins: TOOL_FIXTURE_PINS,
      health: {
        status: health.status,
        registry: health.registry,
        release: health.productReality.release,
        viz: health.productReality.viz,
        warnings: health.warnings ?? [],
      },
      dashboards: {
        twoPanelHtmlSha256: two.sha256,
        fourPanelHtmlSha256: four.sha256,
        repeatsIdentical: true,
      },
      viz: { chartType: viz.chartType, contentHash: viz.contentHash },
      certify: {
        coverage: positive.coverage,
        conformant: positive.conformant,
        pillars: positive.pillars,
        negativeCode: "OODS-V126",
      },
    };
    stdinClose = await primary.closeStdinAndObserve();
    assert.equal(
      stdinClose.exited,
      true,
      "adapter did not exit after stdin close",
    );
    assert.equal(stdinClose.code, 0, "adapter stdin-close exit was not clean");
    assert.equal(
      stdinClose.signal,
      null,
      "adapter stdin-close exit was signal-driven",
    );
    primaryTermination = { method: "stdin-close", ...stdinClose };
    // The preview host the adapter started must not outlive it.
    assert(previewHostPort, 'preview host port was never recorded');
    await assertLoopbackPortClosed(previewHostPort);
    primaryTermination.previewHostPortClosed = previewHostPort;
  } catch (error) {
    await primary.terminate("SIGTERM");
    throw error;
  }

  const restarted = new McpClient({
    ...runtimeInvocation,
    cwd: adapterCwd,
    env: childEnvironment,
  });
  let restart;
  try {
    // The second process is a client that declares nothing: no pointer to the app, and its stderr line says so.
    const plain = await initializeAndList(
      restarted,
      adapterPackage.version,
      expectedToolNames,
    );
    const restartHealth = await restarted.callTool("health_check", {});
    assert.equal(
      restartHealth.status,
      "ok",
      "restarted adapter native health call failed",
    );
    assert.equal(
      restarted.callCount,
      1,
      "restarted adapter must make exactly one native health call",
    );
    const termination = await restarted.terminate("SIGTERM");
    assert.equal(
      termination.forcedKill,
      false,
      "adapter required SIGKILL after SIGTERM",
    );
    assert(
      termination.code === 0 || termination.signal === "SIGTERM",
      `adapter SIGTERM exit was not clean: ${JSON.stringify(termination)}`,
    );
    restart = {
      initialized: true,
      negotiation: plain.negotiation,
      nativeHealth: restartHealth.status,
      sigterm: termination,
    };
  } catch (error) {
    await restarted.terminate("SIGKILL");
    throw error;
  }

  await fsp.rm(scratch, { recursive: true });
  if (!oodsExisted) await fsp.rmdir(path.join(runtimeRoot, '.oods'));
  await fsp.rm(artifactsRoot, { recursive: true });
  const fullTreeAfter = await treeDigest(runtimeRoot);
  assert.equal(
    primary.callCount + restarted.callCount,
    31,
    "portable runtime E2E must make 31 tools/call operations across both adapter processes",
  );
  calls.totalAcrossProcesses = primary.callCount + restarted.callCount;
  assert.equal(
    fullTreeAfter.sha256,
    fullTreeBefore.sha256,
    "extracted runtime tree was not restored after scoped E2E writes",
  );
  assert.equal(
    fullTreeAfter.entryCount,
    fullTreeBefore.entryCount,
    "extracted runtime entry count was not restored",
  );
  process.stdout.write(
    canonicalJson({
      status: "pass",
      nodeVersion: process.version,
      completedAt: new Date().toISOString(),
      manifest: {
        file: RUNTIME_MANIFEST_FILE,
        commit: manifest.commit,
        dirty: manifest.dirty,
        payloadTreeSha256: payload.sha256,
        thirdPartyCount: manifest.thirdPartyCount,
      },
      tools: { count: expectedToolNames.length, names: expectedToolNames },
      isolation: { method: 'ancestor module denial', blockedAncestors: runtimeInvocation.blocked, missingPeer },
      calls,
      healthPort: {
        inherited: false,
        canaryPort: healthCanaryPort,
        listenerAbsent: true,
      },
      extractionTree: {
        before: fullTreeBefore.sha256,
        after: fullTreeAfter.sha256,
        unchanged: true,
        restoredAfterScopedWrites: true,
      },
      lifecycle: { stdinClose, primaryTermination, restart },
    }),
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(
      `runtime-e2e: ${error.stack ?? error.message ?? String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
