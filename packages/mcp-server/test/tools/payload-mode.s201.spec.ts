import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getAjv } from '../../src/lib/ajv.js';
import { resolvePayloadsDir } from '../../src/lib/payload-store.js';
import { validateGeneratedArtifact } from '../../src/codegen/artifact-envelope.js';
import generateOutput from '../../src/schemas/code.generate.output.json' with { type: 'json' };
import replRenderOutput from '../../src/schemas/repl.render.output.json' with { type: 'json' };
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { handle as render } from '../../src/tools/repl.render.js';

// Sprint 201 m06 — Sprint 200 residue (#2087): large code.generate and rendered-document payloads.
// payloadMode 'file' writes the bytes beside the saved-schema store and returns references.
const sha256 = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
let storeRoot: string;
const env: Record<string, string | undefined> = {};

beforeEach(() => {
  storeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s201-payload-'));
  env.MCP_SCHEMA_STORE_ROOT = process.env.MCP_SCHEMA_STORE_ROOT;
  process.env.MCP_SCHEMA_STORE_ROOT = storeRoot;
});
afterEach(() => {
  if (env.MCP_SCHEMA_STORE_ROOT === undefined) delete process.env.MCP_SCHEMA_STORE_ROOT; else process.env.MCP_SCHEMA_STORE_ROOT = env.MCP_SCHEMA_STORE_ROOT;
  fs.rmSync(storeRoot, { recursive: true, force: true });
});

describe('code.generate payloadMode file', () => {
  it('writes the artifact files plus artifact.json beside the schema store and returns references instead of bytes', async () => {
    const composed = await compose({ object: 'Subscription', context: 'list', options: { transient: true } });
    const inline = await generate({ schema: composed.schema, framework: 'react', profile: 'build' });
    expect(inline.status).toBe('ok');
    const result = await generate({ schema: composed.schema, framework: 'react', profile: 'build', options: { payloadMode: 'file' } });
    expect(result.status).toBe('ok');
    expect(result.artifact).toBeUndefined();
    expect(result.code).toBe('');
    expect(result.payload?.mode).toBe('file');
    expect(result.payload!.directory.startsWith(resolvePayloadsDir())).toBe(true);
    expect(fs.realpathSync(result.payload!.directory)).toBe(fs.realpathSync(path.join(storeRoot, '.oods/payloads', `code.generate-${inline.artifact!.contentHash.replace(/^sha256:/, '').slice(0, 12)}`)));
    expect(JSON.stringify(result).length).toBeLessThan(JSON.stringify(inline).length / 2);
    const written = result.payload!.files.map(file => file.path).sort();
    expect(written).toEqual([...inline.artifact!.files.map(file => file.path), 'artifact.json'].sort());
    for (const ref of result.payload!.files) {
      const bytes = fs.readFileSync(path.join(result.payload!.directory, ref.path));
      expect(bytes.length).toBe(ref.bytes);
      expect(sha256(bytes)).toBe(ref.sha256);
    }
    expect(result.payload!.bytes).toBe(result.payload!.files.reduce((sum, ref) => sum + ref.bytes, 0));
    const envelope = JSON.parse(fs.readFileSync(path.join(result.payload!.directory, 'artifact.json'), 'utf8'));
    expect(validateGeneratedArtifact(envelope)).toEqual([]);
    expect(envelope.contentHash).toBe(inline.artifact!.contentHash);
    expect(fs.readFileSync(path.join(result.payload!.directory, inline.artifact!.files[0]!.path), 'utf8')).toBe(inline.artifact!.files[0]!.contents);
    const validate = getAjv().compile(generateOutput);
    expect(validate(result), JSON.stringify(validate.errors)).toBe(true);
    expect(validate(inline), JSON.stringify(validate.errors)).toBe(true);
    expect(result.validationReceipt.artifactContentHash).toBe(inline.validationReceipt.artifactContentHash);
  });

  it('reports OODS-S020 when the payload directory cannot be written', async () => {
    fs.writeFileSync(path.join(storeRoot, 'blocker'), 'not a directory');
    process.env.MCP_SCHEMA_STORE_ROOT = path.join(storeRoot, 'blocker');
    const composed = await compose({ object: 'Subscription', context: 'list', options: { transient: true } });
    const result = await generate({ schema: composed.schema, framework: 'react', profile: 'build', options: { payloadMode: 'file' } });
    expect(result.status).toBe('error');
    expect(result.errors?.[0]?.code).toBe('OODS-S020');
    expect(result.artifact).toBeUndefined();
  });
});

describe('repl.render payloadMode file', () => {
  it('writes the document as index.html and omits html from the response', async () => {
    const composed = await compose({ object: 'Subscription', context: 'detail', options: { transient: true } });
    const inline = await render({ schema: composed.schema, apply: true });
    expect(inline.status).toBe('ok');
    expect(typeof inline.html).toBe('string');
    const result = await render({ schema: composed.schema, apply: true, output: { payloadMode: 'file' } });
    expect(result.status).toBe('ok');
    expect(result.html).toBeUndefined();
    expect(result.payload?.files.map(file => file.path)).toEqual(['index.html']);
    expect(fs.readFileSync(path.join(result.payload!.directory, 'index.html'), 'utf8')).toBe(inline.html);
    expect(result.payload!.files[0]!.sha256).toBe(sha256(inline.html!));
    // The response shrinks by the document; the preview and rendered tree stay.
    expect(JSON.stringify(result).length).toBeLessThan(JSON.stringify(inline).length - inline.html!.length + 600);
    const validate = getAjv().compile(replRenderOutput);
    expect(validate(result), JSON.stringify(validate.errors)).toBe(true);
  });

  it('writes fragments.json and css.json for the fragments format', async () => {
    const composed = await compose({ object: 'Subscription', context: 'detail', options: { transient: true } });
    const inline = await render({ schema: composed.schema, apply: true, output: { format: 'fragments' } });
    expect(inline.fragments).toBeTruthy();
    const result = await render({ schema: composed.schema, apply: true, output: { format: 'fragments', payloadMode: 'file' } });
    expect(result.status).toBe('ok');
    expect(result.fragments).toBeUndefined();
    expect(result.css).toBeUndefined();
    expect(result.payload?.files.map(file => file.path)).toEqual(['fragments.json', 'css.json']);
    expect(JSON.parse(fs.readFileSync(path.join(result.payload!.directory, 'fragments.json'), 'utf8'))).toEqual(inline.fragments);
    expect(JSON.parse(fs.readFileSync(path.join(result.payload!.directory, 'css.json'), 'utf8'))).toEqual(inline.css);
  });

  it('leaves inline rendering byte-identical when payloadMode is omitted', async () => {
    const composed = await compose({ object: 'Subscription', context: 'detail', options: { transient: true } });
    const a = await render({ schema: composed.schema, apply: true });
    const b = await render({ schema: composed.schema, apply: true, output: { payloadMode: 'inline' } });
    expect(b.html).toBe(a.html);
    expect(b.payload).toBeUndefined();
  });
});
