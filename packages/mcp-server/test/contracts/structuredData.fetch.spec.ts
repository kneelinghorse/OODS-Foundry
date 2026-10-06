import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { getAjv } from '../../src/lib/ajv.js';
import inputSchema from '../../src/schemas/structuredData.fetch.input.json' assert { type: 'json' };
import outputSchema from '../../src/schemas/structuredData.fetch.output.json' assert { type: 'json' };
import { handle, computeStructuredDataEtag } from '../../src/tools/structuredData.fetch.js';
import { ToolError } from '../../src/errors/tool-error.js';

const ajv = getAjv();
const validateInput = ajv.compile(inputSchema);
const validateOutput = ajv.compile(outputSchema);

describe('structuredData.fetch schemas', () => {
  it('accepts valid input payloads', () => {
    expect(validateInput({ dataset: 'components' })).toBe(true);
    expect(validateInput.errors).toBeNull();
  });

  it('rejects unknown datasets', () => {
    expect(validateInput({ dataset: 'other' })).toBe(false);
    expect(validateInput.errors).not.toBeNull();
  });

  it('accepts rollup kind+runPath inputs', () => {
    expect(
      validateInput({ kind: 'identity_graph', runPath: '/tmp/run/artifacts' }),
    ).toBe(true);
    expect(
      validateInput({ kind: 'capability_rollup', runPath: '/tmp/run/artifacts' }),
    ).toBe(true);
    expect(
      validateInput({ kind: 'object_rollup', runPath: '/tmp/run/artifacts' }),
    ).toBe(true);
    expect(
      validateInput({ kind: 'drift_report', runPath: '/tmp/run/artifacts' }),
    ).toBe(true);
  });

  it('rejects unknown rollup kinds', () => {
    expect(
      validateInput({ kind: 'mystery_rollup', runPath: '/tmp/run' }),
    ).toBe(false);
  });

  it('rejects kind without runPath', () => {
    expect(validateInput({ kind: 'identity_graph' })).toBe(false);
  });

  it('rejects mixing dataset with kind', () => {
    expect(
      validateInput({ dataset: 'components', kind: 'identity_graph', runPath: '/tmp' }),
    ).toBe(false);
  });

  it('rejects empty input (requires one of dataset or kind+runPath)', () => {
    expect(validateInput({})).toBe(false);
  });
});

describe('structuredData.fetch handler', () => {
  it('returns components payload with validated schema and stable etag', async () => {
    const result = await handle({ dataset: 'components' });
    const repeat = await handle({ dataset: 'components' });

    expect(validateOutput(result)).toBe(true);
    expect(result.schemaValidated).toBe(true);
    expect(result.payloadIncluded).toBe(true);
    expect(result.payload).toBeDefined();
    expect(result.meta?.componentCount).toBeGreaterThan(0);
    // ETag may come from manifest metadata or computed payload hash;
    // contract requires stability and ifNoneMatch compatibility.
    expect(result.etag).toBe(repeat.etag);
    expect(computeStructuredDataEtag(result.payload).length).toBe(64);
  });

  it('omits payload when ETag matches ifNoneMatch', async () => {
    const first = await handle({ dataset: 'tokens' });
    const second = await handle({ dataset: 'tokens', ifNoneMatch: first.etag });

    expect(second.matched).toBe(true);
    expect(second.payloadIncluded).toBe(false);
    expect(second.payload).toBeUndefined();
    expect(validateOutput(second)).toBe(true);
  });
});

describe('structuredData.fetch drift_report read-side allow-list (s95-m02)', () => {
  let tmpDir: string;
  let artifactsDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-drift-fetch-'));
    artifactsDir = path.join(tmpDir, 'artifacts');
    fs.mkdirSync(artifactsDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeDriftReport(schemaVersion: string) {
    fs.writeFileSync(
      path.join(artifactsDir, 'drift_report.json'),
      JSON.stringify({
        kind: 'drift_report',
        schema_version: schemaVersion,
        generated_at: '2026-04-18T02:16:31.952Z',
        current_run: {
          id: '5c22ae9c-0696-44ce-a51c-0352ddd5b6c1',
          url: 'https://linear.app/',
        },
        semantic_drift: [],
        projection_inconsistency: [],
        capability_contradiction: [],
        token_intent_mismatch: [],
        object_coverage_gap: [],
        signals: [],
      }),
    );
  }

  it.each(['1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0'])('accepts reviewed drift_report schema_version %s with empty signals[]', async version => {
    writeDriftReport(version);
    const result = await handle({ kind: 'drift_report', runPath: artifactsDir });

    expect(validateOutput(result)).toBe(true);
    expect(result.kind).toBe('drift_report');
    expect(result.schemaVersion).toBe(version);
    expect(result.meta?.signalCount).toBe(0);
    expect((result.payload as any).signals).toEqual([]);
  });

  it('rejects unknown drift_report schema_version values with a structured ToolError', async () => {
    writeDriftReport('2.0.0');

    try {
      await handle({ kind: 'drift_report', runPath: artifactsDir });
      throw new Error('expected rejection');
    } catch (err) {
      expect(err).toBeInstanceOf(ToolError);
      expect((err as ToolError).message).toMatch(/Unsupported schema_version "2\.0\.0"/);
      expect((err as any).details?.accepted).toEqual(['1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0']);
    }
  });
});
