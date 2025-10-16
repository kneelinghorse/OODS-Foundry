import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { bridgeConfig, lowerCaseHeaders } from './config.js';
import { registerArtifactEndpoints } from './endpoints/artifacts.js';
import { buildErrorPayload, normalizeRunErrorCode, sendError, statusForCode } from './middleware/errors.js';

const ALLOWED_TOOLS = new Set(bridgeConfig.tools.allowed);
const WRITE_GATED_TOOLS = new Set(bridgeConfig.tools.writeGated);

type RunRequestBody = {
  tool?: string;
  input?: Record<string, any>;
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

  async run(tool: string, input: any): Promise<any> {
    this.ensure();
    const id = ++this.seq;
    const payload = JSON.stringify({ id, tool, input }) + '\n';
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
      details: { reason: 'MISSING_TOKEN', header: bridgeConfig.auth.header },
    });
    return false;
  }
  if (provided !== expected) {
    sendError(reply, 401, 'POLICY_DENIED', 'Bridge token rejected.', {
      details: { reason: 'INVALID_TOKEN' },
    });
    return false;
  }
  return true;
}

function hasApprovalToken(request: FastifyRequest): boolean {
  const value = request.headers[lowerCaseHeaders.approval];
  if (Array.isArray(value)) return value.some((item) => typeof item === 'string' && item.trim().length > 0);
  return typeof value === 'string' && value.trim().length > 0;
}

async function main() {
  const fastify = Fastify({ logger: false });

  await fastify.register(rateLimit, {
    global: false,
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    errorResponseBuilder: (_request, context) =>
      buildErrorPayload('RATE_LIMITED', 'Too many requests - please slow down.', {
        details: {
          limit: context.max,
          resetInSeconds: Math.ceil(context.ttl / 1000),
        },
      }),
  });

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
  const client = new McpClient(mcpServerCwd);
  const artifactsRoot = path.join(mcpServerCwd, 'artifacts');

  await fastify.register(fastifyStatic, {
    root: artifactsRoot,
    prefix: '/artifacts/',
    index: false,
    list: false,
    decorateReply: false,
  });

  await registerArtifactEndpoints(fastify, artifactsRoot, {
    list: bridgeConfig.rateLimit.artifacts,
    detail: bridgeConfig.rateLimit.artifacts,
    files: bridgeConfig.rateLimit.artifacts,
    open: bridgeConfig.rateLimit.artifacts,
  });

  fastify.get('/health', async () => ({ status: 'ok', bridge: 'ready' }));

  fastify.get('/tools', { config: { rateLimit: bridgeConfig.rateLimit.tools } }, async () => ({
    tools: Array.from(ALLOWED_TOOLS),
  }));

  fastify.post<{ Body: RunRequestBody }>('/run', { config: { rateLimit: bridgeConfig.rateLimit.run } }, async (request, reply) => {
    if (!ensureJsonContentType(request, reply)) return;
    if (!ensureAuthToken(request, reply)) return;

    const body = request.body ?? {};
    const tool = body.tool;
    if (!tool || typeof tool !== 'string') {
      sendError(reply, 400, 'VALIDATION_ERROR', 'Tool name is required.', {
        details: { reason: 'MISSING_TOOL' },
      });
      return;
    }
    if (!ALLOWED_TOOLS.has(tool)) {
      sendError(reply, 403, 'POLICY_DENIED', `Tool not allowed: ${tool}`, {
        details: { reason: 'FORBIDDEN_TOOL', tool },
      });
      return;
    }

    const input = { ...(body.input ?? {}) };
    const applyRequested = input.apply === true;

    if (applyRequested && !WRITE_GATED_TOOLS.has(tool)) {
      sendError(reply, 403, 'POLICY_DENIED', `Tool ${tool} cannot apply changes via the bridge.`, {
        details: { reason: 'READ_ONLY_TOOL', tool },
      });
      return;
    }

    const approvalGranted = applyRequested && hasApprovalToken(request);
    if (applyRequested && WRITE_GATED_TOOLS.has(tool) && !approvalGranted) {
      sendError(reply, 403, 'POLICY_DENIED', 'Approval token required to apply changes.', {
        details: { reason: 'READ_ONLY_ENFORCED', tool },
      });
      return;
    }

    if (!approvalGranted) {
      input.apply = false;
    }

    try {
      const result = await client.run(tool, input);
      const normalized = {
        ok: true as const,
        tool,
        artifacts: result?.artifacts ?? [],
        transcriptPath: result?.transcriptPath ?? null,
        bundleIndexPath: result?.bundleIndexPath ?? null,
        diagnosticsPath: result?.diagnosticsPath ?? null,
        preview: result?.preview ?? null,
        artifactsDetail: result?.artifactsDetail ?? null,
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
      return sendError(reply, status, normalizedCode, message, {
        details,
        incidentId: typeof err?.incidentId === 'string' ? err.incidentId : undefined,
      });
    }
  });

  async function listenWithFallback() {
    try {
      await fastify.listen({ port: bridgePort, host: '127.0.0.1' });
    } catch (err: any) {
      if (err?.code === 'EADDRINUSE' && !process.env.MCP_BRIDGE_PORT) {
        // If default port is busy and no explicit port set, pick ephemeral
        await fastify.listen({ port: 0, host: '127.0.0.1' });
      } else {
        throw err;
      }
    }
    const addr = fastify.server.address();
    const actualPort = typeof addr === 'object' && addr ? (addr as any).port : bridgePort;
    // eslint-disable-next-line no-console
    console.log(`[mcp-bridge] listening on :${actualPort}`);
  }

  await listenWithFallback();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[mcp-bridge] fatal', err);
  process.exit(1);
});
