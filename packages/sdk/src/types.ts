/**
 * Public type re-exports from @oods/mcp-server.
 *
 * All tool input/output types available from a single import:
 *   import type { DesignComposeInput } from '@oods/sdk';
 */

export type {
  // design.compose
  DesignComposeInput,
  DesignComposeOutput,
  ComposeIssue,
  SlotSelectionEntry,
  ObjectUsedInfo,


  // pipeline
  PipelineInput,
  PipelineOutput,

  // code.generate
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

  // catalog
  CatalogListInput,
  CatalogListOutput,
  ComponentCatalogSummary,
  ComponentCatalogEntry,
  ComponentStatus,

  // object.list
  ObjectListInput,
  ObjectListOutput,
  ObjectListEntry,

  // object.show
  ObjectShowInput,
  ObjectShowOutput,
  ObjectShowTraitEntry,

  // schema management
  SchemaListInput,
  SchemaListOutput,
  SchemaLoadInput,
  SchemaLoadOutput,
  SchemaSaveInput,
  SchemaSaveOutput,
  SchemaDeleteInput,
  SchemaDeleteOutput,

  // mapping tools
  MapCreateInput,
  MapCreateOutput,
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
  Stage1ReconciliationManifest,
  Stage1ReconciliationReport,
  Stage1ReconciliationSummary,
  RegistrySnapshotInput,
  RegistrySnapshotOutput,
  RegistrySnapshotTraitInfo,
  RegistrySnapshotObjectInfo,

  // structured data
  StructuredDataFetchInput,
  StructuredDataFetchOutput,
  StructuredDataset,

  // tokens + brand
  TokensBuildInput,
  BrandApplyInput,
  BrandApplyStrategy,
  GenericOutput,
} from '@oods/mcp-server/types';
