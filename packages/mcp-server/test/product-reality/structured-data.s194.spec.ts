import { expect, it } from 'vitest';
import { handle as fetch } from '../../src/tools/structuredData.fetch.js';
import { ToolError } from '../../src/errors/tool-error.js';
import { createError } from '../../src/errors/registry.js';
import { wire, retain } from '../helpers/wire-boundary.js';

it('structuredData.fetch serves real datasets, honors ETags and exposes dataset versions', async () => {
  const receipts = [];
  for (const dataset of ['components', 'tokens', 'manifest'] as const) {
    const input = { dataset };
    wire('structuredData.fetch', 'input', input);
    const first = await fetch(input);
    wire('structuredData.fetch', 'output', first);
    expect(first.payloadIncluded).toBe(true);
    expect(first.etag).toMatch(/^[a-f0-9]{64}$/);
    const conditionalInput = { dataset, ifNoneMatch: first.etag };
    wire('structuredData.fetch', 'input', conditionalInput);
    const conditional = await fetch(conditionalInput);
    wire('structuredData.fetch', 'output', conditional);
    expect(conditional).toMatchObject({ matched: true, payloadIncluded: false, etag: first.etag });
    expect(conditional.payload).toBeUndefined();
    const versionInput = { dataset, listVersions: true };
    wire('structuredData.fetch', 'input', versionInput);
    const versions = await fetch(versionInput);
    wire('structuredData.fetch', 'output', versions);
    expect(Array.isArray(versions.availableVersions)).toBe(true);
    receipts.push({ dataset, firstEtag: first.etag, conditional, versions });
  }
  retain('structured-data', receipts);
});

it.each([{ listVersions: true }, { version: '2026-09-11' }])('kind mode rejects %j with a tool-specific registered diagnostic', async option => {
  const input = { kind: 'identity_graph' as const, runPath: '/not-read-because-mode-is-rejected', ...option };
  wire('structuredData.fetch', 'input', input);
  let error: ToolError | undefined;
  try { await fetch(input); } catch (caught) { error = caught as ToolError; }
  expect(error).toBeInstanceOf(ToolError);
  expect(error!.opiCode).toBe('OODS-V202');
  expect(error!.message).toContain('structuredData.fetch');
  expect(createError(error!.opiCode).message).toBe('structuredData.fetch input invalid');
  expect(error!.toStructured().message).not.toContain('map.apply');
});
