import './load-env.js';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  bridgeConfig,
  lowerCaseHeaders,
  policyDocs,
  approvalRequiredTools,
  applyCapableTools,
  approvalTokenSets,
} from './config.js';
import { registerArtifactEndpoints } from './endpoints/artifacts.js';
import { buildErrorPayload, normalizeRunErrorCode, sendError, statusForCode } from './middleware/errors.js';
import { rateLimitOptions } from './middleware/rate-limit.js';
import { listenOnLoopback, PortInUseError, refuseForeignHosts } from './listen.js';
import { buildToolNameMaps, legacyToolWarning, resolveInternalToolName } from './tool-names.js';
import { resolveBridgeToolSurface } from './tool-surface.js';
import { registerBridgeHealth } from './health.js';
import { resolveBridgeArtifacts, activeTokenPackageRoot, resolveTokenPackageRoot } from './runtime-paths.js';
import { registerPreviewHost } from './preview/host.js';
import { resolveCompositionsDir } from './preview/store.js';

const APPROVAL_REQUIRED_TOOLS = approvalRequiredTools;
const APPLY_CAPABLE_TOOLS = applyCapableTools;
const POLICY_UX_DOC = policyDocs.ux;
const POLICY_RULES_DOC = policyDocs.rules;

type RunRequestBody = {
  tool?: string;
  input?: Record<string, any>;
  role?: string;
};

type McpResponse =
  | { id?: string | number; result: any }
  | { id?: string | number; error: { code: string; message?: string; messages?: any } };

class McpClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private seq = 0;
  private pending = new Map<
    number,
    { resolve: (v: any) => void; reject: (e: any) => void }
  >();
  private buffer = '';
  /** Where the preview host listens; sent with every request so design.preview can hand back URLs. */
  previewHostUrl: string | undefined;

  constructor(private serverCwd: string) {}

  private ensure() {
    if (this.child && !this.child.killed) return;
    // Spawn the built MCP server (dist/index.js)
    const entry = path.join(this.serverCwd, 'dist', 'index.js');
    this.child = spawn(process.execPath, [entry], {
      cwd: this.serverCwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk: string) => {
      this.buffer += chunk;
      let idx: number;
      while ((idx = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, idx).trim();
        this.buffer = this.buffer.slice(idx + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line) as McpResponse;
          const id = (msg as any).id as number | undefined;
          if (id != null && this.pending.has(id)) {
            const p = this.pending.get(id)!;
            this.pending.delete(id);
            if ((msg as any).error) p.reject((msg as any).error);
            else p.resolve((msg as any).result);
          }
        } catch {
          // ignore parse errors on stdout
        }
      }
    });

    this.child.on('exit', () => {
      // Reject all in-flight requests
      for (const [, p] of this.pending) p.reject({ code: 'PROCESS_EXIT' });
      this.pending.clear();
      this.child = null;
    });
  }

  async close(): Promise<void> {
    const child = this.child;
    if (!child) return;
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => child.kill('SIGKILL'), 2_000);
      timeout.unref();
      child.once('exit', () => { clearTimeout(timeout); resolve(); });
      child.kill('SIGTERM');
    });
  }

  async run(tool: string, input: any, role?: string): Promise<any> {
    this.ensure();
    const id = ++this.seq;
    const envelope: { id: number; tool: string; input: any; role?: string; context?: { previewHostUrl: string } } = { id, tool, input };
    if (role) envelope.role = role;
    if (this.previewHostUrl) envelope.context = { previewHostUrl: this.previewHostUrl };
    const payload = JSON.stringify(envelope) + '\n';
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child!.stdin.write(payload, 'utf8');
    });
  }
}


function isJsonContentType(header: unknown): boolean {
  if (typeof header !== 'string') return false;
  const [mediaType] = header.split(';', 1);
  return mediaType.trim().toLowerCase() === 'application/json';
}

function ensureJsonContentType(request: FastifyRequest, reply: FastifyReply): boolean {
  if (request.method !== 'POST') return true;
  const header = request.headers['content-type'];
  if (isJsonContentType(Array.isArray(header) ? header[0] : header)) return true;
  sendError(reply, 415, 'VALIDATION_ERROR', 'application/json body required.', {
    details: { reason: 'UNSUPPORTED_MEDIA_TYPE' },
  });
  return false;
}

function ensureAuthToken(request: FastifyRequest, reply: FastifyReply): boolean {
  const expected = bridgeConfig.auth.token;
  if (!expected) return true;
  const value = request.headers[lowerCaseHeaders.auth];
  const provided = Array.isArray(value) ? value[0] : value;
  if (!provided) {
    sendError(reply, 401, 'POLICY_DENIED', 'Bridge token required to run tools.', {
      details: { reason: 'MISSING_TOKEN', header: bridgeConfig.auth.header, docs: POLICY_UX_DOC },
    });
    return false;
  }
  if (provided !== expected) {
    sendError(reply, 401, 'POLICY_DENIED', 'Bridge token rejected.', {
      details: { reason: 'INVALID_TOKEN', docs: POLICY_UX_DOC },
    });
    return false;
  }
  return true;
}

type ApprovalState = 'missing' | 'granted' | 'denied' | 'invalid';

function resolveApprovalState(request: FastifyRequest): ApprovalState {
  const header = request.headers[lowerCaseHeaders.approval];
  const values = Array.isArray(header) ? header : header ? [header] : [];
  if (!values.length) return 'missing';
  let sawUnrecognized = false;
  for (const candidate of values) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    const normalized = trimmed.toLowerCase();
    if (approvalTokenSets.granted.size === 0) {
      return 'granted';
    }
    if (approvalTokenSets.granted.has(normalized)) {
      return 'granted';
    }
    if (approvalTokenSets.denied.has(normalized)) {
      return 'denied';
    }
    sawUnrecognized = true;
  }
  return sawUnrecognized ? 'invalid' : 'missing';
}

async function main() {
  const fastify = Fastify({ logger: false });
  // First, before any route: a request naming another site's host is a rebinding page, not a client (s211-m01).
  refuseForeignHosts(fastify);

  await fastify.register(rateLimit, rateLimitOptions);

  fastify.addHook('onRoute', (routeOptions) => {
    if (routeOptions.url?.startsWith('/artifacts')) {
      routeOptions.config = {
        ...(routeOptions.config ?? {}),
        rateLimit: bridgeConfig.rateLimit.artifacts,
      };
    }
  });

  await fastify.register(cors, {
    origin: bridgeConfig.cors.origin,
    methods: [...bridgeConfig.cors.methods],
    allowedHeaders: [...bridgeConfig.cors.allowHeaders],
    exposedHeaders: [...bridgeConfig.cors.exposeHeaders],
    credentials: bridgeConfig.cors.credentials,
    maxAge: bridgeConfig.cors.maxAgeSeconds,
  });

  const bridgePort = Number(process.env.MCP_BRIDGE_PORT || 4466);
  // Resolve MCP server cwd relative to this file location (works in dev and dist)
  const resolvedServerDir = fileURLToPath(new URL('../../mcp-server/', import.meta.url));
  const mcpServerCwd = resolvedServerDir;
  const toolSurface = resolveBridgeToolSurface(mcpServerCwd, bridgeConfig.tools.allowed, process.env);
  const {
    externalToInternal: EXTERNAL_TO_INTERNAL,
    internalToExternal: INTERNAL_TO_EXTERNAL,
    allowedExternalTools: ALLOWED_EXTERNAL_TOOLS,
  } = buildToolNameMaps(toolSurface.enabled);
  const client = new McpClient(mcpServerCwd);
  const { artifactsRoot, artifactsBase } = resolveBridgeArtifacts(mcpServerCwd);
  fastify.addHook('onClose', () => client.close());
  const registrySource = path.relative(mcpServerCwd, toolSurface.registrySource).split(path.sep).join('/');

  if (toolSurface.unknownExtras.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(`[mcp-bridge] unknown MCP_EXTRA_TOOLS entries ignored: ${toolSurface.unknownExtras.join(', ')}`);
  }

  await fastify.register(fastifyStatic, {
    root: artifactsRoot,
    prefix: '/artifacts/',
    index: false,
    list: false,
    decorateReply: false,
  });

  // The running-app preview: composition versions design.compose writes beside the saved-schema
  // store are compiled at request time and served with the prebuilt host runtimes under /preview/.
  const compositionsDir = resolveCompositionsDir(mcpServerCwd);
  const shippedTokens = resolveTokenPackageRoot(mcpServerCwd);
  // s213-m06: the preview follows the server to a team's token build when one becomes active.
  await registerPreviewHost(fastify, { compositionsDir, tokensRoot: () => activeTokenPackageRoot(shippedTokens), runTool: (tool, input) => client.run(tool, input) });

  await registerArtifactEndpoints(fastify, artifactsRoot, {
    list: bridgeConfig.rateLimit.artifacts,
    detail: bridgeConfig.rateLimit.artifacts,
    files: bridgeConfig.rateLimit.artifacts,
    open: bridgeConfig.rateLimit.artifacts,
  }, artifactsBase);

  registerBridgeHealth(fastify, {
    mode: toolSurface.toolsetMode,
    enabledCount: toolSurface.enabled.length,
    registrySource,
  });

  fastify.get('/tools', { config: { rateLimit: bridgeConfig.rateLimit.tools } }, async () => ({
    tools: Array.from(ALLOWED_EXTERNAL_TOOLS),
    toolset: {
      mode: toolSurface.toolsetMode,
      enabledInternal: toolSurface.enabled,
      extras: toolSurface.extraTools,
      unknownExtras: toolSurface.unknownExtras,
      registrySource,
    },
  }));

  fastify.post<{ Body: RunRequestBody }>('/run', { config: { rateLimit: bridgeConfig.rateLimit.run } }, async (request, reply) => {
    if (!ensureJsonContentType(request, reply)) return;
    if (!ensureAuthToken(request, reply)) return;

    const body = request.body ?? {};
    const externalTool = body.tool;
    if (!externalTool || typeof externalTool !== 'string') {
      sendError(reply, 400, 'VALIDATION_ERROR', 'Tool name is required.', {
        details: { reason: 'MISSING_TOOL' },
      });
      return;
    }
    // Accept both external (underscore) and internal (dot) names for backward compatibility
    const internalTool = resolveInternalToolName(externalTool, EXTERNAL_TO_INTERNAL);
    if (!internalTool) {
      sendError(reply, 403, 'POLICY_DENIED', `Tool not allowed: ${externalTool}`, {
        details: { reason: 'FORBIDDEN_TOOL', tool: externalTool, docs: POLICY_RULES_DOC },
      });
      return;
    }
    const tool = internalTool; // Use internal name for all downstream operations
    const aliasWarning = legacyToolWarning(externalTool, internalTool);

    const input = { ...(body.input ?? {}) };
    const role = typeof body.role === 'string' && body.role.trim().length ? body.role.trim() : undefined;
    const applyRequested = input.apply === true;
    let approvalState: ApprovalState = 'missing';

    if (applyRequested) {
      if (!APPLY_CAPABLE_TOOLS.has(tool)) {
        sendError(reply, 403, 'POLICY_DENIED', `Tool ${tool} only supports dry-run mode via the bridge.`, {
          details: { reason: 'APPLY_FORBIDDEN', tool, docs: POLICY_UX_DOC },
        });
        return;
      }
      approvalState = resolveApprovalState(request);
      if (approvalState === 'denied') {
        sendError(reply, 403, 'POLICY_DENIED', `Apply request for ${tool} was denied.`, {
          details: { reason: 'APPROVAL_DENIED', tool, docs: POLICY_UX_DOC },
        });
        return;
      }
      if (approvalState === 'invalid') {
        sendError(reply, 403, 'POLICY_DENIED', 'Approval token was not recognized.', {
          details: { reason: 'INVALID_APPROVAL_TOKEN', tool, docs: POLICY_UX_DOC },
        });
        return;
      }
      if (APPROVAL_REQUIRED_TOOLS.has(tool) && approvalState !== 'granted') {
        sendError(reply, 403, 'POLICY_DENIED', `Approval token required to apply ${tool}.`, {
          details: { reason: 'READ_ONLY_ENFORCED', tool, docs: POLICY_UX_DOC },
        });
        return;
      }
    }

    const applyMode = applyRequested && (!APPROVAL_REQUIRED_TOOLS.has(tool) || approvalState === 'granted');
    // Normalize an explicit flag only. Families such as object and brand.intake have
    // write-capable actions whose schemas do not accept apply; omitted flags use native defaults.
    if (APPLY_CAPABLE_TOOLS.has(tool) && Object.hasOwn(input, 'apply')) {
      input.apply = applyMode;
    }

    try {
      const result = await client.run(tool, input, role);
      const incidentId =
        typeof result?.incidentId === 'string' && result.incidentId.length > 0 ? result.incidentId : randomUUID();
      const normalized = {
        ok: true as const,
        tool: INTERNAL_TO_EXTERNAL.get(tool) ?? tool, // Return external name in response
        role: role ?? null,
        mode: applyMode ? 'apply' : 'dry-run',
        incidentId,
        artifacts: result?.artifacts ?? [],
        transcriptPath: result?.transcriptPath ?? null,
        bundleIndexPath: result?.bundleIndexPath ?? null,
        diagnosticsPath: result?.diagnosticsPath ?? null,
        preview: result?.preview ?? null,
        artifactsDetail: result?.artifactsDetail ?? null,
        result: result ?? null,
        ...(aliasWarning ? { warnings: [aliasWarning] } : {}),
      };
      return normalized;
    } catch (err: any) {
      const normalizedCode = normalizeRunErrorCode(err?.code);
      const inferredStatus =
        typeof err?.status === 'number'
          ? err.status
          : typeof err?.statusCode === 'number'
          ? err.statusCode
          : undefined;
      const status = inferredStatus ?? statusForCode(normalizedCode);
      const message = typeof err?.message === 'string' && err.message.length ? err.message : 'Failed to run tool.';
      const details = err?.details ?? err?.messages;
      return reply.code(status).send({
        ...buildErrorPayload(normalizedCode, message, {
          details,
          incidentId: typeof err?.incidentId === 'string' ? err.incidentId : undefined,
        }),
        ...(aliasWarning ? { warnings: [aliasWarning] } : {}),
      });
    }
  });

  // A taken default port falls back to a free one; a port chosen with MCP_BRIDGE_PORT is refused plainly (s206-m03).
  const actualPort = await listenOnLoopback(fastify, {
    port: bridgePort,
    ...(process.env.MCP_BRIDGE_PORT ? { chosenBy: `MCP_BRIDGE_PORT=${process.env.MCP_BRIDGE_PORT}` } : {}),
    // eslint-disable-next-line no-console
    note: (line) => console.log(`[mcp-bridge] ${line} (set MCP_BRIDGE_PORT to choose one)`),
  });
  client.previewHostUrl = `http://127.0.0.1:${actualPort}`;
  // eslint-disable-next-line no-console
  console.log(`[mcp-bridge] listening on :${actualPort}`);
  const stop = () => {
    fastify.close().then(() => process.exit(0)).catch((error) => {
      console.error('[mcp-bridge] shutdown failed', error);
      process.exit(1);
    });
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  if (err instanceof PortInUseError) console.error(`[mcp-bridge] ${err.message}`);
  // eslint-disable-next-line no-console
  else console.error('[mcp-bridge] fatal', err);
  process.exit(1);
});
