import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { loadToolRegistry, resolveToolRegistry } from '../../src/tools/registry.js';

const root = path.resolve(import.meta.dirname, '../../../..');
const retired = [['billing', 'reviewKit'], ['billing', 'switchFixtures'], ['release', 'tag'], ['diag', 'snapshot']].map(parts => parts.join('.'));
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
describe('s216 retirement removes callable promises, not just documentation', () => {
  it('keeps the registry and both policy layers equal with only accessibility on demand', () => {
    const registry = loadToolRegistry();
    const names = [...registry.auto, ...registry.onDemand].sort();
    expect(registry.onDemand).toEqual(['a11y.scan']);
    expect(names).toHaveLength(20);
    expect(read('configs/agent/policy.json').tools.map((row: any) => row.name).sort()).toEqual(names);
    expect(read('packages/mcp-server/src/security/policy.json').rules.map((row: any) => row.tool).sort()).toEqual(names);
    expect(resolveToolRegistry({ MCP_TOOLSET: 'all', MCP_EXTRA_TOOLS: retired.join(',') })).toMatchObject({ enabled: names, unknownExtras: retired });
  });
  it('removes the handlers and dead emitters, schemas and host conformance', () => {
    for (const name of [...retired, ...['chain', 'resolve'].map(action => ['review', action].join('.'))]) {
      expect(fs.existsSync(path.join(root, `packages/mcp-server/src/tools/${name}.ts`)), name).toBe(false);
      for (const direction of ['input', 'output']) expect(fs.existsSync(path.join(root, `packages/mcp-server/src/schemas/${name}.${direction}.json`))).toBe(false);
    }
    for (const prefix of ['review-queue', 'conflict-detail', 'apply-summary', 'a2ui-runtime']) expect(fs.existsSync(path.join(root, `packages/mcp-server/src/codegen/${prefix}-emitter.ts`))).toBe(false);
    expect(fs.existsSync(path.join(root, 'packages/mcp-server/src/a2ui/host-conformance'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'packages/mcp-adapter/test-s57-m01.js'))).toBe(false);
  });
  it('returns the same unknown-tool error as any unregistered name at the native wire', async () => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
      cwd: path.join(root, 'packages/mcp-server'),
      env: { ...process.env, MCP_HEALTH_PORT: '0', MCP_TOOLSET: 'all', MCP_EXTRA_TOOLS: '', OODS_OTLP_ENDPOINT: '', OODS_BRANDS_DIR: '' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let buffer = '', stderr = '';
    child.stderr.on('data', bytes => { stderr += bytes; });
    try {
      const responses = await new Promise<any[]>((resolve, reject) => {
        const rows: any[] = [];
        const timer = setTimeout(() => reject(new Error(`Native dispatcher did not answer: ${stderr}`)), 20_000);
        child.on('error', error => { clearTimeout(timer); reject(error); });
        child.stdout.on('data', bytes => {
          buffer += bytes;
          let end;
          while ((end = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
            try { const row = JSON.parse(line); if (typeof row.id === 'number') rows.push(row); } catch { /* health-server startup line */ }
          }
          if (rows.length === retired.length + 1) { clearTimeout(timer); resolve(rows); }
        });
        // Invalid inputs prevent a baseline implementation from executing a mutation.
        [...retired, 'unregistered-retirement-control'].forEach((tool, id) => child.stdin.write(JSON.stringify({ id, tool, input: { unexpected: true } }) + '\n'));
      });
      const control = responses.find(row => row.id === retired.length);
      expect(control.error.message).toContain('Unknown tool:');
      for (const row of responses) {
        expect(row.error?.code).toBe(control.error.code);
        expect(row.error?.message).toContain('Unknown tool:');
        expect(row.result).toBeUndefined();
      }
    } finally { child.kill('SIGTERM'); }
  }, 30_000);
});
