import http from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { getAjv } from '../../src/lib/ajv.js';
import { formatValidationErrors } from '../../src/security/errors.js';
import composeInputSchema from '../../src/schemas/design.compose.input.json' assert { type: 'json' };
import { listObjects } from '../../src/objects/object-loader.js';
import { resolveCompositionsDir } from '../../src/lib/composition-store.js';
import { readRunView } from '../../src/lib/run-view.js';
import { createSchemaRef, resolveSchemaRef } from '../../src/tools/schema-ref.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as preview } from '../../src/tools/design.preview.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { handle as showObject } from '../../src/tools/object.show.js';
import { handle as saveSchema } from '../../src/tools/schema/save.js';
import type { UiSchema } from '../../src/schemas/generated.js';

/**
 * s206-m03: the first-run failures a tester's agent meets, each answered in a plain sentence that names the cause and
 * the next step. The same failures, provoked against a pristine extract of the release archive through the stdio
 * adapter, are recorded in artifacts/product-reality/sprint-206/m03/first-run.after.json. The Node floor is pinned in
 * packages/mcp-adapter/test-s206-node-floor.js and a taken port in packages/mcp-bridge/src/listen.test.ts.
 */
const OBJECTS = listObjects();
const schema = { version: '2026.09', screens: [{ id: 'text', component: 'Text', props: { content: 'first run' } }] } as unknown as UiSchema;

describe('an object or context that does not exist', () => {
  const sentence = `Object "Widget" not found. Available: ${OBJECTS.join(', ')}. Use one of these names; they are case-sensitive.`;

  it('design.compose names the objects there are and says to use one', async () => {
    const result = await compose({ object: 'Widget', context: 'detail', options: { transient: true } });
    expect(result.status).toBe('error');
    expect(result.errors).toEqual([{ code: 'OODS-N005', message: sentence, hint: 'The object tool (action: list) describes each object.' }]);
  });

  it('a near miss is offered as a suggestion', async () => {
    const result = await compose({ object: 'Subscriptoin', context: 'detail', options: { transient: true } });
    expect(result.errors?.[0]?.hint).toMatch(/^Did you mean "Subscription"\?/);
  });

  it('the object tool gives the same sentence', async () => {
    await expect(showObject({ name: 'Widget' })).rejects.toMatchObject({ opiCode: 'OODS-N005', message: sentence });
  });

  it('a context outside the seven is refused by the input schema with the seven named', () => {
    const validate = getAjv().compile(composeInputSchema);
    expect(validate({ object: 'User', context: 'banana' })).toBe(false);
    expect(formatValidationErrors(validate.errors as never).message)
      .toBe("Input validation failed: field 'context' must be one of: detail, list, form, timeline, card, inline, workflow");
  });

  it('a context the object does not compose names the contexts it does', async () => {
    const result = await compose({ object: 'Run', context: 'form', options: { transient: true } });
    expect(result.errors?.[0]).toMatchObject({ code: 'OODS-V003', message: "Object 'Run' does not compose the 'form' context; it composes only card, detail, inline, list and timeline." });
  });
});

describe('a schemaRef the server does not hold', () => {
  const savedTtl = process.env.MCP_SCHEMA_REF_TTL_MS;
  const savedMax = process.env.MCP_SCHEMA_REF_MAX;
  afterEach(() => {
    vi.useRealTimers();
    if (savedTtl === undefined) delete process.env.MCP_SCHEMA_REF_TTL_MS; else process.env.MCP_SCHEMA_REF_TTL_MS = savedTtl;
    if (savedMax === undefined) delete process.env.MCP_SCHEMA_REF_MAX; else process.env.MCP_SCHEMA_REF_MAX = savedMax;
  });
  const next = 'Run design.compose again in this conversation for a fresh schemaRef, or pass the schema inline in the schema field. To keep a screen across conversations, save it with the schema tool (action: save) and load it by name (action: load).';

  it('from another conversation or before a restart: not known here, and what to do', async () => {
    const result = await generate({ schemaRef: 'compose-0123abcd', framework: 'react' });
    expect(result.errors).toEqual([{ code: 'OODS-N003', message: `schemaRef 'compose-0123abcd' is not known to this server. A schemaRef lives only in the server your MCP client started, for 30 minutes, so a ref from another conversation, another client or before a restart is not here. ${next}` }]);
    // The retired tool names never reach an agent again.
    expect(JSON.stringify(result.errors)).not.toMatch(/schema\.save|schema\.load/);
  });

  it('past its lifetime: says it expired (it used to read as unknown)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const record = createSchemaRef(schema, 'compose');
    vi.setSystemTime(Date.now() + 31 * 60 * 1000);
    expect(resolveSchemaRef(record.ref)).toEqual({ ok: false, reason: 'expired' });
    const result = await generate({ schemaRef: record.ref, framework: 'react' });
    expect(result.errors).toEqual([{ code: 'OODS-N004', message: `schemaRef '${record.ref}' has expired. A schemaRef lives 30 minutes (MCP_SCHEMA_REF_TTL_MS) in the server that issued it. ${next}` }]);
  });

  it('dropped for room: says so, with the cap', async () => {
    process.env.MCP_SCHEMA_REF_MAX = '2';
    const first = createSchemaRef(schema, 'compose');
    createSchemaRef(schema, 'compose');
    createSchemaRef(schema, 'compose');
    const result = await generate({ schemaRef: first.ref, framework: 'react' });
    expect(result.errors?.[0]).toMatchObject({ code: 'OODS-N004', message: expect.stringContaining(`schemaRef '${first.ref}' is no longer held. This server keeps at most 2 schemaRefs (MCP_SCHEMA_REF_MAX) and dropped the oldest to make room.`) });
  });

  it('saving one: compose again and save the new ref at once', async () => {
    await expect(saveSchema({ name: 'first_run_probe', schemaRef: 'compose-0123abcd' })).rejects.toMatchObject({
      opiCode: 'OODS-N003',
      message: expect.stringMatching(/is not known to this server\..* Run design\.compose again in this conversation and save the new schemaRef right away\.$/),
    });
  });
});

describe('a runPath that is not a Stage1 run', () => {
  let directory: string;
  beforeAll(() => {
    directory = mkdtempSync(path.join(os.tmpdir(), 'forge-first-run-'));
    writeFileSync(path.join(directory, 'notes.txt'), 'not a run\n');
  });
  afterAll(() => rmSync(directory, { recursive: true, force: true }));

  it('a path that does not exist says so', async () => {
    const missing = path.join(directory, 'no-such-run');
    await expect(readRunView(missing)).rejects.toMatchObject({ opiCode: 'OODS-V212', message: `design.preview: runPath ${missing} does not exist. Point runPath at one Stage1 run, the directory that holds the run's manifest.json. Nothing was written.` });
  });

  it('a directory with no run manifest says what a run looks like', async () => {
    await expect(readRunView(directory)).rejects.toMatchObject({ opiCode: 'OODS-V212', message: `design.preview: ${directory} is not a Stage1 run: No Stage1 run manifest (manifest.json) at or above runPath. Point runPath at one Stage1 run, the directory that holds the run's manifest.json. Nothing was written.` });
  });
});

describe('design.preview when the preview host cannot help', () => {
  let platform: Record<string, unknown> = { supported: true, os: process.platform, arch: process.arch };
  let server: http.Server;
  let hostUrl: string;
  beforeAll(async () => {
    // A stand-in preview host: the one route design.preview asks before anything else, answered as a real host would.
    server = http.createServer((request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(request.url === '/preview/status' ? { running: true, base: '/preview', compositionsDir: resolveCompositionsDir(), platform } : {}));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    hostUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('on a platform no binary is shipped for: names the platforms, and what still works', async () => {
    platform = { supported: false, os: 'freebsd', arch: 'x64', gap: 'unshipped', reason: 'no esbuild binary is shipped for freebsd-x64; the preview compiles on darwin-arm64, darwin-x64, linux-x64, linux-arm64' };
    await expect(preview({ object: 'Subscription', context: 'card' }, { previewHostUrl: hostUrl })).rejects.toMatchObject({
      opiCode: 'OODS-N021',
      message: 'design.preview: the preview cannot compile generated screens on freebsd-x64: no esbuild binary is shipped for freebsd-x64; the preview compiles on darwin-arm64, darwin-x64, linux-x64, linux-arm64. design.compose, code.generate and artifact.certify work here without the preview.',
    });
  });

  it('with the shipped binary missing from the install: says to extract the archive again', async () => {
    platform = { supported: false, os: 'darwin', arch: 'arm64', gap: 'incomplete', reason: '@esbuild/darwin-arm64 is installed without its binary at /x/bin/esbuild' };
    await expect(preview({ object: 'Subscription', context: 'card' }, { previewHostUrl: hostUrl })).rejects.toMatchObject({
      opiCode: 'OODS-N021',
      message: 'design.preview: the preview cannot compile generated screens on darwin-arm64: @esbuild/darwin-arm64 is installed without its binary at /x/bin/esbuild. This install is missing a file the release shipped: extract the release archive again into an empty directory and restart your MCP client.',
    });
  });

  it('an object that does not exist is the composition\'s own refusal, not a JSON dump', async () => {
    platform = { supported: true, os: process.platform, arch: process.arch };
    const refusal = preview({ object: 'Widget', context: 'detail' }, { previewHostUrl: hostUrl });
    await expect(refusal).rejects.toMatchObject({
      opiCode: 'OODS-N005',
      message: `design.preview: Object "Widget" not found. Available: ${OBJECTS.join(', ')}. Use one of these names; they are case-sensitive. The object tool (action: list) describes each object.`,
    });
    await expect(refusal).rejects.not.toMatchObject({ message: expect.stringContaining('[{') });
  });
});
