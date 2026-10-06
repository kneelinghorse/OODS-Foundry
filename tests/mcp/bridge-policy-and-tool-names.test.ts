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

  it('does not mark the grouped repl tool as read-only in mcp-server security policy', () => {
    const policy = readJson<ServerSecurityPolicyDoc>('packages/mcp-server/src/security/policy.json');
    const replRender = policy.rules.find((rule) => rule.tool === 'repl');

    expect(replRender).toBeDefined();
    expect(replRender?.readOnly).not.toBe(true);
    expect(replRender?.writes?.length ?? 0).toBeGreaterThan(0);
  });
});

describe('bridge tool-name translation', () => {
  it('maps dot-delimited names to underscore-delimited external names and accepts both forms', () => {
    const internalTools = ['structuredData.fetch', 'repl.render', 'health'];
    const maps = buildToolNameMaps(internalTools);

    expect(maps.allowedExternalTools.has('structuredData_fetch')).toBe(true);
    expect(maps.allowedExternalTools.has('repl_render')).toBe(true);
    expect(resolveInternalToolName('structuredData_fetch', maps.externalToInternal)).toBe('structuredData.fetch');
    expect(resolveInternalToolName('structuredData.fetch', maps.externalToInternal)).toBe('structuredData.fetch');
    expect(resolveInternalToolName('repl_render', maps.externalToInternal)).toBe('repl.render');
    expect(resolveInternalToolName('repl.render', maps.externalToInternal)).toBe('repl.render');
  });
});
