import Ajv, { type AnySchema, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

import type { PreferenceDocument } from '@/schemas/preferences/preference-document.js';
import { formatAjvErrors } from '@/validation/formatter.js';
import type { ValidationIssue } from '@/validation/types.js';

import { resolvePreferenceSchema } from './schema-registry.js';

const ajv = new Ajv({
  allErrors: true,
  allowUnionTypes: true,
  strict: false,
});
addFormats(ajv);

const validatorCache = new Map<string, ValidateFunction>();

export interface PreferenceValidationOptions {
  readonly version?: string;
  readonly filePath?: string;
}

export interface PreferenceValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly version: string;
}

function ensureValidator(version: string, schema: AnySchema): ValidateFunction {
  let validator = validatorCache.get(version);
  if (!validator) {
    const schemaClone = structuredClone(schema);
    validator = ajv.compile(schemaClone);
    validatorCache.set(version, validator);
  }
  return validator;
}

export function getPreferenceValidator(version?: string): ValidateFunction {
  const definition = resolvePreferenceSchema(version);
  return ensureValidator(definition.version, definition.schema as AnySchema);
}

export function validatePreferenceDocument(
  document: PreferenceDocument,
  options: PreferenceValidationOptions = {}
): PreferenceValidationResult {
  const definition = resolvePreferenceSchema(options.version);
  const validator = ensureValidator(definition.version, definition.schema as AnySchema);
  const payload = structuredClone(document);
  const valid = validator(payload);
  if (valid) {
    return {
      valid: true,
      issues: [],
      version: definition.version,
    };
  }

  const issues = formatAjvErrors(
    validator.errors,
    options.filePath ?? `preference-schema/${definition.version}.json`
  );

  return {
    valid: false,
    issues,
    version: definition.version,
  };
}
