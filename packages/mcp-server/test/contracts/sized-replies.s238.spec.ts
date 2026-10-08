import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as codegen } from '../../src/tools/code.generate.js';
import { handle as render } from '../../src/tools/repl.render.js';
import { handle as pipeline } from '../../src/tools/pipeline.js';
import { handle as fetchData } from '../../src/tools/structuredData.fetch.js';
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
    // s239: the site's 0.10.1 report found this path wrote files without saying so.
    expect(sized.warnings?.map(warning => warning.code)).toEqual(['OODS-W004']);
    expect(sized.payload?.files.some(file => file.path === 'render/index.html')).toBe(true);
    expect(sized.payload?.files.some(file => file.path === 'code/artifact.json')).toBe(true);
    expect(sized.code?.artifact).toBeUndefined();
    expect(size(sized)).toBeLessThan(50_000);
    const inline = await pipeline({ object: 'Subscription', context: 'list', framework: 'react', options: { payloadMode: 'inline' } } as never, client);
    expect(inline.code?.artifact).toBeTruthy();
    expect(inline.payload).toBeUndefined();
    expect(inline.warnings).toBeUndefined();
  });

  // s239 (#2743): the components export is about 1.1 million characters (roughly 278,000 tokens) with no other way to narrow it.
  it('structured_data_fetch writes an oversized export to a file, says why, and leaves direct and inline calls whole', async () => {
    const sized = await fetchData({ dataset: 'components' }, client);
    expect(sized.payload).toBeUndefined();
    expect(sized.payloadIncluded).toBe(false);
    expect(sized.payloadFile?.files.map(file => file.path)).toEqual(['components.json']);
    expect(sized.payloadFile!.bytes).toBeGreaterThan(INLINE_PAYLOAD_LIMIT);
    expect(JSON.parse(fs.readFileSync(path.join(sized.payloadFile!.directory, 'components.json'), 'utf8')).components.length).toBeGreaterThan(0);
    expect(sized.warnings?.some(warning => warning.includes('payloadMode'))).toBe(true);
    expect(size(sized)).toBeLessThan(10_000);
    const inline = await fetchData({ dataset: 'components', payloadMode: 'inline' }, client);
    expect(inline.payload).toBeTruthy();
    const direct = await fetchData({ dataset: 'components' });
    expect(direct.payload).toBeTruthy();
    expect(direct.payloadFile).toBeUndefined();
  });
});
