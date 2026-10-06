/**
 * HTTP client for the OODS MCP Bridge.
 *
 * Proxied via Vite dev server: /api/* → http://127.0.0.1:4466/*
 */

const BASE = "/api";

export type BridgeResponse<T = unknown> =
  | {
      ok: true;
      tool: string;
      mode: string;
      result: T;
      preview?: unknown;
    }
  | {
      ok?: false;
      error: { code: string; message: string };
    };

export type PipelineInput = {
  object?: string;
  intent?: string;
  context?: string;
  layout?: string;
  framework?: "react" | "vue" | "html";
  styling?: "inline" | "tokens" | "tailwind";
  save?: string;
  options?: {
    compact?: boolean;
    showConfidence?: boolean;
    confidenceThreshold?: number;
  };
};

export type PipelineResult = {
  schemaRef?: string;
  compose: {
    object?: string;
    context?: string;
    layout: string;
    componentCount: number;
  };
  validation?: {
    status: string;
    errors: Array<{ code: string; message: string }>;
    warnings: Array<{ code: string; message: string }>;
  };
  render?: {
    html?: string;
    tokenCssRef?: string;
    meta: Record<string, unknown>;
  };
  code?: {
    framework: string;
    styling: string;
    output: string;
  };
  summary?: string;
  metrics?: {
    totalNodes: number;
    componentsUsed: number;
    fieldsBound: number;
    fieldsOmitted?: Array<{ field: string; reason: string }>;
    responseBytes: number;
  };
  pipeline: {
    steps: string[];
    stepLatency?: Record<string, number>;
    duration: number;
  };
  error?: {
    step: string;
    code: string;
    message: string;
  };
};

export type MapApplyDiff = {
  create: number;
  patch: number;
  skip: number;
  conflict: number;
  queued: number;
  changedFields: string[];
  addedTraits: string[];
  removedTraits: string[];
};

export type MapApplyRoute = {
  objectId: string;
  name: string;
  action: "create" | "patch" | "skip";
  confidence: number;
  recommendedOodsTraits: string[];
  existingMapId?: string;
  mappingId?: string;
  reason: string;
  persisted: boolean;
  diff?: {
    added_traits: string[];
    removed_traits: string[];
    changed_fields: Array<{
      field: string;
      from?: unknown;
      to?: unknown;
    }>;
  };
};

export type MapApplyQueued = {
  objectId: string;
  name: string;
  action: "create" | "patch" | "skip" | "conflict";
  confidence: number;
  threshold: number;
  queueReason: "below_confidence";
  recommendedOodsTraits: string[];
  existingMapId?: string;
  reason: string;
  diff?: MapApplyRoute["diff"];
};

export type MapApplyConflict = {
  objectId: string;
  name: string;
  action: "conflict";
  confidence: number;
  existingMapId?: string;
  reason: string;
};

export type MapApplyResult = {
  applied: MapApplyRoute[];
  skipped: MapApplyRoute[];
  queued: MapApplyQueued[];
  conflicted: MapApplyConflict[];
  errors: Array<{
    objectId?: string;
    name?: string;
    action?: string;
    message: string;
  }>;
  diff: MapApplyDiff;
  conflictArtifactPath?: string;
  etag: string;
};

export async function runTool<T = unknown>(
  tool: string,
  input: Record<string, unknown>,
): Promise<BridgeResponse<T>> {
  const res = await fetch(`${BASE}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool, input }),
  });
  return res.json() as Promise<BridgeResponse<T>>;
}

export async function runPipeline(
  input: PipelineInput,
): Promise<BridgeResponse<PipelineResult>> {
  return runTool<PipelineResult>("pipeline", input as Record<string, unknown>);
}

export async function runMapApply(
  reportPath: string,
  minConfidence = 0.75,
): Promise<BridgeResponse<MapApplyResult>> {
  return runTool<MapApplyResult>("map_apply", {
    reportPath,
    minConfidence,
  });
}

export type FidelityKind =
  | "boxes-arrows"
  | "wireframe"
  | "review"
  | "branded-mockup";

export type FidelityPreviewIssue = {
  code: string;
  message: string;
  entity?: string;
};

export type FidelityPreviewResult = {
  status: "ok" | "warning" | "error";
  fidelityKind: FidelityKind;
  fixture: string;
  html: string;
  warnings: FidelityPreviewIssue[];
  errors: FidelityPreviewIssue[];
  meta: {
    entityCount: number;
    appliedBrandOverlay?: string;
  };
};

export async function runFidelityPreview(input: {
  fidelityKind: FidelityKind;
  fixture: string;
  options?: {
    variant?: string;
    brandOverlay?: string;
    reviewThreshold?: number;
    includeStyles?: boolean;
  };
}): Promise<BridgeResponse<FidelityPreviewResult>> {
  return runTool<FidelityPreviewResult>(
    "fidelity_preview",
    input as Record<string, unknown>,
  );
}

// ---------------------------------------------------------------------------
// review.chain — C5 chain MCP tool (sprint-105 m04)
// ---------------------------------------------------------------------------

export type PolicyDecision = 'accept' | 'patch' | 'defer' | 'dismiss';
export type ConfidenceTier = 'high' | 'medium' | 'low' | 'unknown';

export type PolicyPredicate =
  | { kind: 'confidence_threshold'; threshold: number; matchUnknown?: boolean }
  | { kind: 'signal_type_floor'; signal: string; floor: number }
  | { kind: 'entity_urn_match'; urn?: string; pattern?: string };

export type Policy = {
  id: string;
  when: PolicyPredicate;
  then: PolicyDecision;
  reason?: string;
};

export type PolicyBundle = {
  id?: string;
  policies: Policy[];
};

export type ReviewChainSignal = {
  name: string;
  score: number;
  hint?: string;
};

export type ReviewChainQueueEntry = {
  urn: string;
  tier: ConfidenceTier;
  score: number | null;
  flaggedForReview: boolean;
  lowestSignals: ReviewChainSignal[];
  elementName: string;
  elementType: string;
};

export type ReviewChainQueueSummary = {
  entitiesTotal: number;
  entitiesIncluded: number;
  flaggedCount: number;
  tierCounts: { high: number; medium: number; low: number; unknown: number };
  reviewThreshold: number;
  lowestSignalsN: number;
  flaggedOnly: boolean;
};

export type ReviewChainQueueArtifact = {
  entries: ReviewChainQueueEntry[];
  summary: ReviewChainQueueSummary;
  source: { sourceManifest: string; [key: string]: unknown };
};

export type ReviewChainGap =
  | { source: 'signal'; name: string; score: number; threshold: number; hint?: string }
  | { source: 'evidence_refs'; detail: string }
  | { source: 'confidence_decomposition'; detail: string };

export type ReviewChainConflictDetailArtifact = {
  urn: string;
  tier: ConfidenceTier;
  score: number | null;
  flaggedForReview: boolean;
  element: { name: string; type: string; object?: string; action?: string };
  signals: ReviewChainSignal[];
  gaps: ReviewChainGap[];
  context?: {
    projectionVariants?: string[];
    brandOverlay?: string;
    schemaorg?: string;
  };
  source?: { sourceManifest?: string };
};

export type ReviewChainResolution = {
  urn: string;
  decision: PolicyDecision;
  reason: string;
  policyId: string;
  evaluatedScore: number | null;
  evaluatedTier: ConfidenceTier;
};

export type ReviewChainAuditTrail = {
  evaluatedAt: string;
  defaultAction: PolicyDecision;
  entityCount: number;
  policyBundle: PolicyBundle;
  matchedPolicyIds: string[];
};

export type ReviewChainSummaryEntry = {
  urn: string;
  decision: PolicyDecision;
  reason: string;
  policyId: string;
  evaluatedScore: number | null;
  evaluatedTier: ConfidenceTier;
  elementName: string;
  elementType: string;
};

export type ReviewChainSummaryArtifact = {
  entries: ReviewChainSummaryEntry[];
  summary: {
    entriesTotal: number;
    decisionCounts: { accept: number; patch: number; defer: number; dismiss: number };
    defaultActionUsed: number;
    matchedPolicyIds: string[];
  };
  auditTrail: {
    evaluatedAt: string;
    defaultAction: PolicyDecision;
    entityCount: number;
    policyBundleId?: string;
    matchedPolicyIds: string[];
  };
  source?: { sourceManifest?: string; manifestPath?: string };
};

export type ReviewChainResult = {
  queue: ReviewChainQueueArtifact;
  resolutions: ReviewChainResolution[];
  auditTrail: ReviewChainAuditTrail;
  conflictDetails: Array<{ urn: string; detail: ReviewChainConflictDetailArtifact }>;
  summary: ReviewChainSummaryArtifact;
  diagnostics: {
    fixture: string;
    fixtureSource: 'allow-list';
    policyBundleId?: string;
    entityCount: number;
    flaggedCount: number;
  };
};

export async function runReviewChain(input: {
  fixture: string;
  policies: PolicyBundle;
  options?: {
    reviewThreshold?: number;
    lowestSignalsN?: number;
    evidenceGapThreshold?: number;
    defaultAction?: PolicyDecision;
  };
}): Promise<BridgeResponse<ReviewChainResult>> {
  return runTool<ReviewChainResult>('review_chain', input as Record<string, unknown>);
}

export async function healthCheck(): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${BASE}/health`);
    const data = await res.json();
    return { ok: Boolean(data?.status === "ok" || data?.ok) };
  } catch {
    return { ok: false };
  }
}
