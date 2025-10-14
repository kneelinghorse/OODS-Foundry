/**
 * Trait Definition Schema
 *
 * Core TypeScript interfaces for the trait composition system.
 * Based on Trait Engine Spec v0.1, Section 2: Authoring Specification
 */

/**
 * Metadata about the trait definition
 */
export interface TraitMetadata {
  name: string;
  version: string;
  description?: string;
  category?: string;
  author?: string;
  tags?: string[];
}

/**
 * Parameter definition for parameterized traits
 * Uses 'as const' tuple pattern for type-safe parameters (Research R1)
 */
export interface TraitParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'string[]' | 'number[]' | 'enum';
  required: boolean;
  default?: unknown;
  description?: string;
  enumValues?: readonly string[];
  validation?: Record<string, unknown>;
}

/**
 * Schema field definition
 */
export interface SchemaField {
  type: string;
  required?: boolean;
  default?: unknown;
  description?: string;
  validation?: Record<string, unknown>;
}

/**
 * Semantic type mapping for fields
 */
export interface SemanticMapping {
  semantic_type?: string;
  token_mapping?: string;
  ui_hints?: {
    component?: string;
    color_when_true?: string;
    color_when_false?: string;
    [key: string]: unknown;
  };
}

/**
 * View extension definition for specific contexts
 */
export interface ViewExtension {
  component?: string;
  condition?: string;
  position?: 'top' | 'bottom' | 'before' | 'after' | 'replace';
  priority?: number;
  props?: Record<string, unknown>;
  badge?: {
    text: string;
    color: string;
    condition?: string;
  };
}

/**
 * Action definition for trait behaviors
 */
export interface TraitAction {
  name: string;
  label?: string;
  condition?: string;
  confirmation?: boolean;
  confirmationMessage?: string;
  handler?: string;
  icon?: string;
}

/**
 * State machine definition for state-based traits
 */
export interface StateMachine {
  states: readonly string[];
  initial: string;
  transitions: {
    from: string;
    to: string;
    trigger?: string;
    condition?: string;
  }[];
}

/**
 * Token definition for semantic styling
 */
export interface TokenDefinition {
  [tokenName: string]: string | TokenDefinition;
}

/**
 * Dependency specification
 */
export interface TraitDependency {
  trait: string;
  version?: string;
  optional?: boolean;
}

/**
 * Complete trait definition structure
 * This is the core interface that all parsed traits must conform to
 */
export interface TraitDefinition {
  // Metadata section
  trait: TraitMetadata;

  // Parameters (for parameterized traits)
  parameters?: TraitParameter[];

  // Schema section - defines the data fields this trait adds
  schema: Record<string, SchemaField>;

  // Semantics section - maps fields to semantic types and UI hints
  semantics?: Record<string, SemanticMapping>;

  // View extensions - how this trait modifies views in different contexts
  view_extensions?: {
    list?: ViewExtension[];
    detail?: ViewExtension[];
    form?: ViewExtension[];
    timeline?: ViewExtension[];
    card?: ViewExtension[];
    inline?: ViewExtension[];
    [context: string]: ViewExtension[] | undefined;
  };

  // Tokens - semantic design tokens this trait defines
  tokens?: TokenDefinition;

  // Dependencies - other traits this trait requires
  dependencies?: (string | TraitDependency)[];

  // Actions - behaviors this trait adds
  actions?: TraitAction[];

  // State machine - for traits that manage state
  state_machine?: StateMachine;

  // Additional metadata
  metadata?: {
    created?: string;
    updated?: string;
    deprecated?: boolean;
    deprecationMessage?: string;
    [key: string]: unknown;
  };
}

/**
 * Parse result with error information
 */
export interface ParseResult<T> {
  success: boolean;
  data?: T;
  errors?: ParseError[];
}

/**
 * Detailed parse error with location information
 */
export interface ParseError {
  message: string;
  file?: string;
  line?: number;
  column?: number;
  field?: string;
  code?: string;
}

/**
 * Type guard to check if an object is a valid TraitDefinition
 */
export function isTraitDefinition(obj: unknown): obj is TraitDefinition {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const def = obj as Partial<TraitDefinition>;

  // Required fields: trait and schema
  if (!def.trait || typeof def.trait !== 'object') {
    return false;
  }

  if (!def.schema || typeof def.schema !== 'object') {
    return false;
  }

  // Trait metadata must have at least a name
  const trait = def.trait as Partial<TraitMetadata>;
  if (!trait.name || typeof trait.name !== 'string') {
    return false;
  }

  return true;
}

/**
 * Helper to create a parse error
 */
export function createParseError(
  message: string,
  options?: {
    file?: string;
    line?: number;
    column?: number;
    field?: string;
    code?: string;
  }
): ParseError {
  return {
    message,
    ...options,
  };
}

/**
 * Helper to create a successful parse result
 */
export function createSuccessResult<T>(data: T): ParseResult<T> {
  return {
    success: true,
    data,
  };
}

/**
 * Helper to create a failed parse result
 */
export function createFailureResult<T>(errors: ParseError[]): ParseResult<T> {
  return {
    success: false,
    errors,
  };
}
