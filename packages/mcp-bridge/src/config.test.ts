import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BridgeStartupError, loadAgentPolicyDoc } from './config.js';

const directories: string[] = [];
function policyFile(content?: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'oods-bridge-policy-'));
  directories.push(dir);
  const file = path.join(dir, 'policy.json');
  if (content !== undefined) writeFileSync(file, content);
  return file;
}
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('required bridge policy', () => {
  it('refuses a missing policy with a typed error instead of exposing a substitute roster', () => {
    const file = policyFile();
    expect(() => loadAgentPolicyDoc(file)).toThrow(BridgeStartupError);
    expect(() => loadAgentPolicyDoc(file)).toThrow(expect.objectContaining({
      code: 'BRIDGE_POLICY_MISSING', policyPath: file, retryable: false,
    }));
  });

  it.each(['{', 'null', '{}', '{"tools":{}}'])('refuses an invalid policy (%s)', (content) => {
    expect(() => loadAgentPolicyDoc(policyFile(content))).toThrow(expect.objectContaining({
      code: 'BRIDGE_POLICY_INVALID', retryable: false,
    }));
  });

  it('preserves the explicit policy roster and approval settings', () => {
    const policy = { version: 1, tools: [{ name: 'viz.render', modes: ['dry-run'], approval: 'required' }] };
    expect(loadAgentPolicyDoc(policyFile(JSON.stringify(policy)))).toEqual(policy);
  });
});
