import type { FieldDefinition } from './types.js';

export type RelationshipProblem = {
  kind: 'invalid-relationship' | 'unknown-relationship-target' | 'unknown-relationship-field';
  path: string;
  message: string;
};
export const CARDINALITIES = ['one-to-one', 'one-to-many', 'many-to-one', 'many-to-many'] as const;

/** Validate declarations only. A UUID name never creates an edge or implies a target. */
export function relationshipProblems(raw: unknown, name: string, fields: Record<string, FieldDefinition>, available: readonly string[]): RelationshipProblem[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return [{ kind: 'invalid-relationship', path: 'relationships', message: 'relationships must be a list of target, via, cardinality and label declarations.' }];
  const errors: RelationshipProblem[] = [], seen = new Set<string>();
  raw.forEach((entry: unknown, index) => {
    const at = `relationships[${index}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push({ kind: 'invalid-relationship', path: at, message: `${at} must be a relationship mapping.` }); return;
    }
    const relation = entry as Record<string, unknown>;
    for (const key of ['target', 'via', 'label']) if (typeof relation[key] !== 'string' || !(relation[key] as string).trim()) errors.push({ kind: 'invalid-relationship', path: `${at}.${key}`, message: `${at}.${key} must be nonempty text.` });
    if (!(CARDINALITIES as readonly unknown[]).includes(relation.cardinality)) errors.push({ kind: 'invalid-relationship', path: `${at}.cardinality`, message: `${at}.cardinality must be ${CARDINALITIES.join(', ')}.` });
    if (typeof relation.target === 'string' && relation.target && relation.target !== name && !available.includes(relation.target)) errors.push({ kind: 'unknown-relationship-target', path: `${at}.target`, message: `Relationship target "${relation.target}" is not a registered object. Register that object first.` });
    if (typeof relation.via === 'string' && relation.via && !Object.hasOwn(fields, relation.via)) errors.push({ kind: 'unknown-relationship-field', path: `${at}.via`, message: `Relationship field "${relation.via}" does not exist on ${name}, including its traits.` });
    const key = JSON.stringify([relation.target, relation.via]);
    if (seen.has(key)) errors.push({ kind: 'invalid-relationship', path: at, message: `${at} repeats the same target and source field.` });
    seen.add(key);
  });
  return errors;
}
