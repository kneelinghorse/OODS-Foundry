/**
 * OODS Object Catalog v1.0.0 — TypeScript shape.
 *
 * SOURCE OF TRUTH: ./schema.json. These types mirror that JSON Schema exactly;
 * the schema validates the fixtures and the fixtures are typed with these types,
 * so type/schema drift breaks both gates (G2 and the round-trip in G3).
 *
 * Future: replace this file with codegen from schema.json
 * (json-schema-to-typescript or equivalent) when the typegen pipeline lands.
 */

export type Protocol = 'syntactic' | 'semantic' | 'pragmatic' | 'relational';

export type Provenance = 'declared' | 'inferred' | 'candidate' | 'verified';

export type LocationType =
  | 'code'
  | 'docs'
  | 'test'
  | 'api'
  | 'figma'
  | 'route'
  | 'event'
  | 'other';

export type PragmaticRole =
  | 'primary_action'
  | 'secondary_action'
  | 'destructive_action'
  | 'recovery_action'
  | 'navigation'
  | 'informational'
  // Page/IA roles (s106-m03): page-level roles for site-map entities so pages
  // are not forced into navigation/informational. Non-action — they do NOT
  // trigger the element.object_action_present validator.
  | 'page'
  | 'landing'
  | 'section'
  | 'index';

export type RelationshipDirection = 'out' | 'in' | 'undirected';

export type URN = string;

export interface EvidenceRef {
  id: string;
  protocol: Protocol;
  kind: string;
  locator: string;
  matched?: string | null;
  weight: number;
  provenance: Provenance;
  captured_at?: string;
  [extra: string]: unknown;
}

export interface Location {
  type: LocationType;
  path: string;
}

export interface TypedRelationship {
  type: string;
  from: URN;
  to: URN;
  direction?: RelationshipDirection;
  provenance: Provenance;
  weight?: number;
  confidence?: number;
  via?: string;
  reason?: string;
  evidence_refs?: string[];
  captured_at?: string;
  metadata?: Record<string, unknown>;
  [extra: string]: unknown;
}

export interface ElementSpec {
  type: string;
  name: string;
  object?: string;
  action?: string;
  [extra: string]: unknown;
}

export interface SemanticsSpec {
  purpose: string;
  human_meaning: string;
  tags?: string[];
  synonyms?: string[];
  keywords?: string[];
  [extra: string]: unknown;
}

export interface OodsCatalog {
  version: '1.0.0';
}

export interface OodsSlotBinding {
  field: string;
  [extra: string]: unknown;
}

export interface OodsSlot {
  name: string;
  binding: OodsSlotBinding;
  [extra: string]: unknown;
}

export interface OodsRender {
  ui_schema_ref: string;
  slots: OodsSlot[];
  brand_overlay?: string;
  [extra: string]: unknown;
}

export interface OodsProjectionVariant {
  surface: string;
  ui_schema_ref: string;
  slots: OodsSlot[];
  brand_overlay?: string;
  [extra: string]: unknown;
}

export interface OodsConfidenceSignal {
  name: string;
  score: number;
  hint?: string;
  [extra: string]: unknown;
}

export interface OodsConfidenceDecomposition {
  total: number;
  signals: OodsConfidenceSignal[];
  [extra: string]: unknown;
}

export interface OodsEvidenceChainEntry {
  source: string;
  run_id?: string;
  urn?: string;
  match_score?: number;
  context_pack_recipe?: string;
  [extra: string]: unknown;
}

export interface OodsExtension {
  catalog?: OodsCatalog;
  render?: OodsRender;
  projection_variants?: OodsProjectionVariant[];
  confidence_decomposition?: OodsConfidenceDecomposition;
  evidence_chain?: OodsEvidenceChainEntry[];
  [extra: string]: unknown;
}

export interface SemanticEntity {
  urn: URN;
  element: ElementSpec;
  semantics: SemanticsSpec;
  pragmatic_role?: PragmaticRole;
  states?: string[];
  preconditions?: string[];
  effects?: string[];
  traits?: string[];
  context?: Record<string, unknown>;
  locations?: Location[];
  evidence_refs?: EvidenceRef[];
  relationships?: { edges?: TypedRelationship[] };
  oods?: OodsExtension;
  [extra: string]: unknown;
}

export interface ManifestSource {
  agent: string;
  stage?: string;
  url?: string;
  run_id?: string;
  stratum?: string;
  captured_at: string;
  oods_catalog_version?: '1.0.0';
  [extra: string]: unknown;
}

export interface ObjectCatalogManifest {
  manifest_version: '4.0';
  schema_version?: '1.1.0';
  source: ManifestSource;
  entities: SemanticEntity[];
  relationships?: TypedRelationship[];
}
