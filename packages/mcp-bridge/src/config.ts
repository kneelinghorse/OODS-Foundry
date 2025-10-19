import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type CorsConfig = {
  origin: string;
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

const CONFIG_DIR = path.dirname(fileURLToPath(new URL('.', import.meta.url)));
const REPO_ROOT = path.resolve(CONFIG_DIR, '..', '..', '..');
const POLICY_PATH = path.resolve(REPO_ROOT, 'configs/agent/policy.json');

const FALLBACK_POLICY: AgentPolicyDoc = {
  version: 0,
  docs: {
    rules: 'docs/mcp/Policy-Rules.md',
    ux: 'docs/mcp/Policy-UX.md',
  },
  approvals: {
    header: 'X-Bridge-Approval',
    tokens: { granted: 'granted', denied: 'denied' },
  },
  defaults: {
    modes: ['dry-run'],
    approval: 'optional',
  },
  tools: [
    { name: 'a11y.scan', modes: ['dry-run'], approval: 'optional' },
    { name: 'purity.audit', modes: ['dry-run'], approval: 'optional' },
    { name: 'vrt.run', modes: ['dry-run'], approval: 'optional' },
    { name: 'diag.snapshot', modes: ['dry-run'], approval: 'optional' },
    { name: 'reviewKit.create', modes: ['dry-run', 'apply'], approval: 'required' },
    { name: 'brand.apply', modes: ['dry-run', 'apply'], approval: 'required' },
    { name: 'billing.reviewKit', modes: ['dry-run', 'apply'], approval: 'required' },
    { name: 'billing.switchFixtures', modes: ['dry-run', 'apply'], approval: 'required' },
    { name: 'release.verify', modes: ['dry-run'], approval: 'optional', allow: ['maintainer'] },
    { name: 'release.tag', modes: ['dry-run', 'apply'], approval: 'required', allow: ['maintainer'] },
    { name: 'tokens.build', modes: ['dry-run'], approval: 'optional' },
  ],
};

function loadAgentPolicyDoc(): AgentPolicyDoc {
  try {
    const raw = fs.readFileSync(POLICY_PATH, 'utf8');
    const parsed = JSON.parse(raw) as AgentPolicyDoc;
    if (!Array.isArray(parsed.tools)) {
      parsed.tools = [];
    }
    return parsed;
  } catch {
    return FALLBACK_POLICY;
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

const corsOrigin = 'http://localhost:6006';

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
