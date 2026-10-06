/**
 * TypeScript types matching the on-disk YAML schema for OODS objects and traits.
 */

// ---- Shared Field Types ----

export interface FieldValidation {
  enum?: string[];
  enumFromParameter?: string;
  minLength?: number;
  maxLength?: number;
  maxLengthFromParameter?: string;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  pattern?: string;
  format?: string;
  items?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface FieldDefinition {
  type: string;
  required: boolean;
  description: string;
  default?: unknown;
  defaultFromParameter?: string;
  examples?: readonly unknown[];
  validation?: FieldValidation;
  /**
   * The object's data contract never supplies this field (for example, its API does not expose it yet). The field keeps
   * its place in the record's shape, but no view places it and sample records leave it absent (s213-m01).
   */
  unavailable?: boolean;
}

export interface SemanticMapping {
  semantic_type: string;
  token_mapping: string;
  ui_hints?: Record<string, string | boolean | number>;
}

// ---- Object Types ----

export interface ObjectHeader {
  name: string;
  version: string;
  domain: string;
  description: string;
  tags?: string[];
  /** s222-m03 (#2502 ruling 15): an internal object is left out of the public listings unless includeInternal is set. */
  visibility?: 'public' | 'internal';
}

export interface TraitReference {
  name: string;
  alias?: string;
  parameters?: Record<string, unknown>;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  description: string;
}

export interface ObjectMetadata {
  /** Limit an embedded object to its supported presentation contexts. */
  supportedContexts?: string[];
  /** The name of a detail screen's tab of read-only record fields ("Details" when absent). */
  detailTab?: string;
  owners?: string[];
  steward?: string;
  maturity?: string;
  changelog?: ChangelogEntry[];
  references?: string[];
}

export interface ObjectRelationship {
  target: string;
  /** A field in the composed source object, including fields contributed by traits. */
  via: string;
  cardinality: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  label: string;
}

export interface ObjectDefinition {
  object: ObjectHeader;
  relationships?: ObjectRelationship[];
  /** s222-m03 (#2502 ruling 14): authored sample records (partial, by field name), turned into per-field examples aligned
   * by index, trait fields included, so a sample app shows coherent records without copying trait fields. */
  samples?: Array<Record<string, unknown>>;
  traits: TraitReference[];
  schema: Record<string, FieldDefinition>;
  semantics: Record<string, SemanticMapping>;
  tokens: Record<string, unknown>;
  metadata: ObjectMetadata;
}

// ---- Trait Types ----

export interface TraitHeader {
  name: string;
  version: string;
  description: string;
  category: string;
  tags?: string[];
}

export interface ParameterDefinition {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: unknown;
  validation?: FieldValidation;
}

export interface ViewExtension {
  component: string;
  position?: string;
  priority?: number;
  props?: Record<string, unknown>;
}

export interface EventDefinition {
  description: string;
  payload: string[];
}

export interface StateMachineTransition {
  from: string;
  to: string;
  trigger: string;
  guard?: string;
}

export interface StateMachineDefinition {
  states: string[];
  initial: string;
  transitions: StateMachineTransition[];
}

export interface TraitAction {
  name: string;
  label?: string;
  icon?: string;
  confirmation?: boolean;
  confirmationMessage?: string;
  condition?: string;
  description?: string;
  [key: string]: unknown;
}

export interface TraitAccessibility {
  keyboard?: string;
  screenreader?: string;
  rule_reference?: string;
  notes?: string;
}

export interface TraitMetadata {
  created?: string;
  updated?: string;
  owners?: string[];
  maturity?: string;
  conflicts_with?: string[];
  accessibility?: TraitAccessibility;
  regionsUsed?: string[];
  examples?: string[];
  references?: string[];
}

export interface TraitDefinition {
  trait: TraitHeader;
  parameters: ParameterDefinition[];
  schema: Record<string, FieldDefinition>;
  semantics: Record<string, SemanticMapping>;
  view_extensions: Record<string, ViewExtension[]>;
  tokens: Record<string, unknown>;
  events?: Record<string, EventDefinition>;
  state_machine?: StateMachineDefinition;
  actions?: TraitAction[];
  dependencies: string[];
  metadata: TraitMetadata;
}
