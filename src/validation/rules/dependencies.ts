import type { ComposedObject } from '../../core/composed-object.js';
import { ErrorCodes } from '../types.js';
import { extractTraitDependencies } from '../zod-transformer.js';
import type { RuleIssue } from './types.js';

/**
 * Ensure every trait dependency is satisfied by the composed object.
 */
export function validateDependencies(composed: ComposedObject): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const traits = Array.isArray(composed.traits) ? composed.traits : [];
  const composedTraitNames = new Set(traits.map((trait) => trait.trait.name));

  traits.forEach((trait, traitIndex) => {
    if (!trait?.trait?.name) {
      return;
    }

    const dependencies = extractTraitDependencies(trait);

    dependencies.forEach((dependency, depIndex) => {
      if (dependency.optional) {
        if (!composedTraitNames.has(dependency.name)) {
          issues.push({
            code: ErrorCodes.MISSING_DEPENDENCY,
            message: `Optional dependency "${dependency.name}" for trait "${trait.trait.name}" is not present in this composition.`,
            hint: `Consider including "${dependency.name}" when composing "${trait.trait.name}" for full feature support.`,
            severity: 'warning',
            path: ['traits', traitIndex, 'dependencies', depIndex],
            related: [trait.trait.name, dependency.name],
            traitPath: [trait.trait.name],
            impactedTraits: findOtherDependents(traits, dependency.name, trait.trait.name),
          });
        }
        return;
      }

      if (!composedTraitNames.has(dependency.name)) {
        issues.push({
          code: ErrorCodes.MISSING_DEPENDENCY,
          message: `Trait "${trait.trait.name}" depends on "${dependency.name}" but it is missing from the composition.`,
          hint: `Add "${dependency.name}" to the composed trait set or remove the dependency from "${trait.trait.name}".`,
          severity: 'error',
          path: ['traits', traitIndex, 'dependencies', depIndex],
          related: [trait.trait.name, dependency.name],
          traitPath: [trait.trait.name, dependency.name],
          impactedTraits: findOtherDependents(traits, dependency.name, trait.trait.name),
        });
      }
    });
  });

  return issues;
}

function findOtherDependents(
  traits: ComposedObject['traits'],
  depName: string,
  excludeTrait: string
): string[] | undefined {
  const others = traits
    .filter((t) => t.trait?.name && t.trait.name !== excludeTrait)
    .filter((t) => {
      const deps = extractTraitDependencies(t);
      return deps.some((d) => d.name === depName);
    })
    .map((t) => t.trait.name);
  return others.length > 0 ? others : undefined;
}
