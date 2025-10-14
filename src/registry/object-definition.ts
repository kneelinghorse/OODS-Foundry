/**
 * Object Definition Schema
 *
 * Defines TypeScript interfaces for *.object.yaml files that compose traits
 * into canonical object specifications.
 */

import type {
  ParseError,
  ParseResult,
  SchemaField,
  SemanticMapping,
  TraitAction,
  TokenDefinition,
} from '../core/trait-definition';

/**
 * Status lifecycle for an object definition.
 */
export type ObjectStatus = 'draft' | 'beta' | 'stable' | 'deprecated';

/**
 * Reference to a base object that this definition extends.
 */
export interface BaseObjectReference {
  name: string;
  version?: string;
  source?: string;
  description?: string;
}

/**
 * Metadata describing the object definition itself.
 *
 * Additional metadata keys are permitted via the index signature so that
 * domain teams can attach governance or ownership data without breaking the
 * parser.
 */
export interface ObjectMetadata {
  name: string;
  title?: string;
  version?: string;
  description?: string;
  category?: string;
  domain?: string;
  status?: ObjectStatus;
  maturity?: string;
  owners?: string[];
  tags?: string[];
  extends?: BaseObjectReference;
  docs?: {
    summary?: string;
    url?: string;
    diagram?: string;
    [key: string]: unknown;
  };
  lifecycle?: {
    introduced?: string;
    deprecated?: string;
    replacement?: string;
    [key: string]: unknown;
  };
  audits?: {
    last_reviewed?: string;
    notes?: string;
    [key: string]: unknown;
  };
  links?: Record<string, string>;
  annotations?: Record<string, unknown>;
  [custom: string]: unknown;
}

/**
 * Supported parameter value types for trait parameterization.
 */
export type TraitParameterValue =
  | string
  | number
  | boolean
  | readonly string[]
  | readonly number[]
  | readonly boolean[]
  | readonly Record<string, unknown>[]
  | Record<string, unknown>
  | null;

/**
 * Map of parameter name to value for a trait reference.
 */
export type TraitParameterMap = Record<string, TraitParameterValue>;

/**
 * Configuration for selectively mounting trait contributions.
 */
export interface TraitMountConfiguration {
  contexts?: readonly string[];
  regions?: readonly string[];
  priority?: number;
  when?: string;
  description?: string;
  [key: string]: unknown;
}

/**
 * Reference to a trait that the object composes.
 */
export interface TraitReference {
  name: string;
  version?: string;
  alias?: string;
  namespace?: string;
  displayName?: string;
  description?: string;
  optional?: boolean;
  disabled?: boolean;
  parameters?: TraitParameterMap;
  annotations?: Record<string, unknown>;
  mount?: TraitMountConfiguration;
}

/**
 * Object-specific field definition overrides.
 *
 * By reusing SchemaField we keep compatibility with trait authored fields.
 */
export interface ObjectFieldDefinition extends SchemaField {
  provenance?: 'object' | 'trait' | 'override';
  sourceTrait?: string;
  notes?: string;
}

/**
 * Object-level view override actions.
 */
export type ObjectViewOverrideAction = 'add' | 'replace' | 'remove' | 'augment';

export interface ObjectViewOverride {
  id?: string;
  target?: string;
  action: ObjectViewOverrideAction;
  trait?: string;
  alias?: string;
  component?: string;
  when?: string;
  priority?: number;
  props?: Record<string, unknown>;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export type ObjectViewOverrides = {
  [context: string]: ObjectViewOverride[] | undefined;
};

/**
 * Collision resolution strategies for conflicting fields or semantics.
 */
export type ResolutionStrategy = 'use_trait' | 'use_object' | 'merge';

export interface ResolutionDetail {
  strategy: ResolutionStrategy;
  trait?: string;
  description?: string;
  reason?: string;
  notes?: string;
  alias?: Record<string, string>;
  rename?: Record<string, string>;
  mergeStrategy?: 'shallow' | 'deep' | string;
  metadata?: Record<string, unknown>;
}

export interface FieldResolution extends ResolutionDetail {
  field: string;
}

export interface SemanticResolution extends ResolutionDetail {
  semantic: string;
}

export interface TokenResolution extends ResolutionDetail {
  token: string;
}

export interface ViewResolution extends ResolutionDetail {
  view: string;
  extensionId?: string;
}

export interface ObjectResolutions {
  fields?: Record<string, ResolutionDetail>;
  semantics?: Record<string, ResolutionDetail>;
  tokens?: Record<string, ResolutionDetail>;
  views?: Record<string, ResolutionDetail>;
  metadata?: Record<string, unknown>;
}

/**
 * Additional metadata block for governance, ownership, etc.
 */
export interface ObjectAdditionalMetadata {
  owners?: string[];
  steward?: string;
  lastReviewed?: string;
  changelog?: {
    version: string;
    date?: string;
    description?: string;
  }[];
  contacts?: string[];
  links?: Record<string, string>;
  compliance?: Record<string, unknown>;
  notes?: string;
  [key: string]: unknown;
}

/**
 * Complete object definition as parsed from YAML.
 */
export interface ObjectDefinition {
  object: ObjectMetadata;
  traits: TraitReference[];
  schema?: Record<string, ObjectFieldDefinition>;
  semantics?: Record<string, SemanticMapping>;
  tokens?: TokenDefinition;
  views?: ObjectViewOverrides;
  actions?: TraitAction[];
  resolutions?: ObjectResolutions;
  metadata?: ObjectAdditionalMetadata;
  annotations?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Parse helpers mirroring the trait parser utilities.
 */
export type ObjectParseResult = ParseResult<ObjectDefinition>;
export type ObjectParseError = ParseError;

export function createObjectParseSuccess(
  definition: ObjectDefinition
): ObjectParseResult {
  return {
    success: true,
    data: definition,
  };
}

export function createObjectParseFailure(
  errors: ParseError[]
): ObjectParseResult {
  return {
    success: false,
    errors,
  };
}

export function isObjectDefinition(candidate: unknown): candidate is ObjectDefinition {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const obj = candidate as Partial<ObjectDefinition>;
  if (!obj.object || typeof obj.object !== 'object') {
    return false;
  }

  const meta = obj.object as Partial<ObjectMetadata>;
  if (!meta.name || typeof meta.name !== 'string') {
    return false;
  }

  if (!Array.isArray(obj.traits) || obj.traits.length === 0) {
    return false;
  }

  return true;
}
