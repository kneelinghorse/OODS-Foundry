import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export type TelemetryContext = {
  correlationId: string;
  commandId: string;
  tool?: string | null;
  role?: string | null;
  apply?: boolean | null;
  startedAt: number;
};

type LogLevel = 'info' | 'warn' | 'error';

const storage = new AsyncLocalStorage<TelemetryContext>();

const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));

function resolveTelemetryBase(): string {
  const configured = process.env.MCP_TELEMETRY_DIR;
  if (configured && configured.trim().length > 0) {
    return path.isAbsolute(configured) ? configured : path.resolve(REPO_ROOT, configured);
  }
  return path.resolve(REPO_ROOT, 'artifacts', 'current-state');
}

function ensureTelemetryFile(kind: 'mcp-server'): string {
  const base = resolveTelemetryBase();
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const dir = path.join(base, `${yyyy}-${mm}-${dd}`, 'telemetry');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${kind}.jsonl`);
}

function appendToFile(payload: unknown) {
  try {
    const filePath = ensureTelemetryFile('mcp-server');
    fs.appendFileSync(filePath, JSON.stringify(payload) + '\n', 'utf8');
  } catch {
    // Swallow file logging errors to avoid impacting tool runs.
  }
}

export function createCorrelationId(): string {
  return randomUUID();
}

export function createCommandId(): string {
  return randomUUID();
}

export function withTelemetryContext<T>(context: TelemetryContext, run: () => Promise<T> | T): Promise<T> | T {
  return storage.run(context, run);
}

export function currentTelemetry(): TelemetryContext | null {
  return storage.getStore() ?? null;
}

function basePayload(level: LogLevel, event: string) {
  const ctx = currentTelemetry();
  const payload: Record<string, unknown> = {
    ts: new Date().toISOString(),
    source: 'mcp-server',
    level,
    event,
  };
  if (ctx) {
    payload.correlationId = ctx.correlationId;
    payload.commandId = ctx.commandId;
    if (ctx.tool !== undefined) payload.tool = ctx.tool ?? null;
    if (ctx.role !== undefined) payload.role = ctx.role ?? null;
    if (ctx.apply !== undefined) payload.apply = ctx.apply ?? null;
    payload.startedAt = new Date(ctx.startedAt).toISOString();
  }
  return payload;
}

export function logEvent(level: LogLevel, event: string, data: Record<string, unknown> = {}): void {
  const payload = { ...basePayload(level, event), ...data };
  const line = JSON.stringify(payload);
  process.stderr.write(line + '\n');
  appendToFile(payload);
}

export function logRunStarted(details: Record<string, unknown> = {}): void {
  logEvent('info', 'tool.run.started', details);
}

export function logRunCompleted(details: Record<string, unknown> = {}): void {
  logEvent('info', 'tool.run.completed', details);
}

export function logRunFailed(details: Record<string, unknown> = {}): void {
  logEvent('error', 'tool.run.failed', details);
}
