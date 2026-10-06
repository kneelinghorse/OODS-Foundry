import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * s211-m01: the bridge on its fixed port 4466 ran `health` for `Host: attacker.example:4466` with no token, and the
 * preview host the adapter starts answered the same way. Both entry points now refuse a foreign Host before any route.
 * Runs both servers from source on free ports (never 4466, which pm2's bridge holds).
 */
const packageRoot = path.resolve(fileURLToPath(import.meta.url), '../..');
const tsx = path.resolve(packageRoot, '../../node_modules/.bin/tsx');
const store = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s211-host-check-'));
const children: ChildProcessWithoutNullStreams[] = [];
// SIGTERM, not SIGKILL: tsx forwards it to the server it runs, where SIGKILL would orphan that server on the port.
afterAll(async () => {
  for (const child of children) if (child.exitCode === null) { const closed = new Promise(resolve => child.once('close', resolve)); child.stdin.end(); child.kill('SIGTERM'); await closed; }
  fs.rmSync(store, { recursive: true, force: true });
});

function start(args: string[], port: RegExp): Promise<number> {
  const child = spawn(tsx, args, { cwd: packageRoot, env: { ...process.env, MCP_SCHEMA_STORE_ROOT: store, MCP_SCHEMA_STORE_DIR: 'schemas', MCP_BRIDGE_PORT: '0', BRIDGE_TOKEN: '' }, stdio: ['pipe', 'pipe', 'pipe'] });
  children.push(child);
  return new Promise((resolve, reject) => {
    let out = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => { out += chunk; const match = out.match(port); if (match) resolve(Number(match[1])); });
    child.once('exit', code => reject(new Error(`${args.join(' ')} exited ${code}: ${out}`)));
  });
}
function ask(port: number, host: string, method: 'GET' | 'POST', route: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const body = method === 'POST' ? JSON.stringify({ tool: 'health', input: {} }) : undefined;
    const request = http.request({ host: '127.0.0.1', port, method, path: route, headers: { Host: host, ...(body ? { 'Content-Type': 'application/json' } : {}) } }, response => {
      let text = '';
      response.on('data', chunk => { text += chunk; });
      response.on('end', () => resolve({ status: response.statusCode ?? 0, body: text }));
    });
    request.once('error', reject);
    request.end(body);
  });
}

describe('both local servers refuse a foreign Host (s211-m01)', () => {
  it('the bridge refuses /health and /run for another site\'s name and still serves its own', async () => {
    const port = await start(['src/server.ts'], /listening on :(\d+)/);
    for (const route of [['GET', '/health'], ['POST', '/run']] as const) {
      const refused = await ask(port, `attacker.example:${port}`, route[0], route[1]);
      expect(refused.status, route.join(' ')).toBe(403);
      expect(JSON.parse(refused.body).error.details).toEqual({ reason: 'FOREIGN_HOST', host: `attacker.example:${port}` });
    }
    for (const host of [`127.0.0.1:${port}`, `localhost:${port}`]) expect((await ask(port, host, 'GET', '/health')).status, host).toBe(200);
  }, 120_000);

  it('the preview host the adapter starts refuses another site\'s name and still serves its own', async () => {
    const port = await start(['src/preview/standalone.ts', '--port', '0'], /"port":(\d+)/);
    const refused = await ask(port, `attacker.example:${port}`, 'GET', '/preview/status');
    expect(refused.status).toBe(403);
    // /preview/status names the compositions directory on this machine; a rebinding page must not read it.
    expect(refused.body).not.toContain(store);
    for (const host of [`127.0.0.1:${port}`, `localhost:${port}`]) expect((await ask(port, host, 'GET', '/preview/status')).status, host).toBe(200);
  }, 120_000);
});
