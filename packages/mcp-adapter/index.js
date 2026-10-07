// First, before anything else loads: the Node floor (s206-m03). Below it the adapter stops with one plain sentence.
import './node-floor.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ErrorCode, McpError, ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { advertisedSchema } from './advertised-schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const NATIVE_SERVER_CANDIDATES = [
  path.join(PROJECT_ROOT, 'packages', 'mcp-server'),
  path.join(__dirname, '..', 'mcp-server'),
];

function resolveNativeServerDir() {
  for (const candidate of NATIVE_SERVER_CANDIDATES) {
    const registryPath = path.join(candidate, 'dist', 'tools', 'registry.json');
    if (fs.existsSync(registryPath)) {
      return candidate;
    }
  }
  return NATIVE_SERVER_CANDIDATES[0];
}

const NATIVE_SERVER_DIR = resolveNativeServerDir();
const NATIVE_DIST = path.join(NATIVE_SERVER_DIR, 'dist');
const PREVIEW_HOST_CANDIDATES = [
  path.join(PROJECT_ROOT, 'packages', 'mcp-bridge'),
  path.join(__dirname, '..', 'mcp-bridge'),
];

/** The bridge's standalone preview host (dist/preview/standalone.js), when the bridge is built. */
function resolvePreviewHostEntry() {
  for (const candidate of PREVIEW_HOST_CANDIDATES) {
    const entry = path.join(candidate, 'dist', 'preview', 'standalone.js');
    if (fs.existsSync(entry)) return entry;
  }
  return null;
}
const SCHEMAS_DIR = path.join(NATIVE_DIST, 'schemas');
/** The preview app the bridge build emits (dist/preview-app/app.html): one self-contained HTML resource. */
const PREVIEW_APP_CANDIDATES = [
  path.join(PROJECT_ROOT, 'packages', 'mcp-bridge', 'dist', 'preview-app', 'app.html'),
  path.join(__dirname, '..', 'mcp-bridge', 'dist', 'preview-app', 'app.html'),
];

const DEFAULT_ROLE = process.env.MCP_ROLE || 'designer';
const REGISTRY_PATH = path.join(NATIVE_DIST, 'tools', 'registry.json');
const POLICY_PATH = path.join(NATIVE_DIST, 'security', 'policy.json');
const ADAPTER_VERSION = JSON.parse(
  fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8')
).version;
// The product's names, rendered from configs/product/name.json by scripts/product/render-name.mjs (s211-m03).
const PRODUCT = JSON.parse(fs.readFileSync(new URL('./product.json', import.meta.url), 'utf8'));

// Installed packages retain the archive digest; hand-extracted archives retain the payload digest.
// A source checkout has no runtime archive identity and says so without disclosing its directory.
function runtimeIdentity() {
  for (const name of ['.unpacked.json', 'oods-foundry-runtime.manifest.json']) {
    const file = path.join(PROJECT_ROOT, name);
    if (!fs.existsSync(file)) continue;
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    const digest = manifest.sha256 ?? manifest.payloadTreeSha256;
    if (typeof digest === 'string' && /^[a-f0-9]{64}$/.test(digest)) {
      const version = manifest.version ?? manifest.packageVersions?.['@oods/components-react'];
      return `v${version ?? 'unknown'} ${digest.slice(0, 12)}`;
    }
  }
  return `v${ADAPTER_VERSION} unbundled`;
}

// ── Dynamic tool registry ────────────────────────────────────────────
// Reads registry.json from the server dist instead of hardcoding tool names.
// MCP tool names use underscores (Claude Desktop requires ^[a-zA-Z0-9_-]{1,64}$).
// Internal names use dots for native server communication.

function loadRegistry() {
  const raw = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  return { auto: raw.auto || [], onDemand: raw.onDemand || [] };
}

function resolveEnabledTools(registry) {
  const toolset = (process.env.MCP_TOOLSET || 'default').toLowerCase();
  if (toolset === 'all') {
    return [...registry.auto, ...registry.onDemand];
  }
  const extras = (process.env.MCP_EXTRA_TOOLS || '')
    .split(/[,\s]+/)
    .map(s => s.trim())
    .filter(Boolean);
  return [...registry.auto, ...extras.filter(t => registry.onDemand.includes(t))];
}

const TOOL_SURFACE = JSON.parse(fs.readFileSync(new URL('./tool-surface.json', import.meta.url), 'utf8'));
const SCHEMA_RESOURCE_PREFIX = 'oods://schemas/';
const legacyName = name => name.replace(/\./g, '_');
const advertisedName = name => TOOL_SURFACE[name]?.name ?? legacyName(name);

// s211-m01: what to do when the native server is missing or will not start. An installed copy is never built by hand,
// so pointing it at a pnpm build sent testers to a command they cannot run.
const SPAWN_ADVICE = 'If you installed this server from a package or an archive, reinstall it following the install guide that came with it; in a source checkout, run "pnpm --filter @oods/mcp-server run build" and retry.';

const DESCRIPTIONS_PATH = path.join(__dirname, 'tool-descriptions.json');

function loadDescriptions() {
  return JSON.parse(fs.readFileSync(DESCRIPTIONS_PATH, 'utf8'));
}

function loadInputSchema(toolName) {
  // Try tool-specific schema first, fall back to generic
  for (const candidate of [`${toolName}.input.json`, 'generic.input.json']) {
    const full = path.join(SCHEMAS_DIR, candidate);
    try {
      const schema = JSON.parse(fs.readFileSync(full, 'utf8'));
      return advertisedSchema(schema, file => {
        if (!/^(?:\.\/)?[A-Za-z0-9_.-]+\.json$/.test(file)) return undefined;
        try { return JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, file), 'utf8')); } catch { return undefined; }
      });
    } catch {
      continue;
    }
  }
  return { type: 'object', additionalProperties: true };
}

// ── MCP annotations derived from server policy ──────────────────────
// Reads policy.json to determine readOnlyHint / destructiveHint per tool.

function loadPolicy() {
  try {
    return JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'));
  } catch {
    return { rules: [] };
  }
}

function deriveAnnotations(toolName, policy) {
  const rule = policy.rules?.find(r => r.tool === toolName);
  if (!rule) {
    return { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false };
  }
  if (rule.readOnly) {
    return { readOnlyHint: true, destructiveHint: false, idempotentHint: TOOL_SURFACE[toolName]?.idempotentHint ?? true, openWorldHint: false };
  }
  // s213-m02 (#2351): a tool that only adds new files to its own stores (a composition version, a payload directory) writes,
  // so it is not read-only, but it destroys nothing.
  if (rule.additive) {
    return { readOnlyHint: false, destructiveHint: false, idempotentHint: TOOL_SURFACE[toolName]?.idempotentHint ?? false, openWorldHint: false };
  }
  // Tools with 'writes' paths can modify state
  return { readOnlyHint: false, destructiveHint: true, idempotentHint: TOOL_SURFACE[toolName]?.idempotentHint ?? false, openWorldHint: false };
}

// ── Preview host ──────────────────────────────────────────────────────
// design.preview needs the running-app preview host. The adapter starts it lazily on
// 127.0.0.1 the first time that tool is called, reads the port it chose from its first
// stdout line, tells the native server where it listens with every request, and stops it
// when the adapter stops. stdout stays reserved for JSON-RPC; the host logs to stderr.

class PreviewHost {
  constructor({ entry, serverCwd }) {
    this.entry = entry;
    this.serverCwd = serverCwd;
    this.child = null;
    this.url = null;
    this.port = null;
    this.starting = null;
  }

  async ensure() {
    if (this.url && this.child && this.child.exitCode === null) return this.url;
    if (this.starting) return this.starting;
    this.starting = this.start().finally(() => { this.starting = null; });
    return this.starting;
  }

  start() {
    return new Promise((resolve, reject) => {
      const nodeBin = process.env.OODS_NODE_PATH || process.execPath;
      const child = spawn(nodeBin, [this.entry, '--server-cwd', this.serverCwd, '--port', '0'], {
        cwd: path.dirname(this.entry),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      });
      this.child = child;
      child.stderr.pipe(process.stderr, { end: false });
      let buffer = '';
      let settled = false;
      const fail = (error) => {
        if (settled) return;
        settled = true;
        this.child = null;
        this.url = null;
        this.port = null;
        reject(error);
      };
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        buffer += chunk;
        const newline = buffer.indexOf('\n');
        if (newline < 0 || settled) return;
        const line = buffer.slice(0, newline).trim();
        buffer = '';
        let parsed;
        try { parsed = JSON.parse(line); } catch { return fail(new Error(`Preview host announced itself unreadably: ${line}`)); }
        const host = parsed && parsed.previewHost;
        if (!host || typeof host.url !== 'string' || !Number.isInteger(host.port)) return fail(new Error(`Preview host announced no port: ${line}`));
        settled = true;
        this.url = host.url;
        this.port = host.port;
        console.error(`[oods-mcp-adapter] preview host started on ${host.url} (pid ${child.pid})`);
        resolve(host.url);
      });
      child.once('error', (error) => fail(error));
      child.once('exit', (code, signal) => {
        if (this.child === child) { this.child = null; this.url = null; this.port = null; }
        fail(new Error(`Preview host exited before announcing a port (${code ?? signal})`));
      });
    });
  }

  async close() {
    const child = this.child;
    this.child = null;
    this.url = null;
    this.port = null;
    if (!child || child.exitCode !== null) return;
    await new Promise((resolve) => {
      const timer = setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 2000);
      timer.unref();
      child.once('close', () => { clearTimeout(timer); resolve(); });
      child.stdin.end();
      if (!child.killed && !child.kill('SIGTERM')) { clearTimeout(timer); resolve(); }
    });
  }
}

import { UI_EXTENSION, APP_MIME_TYPE, APP_RESOURCE_PREFIX, COMPOSITION_RESOURCE_PREFIX, TOKENS_RESOURCE, PreviewApp, parseCompositionResource, previewResources, readNegotiation } from './mcp-apps.js';

class NativeOodsClient {
  constructor({ cwd, role }) {
    this.cwd = cwd;
    this.role = role;
    this.child = null;
    this.seq = 0;
    this.pending = new Map();
    this.buffer = '';
  }

  ensure() {
    if (this.child && !this.child.killed) return;
    const entry = path.join(NATIVE_DIST, 'index.js');
    if (!fs.existsSync(entry)) {
      throw new Error(`Native MCP server not built at ${entry}. ${SPAWN_ADVICE}`);
    }
    const nodeBin = process.env.OODS_NODE_PATH || process.execPath;
    this.child = spawn(nodeBin, [entry], {
      cwd: this.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    this.child.stderr.pipe(process.stderr, { end: false });
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk) => this.handleStdout(chunk));
    this.child.on('exit', () => {
      for (const [, promise] of this.pending) {
        promise.reject(new Error('Native MCP server exited'));
      }
      this.pending.clear();
      this.child = null;
    });
    // s211-m01: a spawn that fails (a missing or unusable node binary) emits 'error', not 'exit'. Unhandled, it took the
    // whole adapter down, and the client lost the connection instead of reading what to do.
    this.child.on('error', (error) => {
      for (const [, promise] of this.pending) {
        promise.reject(new Error(`Native MCP server could not start: ${error.message}`));
      }
      this.pending.clear();
      this.child = null;
    });
    // A request written while that spawn fails errors on stdin too; its pending call already carries the reason.
    this.child.stdin.on('error', () => {});
  }

  handleStdout(chunk) {
    this.buffer += chunk;
    let idx;
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      const { id, result, error } = parsed;
      if (id == null) continue;
      const pending = this.pending.get(id);
      if (!pending) continue;
      this.pending.delete(id);
      if (error) {
        const failure = new Error(typeof error === 'string' ? error : error.message || 'Native error');
        if (typeof error === 'object' && !Array.isArray(error)) failure.nativeError = error;
        pending.reject(failure);
      } else pending.resolve(result);
    }
  }

  async run(tool, input, context) {
    this.ensure();
    const id = ++this.seq;
    const payload = JSON.stringify({ id, tool, input, role: this.role, ...(context ? { context } : {}) }) + '\n';
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(payload, 'utf8');
    });
  }

  async close() {
    const child = this.child;
    this.child = null;
    if (!child || child.exitCode !== null) return;

    await new Promise((resolve) => {
      const timer = setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 2000);
      timer.unref();
      child.once('close', () => { clearTimeout(timer); resolve(); });
      child.stdin.end();
      if (!child.killed && !child.kill('SIGTERM')) {
        clearTimeout(timer);
        resolve();
      }
    });
  }
}

async function main() {
  const registry = loadRegistry();
  const enabled = resolveEnabledTools(registry);
  const descriptions = loadDescriptions();
  const policy = loadPolicy();

  // Build the tool manifest: MCP name, internal name, description, input schema, annotations
  const toolManifest = enabled.map(internalName => ({
    internalName,
    mcpName: advertisedName(internalName),
    title: TOOL_SURFACE[internalName]?.title ?? internalName,
    description: descriptions[internalName] || `OODS tool: ${internalName}`,
    inputSchema: loadInputSchema(internalName),
    annotations: deriveAnnotations(internalName, policy),
  }));

  const client = new NativeOodsClient({ cwd: NATIVE_SERVER_DIR, role: DEFAULT_ROLE });
  const previewHostEntry = resolvePreviewHostEntry();
  const previewHost = previewHostEntry ? new PreviewHost({ entry: previewHostEntry, serverCwd: NATIVE_SERVER_DIR }) : null;
  const previewApp = new PreviewApp(PREVIEW_APP_CANDIDATES);
  const server = new Server(
    { name: PRODUCT.serverName, version: ADAPTER_VERSION },
    { capabilities: { tools: {}, resources: {}, extensions: { [UI_EXTENSION]: {} } } }
  );
  // Bilateral: the preview app is offered only to a client that advertised the extension (or an operator who forced it).
  let negotiation = readNegotiation(undefined);
  const uiOffered = () => (negotiation.extension || negotiation.forced) && previewApp.current() !== null;

  // Map MCP name → internal name for dispatch
  const nameMap = new Map(toolManifest.map(t => [t.mcpName, t.internalName]));
  const fullSchemas = new Map(toolManifest.map(t => [`${SCHEMA_RESOURCE_PREFIX}${t.mcpName}.input.json`, `${t.internalName}.input.json`]));

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const app = uiOffered() ? previewApp.current() : null;
    return {
      tools: toolManifest.map(t => ({
        name: t.mcpName,
        title: t.title,
        description: t.description,
        inputSchema: t.inputSchema,
        annotations: t.annotations,
        // The spec's key and the one the 1.x-line hosts read, both naming the same resource.
        ...(app && t.internalName === 'design.preview' ? { _meta: { ui: { resourceUri: app.uri }, 'ui/resourceUri': app.uri } } : {}),
      })),
    };
  });

  // The preview app is the one listed resource; composition modules and styles are readable by URI.
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const app = previewApp.current();
    return {
      resources: [...(app ? [{
        uri: app.uri, name: PRODUCT.previewTitle, title: PRODUCT.previewTitle,
        description: `The running-app preview of a composition version, for a client that renders MCP Apps inside the conversation (revision ${app.revision}, ${app.bytes} bytes, self-contained).`,
        mimeType: APP_MIME_TYPE,
      }] : []), ...toolManifest.map(t => ({
        uri: `${SCHEMA_RESOURCE_PREFIX}${t.mcpName}.input.json`, name: `${t.mcpName} input schema`,
        title: `${t.title} Schema`, description: `Full server validation schema for ${t.mcpName}; relative schema references are readable under ${SCHEMA_RESOURCE_PREFIX}.`, mimeType: 'application/schema+json',
      }))],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = String(request.params?.uri ?? '');
    if (uri.startsWith(SCHEMA_RESOURCE_PREFIX)) {
      const file = fullSchemas.get(uri) ?? uri.slice(SCHEMA_RESOURCE_PREFIX.length);
      if (!/^[A-Za-z0-9_.-]+\.json$/.test(file)) throw new McpError(ErrorCode.InvalidParams, 'Schema resource must name one JSON schema file.');
      try {
        return { contents: [{ uri, mimeType: 'application/schema+json', text: fs.readFileSync(path.join(SCHEMAS_DIR, file), 'utf8') }] };
      } catch { throw new McpError(ErrorCode.InvalidParams, `Unknown schema resource ${uri}.`); }
    }
    if (uri.startsWith(APP_RESOURCE_PREFIX)) {
      const app = previewApp.current();
      if (!app) throw new McpError(ErrorCode.InvalidParams, 'No preview app is built (packages/mcp-bridge/dist/preview-app/app.html); build @oods/mcp-bridge.');
      if (uri !== app.uri) throw new McpError(ErrorCode.InvalidParams, `The preview app moved: this adapter serves ${app.uri}. Reload the MCP configuration so the host refreshes its tool list.`);
      return { contents: [{ uri, mimeType: APP_MIME_TYPE, text: app.html }] };
    }
    const parsed = uri === TOKENS_RESOURCE ? { kind: 'tokens' } : parseCompositionResource(uri);
    if (!parsed) throw new McpError(ErrorCode.InvalidParams, `Unknown resource ${uri}: this adapter serves ${APP_RESOURCE_PREFIX}<revision>/app.html, ${TOKENS_RESOURCE} and ${COMPOSITION_RESOURCE_PREFIX}<id>/<n>/<react|vue>.(js|css)[?brand=&theme=].`);
    if (!previewHost) throw new McpError(ErrorCode.InternalError, 'No preview host is built (packages/mcp-bridge/dist/preview/standalone.js); the composition modules cannot be compiled.');
    const hostUrl = await previewHost.ensure();
    if (parsed.kind === 'tokens') {
      const response = await fetch(`${hostUrl}/preview/tokens.json`, { signal: AbortSignal.timeout(60_000) });
      const text = await response.text();
      if (!response.ok) throw new McpError(ErrorCode.InternalError, `The preview host could not serve ${uri} (HTTP ${response.status}): ${text.slice(0, 500)}`);
      return { contents: [{ uri, mimeType: 'application/json', text }] };
    }
    const scope = `${parsed.brand ? `&brand=${parsed.brand}` : ''}${parsed.theme ? `&theme=${parsed.theme}` : ''}`;
    const route = parsed.kind === 'js' ? `${parsed.version}/module.js?framework=${parsed.framework}&format=iife${scope}`
      : parsed.kind === 'css' ? `${parsed.version}/styles.css?framework=${parsed.framework}${scope}`
      : parsed.kind === 'record' ? `${parsed.version}/record.json` : 'versions.json';
    const mimeType = { js: 'text/javascript', css: 'text/css', record: 'application/json', versions: 'application/json' }[parsed.kind];
    const response = await fetch(`${hostUrl}/preview/${parsed.compositionId}/${route}`, { signal: AbortSignal.timeout(60_000) });
    const text = await response.text();
    // A 4xx is the request's fault (a missing version, an unknown brand the host names the known ones for); a 5xx is ours.
    if (!response.ok) throw new McpError(response.status >= 400 && response.status < 500 ? ErrorCode.InvalidParams : ErrorCode.InternalError, `The preview host could not serve ${uri} (HTTP ${response.status}): ${text.slice(0, 500)}`);
    return { contents: [{ uri, mimeType, text }] };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const internalName = nameMap.get(name);
    if (!internalName) {
      // s211-m01: the docs name tools with dots (design.compose); the wire names use underscores.
      const wireName = advertisedName(String(name));
      const hint = wireName !== name && nameMap.has(wireName) ? `. Tool names use underscores here: call ${wireName}.` : '';
      return {
        isError: true,
        content: [{ type: 'text', text: `Unknown tool: ${name}${hint}` }],
      };
    }
    try {
      let context;
      if (internalName === 'design.preview') {
        // Start the preview host now, so the native call can hand back a URL that already serves.
        if (!previewHost) {
          console.error('[oods-mcp-adapter] design.preview: no preview host is built (packages/mcp-bridge/dist/preview/standalone.js); the native server will report OODS-N021');
        } else {
          context = { previewHostUrl: await previewHost.ensure() };
        }
      }
      if (internalName === 'code.generate' && previewHost) {
        // Contract checks use the same host as previews. Host/browser availability stays advisory for codegen.
        try { context = { previewHostUrl: await previewHost.ensure() }; }
        catch (error) { console.error(`[oods-mcp-adapter] code.generate contract host unavailable: ${error.message}`); }
      }
      const result = await client.run(internalName, args ?? {}, context);
      // design_preview carries its result as structuredContent too (for the app, never for the model); the text is unchanged.
      const structured = internalName === 'design.preview' && result && typeof result === 'object' && !Array.isArray(result)
        ? { ...result, ...(uiOffered() ? { resources: previewResources(result, previewApp.current()) } : {}) }
        : undefined;
      return {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
        ...(structured ? { structuredContent: structured } : {}),
      };
    } catch (error) {
      if (error?.nativeError) {
        const native = error.nativeError;
        // Preserve every native field. Current ToolErrors nest retryable/context in
        // details; promote those for clients without dropping the original envelope.
        const structured = {
          ...native,
          ...(typeof native.retryable === 'boolean' ? {} : typeof native.details?.retryable === 'boolean' ? { retryable: native.details.retryable } : {}),
          ...('data' in native ? {} : native.details !== undefined ? { data: native.details?.context ?? native.details } : {}),
        };
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: structured }, null, 2) }],
        };
      }
      const message = error instanceof Error ? error.message : String(error);
      // Structured error with actionable guidance for server spawn failures
      const isSpawnError = message.includes('not built') || message.includes('server exited') || message.includes('ENOENT');
      const guidance = isSpawnError && !message.includes(SPAWN_ADVICE) ? `\n\nTo fix: ${SPAWN_ADVICE}` : '';
      return {
        isError: true,
        content: [{ type: 'text', text: `Tool ${name} failed: ${message}${guidance}` }],
      };
    }
  });

  const app = previewApp.current();
  console.error(`[oods-mcp-adapter] v${ADAPTER_VERSION} | ${enabled.length} tools (${registry.auto.length} auto, ${registry.onDemand.length} on-demand) | runtime: ${runtimeIdentity()} | preview app: ${app ? `${app.uri} (${app.bytes} bytes)` : 'not built'}`);

  const transport = new StdioServerTransport();
  // The initialize request is read raw, before the SDK's capability schema drops the extensions the client declared.
  let onmessage;
  Object.defineProperty(transport, 'onmessage', {
    configurable: true, enumerable: true,
    get: () => onmessage,
    set: (handler) => {
      onmessage = typeof handler === 'function'
        ? (message, extra) => {
          if (message && message.method === 'initialize') {
            negotiation = readNegotiation(message.params);
            const client = negotiation.client ? `${negotiation.client.name} ${negotiation.client.version}` : 'unnamed client';
            // The receipt of a real host session: which client connected and whether the preview app was offered.
            console.error(`[oods-mcp-adapter] client ${client} (protocol ${negotiation.protocolVersion ?? '?'}); MCP Apps ${UI_EXTENSION}: ${negotiation.extension ? `negotiated (mimeTypes ${JSON.stringify(negotiation.mimeTypes)})` : 'not advertised'}${negotiation.forced ? '; OODS_MCP_APPS_UI=1 forces the preview app' : ''}; preview app ${uiOffered() ? 'offered on design_preview' : 'kept as the text result'}; client capability keys: ${negotiation.capabilityKeys.join(', ') || 'none'}`);
          }
          return handler(message, extra);
        }
        : handler;
    },
  });
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await client.close();
    if (previewHost) await previewHost.close();
    await transport.close();
    process.exit(0);
  };
  const requestShutdown = () => {
    void shutdown();
  };
  process.once('SIGINT', requestShutdown);
  process.once('SIGTERM', requestShutdown);
  process.stdin.once('end', requestShutdown);
  process.stdin.once('close', requestShutdown);
  // Exit handlers cannot await. A crash must not strand either child; SIGKILL is
  // covered by the children's stdin EOF handlers instead.
  process.once('exit', () => {
    for (const child of [client.child, previewHost?.child]) if (child && child.exitCode === null) child.kill('SIGKILL');
  });

  await server.connect(transport);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[oods-mcp-adapter] failed to start:', err);
  process.exit(1);
});
