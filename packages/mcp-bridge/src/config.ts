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
  allowed: readonly string[];
  writeGated: readonly string[];
};

export type BridgeConfig = {
  cors: CorsConfig;
  auth: AuthConfig;
  approvals: ApprovalConfig;
  rateLimit: RateLimitConfig;
  tools: ToolsConfig;
};

function readToken(envVar: string): string | null {
  const value = process.env[envVar];
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const corsOrigin = 'http://localhost:6006';

export const bridgeConfig: BridgeConfig = {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST', 'OPTIONS'] as const,
    allowHeaders: ['Content-Type', 'Authorization', 'X-Bridge-Token'] as const,
    exposeHeaders: ['Content-Type'] as const,
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
    header: 'X-Bridge-Approval',
  },
  rateLimit: {
    tools: { max: 60, timeWindow: '1 minute' },
    run: { max: 30, timeWindow: '1 minute' },
    artifacts: { max: 120, timeWindow: '1 minute' },
  },
  tools: {
    allowed: [
      'a11y.scan',
      'purity.audit',
      'vrt.run',
      'diag.snapshot',
      'reviewKit.create',
      'brand.apply',
      'billing.reviewKit',
      'billing.switchFixtures',
    ] as const,
    writeGated: ['reviewKit.create', 'brand.apply', 'billing.reviewKit', 'billing.switchFixtures'] as const,
  },
};

export const lowerCaseHeaders = {
  auth: bridgeConfig.auth.header.toLowerCase(),
  approval: bridgeConfig.approvals.header.toLowerCase(),
};
