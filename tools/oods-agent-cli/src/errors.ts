export type ErrorSeverity = 'error' | 'warning';

export type TaxonomyCode = 'POLICY_DENIED' | 'TIMEOUT' | 'RATE_LIMITED' | 'VALIDATION_ERROR' | 'RUN_ERROR';

export type ResolvedErrorDescriptor = {
  taxonomyCode: TaxonomyCode | null;
  source: 'code' | 'http' | 'fallback';
  title: string;
  description: string;
  guidance: string;
  severity: ErrorSeverity;
  exitCode: 1 | 2;
};

type DescriptorShape = {
  title: string;
  description: string;
  guidance: string;
  severity: ErrorSeverity;
  exitCode: 1 | 2;
};

const CODE_DESCRIPTORS: Record<TaxonomyCode, DescriptorShape> = {
  POLICY_DENIED: {
    title: 'Policy blocked the run',
    description: 'The MCP policy engine denied this action for the current role or missing approval.',
    guidance: 'Request maintainer approval, switch to a read-only tool, or rerun with an allowed role.',
    severity: 'error',
    exitCode: 2,
  },
  TIMEOUT: {
    title: 'Bridge timed out waiting for the server',
    description: 'The MCP server did not respond before the bridge timeout expired.',
    guidance: 'Check MCP server health and retry. Long-running tools may need investigation.',
    severity: 'error',
    exitCode: 2,
  },
  RATE_LIMITED: {
    title: 'Requests are rate limited',
    description: 'The bridge or policy guards are throttling repeated requests.',
    guidance: 'Slow down automated retries and wait a moment before trying again.',
    severity: 'warning',
    exitCode: 2,
  },
  VALIDATION_ERROR: {
    title: 'Request payload is invalid',
    description: 'Inputs failed schema validation or the request format was not accepted.',
    guidance: 'Fix the payload (tool name, input JSON, or media type) and rerun.',
    severity: 'warning',
    exitCode: 1,
  },
  RUN_ERROR: {
    title: 'Run failed unexpectedly',
    description: 'The MCP server exited or returned an unexpected error during execution.',
    guidance: 'Check MCP server logs, restart the service if needed, and retry the command.',
    severity: 'error',
    exitCode: 2,
  },
};

const HTTP_DESCRIPTORS: Record<number, DescriptorShape> = {
  401: {
    title: 'Bridge authentication required',
    description: 'The bridge rejected the request without a valid X-Bridge-Token.',
    guidance: 'Provide the configured bridge token (Storybook settings or CLI flag) and retry.',
    severity: 'error',
    exitCode: 2,
  },
  403: {
    title: 'Bridge denied this request',
    description: 'The bridge blocked the run because the tool is forbidden or approval is missing.',
    guidance: 'Confirm the tool is allowed and supply an approval token when applying changes.',
    severity: 'error',
    exitCode: 2,
  },
  415: {
    title: 'Unsupported media type',
    description: 'The bridge only accepts application/json payloads.',
    guidance: 'Send JSON with the correct Content-Type header and retry.',
    severity: 'warning',
    exitCode: 1,
  },
  429: {
    title: 'Too many requests',
    description: 'The bridge is rate limiting fast repeated requests.',
    guidance: 'Pause before retrying or stagger automation to stay within the allowance.',
    severity: 'warning',
    exitCode: 2,
  },
};

const FALLBACK_DESCRIPTOR: DescriptorShape = {
  title: 'Run failed',
  description: 'The bridge or MCP server returned an unexpected error.',
  guidance: 'Retry the action or share the incident ID with a maintainer.',
  severity: 'error',
  exitCode: 1,
};

const CODE_ALIASES: Record<string, TaxonomyCode> = {
  RATE_LIMIT: 'RATE_LIMITED',
  CONCURRENCY: 'RATE_LIMITED',
  SCHEMA_INPUT: 'VALIDATION_ERROR',
  SCHEMA_OUTPUT: 'VALIDATION_ERROR',
  BAD_REQUEST: 'VALIDATION_ERROR',
  UNKNOWN_TOOL: 'VALIDATION_ERROR',
  FORBIDDEN_TOOL: 'POLICY_DENIED',
  READ_ONLY_TOOL: 'POLICY_DENIED',
  READ_ONLY_ENFORCED: 'POLICY_DENIED',
  MISSING_TOKEN: 'POLICY_DENIED',
  INVALID_TOKEN: 'POLICY_DENIED',
  PROCESS_EXIT: 'RUN_ERROR',
  SERVER_NOT_BUILT: 'RUN_ERROR',
};

export function normalizeTaxonomyCode(code?: string | null): TaxonomyCode | null {
  if (!code) return null;
  const normalized = code.toUpperCase();
  return CODE_ALIASES[normalized] ?? (normalized in CODE_DESCRIPTORS ? (normalized as TaxonomyCode) : null);
}

function fromShape(source: ResolvedErrorDescriptor['source'], taxonomyCode: TaxonomyCode | null, shape: DescriptorShape): ResolvedErrorDescriptor {
  return {
    taxonomyCode,
    source,
    title: shape.title,
    description: shape.description,
    guidance: shape.guidance,
    severity: shape.severity,
    exitCode: shape.exitCode,
  };
}

export function classifyError(code?: string | null, status?: number | null): ResolvedErrorDescriptor {
  const taxonomyCode = normalizeTaxonomyCode(code);
  if (taxonomyCode) {
    return fromShape('code', taxonomyCode, CODE_DESCRIPTORS[taxonomyCode]);
  }
  const statusKey = typeof status === 'number' ? status : null;
  if (statusKey && HTTP_DESCRIPTORS[statusKey]) {
    return fromShape('http', taxonomyCode, HTTP_DESCRIPTORS[statusKey]);
  }
  return fromShape('fallback', taxonomyCode, FALLBACK_DESCRIPTOR);
}
