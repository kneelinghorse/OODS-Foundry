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

    // Identify traits beyond the colliders whose view extensions or semantics
    // reference the colliding field — they are downstream impacted.
    const allTraitNames = (composed.traits ?? []).map((t) => t.trait?.name).filter(Boolean) as string[];
    const impactedTraits = allTraitNames.filter(
      (name) => !conflictingTraitsArray.includes(name) && fieldReferencedByTrait(composed, collision.fieldName, name)
    );

    return {
      code: ErrorCodes.PROPERTY_COLLISION,
      message,
      hint,
      severity,
      path: ['metadata', 'collisions', index],
      related: [collision.fieldName, ...conflictingTraitsArray],
      traitPath: conflictingTraitsArray,
      impactedTraits: impactedTraits.length > 0 ? impactedTraits : undefined,
    };
  });
}

function fieldReferencedByTrait(composed: ComposedObject, fieldName: string, traitName: string): boolean {
  const trait = (composed.traits ?? []).find((t) => t.trait?.name === traitName);
  if (!trait) return false;
  if (trait.semantics && fieldName in trait.semantics) return true;
  for (const exts of Object.values(trait.view_extensions ?? {})) {
    if (Array.isArray(exts) && exts.some((ext) => Object.values(ext.props ?? {}).includes(fieldName))) return true;
  }
  return false;
}
