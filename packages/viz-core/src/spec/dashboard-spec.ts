import Ajv, { type ErrorObject, type JSONSchemaType, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import schema from './dashboard-spec.schema.json' with { type: 'json' };
import type { DashboardSpecV01 } from './dashboard.types.js';

// Re-export the public IR surface generated from the schema (the #681
// Generator-B file is the live source of truth — do NOT hand-edit it). The
// internal `ChartPanel1` intersection artifact is intentionally NOT re-exported.
export type {
  Panel,
  ChartPanel,
  KpiPanel,
  Dataset,
  Encodings,
  EncodingBinding,
  HierarchyData,
  HierarchyNode,
  SankeyData,
  NetworkData,
  GeoData,
  KpiComparison,
  KpiThreshold,
  DashboardLayout,
  PanelPlacement,
  DashboardLink,
  CrossFilterConfig,
  DashboardA11YSpec,
} from './dashboard.types.js';

export type DashboardSpec = DashboardSpecV01;

export interface DashboardSpecValidationError {
  readonly path: string;
  readonly message: string;
  readonly keyword: string;
}

export interface DashboardSpecValidationResult {
  readonly valid: boolean;
  readonly errors: readonly DashboardSpecValidationError[];
}

export class DashboardSpecError extends Error {
  public readonly errors: readonly DashboardSpecValidationError[];

  constructor(message: string, errors: readonly DashboardSpecValidationError[]) {
    super(message);
    this.name = 'DashboardSpecError';
    this.errors = errors;
  }
}

const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
addFormats(ajv);

const typedSchema = schema as unknown as JSONSchemaType<DashboardSpec>;
const validator: ValidateFunction<DashboardSpec> = ajv.compile(typedSchema);

export function validateDashboardSpec(input: unknown): DashboardSpecValidationResult {
  const valid = validator(input);

  if (valid) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: formatErrors(validator.errors ?? []),
  };
}

export function assertDashboardSpec(input: unknown): DashboardSpec {
  const result = validateDashboardSpec(input);

  if (result.valid) {
    return input as DashboardSpec;
  }

  throw new DashboardSpecError('Dashboard Spec validation failed', [...result.errors]);
}

export function isDashboardSpec(input: unknown): input is DashboardSpec {
  return validator(input) === true;
}

export const dashboardSpecSchema = schema;

function formatErrors(errors: ErrorObject[]): DashboardSpecValidationError[] {
  return errors.map((error) => ({
    path: error.instancePath === '' ? '/' : error.instancePath,
    message: error.message ?? 'Validation error',
    keyword: error.keyword,
  }));
}
