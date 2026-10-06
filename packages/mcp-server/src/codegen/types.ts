import type { EmittedSubstitution } from './component-substitutions.js';
import type { UiSchema } from '../schemas/generated.js';

export type CodegenFramework = 'react' | 'vue' | 'html';

export type CodegenStyling = 'inline' | 'tokens' | 'tailwind';

export type CodegenValidationProfile = 'draft' | 'build' | 'release';

export type CodegenValidationScope = 'structural' | 'generated-artifact' | 'release-evidence';

export type CodegenValidationEnforcement = 'advisory' | 'blocking';

export type CodegenFallbackPolicy = 'visible' | 'forbidden';

export type CodegenTargetResolution = {
  requested?: CodegenFramework;
  resolved: CodegenFramework;
  source: 'explicit' | 'options-alias' | 'oodsrc' | 'default';
};

export type CodegenValidationCheck =
  | 'schema-structure'
  | 'component-registry'
  | 'state-contract'
  | 'binding-contract'
  | 'props-contract'
  | 'slots-contract'
  | 'events-contract'
  | 'target-readiness'
  | 'normalization-fidelity'
  | 'dependency-closure'
  | 'fallback-policy'
  | 'rendered-evidence'
  | 'interaction-evidence'
  | 'accessibility-evidence'
  | 'theme-evidence'
  | 'determinism-evidence'
  | 'performance-evidence'
  | 'certification-evidence';

export type CodegenReleaseEvidenceClass =
  | 'rendered'
  | 'interaction'
  | 'accessibility'
  | 'theme'
  | 'determinism'
  | 'performance'
  | 'certification';

export type CodegenReleaseEvidenceItem = {
  status: 'passed';
  /** Exact generated artifact hash that the external evidence inspected. */
  artifactContentHash: string;
  /** SHA-256 of the exact JSON evidence file bytes. */
  contentHash: string;
  /** Local JSON evidence file (absolute, or relative to the server working directory). */
  reference: string;
};

export type CodegenReleaseEvidence = Partial<
  Record<Exclude<CodegenReleaseEvidenceClass, 'certification'>, CodegenReleaseEvidenceItem>
>;

export type CodegenAcceptedReleaseEvidence = CodegenReleaseEvidenceItem & {
  class: Exclude<CodegenReleaseEvidenceClass, 'certification'>;
};

export type CodegenValidationReceipt = {
  evidenceVerification?: 'file-verified-not-re-executed';
  profile: CodegenValidationProfile;
  defaulted: boolean;
  rationale: string;
  axes: {
    scope: CodegenValidationScope;
    enforcement: CodegenValidationEnforcement;
    fallback: CodegenFallbackPolicy;
    target: CodegenTargetResolution;
  };
  /** Checks actually attempted before this response was returned. */
  checks: CodegenValidationCheck[];
  /** Profile checks that were not reached; never a silent omission. */
  notChecked: CodegenValidationCheck[];
  evidence: {
    required: CodegenReleaseEvidenceClass[];
    provided: CodegenReleaseEvidenceClass[];
    missing: CodegenReleaseEvidenceClass[];
    mismatched: CodegenReleaseEvidenceClass[];
    /** Caller-supplied evidence envelopes accepted for evaluation, in canonical class order. */
    accepted: CodegenAcceptedReleaseEvidence[];
    notApplicable: Array<{
      class: CodegenReleaseEvidenceClass;
      rationale: string;
    }>;
    /** Artifact governed by this receipt, when generation reached an artifact. */
    artifactContentHash?: string;
  };
};

export type CodegenOptions = {
  /** Internal sample props/title shared by HTML, preview and standalone apps. */
  sampleModel?: Record<string, unknown>;
  sampleRecords?: Array<Record<string, unknown>>;
  documentTitle?: string;
  documentCss?: string;
  /** Internal lowering used only by assembled workflow screens. */
  workflowCollections?: boolean;
  /** Internal: the object the records belong to, which a workflow screen emitted alone no longer carries. */
  objectName?: string;
  typescript: boolean;
  styling: CodegenStyling;
  theme?: 'light' | 'dark' | 'hc';
  /** A brand in the brand registry (s213-m04). */
  brand?: string;
  /**
   * Internal, set by code.generate (s213-m06): the file name of the brand's stylesheet the artifact carries, for a brand
   * the app's @oods/tokens does not carry. The screen (or a workflow app's App) imports it beside the component styles.
   */
  brandStylesheet?: string;
};

export type CodegenIssue = {
  code: string;
  message: string;
  nodeId?: string;
  component?: string;
};

export type GeneratedArtifactFile = {
  /** Omitted for UTF-8 text; binary assets carry base64 and decode when materialized. */
  encoding?: 'base64';
  path: string;
  contents: string;
  contentHash: string;
};

export type GeneratedDependency = {
  name: string;
  version: string;
  kind: 'dependency' | 'peerDependency';
};

/** Where a generated app's @oods packages come from: it installs them from npm, at the exact versions listed (s220-m03). */
export type CodegenInstall = {
  note: string;
  packages: Array<{ name: string; version: string }>;
  steps: string[];
};

export type GeneratedArtifactActionParameter = {
  name: string;
  type: string;
};

export type GeneratedArtifactActionSource = {
  nodeId: string;
  component: string;
  event: string;
};

/**
 * A domain action the generated UI cannot implement on the consumer's behalf.
 * Every entry is a required injection point. Compatible occurrences share one
 * entry and retain every schema declaration site. Component sites are wired by
 * the generated tree; screen-root sites are invoked by generated action controls.
 */
export type GeneratedArtifactAction = {
  name: string;
  parameters: GeneratedArtifactActionParameter[];
  sources: [GeneratedArtifactActionSource, ...GeneratedArtifactActionSource[]];
};

export type GeneratedArtifact = {
  substitutions?: EmittedSubstitution[];
  schemaVersion: '1.0.0';
  framework: CodegenFramework;
  files: GeneratedArtifactFile[];
  dependencies: GeneratedDependency[];
  actions: GeneratedArtifactAction[];
  contentHash: string;
};

export type CodegenResult = {
  status: 'ok' | 'error';
  framework: CodegenFramework;
  code: string;
  fileExtension: string;
  imports: string[];
  files?: Array<{ path: string; contents: string; encoding?: 'base64' }>;
  /** Required domain actions to include in the generated artifact contract. */
  actions?: GeneratedArtifactAction[];
  warnings: CodegenIssue[];
  errors?: CodegenIssue[];
  meta?: {
    nodeCount?: number;
    componentCount?: number;
    unknownComponents?: string[];
  };
};

export type Emitter = (schema: UiSchema, options: CodegenOptions) => CodegenResult;
