import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as codegen } from '../../src/tools/code.generate.js';
import { handle as render } from '../../src/tools/repl.render.js';
import { handle as pipeline } from '../../src/tools/pipeline.js';
import { INLINE_PAYLOAD_LIMIT } from '../../src/lib/payload-store.js';

// A Subscription detail screen came back as about 409,000 characters from code_generate, 680,000 from schema_render
// and 245,000 from pipeline_run, more than Claude clients take in one reply (~150,000 characters for connectors;
// Claude Code files anything over 50,000). A reply to a client now writes such output to files unless the caller
// asked for it inline; a direct handler call (another tool, a test) is unchanged.

const size = (value: unknown) => JSON.stringify(value, null, 2).length;
const client = { sizedReply: true };
let store: string; const prior = process.env.MCP_SCHEMA_STORE_ROOT;
beforeAll(() => { store = fs.mkdtempSync(path.join(os.tmpdir(), 'sized-replies-')); process.env.MCP_SCHEMA_STORE_ROOT = store; });
afterAll(() => { if (prior === undefined) delete process.env.MCP_SCHEMA_STORE_ROOT; else process.env.MCP_SCHEMA_STORE_ROOT = prior; fs.rmSync(store, { recursive: true, force: true }); });

describe('replies to a client fit in one reply', () => {
  it('code_generate writes an oversized artifact to files, says why, and still honours an explicit inline', async () => {
    const { schemaRef } = await compose({ object: 'Subscription', context: 'detail' } as never) as { schemaRef: string };
    const sized = await codegen({ schemaRef, framework: 'react' } as never, client);
    expect(sized.payload?.files.some(file => file.path === 'src/GeneratedUI.tsx')).toBe(true);
    expect(sized.warnings.map(warning => warning.code)).toContain('OODS-W004');
    expect(size(sized)).toBeLessThan(INLINE_PAYLOAD_LIMIT / 2);
    const inline = await codegen({ schemaRef, framework: 'react', options: { payloadMode: 'inline' } } as never, client);
    expect(inline.artifact?.files.length).toBeGreaterThan(1);
    const direct = await codegen({ schemaRef, framework: 'react' } as never);
    expect(direct.artifact?.files.length).toBeGreaterThan(1);
    expect(direct.payload).toBeUndefined();
  });

  it('schema_render writes a rendered document over the limit to a file', async () => {
    const { schemaRef } = await compose({ object: 'Subscription', context: 'detail' } as never) as { schemaRef: string };
    const sized = await render({ action: 'render', schemaRef, apply: true } as never, client);
    expect(sized.html).toBeUndefined();
    expect(sized.payload?.files.map(file => file.path)).toEqual(['index.html']);
    expect(sized.warnings.map(warning => warning.code)).toContain('OODS-W004');
    expect(size(sized)).toBeLessThan(50_000);
  });

  it('pipeline_run lists the page and the generated files instead of carrying them, unless asked for inline', async () => {
    const sized = await pipeline({ object: 'Subscription', context: 'list', framework: 'react' } as never, client);
    expect(sized.error).toBeUndefined();
    expect(sized.payload?.files.some(file => file.path === 'render/index.html')).toBe(true);
    expect(sized.payload?.files.some(file => file.path === 'code/artifact.json')).toBe(true);
    expect(sized.code?.artifact).toBeUndefined();
    expect(size(sized)).toBeLessThan(50_000);
    const inline = await pipeline({ object: 'Subscription', context: 'list', framework: 'react', options: { payloadMode: 'inline' } } as never, client);
    expect(inline.code?.artifact).toBeTruthy();
    expect(inline.payload).toBeUndefined();
  });
});
