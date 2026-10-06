import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** How the preview host runs a native tool for an edit: the bridge passes its own client, the standalone host owns one. */
export type RunTool = (tool: string, input: Record<string, unknown>) => Promise<unknown>;

/**
 * A minimal client for the native stdio server (packages/mcp-server/dist/index.js), used by the
 * standalone preview host so page edits can re-compose and re-generate without a bridge. Every
 * request carries the host's own address so design.preview answers with URLs on it.
 */
export class NativeToolClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private seq = 0;
  private buffer = '';
  private readonly pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  constructor(private readonly serverCwd: string, private readonly previewHostUrl: () => string | undefined) {}

  private ensure(): ChildProcessWithoutNullStreams {
    if (this.child && this.child.exitCode === null) return this.child;
    const entry = path.join(this.serverCwd, 'dist', 'index.js');
    if (!fs.existsSync(entry)) throw new Error(`Native MCP server not built at ${entry}`);
    const child = spawn(process.execPath, [entry], { cwd: this.serverCwd, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env } });
    child.stderr.pipe(process.stderr);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      this.buffer += chunk;
      let index: number;
      while ((index = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, index).trim();
        this.buffer = this.buffer.slice(index + 1);
        if (!line) continue;
        let message: { id?: number; result?: unknown; error?: { message?: string; code?: string; details?: unknown } };
        try { message = JSON.parse(line); } catch { continue; }
        if (message.id === undefined) continue;
        const waiting = this.pending.get(message.id);
        if (!waiting) continue;
        this.pending.delete(message.id);
        if (message.error) waiting.reject(Object.assign(new Error(message.error.message ?? 'Native tool error'), { nativeError: message.error }));
        else waiting.resolve(message.result);
      }
    });
    child.on('exit', () => { for (const waiting of this.pending.values()) waiting.reject(new Error('Native MCP server exited')); this.pending.clear(); if (this.child === child) this.child = null; });
    this.child = child;
    return child;
  }

  run: RunTool = (tool, input) => {
    const child = this.ensure();
    const id = ++this.seq;
    const url = this.previewHostUrl();
    const payload = JSON.stringify({ id, tool, input, ...(url ? { context: { previewHostUrl: url } } : {}) }) + '\n';
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); child.stdin.write(payload, 'utf8'); });
  };

  async close(): Promise<void> {
    const child = this.child;
    this.child = null;
    if (!child || child.exitCode !== null) return;
    await new Promise<void>(resolve => { const timer = setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 2_000); timer.unref(); child.once('close', () => { clearTimeout(timer); resolve(); }); child.kill('SIGTERM'); });
  }
}
