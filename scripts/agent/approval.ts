import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

type ToolMode = 'dry-run' | 'apply';

type ToolPolicy = {
  name: string;
  modes?: ToolMode[];
  approval?: 'required' | 'optional';
  allow?: string[];
  description?: string;
};

type AgentPolicyDoc = {
  docs?: { rules?: string; ux?: string };
  approvals?: { header?: string; tokens?: Record<string, string> };
  tools: ToolPolicy[];
};

type Preview = { summary?: string | null; notes?: string[] | null } | null;

type ArtifactsDetail =
  | Array<{
      path: string;
      name: string;
      purpose?: string | null;
      sha256?: string | null;
      sizeBytes?: number | null;
    }>
  | null;

type RunSuccess = {
  ok: true;
  tool: string;
  role: string | null;
  mode: 'apply' | 'dry-run';
  incidentId: string;
  artifacts: string[];
  transcriptPath: string | null;
  bundleIndexPath: string | null;
  diagnosticsPath: string | null;
  preview: Preview;
  artifactsDetail: ArtifactsDetail;
};

type RunError = {
  error: {
    code: string;
    message: string;
    incidentId: string;
    details?: unknown;
  };
};

type CliOptions = {
  tool: string;
  role: string;
  apply: boolean;
  baseUrl: string;
  token: string | null;
  approval: string | null;
  input: Record<string, unknown>;
  timeoutMs: number;
};

const cwd = path.dirname(fileURLToPath(new URL(import.meta.url)));
const repoRoot = path.resolve(cwd, '..', '..');
const policyPath = path.resolve(repoRoot, 'configs/agent/policy.json');

function loadPolicy(): AgentPolicyDoc {
  const raw = fs.readFileSync(policyPath, 'utf8');
  const parsed = JSON.parse(raw) as AgentPolicyDoc;
  if (!Array.isArray(parsed.tools)) {
    throw new Error('Policy file missing tools array.');
  }
  return parsed;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const input: Record<string, unknown> = {};
  let tool: string | null = null;
  let role = 'designer';
  let apply = false;
  let baseUrl = 'http://127.0.0.1:4466';
  let token: string | null = null;
  let approval: string | null = null;
  let timeoutMs = 120_000;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--tool' && args[i + 1]) {
      tool = args[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith('--tool=')) {
      tool = arg.split('=', 2)[1] ?? tool;
      continue;
    }
    if (arg === '--role' && args[i + 1]) {
      role = args[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith('--role=')) {
      role = arg.split('=', 2)[1] ?? role;
      continue;
    }
    if (arg === '--apply') {
      apply = true;
      continue;
    }
    if (arg === '--base-url' && args[i + 1]) {
      baseUrl = args[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith('--base-url=')) {
      baseUrl = arg.split('=', 2)[1] ?? baseUrl;
      continue;
    }
    if (arg === '--token' && args[i + 1]) {
      token = args[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith('--token=')) {
      token = arg.split('=', 2)[1] ?? token;
      continue;
    }
    if (arg === '--approval' && args[i + 1]) {
      approval = args[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith('--approval=')) {
      approval = arg.split('=', 2)[1] ?? approval;
      continue;
    }
    if (arg === '--timeout' && args[i + 1]) {
      timeoutMs = Number(args[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--timeout=')) {
      timeoutMs = Number(arg.split('=', 2)[1]);
      continue;
    }
    if (arg === '--input' && args[i + 1]) {
      Object.assign(input, parseInputValue(args[i + 1]));
      i += 1;
      continue;
    }
    if (arg.startsWith('--input=')) {
      Object.assign(input, parseInputValue(arg.split('=', 2)[1] ?? ''));
      continue;
    }
  }

  if (!tool || !tool.trim()) {
    throw new Error('Missing required --tool <name> option.');
  }

  return {
    tool: tool.trim(),
    role: role.trim() || 'designer',
    apply,
    baseUrl: sanitizeBaseUrl(baseUrl),
    token: sanitizeString(token),
    approval: sanitizeString(approval),
    input,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 120_000,
  };
}

function sanitizeBaseUrl(url: string): string {
  if (!url.trim()) return 'http://127.0.0.1:4466';
  return url.replace(/\/+$/, '');
}

function sanitizeString(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseInputValue(raw: string): Record<string, unknown> {
  if (!raw) return {};
  if (raw.startsWith('@')) {
    const filePath = path.resolve(process.cwd(), raw.slice(1));
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return parseJsonWithContext(fileContent, filePath);
  }
  return parseJsonWithContext(raw, 'inline --input');
}

function parseJsonWithContext(text: string, context: string): Record<string, unknown> {
  try {
    const value = JSON.parse(text);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    throw new Error('JSON object required.');
  } catch (error) {
    throw new Error(`Failed to parse ${context} payload: ${(error as Error).message}`);
  }
}

function resolveToolPolicy(doc: AgentPolicyDoc, toolName: string): ToolPolicy {
  const tool = doc.tools.find((candidate) => candidate?.name === toolName);
  if (!tool) {
    throw new Error(`Tool "${toolName}" not found in policy (${path.relative(repoRoot, policyPath)}).`);
  }
  return tool;
}

function printPreview(prefix: string, preview: Preview) {
  if (!preview) return;
  if (preview.summary) {
    process.stdout.write(`${prefix} summary: ${preview.summary}\n`);
  }
  if (Array.isArray(preview.notes)) {
    for (const note of preview.notes) {
      process.stdout.write(`${prefix} note: ${note}\n`);
    }
  }
}

function printArtifacts(prefix: string, artifacts: string[]) {
  if (!artifacts.length) {
    process.stdout.write(`${prefix} artifacts: none\n`);
    return;
  }
  process.stdout.write(`${prefix} artifacts (${artifacts.length}):\n`);
  for (const entry of artifacts) {
    process.stdout.write(`${prefix}   - ${entry}\n`);
  }
}

async function bridgeRun(
  options: CliOptions,
  toolPolicy: ToolPolicy,
  doc: AgentPolicyDoc,
  mode: 'dry-run' | 'apply'
): Promise<RunSuccess> {
  const payload = {
    tool: options.tool,
    role: options.role,
    input: {
      ...options.input,
      apply: mode === 'apply',
    },
  };

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');

  if (options.token) {
    headers.set('X-Bridge-Token', options.token);
  }

  const approvalHeader = doc.approvals?.header?.trim() || 'X-Bridge-Approval';

  if (mode === 'apply') {
    const requiresApproval = toolPolicy.approval === 'required';
    let approvalValue = sanitizeString(options.approval);
    if (!approvalValue && requiresApproval) {
      approvalValue = sanitizeString(doc.approvals?.tokens?.granted ?? 'granted');
      if (!approvalValue) {
        throw new Error(`Approval token value required for ${options.tool}; none configured in policy.`);
      }
    }
    if (approvalValue) {
      headers.set(approvalHeader, approvalValue);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(`${options.baseUrl}/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    const content = text.length ? (JSON.parse(text) as RunSuccess | RunError) : null;

    if (!response.ok) {
      const err = (content as RunError | null)?.error;
      const message = err ? `${err.code}: ${err.message}` : `HTTP ${response.status}`;
      const formatted = err?.incidentId ? `${message} (incident ${err.incidentId})` : message;
      const error = new Error(formatted);
      if (err) {
        (error as any).code = err.code;
        (error as any).incidentId = err.incidentId;
        (error as any).details = err.details;
      }
      throw error;
    }

    return content as RunSuccess;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Bridge request timed out after ${options.timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function assertRoleAllowed(role: string, toolPolicy: ToolPolicy) {
  if (!toolPolicy.allow || !toolPolicy.allow.length) return;
  if (toolPolicy.allow.includes(role)) return;
  throw new Error(
    `Role "${role}" is not allowlisted for ${toolPolicy.name}. Allowed roles: ${toolPolicy.allow.join(', ')}.`
  );
}

function assertApplyAllowed(apply: boolean, toolPolicy: ToolPolicy) {
  if (!apply) return;
  const modes = Array.isArray(toolPolicy.modes) ? toolPolicy.modes : ['dry-run'];
  if (!modes.includes('apply')) {
    throw new Error(`Tool ${toolPolicy.name} does not support apply mode via the bridge.`);
  }
}

function printHeader(label: string) {
  process.stdout.write(`\n== ${label} ==\n`);
}

async function main() {
  const options = parseArgs();
  const policy = loadPolicy();
  const toolPolicy = resolveToolPolicy(policy, options.tool);

  assertRoleAllowed(options.role, toolPolicy);
  assertApplyAllowed(options.apply, toolPolicy);

  process.stdout.write(`Bridge: ${options.baseUrl} | Tool: ${options.tool} | Role: ${options.role}\n`);
  process.stdout.write(`Policy doc: ${path.relative(repoRoot, policyPath)}\n`);

  printHeader('Dry Run');
  const dryRun = await bridgeRun(options, toolPolicy, policy, 'dry-run');
  process.stdout.write(
    `dry-run incident: ${dryRun.incidentId} | mode: ${dryRun.mode} | artifacts: ${dryRun.artifacts.length}\n`
  );
  printPreview('  ', dryRun.preview);
  printArtifacts('  ', dryRun.artifacts);

  if (!options.apply) {
    process.stdout.write('\nDry run complete. Re-run with --apply to request an approval-backed execution.\n');
    return;
  }

  printHeader('Apply');
  const applyResult = await bridgeRun(options, toolPolicy, policy, 'apply');
  process.stdout.write(
    `apply incident: ${applyResult.incidentId} | mode: ${applyResult.mode} | artifacts: ${applyResult.artifacts.length}\n`
  );
  printPreview('  ', applyResult.preview);
  printArtifacts('  ', applyResult.artifacts);
  if (policy.docs?.ux) {
    process.stdout.write(`\nDocs: ${policy.docs.ux}\n`);
  }
}

main().catch((error: unknown) => {
  const err = error as Error & { incidentId?: string; code?: string };
  process.stderr.write(`approval flow failed: ${err.message}\n`);
  if (err.incidentId) {
    process.stderr.write(`incident: ${err.incidentId}\n`);
  }
  if (err.code) {
    process.stderr.write(`code: ${err.code}\n`);
  }
  process.exitCode = 1;
});
