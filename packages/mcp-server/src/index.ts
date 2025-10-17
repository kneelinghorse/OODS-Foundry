import fs from 'node:fs';
import Fastify from 'fastify';
import { getAjv } from './lib/ajv.js';
import { ERROR_CODES, err, type TypedError } from './security/errors.js';
import { isAllowed, tryAcquireSlot, releaseSlot, tryConsumeToken, timeoutMsFor } from './security/policy.js';
import {
  createCommandId,
  createCorrelationId,
  withTelemetryContext,
  logRunStarted,
  logRunCompleted,
  logRunFailed,
} from './telemetry/log.js';

type JsonSchema = Record<string, unknown>;

type RegisteredTool = {
  handle: (input: unknown) => Promise<unknown>;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
};

const tools: Record<string, RegisteredTool> = {};

function register<Input, Output>(
  name: string,
  mod: { handle: (input: Input) => Promise<Output> },
  inputSchema: JsonSchema,
  outputSchema: JsonSchema
): void {
  tools[name] = {
    handle: mod.handle as (input: unknown) => Promise<unknown>,
    inputSchema,
    outputSchema,
  };
}

// Register tools
register(
  'tokens.build',
  await import('./tools/tokens.build.js'),
  JSON.parse(fs.readFileSync(new URL('./schemas/tokens.build.input.json', import.meta.url), 'utf8')) as JsonSchema,
  JSON.parse(fs.readFileSync(new URL('./schemas/generic.output.json', import.meta.url), 'utf8')) as JsonSchema
);

register(
  'brand.apply',
  await import('./tools/brand.apply.js'),
  JSON.parse(fs.readFileSync(new URL('./schemas/brand.apply.input.json', import.meta.url), 'utf8')) as JsonSchema,
  JSON.parse(fs.readFileSync(new URL('./schemas/brand.apply.output.json', import.meta.url), 'utf8')) as JsonSchema
);

for (const name of ['a11y.scan', 'purity.audit', 'vrt.run', 'reviewKit.create', 'diag.snapshot']) {
  const file = `${name}.js`;
  register(
    name,
    await import(`./tools/${file}`),
    JSON.parse(fs.readFileSync(new URL('./schemas/generic.input.json', import.meta.url), 'utf8')) as JsonSchema,
    JSON.parse(fs.readFileSync(new URL('./schemas/generic.output.json', import.meta.url), 'utf8')) as JsonSchema
  );
}

register(
  'release.verify',
  await import('./tools/release.verify.js'),
  JSON.parse(fs.readFileSync(new URL('./schemas/release.verify.input.json', import.meta.url), 'utf8')) as JsonSchema,
  JSON.parse(fs.readFileSync(new URL('./schemas/release.verify.output.json', import.meta.url), 'utf8')) as JsonSchema
);

register(
  'release.tag',
  await import('./tools/release.tag.js'),
  JSON.parse(fs.readFileSync(new URL('./schemas/release.tag.input.json', import.meta.url), 'utf8')) as JsonSchema,
  JSON.parse(fs.readFileSync(new URL('./schemas/release.tag.output.json', import.meta.url), 'utf8')) as JsonSchema
);

register(
  'billing.reviewKit',
  await import('./tools/billing.reviewKit.js'),
  JSON.parse(fs.readFileSync(new URL('./schemas/billing.reviewKit.input.json', import.meta.url), 'utf8')) as JsonSchema,
  JSON.parse(fs.readFileSync(new URL('./schemas/generic.output.json', import.meta.url), 'utf8')) as JsonSchema
);

register(
  'billing.switchFixtures',
  await import('./tools/billing.switchFixtures.js'),
  JSON.parse(fs.readFileSync(new URL('./schemas/billing.switchFixtures.input.json', import.meta.url), 'utf8')) as JsonSchema,
  JSON.parse(fs.readFileSync(new URL('./schemas/generic.output.json', import.meta.url), 'utf8')) as JsonSchema
);

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
async function stdioLoop(): Promise<void> {
  process.stdin.setEncoding('utf8');
  let buffer = '';
  const handleChunk = async (chunk: string) => {
    buffer += chunk;
    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      const initialCorrelation = createCorrelationId();
      const context = {
        correlationId: initialCorrelation,
        commandId: createCommandId(),
        tool: null as string | null,
        role: null as string | null,
        apply: null as boolean | null,
        startedAt: Date.now(),
      };
      await withTelemetryContext(context, async () => {
        let msg: { id?: string | number; tool?: string; input?: unknown; role?: string; correlationId?: unknown };
        let messageId: string | number | undefined;
        let toolName: string | undefined;
        const startedAt = Date.now();
        context.startedAt = startedAt;

        const respondError = (idValue: typeof messageId, error: TypedError, extra: Record<string, unknown> = {}) => {
          const durationMs = Date.now() - context.startedAt;
          logRunFailed({
            ...extra,
            errorCode: error.code,
            incidentId: error.incidentId,
            durationMs,
            exitCode: 1,
          });
          const payload: { id?: string | number; error: TypedError; telemetry: { correlationId: string; incidentId: string } } = {
            error,
            telemetry: {
              correlationId: context.correlationId,
              incidentId: error.incidentId,
            },
          };
          if (idValue !== undefined) {
            payload.id = idValue;
          }
          process.stdout.write(JSON.stringify(payload) + '\n');
        };

        const respondSuccess = (idValue: typeof messageId, result: unknown, extra: Record<string, unknown> = {}) => {
          const durationMs = Date.now() - context.startedAt;
          logRunCompleted({
            ...extra,
            durationMs,
            exitCode: 0,
            policyCode: 'ALLOWED',
          });
          const payload: { id?: string | number; result: unknown; telemetry: { correlationId: string } } = {
            result,
            telemetry: {
              correlationId: context.correlationId,
            },
          };
          if (idValue !== undefined) {
            payload.id = idValue;
          }
          process.stdout.write(JSON.stringify(payload) + '\n');
        };

        try {
          try {
            msg = JSON.parse(line);
          } catch {
            const parseError: TypedError = err(ERROR_CODES.BAD_REQUEST, 'Invalid JSON payload', {
              raw: line.slice(0, 200),
            });
            respondError(undefined, parseError, { reason: 'parse_error' });
            return;
          }

          const { id, tool, input, role: roleRaw, correlationId: providedCorrelation } = msg;
          messageId = id;
          if (typeof providedCorrelation === 'string' && providedCorrelation.trim().length > 0) {
            context.correlationId = providedCorrelation.trim();
          }
          if (typeof id === 'string' || typeof id === 'number') {
            context.commandId = String(id);
          }

          toolName = typeof tool === 'string' ? tool : undefined;
          context.tool = toolName ?? null;

          if (!toolName || !tools[toolName]) {
            const error = err(ERROR_CODES.UNKNOWN_TOOL, `Unknown tool: ${toolName ?? '<missing>'}`);
            respondError(id, error, { reason: 'unknown_tool' });
            return;
          }

          const role = String(roleRaw || process.env.MCP_ROLE || 'designer');
          context.role = role;

          const apply = Boolean((input as Record<string, unknown> | undefined)?.apply === true);
          context.apply = apply;

          logRunStarted({
            bytes: Buffer.byteLength(line, 'utf8'),
            role,
            apply,
          });

          const allow = isAllowed(toolName, role);
          if (!allow.allowed) {
            const error = err(ERROR_CODES.POLICY_DENIED, `Role '${role}' not allowed for tool '${toolName}'`, {
              tool: toolName,
              role,
              allow: allow?.rule?.allow ?? [],
            });
            respondError(id, error, {
              reason: 'policy_denied',
              policyRule: allow?.rule?.tool ?? null,
              policyCode: ERROR_CODES.POLICY_DENIED,
            });
            return;
          }

          if (!tryConsumeToken(toolName)) {
            const error = err(ERROR_CODES.RATE_LIMIT, `Rate limit exceeded for tool '${toolName}'`, { tool: toolName });
            respondError(id, error, { reason: 'rate_limit', policyCode: ERROR_CODES.RATE_LIMIT });
            return;
          }

          if (!tryAcquireSlot(toolName)) {
            const error = err(ERROR_CODES.CONCURRENCY, `Too many concurrent requests for tool '${toolName}'`, { tool: toolName });
            respondError(id, error, { reason: 'concurrency', policyCode: ERROR_CODES.CONCURRENCY });
            return;
          }

          try {
            const reg = tools[toolName]!;
            const validateIn = ajv.compile(reg.inputSchema);
            if (!validateIn(input)) {
              const error: TypedError = err(ERROR_CODES.SCHEMA_INPUT, 'Input validation failed', { errors: validateIn.errors });
              respondError(id, error, { reason: 'schema_input' });
              return;
            }

            const timeout = timeoutMsFor(toolName);
            let timeoutHandle: NodeJS.Timeout | null = null;
            const timeoutPromise = new Promise<never>((_, reject) => {
              timeoutHandle = setTimeout(() => {
                timeoutHandle = null;
                reject(err(ERROR_CODES.TIMEOUT, `Timeout after ${timeout}ms`, { timeoutMs: timeout }));
              }, timeout);
            });
            const result: unknown = await Promise.race([reg.handle(input), timeoutPromise]);
            if (timeoutHandle) {
              clearTimeout(timeoutHandle);
              timeoutHandle = null;
            }

            const validateOut = ajv.compile(reg.outputSchema);
            if (!validateOut(result)) {
              const error: TypedError = err(ERROR_CODES.SCHEMA_OUTPUT, 'Output validation failed', { errors: validateOut.errors });
              respondError(id, error, { reason: 'schema_output' });
              return;
            }

            const artifactCount =
              typeof result === 'object' &&
              result !== null &&
              Array.isArray((result as { artifacts?: unknown[] }).artifacts)
                ? ((result as { artifacts: unknown[] }).artifacts.length)
                : 0;

            respondSuccess(id, result, {
              artifacts: artifactCount,
            });
          } catch (error: unknown) {
            if (error && typeof error === 'object' && 'code' in error && 'incidentId' in error) {
              respondError(messageId, error as TypedError, { reason: 'tool_error' });
            } else {
              const errorMessage =
                error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown MCP error';
              const unexpected: TypedError = err(ERROR_CODES.BAD_REQUEST, errorMessage);
              respondError(messageId, unexpected, { reason: 'unexpected', rawError: errorMessage });
            }
          } finally {
            releaseSlot(toolName);
          }
        } catch (fatal: unknown) {
          const message = fatal instanceof Error ? fatal.message : typeof fatal === 'string' ? fatal : 'Unknown MCP fatal error';
          const fallback: TypedError = err(ERROR_CODES.BAD_REQUEST, message);
          respondError(messageId, fallback, { reason: 'fatal_handler' });
        }
      });
    }
  };

  process.stdin.on('data', handleChunk);

  await new Promise<void>((resolve) => {
    const finalize = () => {
      process.stdin.off('data', handleChunk);
      resolve();
    };
    process.stdin.once('end', finalize);
    process.stdin.once('close', finalize);
  });
}

await Promise.all([startHealthServer(), stdioLoop()]);
