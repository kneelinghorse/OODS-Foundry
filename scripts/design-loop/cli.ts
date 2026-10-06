import fs from 'node:fs/promises';
import { serve } from './serve.js';
import { render } from './render.js';
import { diff } from './diff.js';
import { status } from './status.js';
import { DEFAULT_PORT } from './common.js';
const args = process.argv.slice(2);
const option = (name: string) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const port = Number(option('--port') ?? DEFAULT_PORT);
try {
  if (args[0] === 'serve') {
    const running = await serve({ port, state: option('--state') });
    process.stdout.write(JSON.stringify({ running: true, port, startupMs: running.startupMs }) + '\n');
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void running.close().then(() => process.exit(0)); });
  } else if (args[0] === 'render') {
    const input = JSON.parse(await fs.readFile(option('--input')!, 'utf8'));
    const result = await render({ ...input, port, ...(option('--output') ? { output: option('--output') } : {}) });
    process.stdout.write(JSON.stringify({ schemaHash: result.schemaHash, durationMs: result.durationMs, receipts: result.receipts.map(row => `${row.output}/receipt.json`) }) + '\n');
  } else if (args[0] === 'diff') {
    const result = await diff(args[1]!, args[2]!, option('--output')!);
    process.stdout.write(JSON.stringify({ differenceCount: result.differenceCount }) + '\n');
  } else if (args[0] === 'status') process.stdout.write(JSON.stringify(await status(port), null, 2) + '\n');
  else throw new Error('Usage: design:loop serve [--state DIR] | render --input JSON [--output DIR] | diff BEFORE AFTER --output DIR | status; optional --port NUMBER');
} catch (error) { process.stderr.write((error instanceof Error ? error.stack : String(error)) + '\n'); process.exitCode = 1; }
