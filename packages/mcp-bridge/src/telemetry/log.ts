import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

type LogLevel = 'info' | 'warn' | 'error';

export type BridgeTelemetryContext = {
  correlationId: string;
  requestId: string;
  tool?: string | null;
  apply?: boolean | null;
  startedAt: number;
};

const storage = new AsyncLocalStorage<BridgeTelemetryContext>();

const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));

function resolveTelemetryDir(): string {
  const configured = process.env.MCP_TELEMETRY_DIR;
  if (configured && configured.trim().length > 0) {
    return path.isAbsolute(configured) ? configured : path.resolve(REPO_ROOT, configured);
  }
  return path.resolve(REPO_ROOT, 'artifacts', 'current-state');
}

function ensureFile(kind: 'mcp-bridge'): string {
  const base = resolveTelemetryDir();
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const dir = path.join(base, `${yyyy}-${mm}-${dd}`, 'telemetry');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${kind}.jsonl`);
}

function append(payload: unknown) {
  try {
    const file = ensureFile('mcp-bridge');
    fs.appendFileSync(file, JSON.stringify(payload) + '\n', 'utf8');
  } catch {
    // Drop file logging errors silently.
  }
}

export function createCorrelationId(): string {
  return randomUUID();
}

export function createRequestId(): string {
  return randomUUID();
}

export function withBridgeTelemetry<T>(context: BridgeTelemetryContext, run: () => Promise<T> | T): Promise<T> | T {
  return storage.run(context, run);
}

export function currentBridgeTelemetry(): BridgeTelemetryContext | null {
  return storage.getStore() ?? null;
}

function basePayload(level: LogLevel, event: string) {
  const ctx = currentBridgeTelemetry();
  const payload: Record<string, unknown> = {
    ts: new Date().toISOString(),
    source: 'mcp-bridge',
    level,
    event,
  };
  if (ctx) {
    payload.correlationId = ctx.correlationId;
    payload.requestId = ctx.requestId;
    if (ctx.tool !== undefined) payload.tool = ctx.tool ?? null;
    if (ctx.apply !== undefined) payload.apply = ctx.apply ?? null;
    payload.startedAt = new Date(ctx.startedAt).toISOString();
  }
  return payload;
}

export function logBridgeEvent(level: LogLevel, event: string, details: Record<string, unknown> = {}): void {
  const payload = { ...basePayload(level, event), ...details };
  process.stderr.write(JSON.stringify(payload) + '\n');
  append(payload);
}

export function logRequestStarted(details: Record<string, unknown> = {}): void {
  logBridgeEvent('info', 'bridge.run.started', details);
}

export function logRequestCompleted(details: Record<string, unknown> = {}): void {
  logBridgeEvent('info', 'bridge.run.completed', details);
}

export function logRequestFailed(details: Record<string, unknown> = {}): void {
  logBridgeEvent('error', 'bridge.run.failed', details);
}
