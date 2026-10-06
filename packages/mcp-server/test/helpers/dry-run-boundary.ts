import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect } from 'vitest';
import { loadPolicyDoc } from '../../src/security/policy.js';

// Redirect only the operator artifact policy; handlers and fixture reads remain real.
export function dryRunBoundary() {
  let directory: string;
  let original: string;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-on-demand-s194-'));
    const policy = loadPolicyDoc();
    original = policy.artifactsBase;
    policy.artifactsBase = directory;
  });
  afterEach(() => {
    loadPolicyDoc().artifactsBase = original;
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return (tool: string, output: any) => {
    // s216-m03: a preview creates no history, including empty run directories.
    expect(output.artifacts).toEqual([]);
    expect(output).not.toHaveProperty('transcriptPath');
    expect(output).not.toHaveProperty('bundleIndexPath');
    expect(fs.readdirSync(directory)).toEqual([]);
    if (process.env.S194_TOOL_RECEIPTS) {
      fs.mkdirSync(process.env.S194_TOOL_RECEIPTS, { recursive: true });
      fs.writeFileSync(path.join(process.env.S194_TOOL_RECEIPTS, `${tool}.json`), JSON.stringify({ tool, mode: 'dry-run', output, files: [] }, null, 2) + '\n');
    }
  };
}
