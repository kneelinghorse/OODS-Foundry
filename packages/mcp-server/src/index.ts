import fs from 'node:fs';
import Fastify from 'fastify';
import {getAjv} from './lib/ajv.js';
import { ERROR_CODES, err, type TypedError } from './security/errors.js';
import { isAllowed, tryAcquireSlot, releaseSlot, tryConsumeToken, timeoutMsFor } from './security/policy.js';

// Tool registry
const tools: Record<string, { handle: (input: any) => Promise<any>; inputSchema: object; outputSchema: object }> = {};

function register(
  name: string,
  mod: { handle: (input: any) => Promise<any> },
  inputSchema: object,
  outputSchema: object
) {
  tools[name] = { handle: mod.handle, inputSchema, outputSchema };
}

// Register tools
register(
  'tokens.build',
  await import('./tools/tokens.build.js'),
  JSON.parse(fs.readFileSync(new URL('./schemas/tokens.build.input.json', import.meta.url), 'utf8')) as object,
  JSON.parse(fs.readFileSync(new URL('./schemas/generic.output.json', import.meta.url), 'utf8')) as object
);

register(
  'brand.apply',
  await import('./tools/brand.apply.js'),
  JSON.parse(fs.readFileSync(new URL('./schemas/brand.apply.input.json', import.meta.url), 'utf8')) as object,
  JSON.parse(fs.readFileSync(new URL('./schemas/brand.apply.output.json', import.meta.url), 'utf8')) as object
);

for (const name of ['a11y.scan', 'purity.audit', 'vrt.run', 'reviewKit.create', 'diag.snapshot']) {
  const file = `${name}.js`;
  register(
    name,
    await import(`./tools/${file}`),
    JSON.parse(fs.readFileSync(new URL('./schemas/generic.input.json', import.meta.url), 'utf8')) as object,
    JSON.parse(fs.readFileSync(new URL('./schemas/generic.output.json', import.meta.url), 'utf8')) as object
  );
}

register(
  'release.verify',
  await import('./tools/release.verify.js'),
  JSON.parse(fs.readFileSync(new URL('./schemas/release.verify.input.json', import.meta.url), 'utf8')) as object,
  JSON.parse(fs.readFileSync(new URL('./schemas/release.verify.output.json', import.meta.url), 'utf8')) as object
);

register(
  'release.tag',
  await import('./tools/release.tag.js'),
  JSON.parse(fs.readFileSync(new URL('./schemas/release.tag.input.json', import.meta.url), 'utf8')) as object,
  JSON.parse(fs.readFileSync(new URL('./schemas/release.tag.output.json', import.meta.url), 'utf8')) as object
);

register(
  'billing.reviewKit',
  await import('./tools/billing.reviewKit.js'),
  JSON.parse(fs.readFileSync(new URL('./schemas/billing.reviewKit.input.json', import.meta.url), 'utf8')) as object,
  JSON.parse(fs.readFileSync(new URL('./schemas/generic.output.json', import.meta.url), 'utf8')) as object
);

register(
  'billing.switchFixtures',
  await import('./tools/billing.switchFixtures.js'),
  JSON.parse(fs.readFileSync(new URL('./schemas/billing.switchFixtures.input.json', import.meta.url), 'utf8')) as object,
  JSON.parse(fs.readFileSync(new URL('./schemas/generic.output.json', import.meta.url), 'utf8')) as object
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
      try {
        const msg = JSON.parse(line);
        const { id, tool, input, role: roleRaw } = msg as { id?: string | number; tool: string; input: unknown; role?: string };
        if (!tool || !tools[tool]) {
          process.stdout.write(JSON.stringify({ id, error: err(ERROR_CODES.UNKNOWN_TOOL, `Unknown tool: ${tool}`) }) + '\n');
          continue;
        }
        const role = String(roleRaw || process.env.MCP_ROLE || 'designer');
        // Policy: allow/deny
        const allow = isAllowed(tool, role);
        if (!allow.allowed) {
          const e = err(ERROR_CODES.POLICY_DENIED, `Role '${role}' not allowed for tool '${tool}'`, { tool, role, allow: allow?.rule?.allow ?? [] });
          process.stdout.write(JSON.stringify({ id, error: e }) + '\n');
          continue;
        }
        // Rate limit token bucket
        if (!tryConsumeToken(tool)) {
          const e = err(ERROR_CODES.RATE_LIMIT, `Rate limit exceeded for tool '${tool}'`, { tool });
          process.stdout.write(JSON.stringify({ id, error: e }) + '\n');
          continue;
        }
        // Concurrency guard
        if (!tryAcquireSlot(tool)) {
          const e = err(ERROR_CODES.CONCURRENCY, `Too many concurrent requests for tool '${tool}'`, { tool });
          process.stdout.write(JSON.stringify({ id, error: e }) + '\n');
          continue;
        }
        try {
          const reg = tools[tool];
          const validateIn = ajv.compile(reg.inputSchema);
          if (!validateIn(input)) {
            const e: TypedError = err(ERROR_CODES.SCHEMA_INPUT, 'Input validation failed', { errors: validateIn.errors });
            process.stdout.write(JSON.stringify({ id, error: e }) + '\n');
            continue;
          }
          const timeout = timeoutMsFor(tool);
          const result = await Promise.race([
            reg.handle(input),
            new Promise<never>((_, reject) => setTimeout(() => reject(err(ERROR_CODES.TIMEOUT, `Timeout after ${timeout}ms`, { timeoutMs: timeout })), timeout))
          ]);
          const validateOut = ajv.compile(reg.outputSchema);
          if (!validateOut(result)) {
            const e: TypedError = err(ERROR_CODES.SCHEMA_OUTPUT, 'Output validation failed', { errors: validateOut.errors });
            process.stdout.write(JSON.stringify({ id, error: e }) + '\n');
            continue;
          }
          process.stdout.write(JSON.stringify({ id, result }) + '\n');
        } finally {
          releaseSlot(tool);
        }
      } catch (e: any) {
        const te: TypedError = err(ERROR_CODES.BAD_REQUEST, String(e?.message || e));
        process.stdout.write(JSON.stringify({ error: te }) + '\n');
      }
    }
  });
}

await Promise.all([startHealthServer(), stdioLoop()]);
