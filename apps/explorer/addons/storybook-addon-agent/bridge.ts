import type { ArtifactRunFile, ArtifactRunSummary, ToolName, ToolRunInput, ToolRunSuccess } from './types.js';
import { BridgeError } from './types.js';

const DEFAULT_BRIDGE_ORIGIN = 'http://127.0.0.1:4466';

function sanitizeTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function resolveImportMetaEnv(): Record<string, unknown> | undefined {
  if (typeof globalThis !== 'undefined') {
    const injected = (globalThis as any).__VITE_IMPORT_META_ENV__;
    if (injected && typeof injected === 'object') {
      return injected as Record<string, unknown>;
    }
  }

  try {
    // Using an evaluated function avoids bundlers that rewrite import.meta for non-ESM formats.
    return (Function('return import.meta')() as any)?.env as Record<string, unknown> | undefined;
  } catch {
    return undefined;
  }
}

function detectBridgeOrigin(): string {
  const env = resolveImportMetaEnv();
  const envOrigin = typeof env?.VITE_MCP_BRIDGE_ORIGIN === 'string' ? (env.VITE_MCP_BRIDGE_ORIGIN as string) : undefined;
  const globalOverride = typeof window !== 'undefined' ? (window as any).__OODS_AGENT_BRIDGE_ORIGIN__ : undefined;
  const origin = globalOverride || envOrigin || DEFAULT_BRIDGE_ORIGIN;
  return sanitizeTrailingSlash(origin);
}

const bridgeOrigin = detectBridgeOrigin();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${bridgeOrigin}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      credentials: 'omit',
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
  } catch (err: any) {
    throw new BridgeError('Unable to reach MCP bridge', { details: err });
  }

  const text = await response.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err: any) {
    throw new BridgeError('Bridge returned invalid JSON', { status: response.status, details: err });
  }

  if (!response.ok) {
    const error = data?.error ?? {};
    const message =
      typeof error?.message === 'string' && error.message.length
        ? error.message
        : `Bridge request failed (${response.status})`;
    const details = error?.details ?? error?.messages ?? error;
    throw new BridgeError(message, {
      status: response.status,
      code: typeof error?.code === 'string' ? error.code : undefined,
      details,
      incidentId: typeof error?.incidentId === 'string' ? error.incidentId : undefined,
    });
  }

  return data as T;
}

export async function fetchToolNames(): Promise<ToolName[]> {
  const data = await request<{ tools?: string[] }>('/tools');
  if (!Array.isArray(data?.tools)) {
    throw new BridgeError('Bridge returned malformed tool list');
  }
  // Narrow down to known tools only
  const tools = data.tools.filter((tool): tool is ToolName =>
    tool === 'a11y.scan' ||
    tool === 'purity.audit' ||
    tool === 'vrt.run' ||
    tool === 'diag.snapshot' ||
    tool === 'reviewKit.create' ||
    tool === 'brand.apply' ||
    tool === 'billing.reviewKit' ||
    tool === 'billing.switchFixtures'
  );
  return tools;
}

function resolveApprovalToken(): string | null {
  if (typeof window === 'undefined') return null;
  const globalToken = (window as any).__OODS_AGENT_APPROVAL_TOKEN__;
  if (typeof globalToken === 'string' && globalToken.trim().length) {
    return globalToken.trim();
  }
  try {
    const stored = window.localStorage.getItem('oods.agent.approval');
    if (typeof stored === 'string' && stored.trim().length) {
      return stored.trim();
    }
  } catch {
    // Ignore storage access errors (sandboxed, disabled, etc.)
  }
  return 'granted';
}

export async function runTool(tool: ToolName, input: ToolRunInput): Promise<ToolRunSuccess> {
  const headers: Record<string, string> = {};
  if (input && typeof input === 'object' && (input as Record<string, unknown>).apply === true) {
    const approvalToken = resolveApprovalToken();
    if (approvalToken) {
      headers['X-Bridge-Approval'] = approvalToken;
    }
  }
  const data = await request<ToolRunSuccess | { error?: { code?: string; message?: string; messages?: unknown } }>(
    '/run',
    {
      method: 'POST',
      body: JSON.stringify({ tool, input }),
      headers,
    }
  );

  if (data && 'ok' in data && data.ok) {
    return data;
  }

  const error = ((data as any)?.error ?? {}) as {
    code?: string;
    message?: string;
    details?: unknown;
    messages?: unknown;
    incidentId?: string;
    status?: number;
  };
  const message = typeof error?.message === 'string' && error.message.length ? error.message : 'Tool run failed';
  throw new BridgeError(message, {
    status: typeof error?.status === 'number' ? error.status : undefined,
    code: typeof error?.code === 'string' ? error.code : undefined,
    details: error?.details ?? error?.messages ?? error,
    incidentId: typeof error?.incidentId === 'string' ? error.incidentId : undefined,
  });
}

function normalizeArtifactPath(artifactPath: string): string | null {
  if (!artifactPath) return null;
  const unixPath = artifactPath.replace(/\\/g, '/');
  const idx = unixPath.indexOf('artifacts/');
  if (idx === -1) return null;
  return unixPath.slice(idx + 'artifacts/'.length);
}

export function artifactHref(artifactPath: string): string | null {
  const relative = normalizeArtifactPath(artifactPath);
  if (!relative) return null;
  return `${bridgeOrigin}/artifacts/${relative}`;
}

export async function fetchArtifactText(artifactPath: string): Promise<string> {
  const href = artifactHref(artifactPath);
  if (!href) {
    throw new BridgeError('Artifact path is not exposed by bridge');
  }
  let response: Response;
  try {
    response = await fetch(href, { credentials: 'omit' });
  } catch (err: any) {
    throw new BridgeError('Failed to fetch artifact', { details: err });
  }
  if (!response.ok) {
    throw new BridgeError('Artifact request failed', { status: response.status });
  }
  return response.text();
}

export { bridgeOrigin };

function normalizeRunSummary(entry: any): ArtifactRunSummary | null {
  if (!entry || typeof entry !== 'object') return null;
  const id = typeof entry.id === 'string' ? entry.id : null;
  const date = typeof entry.date === 'string' ? entry.date : null;
  const summary = typeof entry.summary === 'string' ? entry.summary : null;
  if (!id || !date || !summary) return null;
  return {
    id,
    date,
    summary,
    tool: typeof entry.tool === 'string' ? entry.tool : null,
    startedAt: typeof entry.startedAt === 'string' ? entry.startedAt : null,
  };
}

function normalizeRunFile(entry: any): ArtifactRunFile | null {
  if (!entry || typeof entry !== 'object') return null;
  const id = typeof entry.id === 'string' ? entry.id : null;
  const name = typeof entry.name === 'string' ? entry.name : null;
  const openUrl = typeof entry.openUrl === 'string' ? entry.openUrl : null;
  if (!id || !name || !openUrl) return null;
  return {
    id,
    name,
    openUrl,
    purpose: typeof entry.purpose === 'string' ? entry.purpose : null,
    size: typeof entry.size === 'number' ? entry.size : null,
    sha256: typeof entry.sha256 === 'string' ? entry.sha256 : null,
  };
}

export async function fetchRunSummaries(): Promise<ArtifactRunSummary[]> {
  const data = await request<ArtifactRunSummary[] | { error?: unknown }>('/runs');
  if (!Array.isArray(data)) {
    throw new BridgeError('Bridge returned malformed run list');
  }
  const runs = data.map((entry) => normalizeRunSummary(entry)).filter((entry): entry is ArtifactRunSummary => entry !== null);
  return runs;
}

export async function fetchRunDiagnostics(runId: string): Promise<unknown> {
  const encoded = encodeURIComponent(runId);
  return request<unknown>(`/runs/${encoded}`);
}

export async function fetchRunFiles(runId: string): Promise<ArtifactRunFile[]> {
  const encoded = encodeURIComponent(runId);
  const data = await request<ArtifactRunFile[] | { error?: unknown }>(`/runs/${encoded}/files`);
  if (!Array.isArray(data)) {
    throw new BridgeError('Bridge returned malformed run file list');
  }
  const files = data.map((entry) => normalizeRunFile(entry)).filter((entry): entry is ArtifactRunFile => entry !== null);
  return files;
}
