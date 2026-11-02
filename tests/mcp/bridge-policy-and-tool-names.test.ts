import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { buildToolNameMaps, resolveInternalToolName } from '../../packages/mcp-bridge/src/tool-names.js';

type AgentPolicyDoc = {
  tools: Array<{ name: string; modes?: string[] }>;
};

type ServerSecurityPolicyDoc = {
  rules: Array<{ tool: string; readOnly?: boolean; writes?: string[] }>;
};

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '..', '..');

function readJson<T>(repoRelativePath: string): T {
  const absolutePath = path.join(REPO_ROOT, repoRelativePath);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as T;
}

describe('bridge policy contracts', () => {
  it('allows apply mode for the grouped repl tool in configs/agent/policy.json', () => {
    const policy = readJson<AgentPolicyDoc>('configs/agent/policy.json');
    const replRender = policy.tools.find((tool) => tool.name === 'repl');

    expect(replRender).toBeDefined();
    expect(replRender?.modes ?? []).toContain('apply');
  });

  // s240-m01 (#2750, #2751): the 0.11.0 read/write split moved saving to schema_store, so the grouped repl tool
  // (schema_render) only renders and validates. The writes it used to declare now belong to the store.
  it('marks the grouped repl tool read-only and keeps the writes on the schema store', () => {
    const policy = readJson<ServerSecurityPolicyDoc>('packages/mcp-server/src/security/policy.json');
    const replRender = policy.rules.find((rule) => rule.tool === 'repl');
    const store = policy.rules.find((rule) => rule.tool === 'schema');

    expect(replRender).toBeDefined();
    expect(replRender?.readOnly).toBe(true);
    expect(replRender?.writes ?? []).toEqual([]);
    expect(store?.readOnly).not.toBe(true);
    expect(store?.writes?.length ?? 0).toBeGreaterThan(0);
  });
});

describe('bridge tool-name translation', () => {
  // 0.7.0 (b8c19eacce) published names from tool-surface.json, and 0.11.0 (9ee860c146) stopped accepting the
  // pre-0.7 underscore aliases and dotted internal names, so only a tool's published name resolves.
  it('maps internal names to their published external names and accepts only those', () => {
    const maps = buildToolNameMaps(['structuredData.fetch', 'repl', 'health']);

    expect([...maps.allowedExternalTools].sort()).toEqual(['health_check', 'schema_render', 'structured_data_fetch']);
    expect(resolveInternalToolName('structured_data_fetch', maps.externalToInternal)).toBe('structuredData.fetch');
    expect(resolveInternalToolName('schema_render', maps.externalToInternal)).toBe('repl');
    expect(resolveInternalToolName('health_check', maps.externalToInternal)).toBe('health');
    for (const retired of ['structuredData.fetch', 'structuredData_fetch', 'repl', 'health']) {
      expect(resolveInternalToolName(retired, maps.externalToInternal)).toBeUndefined();
    }
  });
});
