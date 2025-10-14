import type { ComposedObject } from '../../core/composed-object.js';
import { ErrorCodes } from '../types.js';
import type { RuleIssue } from './types.js';

/**
 * Emit issues for detected schema collisions between traits.
 *
 * Collisions that were resolved automatically surface as warnings so authors
 * can review them, while manual resolutions are downgraded to informational
 * hints to avoid noisy failures.
 */
export function validateCollisions(composed: ComposedObject): RuleIssue[] {
  const collisions = Array.isArray(composed.metadata?.collisions)
    ? composed.metadata.collisions
    : [];

  if (collisions.length === 0) {
    return [];
  }

  return collisions.map((collision, index): RuleIssue => {
    const conflictingTraitsArray = Array.isArray(collision?.conflictingTraits)
      ? collision.conflictingTraits
      : [];
    const conflictingTraits = conflictingTraitsArray.join(', ');
    const message = `Field "${collision.fieldName}" was contributed by multiple traits (${conflictingTraits}) and resolved using "${collision.resolution}".`;
    const hint = `Align the field definition across ${conflictingTraits} or provide an explicit resolution for "${collision.fieldName}".`;

    const severity =
      collision.resolution === 'manual' ? 'info' : 'warning';

    return {
      code: ErrorCodes.PROPERTY_COLLISION,
      message,
      hint,
      severity,
      path: ['metadata', 'collisions', index],
      related: [collision.fieldName, ...conflictingTraitsArray],
    };
  });
}
