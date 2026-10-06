import { randomUUID } from 'node:crypto';
import { knownBrands, unknownBrandMessage } from '../lib/brand-registry.js';

/** s213-m04: the JSON Schema format every brand field carries; getAjv checks it against the brand registry. */
export const BRAND_FORMAT = 'oods-brand';

export type TypedError = {
  code: string;
  message: string;
  details?: unknown;
  incidentId: string;
};

export function err(code: string, message: string, details?: unknown): TypedError {
  return { code, message, details, incidentId: randomUUID() };
}

export const ERROR_CODES = {
  POLICY_DENIED: 'POLICY_DENIED',
  RATE_LIMIT: 'RATE_LIMIT',
  CONCURRENCY: 'CONCURRENCY',
  TIMEOUT: 'TIMEOUT',
  SCHEMA_INPUT: 'SCHEMA_INPUT',
  SCHEMA_OUTPUT: 'SCHEMA_OUTPUT',
  BAD_REQUEST: 'BAD_REQUEST',
  UNKNOWN_TOOL: 'UNKNOWN_TOOL',
} as const;

// ---------------------------------------------------------------------------
// Agent-friendly validation error formatting
// ---------------------------------------------------------------------------

export type ValidationErrorDetail = {
  field: string;
  message: string;
  keyword: string;
};

export type FormattedValidationResult = {
  message: string;
  details: ValidationErrorDetail[];
};

/**
 * Converts raw AJV error objects into agent-readable messages so agents can
 * self-correct without needing to consult documentation.
 */
export function formatValidationErrors(
  errors: Array<{ keyword: string; instancePath: string; params: Record<string, unknown>; message?: string }> | null | undefined,
  options?: { prefix?: string; data?: unknown },
): FormattedValidationResult {
  const prefix = options?.prefix ?? 'Input validation failed';
  if (!errors || errors.length === 0) {
    return { message: prefix, details: [] };
  }

  const details: ValidationErrorDetail[] = errors.map((e) => {
    const field = e.instancePath ? e.instancePath.replace(/^\//, '').replace(/\//g, '.') : '(root)';

    switch (e.keyword) {
      case 'enum': {
        const allowed = (e.params.allowedValues as string[]) ?? [];
        return {
          field,
          message: `field '${field}' must be one of: ${allowed.join(', ')}`,
          keyword: 'enum',
        };
      }
      case 'required': {
        const missing = (e.params.missingProperty as string) ?? 'unknown';
        return {
          field: missing,
          message: `missing required field: '${missing}'`,
          keyword: 'required',
        };
      }
      case 'type': {
        const expected = (e.params.type as string) ?? 'unknown';
        return {
          field,
          message: `field '${field}' must be ${expected}`,
          keyword: 'type',
        };
      }
      case 'additionalProperties': {
        const extra = (e.params.additionalProperty as string) ?? 'unknown';
        return {
          field: extra,
          message: `unknown field '${extra}' is not allowed`,
          keyword: 'additionalProperties',
        };
      }
      case 'format':
        if (e.params.format === BRAND_FORMAT) {
          // s213-m04: brands come from the registry, so the answer names the brands this server has.
          return { field, message: unknownBrandMessage(valueAt(options?.data, e.instancePath), field), keyword: 'brand' };
        }
        return { field, message: e.message ?? 'validation failed (format)', keyword: 'format' };
      default:
        return {
          field,
          message: e.message ?? `validation failed (${e.keyword})`,
          keyword: e.keyword,
        };
    }
  });

  const summary = details.map((d) => d.message).join('; ');
  return { message: `${prefix}: ${summary}`, details };
}

/** The value a JSON pointer names, or undefined. */
function valueAt(data: unknown, pointer: string): unknown {
  let node = data;
  for (const segment of pointer.split('/').slice(1).map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'))) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return node;
}

/** The brands a brand field accepts, for an error's `expected` map. */
export function knownBrandsExpectation(): string {
  return `one of ${knownBrands().join(', ')} (the brand registry; health lists it)`;
}
