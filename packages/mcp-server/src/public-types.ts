/**
 * Public type re-exports for @oods/sdk and external consumers.
 *
 * This barrel exports all tool input/output types from a single entry point.
 */

// -- design.compose --
export type {
  DesignComposeInput,
  DesignComposeOutput,
  ComposeIssue,
  SlotSelectionEntry,
  ObjectUsedInfo,
} from "./tools/design.compose.js";

// -- pipeline --
export type { PipelineInput, PipelineOutput } from "./tools/pipeline.js";

// -- code.generate --
export type {
  CodeGenerateInput,
  CodeGenerateOutput,
  CodegenAcceptedReleaseEvidence,
  CodegenFramework,
  CodegenStyling,
  CodegenIssue,
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
} from "./tools/types.js";

// -- catalog --
export type {
  CatalogListInput,
  CatalogListOutput,
  ComponentCatalogSummary,
  ComponentCatalogEntry,
  ComponentStatus,
} from "./tools/types.js";

// -- object.list --
export type {
  ObjectListInput,
  ObjectListOutput,
  ObjectListEntry,
} from "./tools/object.list.js";

// -- object.show --
export type {
  ObjectShowInput,
  ObjectShowOutput,
  ObjectShowTraitEntry,
} from "./tools/object.show.js";

// -- schema management --
export type { SchemaListInput, SchemaListOutput } from "./tools/schema/list.js";

export type { SchemaLoadInput, SchemaLoadOutput } from "./tools/schema/load.js";

export type { SchemaSaveInput, SchemaSaveOutput } from "./tools/schema/save.js";

export type {
  SchemaDeleteInput,
  SchemaDeleteOutput,
} from "./tools/schema/delete.js";

// -- mapping tools --
export type {
  MapCreateInput,
  MapCreateOutput,
  MapCreateBatchInput,
  MapCreateBatchOutput,
  MapCreateBatchError,
  MapCreateEntryOutcome,
  MapApplyAction,
  MapApplyInput,
  MapApplyOutput,
  MapApplyRoute,
  MapApplyQueued,
  MapApplyConflict,
  MapApplyError,
  MapApplyDiffSummary,
  MapListInput,
  MapListOutput,
  MapResolveInput,
  MapResolveOutput,
  MapUpdateInput,
  MapUpdateOutput,
  MapDeleteInput,
  MapDeleteOutput,
  MapPropTranslation,
  Stage1CandidateAction,
  Stage1CandidateDiff,
  Stage1CandidateObject,
  Stage1Conflict,
  Stage1DisambiguationDecision,
  Stage1PreferredTermEntity,
  Stage1CapabilityEntity,
  Stage1ProjectionVariant,
  Stage1ReconciliationManifest,
  Stage1ReconciliationReport,
  Stage1ReconciliationSummary,
  RegistrySnapshotInput,
  RegistrySnapshotOutput,
  RegistrySnapshotTraitInfo,
  RegistrySnapshotObjectInfo,
} from "./tools/types.js";

// -- structured data --
export type {
  StructuredDataFetchInput,
  StructuredDataFetchOutput,
  StructuredDataset,
} from "./tools/types.js";

// -- tokens + brand --
export type {
  TokensBuildInput,
  BrandApplyInput,
  BrandApplyStrategy,
  GenericOutput,
} from "./tools/types.js";

// -- versioning --
export type {
  DslVersion,
  VersionFeatures,
  VersionEntry,
  ChangelogEntry,
} from "./versioning/versions.js";
export { CURRENT_VERSION } from "./versioning/versions.js";
