import './load-env.js';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { getAjv } from './lib/ajv.js';
import { ERROR_CODES, err, formatValidationErrors, type TypedError } from './security/errors.js';
import { formatSchemaInputError } from './security/schema-errors.js';
import { isAllowed, tryAcquireSlot, releaseSlot, tryConsumeToken, timeoutMsFor } from './security/policy.js';
import { resolveToolRegistry } from './tools/registry.js';
import { isToolError, ToolError } from './errors/tool-error.js';
import { LEGACY_CODE_MAP } from './errors/registry.js';
import { readToolContext, type ToolContext } from './lib/tool-context.js';
import { initTelemetry, shutdownTelemetry, startToolSpan, recordSpanError, recordAjvFailure } from './telemetry/otel.js';
import { prepareUserBrands } from './lib/user-brands.js';
import { refreshTokenBundle } from './lib/token-build.js';
import { warmEChartsRenderWorker } from '@oods/viz-render';

type ResponseMeta = { requestId: string; latency: number; timestamp: string };
function buildMeta(requestId: string, startMs: number): ResponseMeta {
  return { requestId, latency: Math.max(0, Date.now() - startMs), timestamp: new Date().toISOString() };
}

// Tool registry
const tools: Record<string, { handle: (input: any, context?: ToolContext) => Promise<any>; inputSchema: object; outputSchema: object }> = {};

function register(
  name: string,
  mod: { handle: (input: any, context?: ToolContext) => Promise<any> },
  inputSchema: object,
  outputSchema: object
) {
  tools[name] = { handle: mod.handle, inputSchema, outputSchema };
}

type ToolSpec = { modulePath: string; inputSchema: string; outputSchema: string };

const toolSpecs: Record<string, ToolSpec> = {
  'tokens.build': {
    modulePath: './tools/tokens.build.js',
    inputSchema: './schemas/tokens.build.input.json',
    outputSchema: './schemas/generic.output.json',
  },
  'structuredData.fetch': {
    modulePath: './tools/structuredData.fetch.js',
    inputSchema: './schemas/structuredData.fetch.input.json',
    outputSchema: './schemas/structuredData.fetch.output.json',
  },
  'brand.apply': {
    modulePath: './tools/brand.apply.js',
    inputSchema: './schemas/brand.apply.input.json',
    outputSchema: './schemas/brand.apply.output.json',
  },
  'brand.intake': {
    modulePath: './tools/brand.intake.js',
    inputSchema: './schemas/brand.intake.input.json',
    outputSchema: './schemas/brand.intake.output.json',
  },
  'a11y.scan': {
    modulePath: './tools/a11y.scan.js',
    inputSchema: './schemas/a11y.scan.input.json',
    outputSchema: './schemas/generic.output.json',
  },
  'catalog.list': {
    modulePath: './tools/catalog.list.js',
    inputSchema: './schemas/catalog.list.input.json',
    outputSchema: './schemas/catalog.list.output.json',
  },
  'code.generate': {
    modulePath: './tools/code.generate.js',
    inputSchema: './schemas/code.generate.input.json',
    outputSchema: './schemas/code.generate.output.json',
  },
  'design.compose': {
    modulePath: './tools/design.compose.js',
    inputSchema: './schemas/design.compose.input.json',
    outputSchema: './schemas/design.compose.output.json',
  },
  'pipeline': {
    modulePath: './tools/pipeline.js',
    inputSchema: './schemas/pipeline.input.json',
    outputSchema: './schemas/pipeline.output.json',
  },
  'health': {
    modulePath: './tools/health.js',
    inputSchema: './schemas/health.input.json',
    outputSchema: './schemas/health.output.json',
  },
  'registry.snapshot': {
    modulePath: './tools/registry.snapshot.js',
    inputSchema: './schemas/registry.snapshot.input.json',
    outputSchema: './schemas/registry.snapshot.output.json',
  },
  'viz.render': {
    modulePath: './tools/viz.render.js',
    inputSchema: './schemas/viz.render.input.json',
    outputSchema: './schemas/viz.render.output.json',
  },
  'dashboard.render': {
    modulePath: './tools/dashboard.render.js',
    inputSchema: './schemas/dashboard.render.input.json',
    outputSchema: './schemas/dashboard.render.output.json',
  },
  'artifact.certify': {
    modulePath: './tools/artifact.certify.js',
    inputSchema: './schemas/artifact.certify.input.json',
    outputSchema: './schemas/artifact.certify.output.json',
  },
  'design.preview': {
    modulePath: './tools/design.preview.js',
    inputSchema: './schemas/design.preview.input.json',
    outputSchema: './schemas/design.preview.output.json',
  },
  'fidelity.preview': {
    modulePath: './tools/fidelity.preview.js',
    inputSchema: './schemas/fidelity.preview.input.json',
    outputSchema: './schemas/fidelity.preview.output.json',
  },
  // --- Grouped action-parameter tools (s107-m01/m01b). Each delegates to the
  //     retained per-action handler modules via a thin `action` switch; the
  //     grouped input schema reproduces every per-action body under an
  //     `action` discriminator, the output schema is an anyOf union. The
  //     per-action tool *registrations* were removed in m01b (surface cut
  //     27→16); the handler modules, their schemas, and their tests stay. ---
  'map': {
    modulePath: './tools/map.js',
    inputSchema: './schemas/map.input.json',
    outputSchema: './schemas/map.output.json',
  },
  'schema': {
    modulePath: './tools/schema/index.js',
    inputSchema: './schemas/schema.input.json',
    outputSchema: './schemas/schema.output.json',
  },
  'object': {
    modulePath: './tools/object.js',
    inputSchema: './schemas/object.input.json',
    outputSchema: './schemas/object.output.json',
  },
  'repl': {
    modulePath: './tools/repl.js',
    inputSchema: './schemas/repl.input.json',
    outputSchema: './schemas/repl.output.json',
  },
};

const schemaCache = new Map<string, object>();
function readSchema(relativePath: string): object {
  const cached = schemaCache.get(relativePath);
  if (cached) return cached;
  const schema = JSON.parse(fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as object;
  schemaCache.set(relativePath, schema);
  return schema;
}

const registry = resolveToolRegistry();
if (registry.unknownExtras.length > 0) {
  // eslint-disable-next-line no-console
  console.warn(`[mcp] unknown MCP_EXTRA_TOOLS entries ignored: ${registry.unknownExtras.join(', ')}`);
}

for (const name of registry.enabled) {
  const spec = toolSpecs[name];
  if (!spec) {
    // eslint-disable-next-line no-console
    console.warn(`[mcp] tool '${name}' missing from toolSpecs registry`);
    continue;
  }
  register(name, await import(spec.modulePath), readSchema(spec.inputSchema), readSchema(spec.outputSchema));
}

// Validator
const ajv = getAjv();

// Health/debug server (optional)
const fastify = Fastify({ logger: false });
fastify.get('/health', async () => ({ status: 'ok', tools: Object.keys(tools) }));

async function startHealthServer() {
  const port = Number(process.env.MCP_HEALTH_PORT || 0);
  if (!port) return;
  try {
    await fastify.listen({ port, host: '127.0.0.1' });
    // eslint-disable-next-line no-console
    console.log(`[mcp] health server on :${port}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[mcp] health server failed', err);
  }
}

// Minimal stdio loop: each line is a JSON object { id, tool, input }
async function stdioLoop() {
  process.stdin.setEncoding('utf8');
  let buffer = '';
  process.stdin.on('data', async (chunk: string) => {
    buffer += chunk;
    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      let messageId: string | number | undefined;
      const requestId = randomUUID();
      const startMs = Date.now();
      try {
        const msg = JSON.parse(line);
        const { id, tool, input, role: roleRaw, context: rawContext } = msg as { id?: string | number; tool: string; input: unknown; role?: string; context?: unknown };
        const toolContext = readToolContext(rawContext);
        messageId = id;
        if (!tool || !tools[tool]) {
          process.stdout.write(JSON.stringify({ id, error: { ...err(ERROR_CODES.UNKNOWN_TOOL, `Unknown tool: ${tool}`), code: LEGACY_CODE_MAP.UNKNOWN_TOOL }, meta: buildMeta(requestId, startMs) }) + '\n');
          continue;
        }
        const role = String(roleRaw || process.env.MCP_ROLE || 'designer');
        // Policy: allow/deny
        const allow = isAllowed(tool, role);
        if (!allow.allowed) {
          const e = { ...err(ERROR_CODES.POLICY_DENIED, `Role '${role}' not allowed for tool '${tool}'`, { tool, role, allow: allow?.rule?.allow ?? [] }), code: LEGACY_CODE_MAP.POLICY_DENIED };
          process.stdout.write(JSON.stringify({ id, error: e, meta: buildMeta(requestId, startMs) }) + '\n');
          continue;
        }
        // Rate limit token bucket
        if (!tryConsumeToken(tool)) {
          const e = { ...err(ERROR_CODES.RATE_LIMIT, `Rate limit exceeded for tool '${tool}'`, { tool }), code: LEGACY_CODE_MAP.RATE_LIMIT };
          process.stdout.write(JSON.stringify({ id, error: e, meta: buildMeta(requestId, startMs) }) + '\n');
          continue;
        }
        // Concurrency guard
        if (!tryAcquireSlot(tool)) {
          const e = { ...err(ERROR_CODES.CONCURRENCY, `Too many concurrent requests for tool '${tool}'`, { tool }), code: LEGACY_CODE_MAP.CONCURRENCY };
          process.stdout.write(JSON.stringify({ id, error: e, meta: buildMeta(requestId, startMs) }) + '\n');
          continue;
        }
        const span = startToolSpan({ toolName: tool, role, requestId });
        try {
          const reg = tools[tool];
          const validateIn = ajv.compile(reg.inputSchema);
          if (!validateIn(input)) {
            const formatted = formatSchemaInputError(tool, validateIn.errors as any, input);
            recordAjvFailure(span, 'input', Array.isArray(validateIn.errors) ? validateIn.errors.length : 1);
            const details: Record<string, unknown> = { errors: formatted.details };
            if (formatted.hint) details.hint = formatted.hint;
            if (formatted.expected) details.expected = formatted.expected;
            const e = { ...err(ERROR_CODES.SCHEMA_INPUT, formatted.message, details), code: LEGACY_CODE_MAP.SCHEMA_INPUT };
            process.stdout.write(JSON.stringify({ id, error: e, meta: buildMeta(requestId, startMs) }) + '\n');
            continue;
          }
          const timeout = timeoutMsFor(tool);
          let result: unknown;
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            result = await Promise.race([
              reg.handle(input, toolContext),
              new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new ToolError(LEGACY_CODE_MAP.TIMEOUT, `Timeout after ${timeout}ms`, { timeoutMs: timeout })), timeout); })
            ]);
          } catch (handlerErr) {
            recordSpanError(span, handlerErr, isToolError(handlerErr) ? handlerErr.opiCode : (handlerErr as { code?: string })?.code);
            throw handlerErr;
          } finally {
            clearTimeout(timer);
          }
          const validateOut = ajv.compile(reg.outputSchema);
          if (!validateOut(result)) {
            const formatted = formatValidationErrors(validateOut.errors as any, { prefix: 'Output validation failed' });
            recordAjvFailure(span, 'output', Array.isArray(validateOut.errors) ? validateOut.errors.length : 1);
            const e = { ...err(ERROR_CODES.SCHEMA_OUTPUT, formatted.message, { errors: formatted.details }), code: LEGACY_CODE_MAP.SCHEMA_OUTPUT };
            process.stdout.write(JSON.stringify({ id, error: e, meta: buildMeta(requestId, startMs) }) + '\n');
            continue;
          }
          process.stdout.write(JSON.stringify({ id, result, meta: buildMeta(requestId, startMs) }) + '\n');
        } finally {
          span.end();
          releaseSlot(tool);
        }
      } catch (e: any) {
        const se = (isToolError(e) ? e : new ToolError(LEGACY_CODE_MAP.BAD_REQUEST, String(e?.message || e))).toStructured();
        const te: TypedError = { code: se.code, message: se.message, details: { category: se.category, retryable: se.retryable, ...(se.details != null ? { context: se.details } : {}) }, incidentId: se.incidentId };
        const payload: { id?: string | number; error: TypedError; meta: ResponseMeta } = { error: te, meta: buildMeta(requestId, startMs) };
        if (messageId !== undefined) {
          payload.id = messageId;
        }
        process.stdout.write(JSON.stringify(payload) + '\n');
      }
    }
  });
}

const telemetryInit = await initTelemetry();
if (telemetryInit.enabled) {
  // eslint-disable-next-line no-console
  console.error(`[mcp] OTLP telemetry enabled → ${telemetryInit.endpoint}`);
}

let shuttingDown = false;
async function gracefulShutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  await shutdownTelemetry();
}
const requestShutdown = () => {
  if (shuttingDown) return;
  void gracefulShutdown().then(() => process.exit(0));
};
process.on('SIGTERM', requestShutdown);
process.on('SIGINT', requestShutdown);
// The adapter can be SIGKILLed: its child receives EOF, not a forwarded signal.
process.stdin.once('end', requestShutdown);
process.stdin.once('close', requestShutdown);

// s213-m06: a team's brands (OODS_BRANDS_DIR) are brought up to date with their folder and this runtime's token kit
// before the first request, and every tool then reads the build that holds them.
const teamBrands = await prepareUserBrands();
if (teamBrands.action !== 'none') {
  await refreshTokenBundle();
  // eslint-disable-next-line no-console
  console.error(`[mcp] team brands: ${teamBrands.action}${teamBrands.reason ? ` (${teamBrands.reason})` : ''}${teamBrands.error ? `: ${teamBrands.error}` : ''}`);
}

// A cold ECharts import cannot consume the first chart tool's timeout. Failure stops startup explicitly.
await warmEChartsRenderWorker();
await Promise.all([startHealthServer(), stdioLoop()]);
