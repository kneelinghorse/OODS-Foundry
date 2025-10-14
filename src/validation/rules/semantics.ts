import type { ComposedObject } from '../../core/composed-object.js';
import { ErrorCodes } from '../types.js';
import { extractProvenanceEntries } from '../zod-transformer.js';
import type { RuleIssue } from './types.js';

/**
 * Validate semantic mappings cover trait-provided fields and reference valid schema entries.
 */
export function validateSemanticMappings(composed: ComposedObject): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const schemaObject = composed.schema && typeof composed.schema === 'object'
    ? composed.schema
    : {};
  const schemaFields = new Set(Object.keys(schemaObject));
  const semanticEntries = composed.semantics && typeof composed.semantics === 'object'
    ? composed.semantics
    : {};

  for (const [fieldName, semantic] of Object.entries(semanticEntries)) {
    if (!semantic || typeof semantic !== 'object') {
      continue;
    }

    if (!schemaFields.has(fieldName)) {
      issues.push({
        code: ErrorCodes.SEMANTIC_MAPPING_INCOMPLETE,
        message: `Semantic mapping references "${fieldName}" but the field is not present in the composed schema.`,
        hint: `Remove the semantic mapping or add "${fieldName}" to the schema.`,
        severity: 'error',
        path: ['semantics', fieldName],
        related: [fieldName],
      });
      continue;
    }

    if (!semantic.semantic_type) {
      issues.push({
        code: ErrorCodes.SEMANTIC_MAPPING_INCOMPLETE,
        message: `Semantic mapping for "${fieldName}" is missing a semantic_type.`,
        hint: `Provide a semantic_type so downstream consumers can interpret "${fieldName}" correctly.`,
        severity: 'warning',
        path: ['semantics', fieldName],
        related: [fieldName],
      });
    }
  }

  const semanticsFields = new Set(Object.keys(semanticEntries));
  const provenanceEntries = extractProvenanceEntries(composed);

  provenanceEntries.forEach(([fieldName, provenance]) => {
    if (provenance.layer !== 'trait') {
      return;
    }

    if (!semanticsFields.has(fieldName)) {
      issues.push({
        code: ErrorCodes.SEMANTIC_MAPPING_INCOMPLETE,
        message: `Trait "${provenance.source}" contributed field "${fieldName}" without a semantic mapping.`,
        hint: `Add a semantic mapping for "${fieldName}" in "${provenance.source}" to maintain semantic completeness.`,
        severity: 'warning',
        path: ['semantics', fieldName],
        related: [provenance.source, fieldName],
      });
    }
  });

  return issues;
}
