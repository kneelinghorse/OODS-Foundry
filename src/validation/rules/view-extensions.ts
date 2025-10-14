import type { ComposedObject } from '../../core/composed-object.js';
import { ErrorCodes } from '../types.js';
import { normalizeViewRegion } from '../zod-transformer.js';
import type { RuleIssue } from './types.js';

const ALLOWED_VIEW_CONTEXTS = new Set([
  'list',
  'detail',
  'form',
  'timeline',
  'card',
  'inline',
]);

const FIELD_KEY_PATTERN = /(?:^field$|Field$)/;

/**
 * Validate view extension targets and referenced field bindings.
 */
export function validateViewExtensions(composed: ComposedObject): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const schemaObject = composed.schema && typeof composed.schema === 'object'
    ? composed.schema
    : {};
  const schemaFields = new Set(Object.keys(schemaObject));
  const viewExtensions = composed.viewExtensions && typeof composed.viewExtensions === 'object'
    ? composed.viewExtensions
    : {};

  for (const [regionKey, extensions] of Object.entries(viewExtensions)) {
    if (!Array.isArray(extensions) || extensions.length === 0) {
      continue;
    }

    const normalized = normalizeViewRegion(regionKey);
    if (!ALLOWED_VIEW_CONTEXTS.has(normalized)) {
      issues.push({
        code: ErrorCodes.VIEW_EXTENSION_INVALID,
        message: `View extension context "${regionKey}" is not supported (allowed: ${Array.from(ALLOWED_VIEW_CONTEXTS).join(', ')}).`,
        hint: `Emit extensions only within the supported contexts or update the context template specification to accept new contexts.`,
        severity: 'error',
        path: ['viewExtensions', regionKey],
        related: [regionKey],
      });
      continue;
    }

    extensions.forEach((extension, index) => {
      const props = extension.props ?? {};

      for (const [propKey, value] of Object.entries(props)) {
        if (
          typeof value === 'string' &&
          FIELD_KEY_PATTERN.test(propKey) &&
          !schemaFields.has(value)
        ) {
          issues.push({
            code: ErrorCodes.VIEW_EXTENSION_INVALID,
            message: `View extension "${extension.component}" references field "${value}" via "${propKey}" but it does not exist in the composed schema.`,
            hint: `Add "${value}" to the schema or update "${extension.component}" to reference an existing field.`,
            severity: 'error',
            path: ['viewExtensions', regionKey, index, 'props', propKey],
            related: [extension.component || 'UnknownComponent', value, regionKey],
          });
        }
      }
    });
  }

  return issues;
}
