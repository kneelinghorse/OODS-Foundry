import type { ComponentSubstitution } from './component-substitution.js';
import type {
  Stage1CapabilityEntity as GeneratedStage1CapabilityEntity,
  Stage1DisambiguationDecision as GeneratedStage1DisambiguationDecision,
  Stage1PreferredTermEntity as GeneratedStage1PreferredTermEntity,
  Stage1ProjectionVariant as GeneratedStage1ProjectionVariant,
} from "../schemas/generated.js";
import type { GeneratedArtifact } from "../codegen/types.js";

export type {
  CodegenAcceptedReleaseEvidence,
  CodegenFallbackPolicy,
  CodegenReleaseEvidence,
  CodegenReleaseEvidenceClass,
  CodegenReleaseEvidenceItem,
  CodegenTargetResolution,
  CodegenValidationCheck,
  CodegenValidationEnforcement,
  CodegenValidationProfile,
  CodegenValidationReceipt,
  CodegenValidationScope,
  GeneratedArtifact,
  GeneratedArtifactAction,
  GeneratedArtifactActionParameter,
  GeneratedArtifactActionSource,
  GeneratedArtifactFile,
  GeneratedDependency,
} from "../codegen/types.js";

export type BaseInput = { apply?: boolean };

export type TokensBuildInput = BaseInput & {
  /** A brand in the brand registry (s213-m04). */
  brand?: string;
  theme?: "light" | "dark" | "hc";
};

export type PlanDiffChange = {
  type: "context" | "add" | "remove";
  value: string;
};

export type PlanDiffHunk = {
  header: string;
  changes: PlanDiffChange[];
};

export type PlanDiffSummary = {
  additions?: number;
  deletions?: number;
};

export type PlanDiff = {
  path: string;
  status: "added" | "modified" | "deleted";
  summary?: PlanDiffSummary;
  hunks: PlanDiffHunk[];
  structured?:
    | {
        type: "json";
        before?: unknown;
        after?: unknown;
      }
    | undefined;
};

export type ArtifactDetail = {
  path: string;
  name: string;
  purpose?: string | null;
  sha256?: string | null;
  sizeBytes?: number | null;
};

export type ToolPreview = {
  summary?: string | null;
  notes?: string[];
  diffs?: PlanDiff[];
  specimens?: string[];
};

export type PreviewVerbosity = "full" | "compact";

export type GenericOutput = {
  structuredData?: Record<string, unknown>;
  artifacts: string[];
  diagnosticsPath?: string;
  transcriptPath?: string;
  bundleIndexPath?: string;
  preview?: ToolPreview;
  artifactsDetail?: ArtifactDetail[];
};

export type BrandApplyStrategy = "alias" | "patch";

export type BrandApplyInput = BaseInput & {
  /** A brand in the brand registry (s213-m04). */
  brand?: string;
  delta: Record<string, unknown> | Record<string, unknown>[];
  strategy?: BrandApplyStrategy;
  preview?: {
    verbosity?: PreviewVerbosity;
  };
};

export type ReleaseVerifyInput = BaseInput & {
  packages?: string[];
  fromTag?: string;
};

export type ReleaseVerifyResult = GenericOutput & {
  results: Array<{
    name: string;
    version: string;
    identical: boolean;
    sha256: string;
    sizeBytes: number;
    warnings?: string[];
    files?: string[];
  }>;
  changelogPath: string;
  summary: string;
  warnings?: string[];
};

export type StructuredDataset = "components" | "tokens" | "manifest";

/** Stage1 structured artifact kinds consumable via structuredData.fetch. */
export type Stage1RollupKind =
  | "identity_graph"
  | "capability_rollup"
  | "object_rollup"
  | "drift_report"
  | "derived_analysis"
  // s205-m04: the run-view kinds, admitted at their pinned versions (structuredData.fetch.ts RUN_VIEW_KINDS).
  | "a11y_report"
  | "report_index"
  | "a11y_evidence"
  | "run_manifest";

export type StructuredDataFetchInput = {
  dataset?: StructuredDataset;
  kind?: Stage1RollupKind;
  runPath?: string;
  ifNoneMatch?: string;
  includePayload?: boolean;
  version?: string;
  listVersions?: boolean;
  /** Live components dataset only: list OODS Foundry's internal objects too, after the business objects. */
  includeInternal?: boolean;
};

export type StructuredDataFetchOutput = {
  dataset?: StructuredDataset;
  kind?: Stage1RollupKind;
  schemaVersion?: string;
  runId?: string;
  version?: string | null;
  generatedAt?: string | null;
  etag: string;
  matched: boolean;
  payloadIncluded: boolean;
  path: string;
  manifestPath?: string | null;
  sizeBytes: number;
  schemaValidated: boolean;
  validationErrors?: string[];
  warnings?: string[];
  meta?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  availableVersions?: string[];
  requestedVersion?: string | null;
  resolvedVersion?: string | null;
};

/* Stage1 rollup shapes — accepted schema_versions (post v1.6.0):
 *   identity_graph: 1.1.0 | 1.2.0
 *   capability_rollup: 1.1.0 | 1.2.0
 *   object_rollup: 1.0.0 | 1.1.0
 *   drift_report: 1.0.0–1.4.0
 * See ROLLUP_ALLOWED_SCHEMA_VERSIONS in structuredData.fetch.ts.
 */

export type Stage1EvidenceRef = {
  artifact_ref: string;
  json_pointer: string;
  run_id?: string;
  source_surface?: string;
  observation_type?: string;
};

/**
 * Stage1 v1.6.0 unified confidence surfaces (contract §2d).
 * Identical shape across identity_graph (candidate_mappings[]),
 * capability_rollup (presentations[]), object_rollup (projection_variants[]),
 * and reconciliation_report (candidate_objects[].decomposition).
 */
export type Stage1ConfidenceMethodId = 'weighted_blend_v1' | 'threshold_gate_v1' | string;

export type Stage1ConfidenceSignal = {
  type: string;
  raw_score: number;
  weight: number;
  weighted_contribution: number;
  evidence_ref: Stage1EvidenceRef;
  hint?: string;
};

export type Stage1ConfidenceDecomposition = {
  total: number;
  method: Stage1ConfidenceMethodId;
  signals: Stage1ConfidenceSignal[];
};

export type Stage1ConfidenceSummary = {
  total: number;
  method: Stage1ConfidenceMethodId;
  evidence_ref: Stage1EvidenceRef;
  top_signal_types?: string[];
};

export type Stage1CandidateMapping = {
  target: string;
  /** v1.1.0 scalar; v1.2.0 full decomposition. Use unwrap helpers in the normalizer. */
  confidence: number | Stage1ConfidenceDecomposition;
  /** Legacy v1.1.0 surface; removed in v1.2.0 (hints moved into confidence.signals[].hint). */
  hints?: Array<{ heuristic: string; contribution: number; detail?: string }>;
};

export type Stage1MemberCandidate = {
  surface_id: string;
  source_surface?: string;
  label?: string;
  aliases?: string[];
  attributes?: Record<string, unknown>;
  evidence_refs?: Stage1EvidenceRef[];
};

export type Stage1IdentityGraphNode = {
  canonical_id: string;
  canonical_label?: string;
  identity_class: string;
  candidate_mappings?: Stage1CandidateMapping[];
  review_status?: string;
  member_candidates?: Stage1MemberCandidate[];
};

export type Stage1IdentityGraph = {
  kind: "identity_graph";
  schema_version: string;
  generated_at: string;
  run_id: string;
  target: { id: string; url?: string };
  nodes: Stage1IdentityGraphNode[];
};

export type Stage1CapabilityPresentation = {
  surface: string;
  label?: string;
  /** v1.2.0 adds a ConfidenceDecomposition per presentation. */
  confidence?: Stage1ConfidenceDecomposition;
  preconditions?: unknown[];
  role_hints?: string[];
  state_hints?: string[];
  member_instances?: Stage1EvidenceRef[];
};

export type Stage1Capability = {
  canonical_id: string;
  display_label?: string;
  presentations: Stage1CapabilityPresentation[];
  minimum_preconditions?: unknown[];
  lifecycle_hints?: unknown[];
  conflicts?: unknown[];
  resolution_strategy?: string;
  derived_from_runs?: string[];
};

export type Stage1CapabilityRollup = {
  kind: "capability_rollup";
  schema_version: string;
  generated_at: string;
  run_id: string;
  target: { id: string; url?: string };
  capabilities: Stage1Capability[];
};

export type Stage1RollupProjectionVariant = {
  id: string;
  surface: string;
  /** v1.0.0 scalar; v1.1.0 full decomposition. Use unwrap helpers in the normalizer. */
  confidence?: number | Stage1ConfidenceDecomposition;
  /** v1.1.0 summary backref to object_rollup.json; preserved on normalized variants. */
  confidence_summary?: Stage1ConfidenceSummary;
  evidence_chain?: Stage1EvidenceRef[];
  metadata?: Record<string, unknown>;
  selector?: string;
  external_component?: string;
  capability_id?: string;
};

export type Stage1RollupObject = {
  canonical_id: string;
  canonical_label?: string;
  representative_object_id?: string;
  source_object_ids?: string[];
  external_component?: string;
  oods_traits?: string[];
  projection_variants?: Stage1RollupProjectionVariant[];
  conflicts?: unknown[];
  reconciliation?: { action?: string; [key: string]: unknown };
};

export type Stage1ObjectRollup = {
  kind: "object_rollup";
  schema_version: string;
  generated_at: string;
  run_id: string;
  target: { id: string; url?: string };
  objects: Stage1RollupObject[];
  /**
   * Stage1 schema_version 1.2.0 and later. True when any object's reconciliation verdict is gated:
   * the rolled-up semantic→OODS mappings are PROPOSALS requiring human adjudication, never
   * auto-apply directives. Structural rollup data is unaffected either way.
   *
   * Surfaced in s204-m03 because Phase E turns on exactly this distinction — near.md §8 rules out
   * autonomous semantic reconciliation by name, and Stage1 shelved it after confident errors. A
   * consumer that reads this flag can refuse to treat gated mappings as instructions instead of
   * having to know the rule out of band.
   *
   * Optional: absent on 1.0.0 and 1.1.0 payloads, which predate it.
   */
  requires_human_adjudication?: boolean;
};

export type CatalogListDetail = "brief" | "summary" | "full";

export type CatalogListInput = {
  category?: string;
  trait?: string;
  context?: string;
  /**
   * Filter by component status: 'stable', 'beta', or 'planned'.
   */
  status?: ComponentStatus;
  /**
   * Response detail level. Defaults to brief for unfiltered calls (name, categories, readiness),
   * full when filters are provided; summary adds tags, contexts, regions and traits; evidence is only in full.
   */
  detail?: CatalogListDetail;
  /**
   * 1-based page index for pagination.
   */
  page?: number;
  /**
   * Number of components per page.
   */
  pageSize?: number;
  /**
   * List OODS Foundry's internal objects in registry.objects too, after the business objects.
   */
  includeInternal?: boolean;
};

export type ComponentCodeReference = {
  kind: "storybook" | "code-connect";
  /**
   * Repo-relative path (POSIX) to a source file containing a usage example.
   */
  path: string;
  /**
   * Storybook title (or equivalent label) when available (e.g., `Traits/Core/Taggable`).
   */
  title?: string;
  /**
   * Concise usage snippet extracted from the story file.
   */
  snippet: string;
};

export type ComponentClassification =
  | "native"
  | "recipe"
  | "alias"
  | "authoring-only"
  | "merged"
  | "retired";

export type ComponentCapabilityEvidence = {
  state: string;
  reason?: string;
  evidence: string[];
};

export type ComponentProductReality = {
  schemaVersion: string;
  proposedClassification: ComponentClassification;
  reconciliationState: string;
  surfaces: {
    contract: ComponentCapabilityEvidence;
    metadata: ComponentCapabilityEvidence;
    html: ComponentCapabilityEvidence;
    react: ComponentCapabilityEvidence;
    vue: ComponentCapabilityEvidence;
    generatedConsumer: ComponentCapabilityEvidence;
    accessibility: ComponentCapabilityEvidence;
    theme: ComponentCapabilityEvidence;
    interaction: ComponentCapabilityEvidence;
  };
};

export type ComponentStatus = "stable" | "beta" | "planned";

/**
 * One plain readiness label from the measured surfaces (s211-m01): React and Vue implemented with evidence and placed
 * in a generated app; implemented in both but not yet placed in one; or a framework implementation is missing.
 */
export type ComponentReadiness = "proven-in-generated-apps" | "react-and-vue" | "incomplete";

/** The default, unfiltered answer (s211-m01): what each component is called, where it belongs and how ready it is. */
export type ComponentCatalogBrief = {
  name: string;
  description?: string;
  categories: string[];
  readiness: ComponentReadiness;
};

export type ComponentCatalogSummary = {
  name: string;
  description?: string;
  displayName: string;
  categories: string[];
  tags: string[];
  contexts: string[];
  regions: string[];
  traits: string[];
  /**
   * Additive, target-specific capability evidence from the canonical component
   * ledger. Unlike `status`, this distinguishes HTML, React, Vue, and consumer
   * evidence instead of collapsing them into one implementation claim.
   */
  productReality?: ComponentProductReality;
  /**
   * Legacy static-HTML renderer status. `stable` means the component has a
   * mapped HTML renderer; `planned` means the HTML renderer falls back. This
   * is not a React, Vue, code-generation, or release-readiness claim.
   */
  status: ComponentStatus;
  maturity?: string;
  deprecated_since?: string;
  readiness?: ComponentReadiness;
};

/** A framework's props by name: the declared TypeScript type and whether the prop is optional. */
export type TargetPropTypes = Record<string, { type: string; optional: boolean }>;

export type ComponentCatalogEntry = ComponentCatalogSummary & {
  /** The static HTML renderer's props (see propSchemaTarget); a React or Vue component's are in propTypes. */
  propSchema: Record<string, unknown>;
  /** s221-m02: the target propSchema describes. */
  propSchemaTarget?: 'html';
  /** s221-m02: the React and Vue components' props, from the published declarations. */
  propTypes?: { react: TargetPropTypes; vue: TargetPropTypes };
  slots: Record<string, { accept?: string[]; role?: string }>;
  /**
   * References into `.stories.tsx` files that show real usage patterns.
   */
  codeReferences?: ComponentCodeReference[];
  /**
   * Convenience: best single snippet picked from `codeReferences`.
   */
  codeSnippet?: string;
};

/** Current scope decision; historical per-row proposals do not exclude obligations. */
export type ComponentObligationScope = {
  runtimeEvidence?: string;
  schemaVersion: string;
  decisionId: number;
  disposition: "retain-all-obligations";
  controllingObligationDenominator: number;
  approvedRuntimeCensus: null;
  classificationStatus: "historical-proposals-unapproved" | "proposed-awaiting-approval";
};

export type CatalogListOutput = {
  registry: import("../lib/live-registry.js").LiveRegistrySummary;
  obligationScope?: ComponentObligationScope;
  components: Array<ComponentCatalogBrief | ComponentCatalogSummary | ComponentCatalogEntry>;
  totalCount: number;
  returnedCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  detail: CatalogListDetail;
  generatedAt: string;
  stats: {
    componentCount: number;
    traitCount: number;
    filteredCount?: number;
  };
  availableCategories: string[];
  suggestions?: {
    traits?: string[];
  };
};

export type CodegenFramework = "react" | "vue" | "html";

export type CodegenStyling = "inline" | "tokens" | "tailwind";

export type CodeGenerateInput = {
  schema?: import("../schemas/generated.js").UiSchema;
  schemaRef?: string;
  framework: CodegenFramework;
  /** Validation profile. Defaults to build, the minimum runnable-artifact gate. */
  profile?: import("../codegen/types.js").CodegenValidationProfile;
  /** Required only for release; every entry must name this generated artifact's content hash. */
  releaseEvidence?: import("../codegen/types.js").CodegenReleaseEvidence;
  options?: {
    typescript?: boolean;
    styling?: CodegenStyling;
    theme?: NonNullable<import('../schemas/generated.js').CodeGenerateInput['options']>['theme'];
    /** A brand in the brand registry (s213-m04); validated at call time. */
    brand?: string;
    /** 'file' writes the artifact beside the saved-schema store and returns file references instead of the bytes. */
    payloadMode?: import('../lib/payload-store.js').PayloadMode;
    output?: 'component' | 'application';
  };
};

export type CodegenIssue = {
  code: string;
  message: string;
  nodeId?: string;
  component?: string;
};

type CodeGenerateOutputBase = {
  componentContracts?: import('@oods/component-contracts').SubstitutionContractReport[];
  framework: CodegenFramework;
  /** @deprecated Use artifact.files instead. Retained for v0 compatibility. */
  code: string;
  /** @deprecated Use artifact.files[].path instead. Retained for v0 compatibility. */
  fileExtension: string;
  /** @deprecated Use artifact.dependencies instead. Retained for v0 compatibility. */
  imports: string[];
  warnings: CodegenIssue[];
  /** Mandatory disclosure of applied policy, attempted checks, and skipped checks. */
  validationReceipt: import("../codegen/types.js").CodegenValidationReceipt;
  errors?: CodegenIssue[];
  meta?: {
    nodeCount?: number;
    componentCount?: number;
    unknownComponents?: string[];
  };
};

export type CodeGenerateOutput = CodeGenerateOutputBase & (
  | {
      status: "ok";
      artifact: GeneratedArtifact;
      payload?: undefined;
      errors?: CodegenIssue[];
      install?: import("../codegen/types.js").CodegenInstall;
    }
  | {
      /** payloadMode 'file': the artifact envelope and its files live in payload.directory. */
      status: "ok";
      artifact?: undefined;
      payload: import('../lib/payload-store.js').PayloadReceipt;
      errors?: CodegenIssue[];
      install?: import("../codegen/types.js").CodegenInstall;
    }
  | {
      status: "error";
      artifact?: never;
      errors?: CodegenIssue[];
    }
);

// -- Mapping tools --

export type MapCreateInput = {
  substitution?: ComponentSubstitution;
  apply?: boolean;
  externalSystem: string;
  externalComponent: string;
  oodsTraits: string[];
  propMappings?: Array<{
    externalProp: string;
    oodsProp: string;
    coercion?:
      | (
          | { type: "enum"; mapping: Record<string, string> }
          | { type: "boolean_to_string"; trueValue: string; falseValue: string }
          | { type: "template"; pattern: string }
          | { type: "identity" }
        )
      | string
      | null;
  }>;
  confidence?: "auto" | "manual";
  metadata?: {
    author?: string;
    notes?: string;
  };
  projection_variants?: Stage1ProjectionVariant[];
  disambiguation_decisions?: Stage1DisambiguationDecision[];
  preferred_terms?: Stage1PreferredTermEntity[];
  capabilities?: Stage1CapabilityEntity[];
};

export type MapCreateErrorDetail = {
  field: string;
  message: string;
  keyword: string;
};

export type MapCreateError = {
  message: string;
  details: MapCreateErrorDetail[];
};

export type MapCreateOutput = {
  status: "ok" | "error";
  mapping: Record<string, unknown>;
  etag: string;
  applied?: boolean;
  warnings?: string[];
  errors?: MapCreateError;
};

/** The single create contract stays intact; list calls have one apply flag. */
export type MapCreateBatchInput = { apply?: boolean } & (
  | { mappings: Array<Omit<MapCreateInput, 'apply'>>; mappingsPath?: never }
  | { mappingsPath: string; mappings?: never }
);

export type MapCreateBatchError = { code: 'OODS-V219'; message: string; field?: string };
export type MapCreateEntryOutcome = {
  index: number;
  id: string;
  status: 'valid' | 'invalid';
  applied: boolean;
  mapping?: Record<string, unknown>;
  warnings?: string[];
  errors?: MapCreateBatchError[];
};
export type MapCreateBatchOutput = {
  status: 'ok' | 'error';
  entries: MapCreateEntryOutcome[];
  etag: string;
  applied: boolean;
  errors?: MapCreateBatchError[];
};

export type MapApplyAction = "create" | "patch" | "skip" | "conflict";

export type Stage1AlternateInterpretation =
  | string
  | {
      role: string;
      score: number;
      reasoning: string;
    };

export type Stage1AlternateVerb =
  | string
  | {
      verb_id: string;
      score: number;
      reasoning: string;
    };

export type Stage1ActionPrecondition = {
  type: "auth" | "role" | "state" | "data";
  description?: string;
  confidence?: number;
  evidence_chain?: Record<string, unknown>[];
};

export type Stage1DisambiguationDecision =
  GeneratedStage1DisambiguationDecision;
export type Stage1PreferredTermEntity = GeneratedStage1PreferredTermEntity;
export type Stage1CapabilityEntity = GeneratedStage1CapabilityEntity;
export type Stage1ProjectionVariant = GeneratedStage1ProjectionVariant;

export type Stage1CandidateDiff = {
  added_traits: string[];
  removed_traits: string[];
  changed_fields: Array<{
    field: string;
    from?: unknown;
    to?: unknown;
  }>;
};

export type Stage1CandidateObject = {
  object_id: string;
  name: string;
  role: string;
  inferred_role?: string;
  inferred_role_score?: number;
  confidence: number;
  recommended_oods_traits: string[];
  recommended_domain?: string;
  action: MapApplyAction;
  reasoning: string;
  verdict_reasoning?: string;
  existing_map_id?: string;
  external_component?: string;
  diff?: Stage1CandidateDiff;
  alternate_interpretations?: Stage1AlternateInterpretation[];
  evidence_chain?: Record<string, unknown>[];
  projection_variants?: Stage1ProjectionVariant[];
};

export type Stage1CandidateAction = {
  action_id: string;
  name: string;
  verb: string;
  source_object_id?: string;
  confidence?: number;
  suggested_oods_trait?: string;
  suggested_action?: string;
  reasoning?: string;
  alternate_verbs?: Stage1AlternateVerb[];
  preconditions?: Stage1ActionPrecondition[];
};

export type Stage1Conflict = {
  type: string;
  severity: "info" | "warning" | "error";
  description: string;
  action_id?: string;
  object_id?: string;
  existing_map_id?: string;
};

export type Stage1RegistryFetchTelemetry = {
  source: "pre-supplied" | "transport" | "empty-fallback";
  entries_count: number;
  warnings?: string[];
};

export type Stage1ReconciliationManifest = {
  inputs?: {
    oods_registry_fetch?: Stage1RegistryFetchTelemetry;
  };
};

export type Stage1ReconciliationSummary = {
  mode: string;
  existing_map_count: number;
  verdict_counts: Partial<Record<MapApplyAction, number>>;
};

export type Stage1ReconciliationReport = {
  kind: "reconciliation_report";
  schema_version: string;
  generated_at: string;
  target: {
    id: string;
    url?: string;
  };
  candidate_objects: Stage1CandidateObject[];
  candidate_actions?: Stage1CandidateAction[];
  candidate_traits?: Record<string, unknown>[];
  conflicts?: Stage1Conflict[];
  coverage_gaps?: Record<string, unknown>[];
  validation_failures?: Record<string, unknown>[];
  disambiguation_decisions?: Stage1DisambiguationDecision[];
  manifest?: Stage1ReconciliationManifest;
  reconciliation_summary?: Stage1ReconciliationSummary;
};

export type MapApplyInput = {
  apply?: boolean;
  minConfidence?: number;
  report?: Stage1ReconciliationReport;
  reportPath?: string;
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
  diff?: Stage1CandidateDiff;
};

export type MapApplyQueued = {
  objectId: string;
  name: string;
  action: MapApplyAction;
  confidence: number;
  threshold: number;
  queueReason: "below_confidence";
  recommendedOodsTraits: string[];
  existingMapId?: string;
  reason: string;
  diff?: Stage1CandidateDiff;
};

export type MapApplyConflict = {
  objectId: string;
  name: string;
  action: "conflict";
  confidence: number;
  existingMapId?: string;
  reason: string;
};

export type MapApplyError = {
  objectId?: string;
  name?: string;
  action?: MapApplyAction;
  message: string;
  details?: Record<string, unknown>;
};

export type MapApplyDiffSummary = {
  create: number;
  patch: number;
  skip: number;
  conflict: number;
  queued: number;
  changedFields: string[];
  addedTraits: string[];
  removedTraits: string[];
};

export type MapApplyOutput = {
  applied: MapApplyRoute[];
  skipped: MapApplyRoute[];
  queued: MapApplyQueued[];
  conflicted: MapApplyConflict[];
  errors: MapApplyError[];
  diff: MapApplyDiffSummary;
  conflictArtifactPath?: string;
  etag: string;
};

export type RegistrySnapshotInput = {
  /** List OODS Foundry's internal objects too, after the business objects. */
  includeInternal?: boolean;
  /** summary (the default) gives each trait and object without its schema, view extensions and tokens; full gives everything. */
  detail?: 'summary' | 'full';
  /** Only these traits and objects, by exact name. */
  names?: string[];
};

export type RegistrySnapshotTraitInfo = {
  name: string;
  version: string;
  description: string;
  category: string;
  tags?: string[];
  contexts?: string[];
  viewExtensions?: Record<string, unknown>[];
  parameters?: Record<string, unknown>[];
  schema?: Record<string, unknown>;
  semantics?: Record<string, unknown>;
  tokens?: Record<string, unknown>;
  dependencies?: string[];
  metadata?: Record<string, unknown>;
  objects?: string[];
  source?: string;
};

export type RegistrySnapshotObjectInfo = {
  name: string;
  version: string;
  domain: string;
  description: string;
  tags?: string[];
  traits?: Array<{
    reference: string;
    alias?: string | null;
    parameters?: Record<string, unknown>;
  }>;
  fields?: string[];
  semantics?: Record<string, unknown>;
  tokens?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  visibility?: 'public' | 'internal';
  source?: string;
};

export type RegistrySnapshotOutput = {
  maps: Record<string, unknown>[];
  traits: Record<string, RegistrySnapshotTraitInfo>;
  objects: Record<string, RegistrySnapshotObjectInfo>;
  etag: string;
  generatedAt: string;
  registry: import("../lib/live-registry.js").LiveRegistrySummary;
};

export type MapListInput = {
  externalSystem?: string;
  cursor?: string;
  limit?: number;
};

export type MapListOutput = {
  mappings: Record<string, unknown>[];
  totalCount: number;
  stats: {
    mappingCount: number;
    systemCount: number;
  };
  etag: string;
  nextCursor?: string;
};

export type MapPropTranslation = {
  externalProp: string;
  oodsProp: string;
  coercionType: string | null;
  coercionDetail: Record<string, unknown> | null;
};

export type MapResolveInput = {
  externalSystem: string;
  externalComponent: string;
};

export type MapResolveOutput = {
  status: "ok" | "not_found";
  mapping?: Record<string, unknown>;
  propTranslations?: MapPropTranslation[];
  message?: string;
};

export type MapUpdateInput = {
  id: string;
  updates: {
    substitution?: ComponentSubstitution;
    oodsTraits?: string[];
    confidence?: "auto" | "manual";
    propMappings?: Array<{
      externalProp: string;
      oodsProp: string;
      coercion?:
        | (
            | { type: "enum"; mapping: Record<string, string> }
            | {
                type: "boolean_to_string";
                trueValue: string;
                falseValue: string;
              }
            | { type: "template"; pattern: string }
            | { type: "identity" }
          )
        | string
        | null;
    }>;
    notes?: string;
    projection_variants?: Stage1ProjectionVariant[];
  };
};

export type MapUpdateOutput = {
  status: "ok" | "error";
  mapping?: Record<string, unknown>;
  etag?: string;
  changes?: string[];
  message?: string;
};

export type MapDeleteInput = {
  id: string;
};

export type MapDeleteOutput = {
  status: "ok" | "error";
  deleted?: {
    id: string;
    externalSystem: string;
    externalComponent: string;
  };
  etag?: string;
  message?: string;
};
