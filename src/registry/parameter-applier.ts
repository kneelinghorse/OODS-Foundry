import type { TraitDefinition } from '../core/trait-definition.js';
import type { TraitParameterMap, TraitParameterValue } from './object-definition.js';
import {
  ParameterValidator,
  type ParameterValidationOptions,
} from '../validation/parameter-validator.js';
import type { ValidationIssue } from '../validation/types.js';

export interface ParameterApplicationOptions {
  readonly validator?: ParameterValidator;
  readonly validate?: boolean;
  readonly traitLabel?: string;
  readonly filePath?: string;
  readonly validationOptions?: Omit<ParameterValidationOptions, 'traitLabel' | 'filePath'>;
}

export interface ParameterApplicationResult {
  readonly definition: TraitDefinition;
  readonly parameters: Readonly<Record<string, TraitParameterValue>>;
}

export class TraitParameterValidationError extends Error {
  constructor(
    readonly traitName: string,
    readonly issues: readonly ValidationIssue[]
  ) {
    const message =
      issues.length === 0
        ? `Parameters for trait "${traitName}" failed validation.`
        : `Parameters for trait "${traitName}" failed validation:\n${issues
            .map((issue) => `  - [${issue.severity}] ${issue.code}: ${issue.message}`)
            .join('\n')}`;
    super(message);
    this.name = 'TraitParameterValidationError';
  }
}

const defaultValidator = new ParameterValidator();

export function applyTraitParameters(
  definition: TraitDefinition,
  overrides: TraitParameterMap | undefined,
  options: ParameterApplicationOptions = {}
): ParameterApplicationResult {
  const resolvedParameters = resolveParameters(definition, overrides);

  if (options.validate !== false) {
    const validator = options.validator ?? defaultValidator;
    const validation = validator.validate(definition.trait.name, resolvedParameters, {
      ...options.validationOptions,
      traitLabel: options.traitLabel ?? definition.trait.name,
      filePath: options.filePath,
      includeWarnings: true,
    });

    if (!validation.valid) {
      throw new TraitParameterValidationError(definition.trait.name, validation.issues);
    }
  }

  const clone = cloneTraitDefinition(definition);

  if (!clone.metadata) {
    clone.metadata = {};
  }

  clone.metadata = {
    ...clone.metadata,
    appliedParameters: resolvedParameters,
  };

  return {
    definition: clone,
    parameters: Object.freeze({ ...resolvedParameters }),
  };
}

function resolveParameters(
  definition: TraitDefinition,
  overrides: TraitParameterMap | undefined
): Record<string, TraitParameterValue> {
  const parameters = definition.parameters ?? [];
  if (parameters.length === 0) {
    return overrides ? cloneParameterMap(overrides) : {};
  }

  const defaults: Record<string, TraitParameterValue> = {};
  for (const parameter of parameters) {
    if (parameter.default !== undefined) {
      defaults[parameter.name] = cloneParameterValue(parameter.default as TraitParameterValue);
    }
  }

  if (!overrides) {
    return defaults;
  }

  const merged = { ...defaults };
  for (const [key, value] of Object.entries(overrides)) {
    merged[key] = cloneParameterValue(value);
  }
  return merged;
}

function cloneParameterMap(
  source: TraitParameterMap
): Record<string, TraitParameterValue> {
  const copy: Record<string, TraitParameterValue> = {};
  for (const [key, value] of Object.entries(source)) {
    copy[key] = cloneParameterValue(value);
  }
  return copy;
}

function cloneParameterValue(value: TraitParameterValue): TraitParameterValue {
  if (value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => {
      if (entry === null || typeof entry !== 'object') {
        return entry;
      }
      return { ...(entry as Record<string, unknown>) };
    }) as TraitParameterValue;
  }

  if (typeof value === 'object') {
    return { ...(value as Record<string, unknown>) } as TraitParameterValue;
  }

  return value;
}

function cloneTraitDefinition(definition: TraitDefinition): TraitDefinition {
  if (typeof structuredClone === 'function') {
    return structuredClone(definition);
  }

  return JSON.parse(JSON.stringify(definition)) as TraitDefinition;
}
