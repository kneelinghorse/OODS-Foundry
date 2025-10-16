import process from 'node:process';

type ToolListResponse = {
  tools: string[];
};

type RunSuccess = {
  ok: true;
  tool: string;
  artifacts: string[];
  transcriptPath: string | null;
  bundleIndexPath: string | null;
  diagnosticsPath: string | null;
  preview: { summary?: string | null; notes?: string[] | null } | null;
  artifactsDetail:
    | Array<{
        path: string;
        name: string;
        purpose?: string | null;
        sha256?: string | null;
        sizeBytes?: number | null;
      }>
    | null;
};

type BridgeError = {
  error: {
    code: string;
    message: string;
    incidentId: string;
    details?: unknown;
  };
};

type HttpMethod = 'GET' | 'POST';

const DEFAULT_TOOL = 'diag.snapshot';
const DEFAULT_TIMEOUT_MS = 120_000;

function parseArgs(): { tool: string; apply: boolean } {
  const args = process.argv.slice(2);
  let tool = DEFAULT_TOOL;
  let apply = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--tool' && args[i + 1]) {
      tool = args[i + 1];
      i += 1;
    } else if (arg.startsWith('--tool=')) {
      tool = arg.split('=', 2)[1] ?? tool;
    } else if (arg === '--apply') {
      apply = true;
    }
  }

  return { tool, apply };
}

function readEnv(name: string): string | null {
  const value = process.env[name];
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeBaseUrl(raw: string): string {
  if (!raw.trim()) {
    return 'http://127.0.0.1:4466';
  }
  return raw.replace(/\/+$/, '');
}

async function requestJson<T>(
  method: HttpMethod,
  baseUrl: string,
  path: string,
  init: { body?: unknown; apply?: boolean; timeoutMs: number }
): Promise<T> {
  const url = new URL(path, baseUrl).toString();
  const headers = new Headers();
  const token = readEnv('BRIDGE_TOKEN');
  if (token) {
    headers.set('X-Bridge-Token', token);
  }
  if (method === 'POST') {
    headers.set('Content-Type', 'application/json');
  }
  if (init.apply) {
    const approval = readEnv('BRIDGE_APPROVAL') ?? 'granted';
    headers.set('X-Bridge-Approval', approval);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify(init.body ?? {}) : undefined,
      signal: controller.signal,
    });
    const text = await response.text();
    const content = text.length ? (JSON.parse(text) as T | BridgeError) : null;

    if (!response.ok) {
      const details =
        content && typeof content === 'object' && 'error' in content
          ? (content as BridgeError).error
          : null;
      const detailMessage = details?.message ?? response.statusText;
      const detailCode = details?.code ? ` (${details.code})` : '';
      throw new Error(`Bridge request failed: ${response.status}${detailCode} ${detailMessage}`);
    }

    return content as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Bridge request timed out after ${init.timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function printHeader(title: string) {
  process.stdout.write(`\n== ${title} ==\n`);
}

function formatArtifacts(artifacts: string[]): string {
  if (!artifacts.length) return 'none';
  return artifacts.map((artifact) => `- ${artifact}`).join('\n');
}

function formatDetails(details: RunSuccess['artifactsDetail']): string {
  if (!details || details.length === 0) return 'none';
  const lines = details.map((detail) => {
    const parts = [`• ${detail.name} → ${detail.path}`];
    if (typeof detail.sizeBytes === 'number') {
      parts.push(`size=${detail.sizeBytes}`);
    }
    if (detail.sha256) {
      parts.push(`sha256=${detail.sha256}`);
    }
    if (detail.purpose) {
      parts.push(`purpose=${detail.purpose}`);
    }
    return parts.join(' | ');
  });
  return lines.join('\n');
}

async function main() {
  const { tool, apply } = parseArgs();
  const baseUrl = sanitizeBaseUrl(readEnv('BRIDGE_URL') ?? 'http://127.0.0.1:4466');
  const timeoutMs = Number.parseInt(process.env.BRIDGE_TIMEOUT ?? '', 10) || DEFAULT_TIMEOUT_MS;

  process.stdout.write(`OODS MCP bridge: ${baseUrl}\n`);
  if (readEnv('BRIDGE_TOKEN')) {
    process.stdout.write('Using supplied bridge token\n');
  }
  if (apply) {
    process.stdout.write('Apply mode enabled: approval header will be sent\n');
  }

  printHeader('Health');
  const health = await requestJson<{ status: string; bridge: string }>('GET', baseUrl, '/health', {
    timeoutMs,
  });
  process.stdout.write(`status: ${health.status} | bridge: ${health.bridge}\n`);

  printHeader('Tools');
  const list = await requestJson<ToolListResponse>('GET', baseUrl, '/tools', { timeoutMs });
  if (!Array.isArray(list.tools)) {
    throw new Error('Bridge /tools payload malformed.');
  }
  for (const item of list.tools) {
    process.stdout.write(`• ${item}\n`);
  }
  if (!list.tools.includes(tool)) {
    process.stdout.write(`\nWARNING: Tool "${tool}" is not allowlisted; continuing anyway.\n`);
  }

  const payload = {
    tool,
    input: {
      apply,
    },
  };

  printHeader(`Run ${tool}`);
  const result = await requestJson<RunSuccess>('POST', baseUrl, '/run', {
    body: payload,
    apply,
    timeoutMs,
  });

  process.stdout.write(`ok: ${result.ok}\n`);
  if (result.preview?.summary) {
    process.stdout.write(`summary: ${result.preview.summary}\n`);
  }
  if (result.preview?.notes?.length) {
    for (const note of result.preview.notes) {
      process.stdout.write(`note: ${note}\n`);
    }
  }
  process.stdout.write(`artifacts:\n${formatArtifacts(result.artifacts)}\n`);
  process.stdout.write(`transcript: ${result.transcriptPath ?? 'n/a'}\n`);
  process.stdout.write(`bundle: ${result.bundleIndexPath ?? 'n/a'}\n`);
  process.stdout.write(`diagnostics: ${result.diagnosticsPath ?? 'n/a'}\n`);
  process.stdout.write(`details:\n${formatDetails(result.artifactsDetail)}\n`);

  process.stdout.write('\nSmoke run complete.\n');
}

main().catch((error: unknown) => {
  process.stderr.write(`agents-smoke failed: ${(error as Error).message}\n`);
  process.exitCode = 1;
});
