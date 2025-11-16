import Ajv, { type ErrorObject, type JSONSchemaType, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import schema from '../../../schemas/viz/normalized-viz-spec.schema.json' assert { type: 'json' };
import type { NormalizedVizSpecV01 } from '../../../generated/types/viz/normalized-viz-spec';

export type {
  TraitBinding,
  InteractionTrait,
  InteractionSelection,
  IntervalSelection,
  InteractionRule,
  LayoutDefinition,
  LayoutFacet,
  LayoutLayer,
  LayoutConcat,
  ConcatSection,
  SharedScaleConfig,
  LayoutProjection,
  FacetField,
  SectionFilter,
} from '../../../generated/types/viz/normalized-viz-spec';

export type NormalizedVizSpec = NormalizedVizSpecV01;

export interface NormalizedVizSpecValidationError {
  readonly path: string;
  readonly message: string;
  readonly keyword: string;
}

export interface VizSpecValidationResult {
  readonly valid: boolean;
  readonly errors: readonly NormalizedVizSpecValidationError[];
}

export class NormalizedVizSpecError extends Error {
  public readonly errors: readonly NormalizedVizSpecValidationError[];

  constructor(message: string, errors: readonly NormalizedVizSpecValidationError[]) {
    super(message);
    this.name = 'NormalizedVizSpecError';
    this.errors = errors;
  }
}

const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
addFormats(ajv);

const typedSchema = schema as unknown as JSONSchemaType<NormalizedVizSpec>;
const validator: ValidateFunction<NormalizedVizSpec> = ajv.compile(typedSchema);

export function validateNormalizedVizSpec(input: unknown): VizSpecValidationResult {
  const valid = validator(input);

  if (valid) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: formatErrors(validator.errors ?? []),
  };
}

export function assertNormalizedVizSpec(input: unknown): NormalizedVizSpec {
  const result = validateNormalizedVizSpec(input);

  if (result.valid) {
    return input as NormalizedVizSpec;
  }

  throw new NormalizedVizSpecError('Normalized Viz Spec validation failed', [...result.errors]);
}

export function isNormalizedVizSpec(input: unknown): input is NormalizedVizSpec {
  return validator(input) === true;
}

export const normalizedVizSpecSchema = schema;

function formatErrors(errors: ErrorObject[]): NormalizedVizSpecValidationError[] {
  return errors.map((error) => ({
    path: error.instancePath === '' ? '/' : error.instancePath,
    message: error.message ?? 'Validation error',
    keyword: error.keyword,
  }));
}
