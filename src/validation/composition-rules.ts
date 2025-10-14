import { z } from 'zod';

import {
  validateCollisions,
  validateDependencies,
  validateSemanticMappings,
  validateStateMachineOwnership,
  validateTokenMappings,
  validateViewExtensions,
} from './rules/index.js';
import type { RuleIssue } from './rules/types.js';
import type { ComposedObject } from '../core/composed-object.js';
import { ErrorCodes } from './types.js';

const BASE_SCHEMA = z.any() as z.ZodType<ComposedObject>;

const RULES = [
  validateCollisions,
  validateDependencies,
  validateSemanticMappings,
  validateStateMachineOwnership,
  validateTokenMappings,
  validateViewExtensions,
] satisfies Array<(value: ComposedObject) => RuleIssue[]>;

/**
 * Create the composition validation schema enriched with rule-based super refinement.
 */
export function createCompositionSchema(): z.ZodType<ComposedObject> {
  return BASE_SCHEMA.superRefine((value, ctx) => {
    if (!value || typeof value !== 'object') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Composed object must be an object.',
        path: [],
        params: {
          code: ErrorCodes.INVALID_TRAIT_FORMAT,
          hint: 'Ensure the compositor returns a structured composed object.',
          severity: 'error',
          domain: 'composition',
          source: 'composition-validator',
        },
      });
      return;
    }

    const composed = value as ComposedObject;

    for (const rule of RULES) {
      for (const issue of rule(composed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: issue.message,
          path: issue.path,
          params: {
            code: issue.code,
            hint: issue.hint ?? null,
            severity: issue.severity ?? 'error',
            related: issue.related,
            docsUrl: issue.docsUrl,
            domain: 'composition',
            source: 'composition-validator',
          },
        });
      }
    }
  });
}
