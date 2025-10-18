export type ToolName =
  | 'a11y.scan'
  | 'purity.audit'
  | 'vrt.run'
  | 'diag.snapshot'
  | 'reviewKit.create'
  | 'brand.apply'
  | 'billing.reviewKit'
  | 'billing.switchFixtures';

export type JsonSchema = {
  type?: string;
  title?: string;
  description?: string;
  enum?: readonly unknown[];
  default?: unknown;
  properties?: Record<string, JsonSchema>;
  required?: readonly string[];
  items?: JsonSchema;
  additionalProperties?: boolean;
};

export type ToolDescriptor = {
  name: ToolName;
  label: string;
  description?: string;
  inputSchema: JsonSchema;
};

export type ToolRunInput = Record<string, unknown>;

export type PlanDiffChange = {
  type: 'context' | 'add' | 'remove';
  value: string;
};

export type PlanDiffHunk = {
  header: string;
  changes: PlanDiffChange[];
};

export type PlanDiff = {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  summary?: {
    additions: number;
    deletions: number;
  };
  hunks: PlanDiffHunk[];
  structured?:
    | {
        type: 'json';
        before?: unknown;
        after?: unknown;
      }
    | undefined;
};

export type ArtifactInfo = {
  path: string;
  name: string;
  purpose?: string | null;
  sha256?: string | null;
  sizeBytes?: number | null;
};

export type ArtifactRunSummary = {
  id: string;
  date: string;
  summary: string;
  tool?: string | null;
  startedAt?: string | null;
};

export type ArtifactRunFile = {
  id: string;
  name: string;
  purpose: string | null;
  size: number | null;
  sha256: string | null;
  openUrl: string;
};

export type ToolRunPreview = {
  summary?: string | null;
  notes?: string[];
  diffs?: PlanDiff[];
};

export type ToolRunSuccess = {
  ok: true;
  tool: ToolName;
  role: string | null;
  mode: 'apply' | 'dry-run';
  incidentId: string | null;
  artifacts: string[];
  transcriptPath: string | null;
  bundleIndexPath: string | null;
  diagnosticsPath: string | null;
  preview?: ToolRunPreview;
  artifactsDetail?: ArtifactInfo[];
};

export type ToolRunError = {
  ok: false;
  error: {
    code: string;
    message?: string;
    messages?: unknown;
    incidentId?: string;
  };
};

export type ToolRunResponse = ToolRunSuccess | ToolRunError;

export class BridgeError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
  incidentId?: string;

  constructor(message: string, options: { status?: number; code?: string; details?: unknown; incidentId?: string } = {}) {
    super(message);
    this.name = 'BridgeError';
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.incidentId = options.incidentId;
  }
}
