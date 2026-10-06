export type ArtifactRole = 'input' | 'output';

export type TranscriptArtifact = {
  path: string;
  sha256: string;
  role: ArtifactRole;
  name?: string;
  sizeBytes?: number | null;
  purpose?: string;
};

export type TranscriptRedaction = {
  field: string;
  reason: string;
};

export type TranscriptArgs = {
  payload: unknown;
  apply: boolean;
  options: {
    approve: boolean;
    role?: string | null;
  };
  replaySource?: string | null;
};

export type TranscriptSignature = {
  algo: string;
  hash: string;
};

export type TranscriptDraft = {
  schemaVersion?: string;
  source: string;
  command: 'plan' | 'apply' | 'replay' | 'preview';
  tool: string;
  args: TranscriptArgs;
  user: string;
  hostname: string;
  startTime: string;
  endTime: string;
  exitCode: number;
  artifacts: TranscriptArtifact[];
  redactions: TranscriptRedaction[];
  meta?: Record<string, unknown>;
  signature?: TranscriptSignature;
};

export type TranscriptDocument = TranscriptDraft & {
  schemaVersion: string;
  signature: TranscriptSignature;
};

export type BundleIndexEntryInput = string | BundleIndexEntry;

export type BundleIndexEntry = {
  path: string;
  name?: string;
  purpose?: string | null;
  sizeBytes?: number | null;
  sha256?: string;
  openUrl?: string;
  role?: ArtifactRole;
};

export type BundleIndexFile = BundleIndexEntry & { sha256: string };

export type BundleIndexDocument = {
  schemaVersion: string;
  generatedAt: string;
  files: BundleIndexFile[];
};

export type DiagnosticsBrandSummary = {
  aaPassPct?: number | null;
  aaPairsTotal?: number | null;
  deltaGuardrails?: { maxDeltaL?: number | null; maxDeltaC?: number | null; ok?: boolean | null };
  hcPngCount?: number | null;
  notes?: string[];
};

export type DiagnosticsVrtSummary = {
  totalStories?: number | null;
  darkCount?: number | null;
  allowlistCount?: number | null;
  flakePct?: number | null;
  runUrl?: string | null;
};

export type DiagnosticsInventorySummary = {
  components?: number | null;
  stories?: number | null;
};

export type DiagnosticsTokensSummary = {
  buildMs?: number | null;
  lastBuildAt?: string | null;
};

export type DiagnosticsPackageSummary = {
  name: string;
  version?: string | null;
  reproducible?: boolean | null;
  sha256?: string | null;
  sizeBytes?: number | null;
  warnings?: string[];
};

export type DiagnosticsReleaseChangelogEntry = {
  type?: string;
  scope?: string | null;
  description?: string | null;
  breaking?: boolean | null;
};

export type DiagnosticsRelease = {
  changelog?: {
    baseTag?: string | null;
    warnings?: string[];
    entries?: DiagnosticsReleaseChangelogEntry[];
  };
};

export type DiagnosticsDocument = {
  schemaVersion: string;
  createdAt: string;
  sprint?: string | null;
  runId: string;
  tool: string;
  summary: string;
  notes?: string[];
  brandA?: DiagnosticsBrandSummary;
  vrt?: DiagnosticsVrtSummary;
  inventory?: DiagnosticsInventorySummary;
  tokens?: DiagnosticsTokensSummary;
  packages?: DiagnosticsPackageSummary[];
  release?: DiagnosticsRelease;
};

export type DiagnosticsWriteInput = Omit<DiagnosticsDocument, 'schemaVersion' | 'createdAt'> & {
  createdAt?: string;
};
