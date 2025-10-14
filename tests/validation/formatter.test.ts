/**
 * Tests for validation formatters.
 */

import Ajv from 'ajv';
import type { ErrorObject } from 'ajv';
import { describe, expect, it } from 'vitest';
import { z, ZodIssueCode } from 'zod';

import {
  formatAjvError,
  formatZodIssue,
} from '../../src/validation/formatter.js';
import { ErrorCodes } from '../../src/validation/types.js';

describe('formatAjvError', () => {
  it('maps required keyword errors to ValidationIssue objects with hints', () => {
    const ajv = new Ajv({ allErrors: true });
    const schema = {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
      },
    };

    const validate = ajv.compile(schema);
    const valid = validate({});
    expect(valid).toBe(false);

    const requiredError = validate.errors?.find((err) => err.keyword === 'required');
    expect(requiredError).toBeDefined();

    const issue = formatAjvError(requiredError as ErrorObject, 'traits/example.yaml');
    expect(issue.code).toBe(ErrorCodes.MISSING_REQUIRED_PARAMETER);
    expect(issue.fixHint).toContain("Add the required 'name'");
    expect(issue.location.path).toBe('/');
    expect(issue.source).toBe('ajv');
    expect(issue.domain).toBe('parameters');
  });

  it('provides actionable hints for minItems violations', () => {
    const ajv = new Ajv({ allErrors: true });
    const schema = {
      type: 'array',
      minItems: 2,
    };

    const validate = ajv.compile(schema);
    const valid = validate([1]);
    expect(valid).toBe(false);

    const minItemsError = validate.errors?.find((err) => err.keyword === 'minItems');
    expect(minItemsError).toBeDefined();

    const issue = formatAjvError(minItemsError as ErrorObject, 'traits/example.yaml');
    expect(issue.code).toBe(ErrorCodes.INVALID_PARAMETER_VALUE);
    expect(issue.message).toContain('at least 2 item(s)');
    expect(issue.fixHint).toContain('Add more items');
  });

  it('honours severity overrides when provided in error params', () => {
    const overridden: ErrorObject = {
      instancePath: '/parameters',
      schemaPath: '#/properties/parameters/type',
      keyword: 'type',
      params: { type: 'array', severity: 'warning' },
      message: 'must be array',
    };

    const issue = formatAjvError(overridden, 'traits/example.yaml');
    expect(issue.severity).toBe('warning');
  });
});

describe('formatZodIssue', () => {
  it('translates Zod issues into ValidationIssue objects', () => {
    const schema = z.object({
      count: z.number().min(1),
    });

    const result = schema.safeParse({ count: 0 });
    expect(result.success).toBe(false);

  const issue = formatZodIssue(result.error.issues[0], 'traits/example.yaml');
  expect(issue.code).toBe(ErrorCodes.INVALID_PARAMETER_VALUE);
  expect(issue.fixHint).toContain('Increase the value');
  expect(issue.source).toBe('zod');
  expect(issue.domain).toBe('composition');
});

  it('uses custom severity and hint from Zod superRefine issues', () => {
    const schema = z.string().superRefine((value, ctx) => {
      if (value.toLowerCase() === value) {
        ctx.addIssue({
          code: ZodIssueCode.custom,
          message: 'Value should be uppercase',
          params: { severity: 'warning', hint: 'Convert the string to uppercase' },
        });
      }
    });

    const result = schema.safeParse('lowercase');
    expect(result.success).toBe(false);

    const issue = formatZodIssue(result.error.issues[0], 'traits/example.yaml');
    expect(issue.severity).toBe('warning');
    expect(issue.fixHint).toBe('Convert the string to uppercase');
  });
});
