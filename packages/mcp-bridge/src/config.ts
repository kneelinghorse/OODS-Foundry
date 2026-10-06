import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type CorsConfig = {
  origin: string | string[];
  methods: readonly string[];
  allowHeaders: readonly string[];
  exposeHeaders: readonly string[];
  credentials: boolean;
  maxAgeSeconds: number;
};

export type AuthConfig = {
  header: string;
  env: string;
  token: string | null;
  requiredByDefault: boolean;
};

export type ApprovalConfig = {
  header: string;
};

export type RateLimitWindow = {
  max: number;
  timeWindow: string;
};

export type RateLimitConfig = {
  tools: RateLimitWindow;
  run: RateLimitWindow;
  artifacts: RateLimitWindow;
};

export type ToolsConfig = {
  allowed: string[];
  writeGated: string[];
};

export type BridgeConfig = {
  cors: CorsConfig;
  auth: AuthConfig;
  approvals: ApprovalConfig;
  rateLimit: RateLimitConfig;
  tools: ToolsConfig;
};

export type ToolMode = 'dry-run' | 'apply';

export type AgentToolPolicy = {
  name: string;
  modes?: ToolMode[];
  approval?: 'required' | 'optional';
  allow?: string[];
};

export type AgentPolicyDoc = {
  version: number;
  updated?: string;
  docs?: { rules?: string; ux?: string };
  limits?: { ratePerMinute?: number; concurrency?: number };
  defaults?: {
    modes?: ToolMode[];
    approval?: 'required' | 'optional';
    ratePerMinute?: number;
    concurrency?: number;
  };
  approvals?: {
    header?: string;
    tokens?: Record<string, string>;
  };
  tools: AgentToolPolicy[];
};

type ToolPolicyState = {
  modes: ToolMode[];
  approval: 'required' | 'optional';
  allow: string[];
};

// import.meta.url → file:///repo/packages/mcp-bridge/{src|dist}/config.{ts|js}
// new URL('.', ...) → directory with trailing slash
// path.dirname strips trailing slash → /repo/packages/mcp-bridge
// So we go up 2 levels to reach the repo root.
const CONFIG_DIR = path.dirname(fileURLToPath(new URL('.', import.meta.url)));
const REPO_ROOT = path.resolve(CONFIG_DIR, '..', '..');
const POLICY_PATH = path.resolve(REPO_ROOT, 'configs/agent/policy.json');

export class BridgeStartupError extends Error {
  readonly retryable = false;

  constructor(
    readonly code: 'BRIDGE_POLICY_MISSING' | 'BRIDGE_POLICY_INVALID',
    readonly policyPath: string,
    cause?: unknown,
  ) {
    super(`${code}: Agent policy ${policyPath} is ${code === 'BRIDGE_POLICY_MISSING' ? 'missing' : 'invalid'}; bridge startup refused.`, { cause });
    this.name = 'BridgeStartupError';
  }
}

export function loadAgentPolicyDoc(policyPath = POLICY_PATH): AgentPolicyDoc {
  let raw: string;
  try {
    raw = fs.readFileSync(policyPath, 'utf8');
  } catch (error) {
    throw new BridgeStartupError(
      (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'BRIDGE_POLICY_MISSING' : 'BRIDGE_POLICY_INVALID',
      policyPath,
      error,
    );
  }
  try {
    const parsed = JSON.parse(raw) as AgentPolicyDoc;
    if (!parsed || !Array.isArray(parsed.tools)) throw new Error('Agent policy must contain a tools array.');
    return parsed;
  } catch (error) {
    throw new BridgeStartupError('BRIDGE_POLICY_INVALID', policyPath, error);
  }
}

function asToolModes(values: unknown, defaults: ToolMode[]): ToolMode[] {
  if (!Array.isArray(values) || values.length === 0) return defaults;
  const modes: ToolMode[] = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'dry-run' || normalized === 'dryrun') {
      modes.push('dry-run');
    } else if (normalized === 'apply') {
      modes.push('apply');
    }
  }
  return modes.length ? Array.from(new Set(modes)) : defaults;
}

function ensureApproval(value: unknown, fallback: 'required' | 'optional'): 'required' | 'optional' {
  if (value === 'required' || value === 'optional') return value;
  return fallback;
}

const agentPolicyDoc = loadAgentPolicyDoc();

const defaultModes = asToolModes(agentPolicyDoc.defaults?.modes, ['dry-run']);
const defaultApproval = ensureApproval(agentPolicyDoc.defaults?.approval, 'optional');

const toolPolicyIndex = new Map<string, ToolPolicyState>();
for (const tool of agentPolicyDoc.tools) {
  if (!tool || typeof tool.name !== 'string') continue;
  const name = tool.name;
  const modes = asToolModes(tool.modes, defaultModes);
  const approval = ensureApproval(tool.approval, defaultApproval);
  const allow =
    Array.isArray(tool.allow) && tool.allow.length
      ? tool.allow
          .filter((role): role is string => typeof role === 'string' && role.trim().length > 0)
          .map((role) => role.trim())
      : ['designer'];
  toolPolicyIndex.set(name, { modes, approval, allow });
}

const allowedTools = Array.from(toolPolicyIndex.keys());
const approvalRequiredList = allowedTools.filter((name) => toolPolicyIndex.get(name)?.approval === 'required');
const applyCapableList = allowedTools.filter((name) => toolPolicyIndex.get(name)?.modes.includes('apply'));

const corsOrigin: string | string[] = process.env.MCP_BRIDGE_CORS_ORIGIN
  ? process.env.MCP_BRIDGE_CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:6006', 'http://localhost:3000'];

const approvalHeader = agentPolicyDoc.approvals?.header?.trim() || 'X-Bridge-Approval';

const approvalTokensRaw = agentPolicyDoc.approvals?.tokens ?? {};
const approvalGrantedTokens = new Set<string>();
const approvalDeniedTokens = new Set<string>();

if (approvalTokensRaw && typeof approvalTokensRaw === 'object') {
  for (const [key, value] of Object.entries(approvalTokensRaw)) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const normalizedValue = trimmed.toLowerCase();
    const lower = key.toLowerCase();
    if (lower.includes('grant') || lower.includes('approve') || lower === 'ok') {
      approvalGrantedTokens.add(normalizedValue);
    } else if (lower.includes('deny') || lower.includes('reject')) {
      approvalDeniedTokens.add(normalizedValue);
    }
  }
}

function readToken(envVar: string): string | null {
  const value = process.env[envVar];
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const bridgeConfig: BridgeConfig = {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Bridge-Token', approvalHeader],
    exposeHeaders: ['Content-Type'],
    credentials: false,
    maxAgeSeconds: 600,
  },
  auth: {
    header: 'X-Bridge-Token',
    env: 'BRIDGE_TOKEN',
    token: readToken('BRIDGE_TOKEN'),
    requiredByDefault: false,
  },
  approvals: {
    header: approvalHeader,
  },
  rateLimit: {
    tools: { max: 60, timeWindow: '1 minute' },
    run: { max: 30, timeWindow: '1 minute' },
    artifacts: { max: 120, timeWindow: '1 minute' },
  },
  tools: {
    allowed: allowedTools,
    writeGated: approvalRequiredList,
  },
};

export const lowerCaseHeaders = {
  auth: bridgeConfig.auth.header.toLowerCase(),
  approval: bridgeConfig.approvals.header.toLowerCase(),
};

export const toolPolicies = toolPolicyIndex;
export const approvalRequiredTools = new Set(approvalRequiredList);
export const applyCapableTools = new Set(applyCapableList);
export const policyDocs = {
  rules: agentPolicyDoc.docs?.rules ?? 'docs/mcp/Policy-Rules.md',
  ux: agentPolicyDoc.docs?.ux ?? 'docs/mcp/Policy-UX.md',
};
export const approvalTokenSets = {
  granted: approvalGrantedTokens,
  denied: approvalDeniedTokens,
};
