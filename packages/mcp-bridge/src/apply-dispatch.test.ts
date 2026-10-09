import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const packageRoot = path.resolve(import.meta.dirname, '..');
const store = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s233-apply-'));
let child: ChildProcessWithoutNullStreams | undefined;
afterAll(async () => {
  if (child && child.exitCode === null) {
    const closed = new Promise(resolve => child!.once('close', resolve));
    child.stdin.end(); child.kill('SIGTERM'); await closed;
  }
  fs.rmSync(store, { recursive: true, force: true });
});

describe('bridge preserves action-family input contracts', () => {
  it('does not invent apply for lookups or templates, and keeps optional writes dry unless explicitly requested', async () => {
    child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], { cwd: packageRoot, stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, MCP_BRIDGE_PORT: '0', MCP_HEALTH_PORT: '0', BRIDGE_TOKEN: '',
        MCP_SCHEMA_STORE_ROOT: store, MCP_SCHEMA_STORE_DIR: 'schemas', MCP_MAPPINGS_PATH: path.join(store, 'mappings.json'),
        OODS_OBJECTS_DIR: path.join(store, 'objects'), OODS_TRAITS_DIR: path.join(store, 'traits'), OODS_BRANDS_DIR: path.join(store, 'brands') } });
    let logs = '';
    child.stderr.setEncoding('utf8'); child.stderr.on('data', chunk => { logs += chunk; });
    const port = await new Promise<number>((resolve, reject) => {
      let output = '';
      child!.stdout.setEncoding('utf8');
      child!.stdout.on('data', chunk => { output += chunk; const match = output.match(/listening on :(\d+)/); if (match) resolve(Number(match[1])); });
      child!.once('error', reject); child!.once('exit', code => reject(new Error(`Bridge exited ${code}: ${logs}`)));
    });
    const call = async (tool: string, input: Record<string, unknown>, approved = false) => {
      const response = await fetch(`http://127.0.0.1:${port}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(approved ? { 'X-Bridge-Approval': 'granted' } : {}) }, body: JSON.stringify({ tool, input }) });
      return { status: response.status, body: await response.json() as any };
    };
    const listed = await call('object_registry', { action: 'list' });
    expect(listed.status, JSON.stringify(listed.body)).toBe(200);
    expect(listed.body.tool).toBe('object_registry');
    const template = await call('brand_read', { action: 'template' });
    expect(template.status, JSON.stringify(template.body)).toBe(200);
    const dry = await call('component_map', { action: 'create', externalSystem: 'bridge-test', externalComponent: 'Button', oodsTraits: ['Stateful'] });
    expect(dry.status, JSON.stringify(dry.body)).toBe(200);
    expect(dry.body.mode).toBe('dry-run');
    expect(fs.existsSync(path.join(store, 'mappings.json'))).toBe(false);
    const applied = await call('component_map', { action: 'create', externalSystem: 'bridge-test', externalComponent: 'Button', oodsTraits: ['Stateful'], apply: true }, true);
    expect(applied.status, JSON.stringify(applied.body)).toBe(200);
    expect(applied.body.mode).toBe('apply');
    expect(fs.existsSync(path.join(store, 'mappings.json'))).toBe(true);
    const denied = await call('brand_apply', { brand: 'A', delta: {}, apply: true });
    expect(denied.status).toBe(403);
    expect(denied.body.error.details.reason).toBe('READ_ONLY_ENFORCED');
    const alias = await call('object', { action: 'list' });
    expect(alias.status).toBe(403);
    expect(alias.body.error.details.reason).toBe('FORBIDDEN_TOOL');
    const invalid = await call('object_registry', { action: 'unsupported' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('OODS-V001');

  }, 120_000);
});
