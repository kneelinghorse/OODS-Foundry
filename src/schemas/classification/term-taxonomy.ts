import { z } from 'zod';

import { TERM_TAXONOMY_TYPES, type TermTaxonomyType } from './constants.js';
import { LTREE_PATH_PATTERN, normalizeLtreePath } from './utils.js';

export const TermTaxonomySchema = z
  .object({
    id: z.string().min(8).optional(),
    tenantId: z
      .string()
      .trim()
      .min(3),
    termId: z.string().min(8),
    taxonomy: z.enum(TERM_TAXONOMY_TYPES),
    categoryId: z.string().min(8).optional().nullable(),
    tagId: z.string().min(8).optional().nullable(),
    parentId: z.string().min(8).optional().nullable(),
    hierarchyPath: z
      .string()
      .regex(LTREE_PATH_PATTERN, 'hierarchy paths must be valid ltree strings.')
      .optional()
      .nullable(),
    depth: z
      .number()
      .int()
      .min(0)
      .max(63),
    relationshipCount: z
      .number()
      .int()
      .min(0),
    metadata: z.record(z.string(), z.unknown()).optional(),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
  })
  .strict();

export type TermTaxonomyEntry = z.infer<typeof TermTaxonomySchema>;

export interface TermTaxonomyInput
  extends Partial<Omit<TermTaxonomyEntry, 'hierarchyPath' | 'depth' | 'taxonomy'>> {
  readonly tenantId: string;
  readonly termId: string;
  readonly taxonomy: TermTaxonomyType;
  readonly hierarchyPath?: string | readonly string[] | null;
  readonly depth?: number;
  readonly metadata?: Record<string, unknown> | undefined;
}

/**
 * Normalize a term taxonomy entry, resolving hierarchy paths and depth.
 */
export function normalizeTermTaxonomyEntry(input: TermTaxonomyInput): TermTaxonomyEntry {
  if (!input) {
    throw new TypeError('term taxonomy input is required.');
  }

  if (input.taxonomy === 'category' && !input.categoryId) {
    throw new Error('categoryId is required for taxonomy="category".');
  }

  if (input.taxonomy === 'tag' && !input.tagId) {
    throw new Error('tagId is required for taxonomy="tag".');
  }

  const hasHierarchy = typeof input.hierarchyPath !== 'undefined' && input.hierarchyPath !== null;
  const hierarchyPath = hasHierarchy
    ? normalizeLtreePath(
        typeof input.hierarchyPath === 'string' ? input.hierarchyPath : input.hierarchyPath,
        []
      )
    : null;
  const depth = typeof input.depth === 'number'
    ? input.depth
    : hierarchyPath
    ? Math.max(hierarchyPath.split('.').length - 1, 0)
    : 0;

  return TermTaxonomySchema.parse({
    id: input.id,
    tenantId: input.tenantId.trim(),
    termId: input.termId,
    taxonomy: input.taxonomy,
    categoryId: input.categoryId ?? null,
    tagId: input.tagId ?? null,
    parentId: input.parentId ?? null,
    hierarchyPath,
    depth,
    relationshipCount: input.relationshipCount ?? 0,
    metadata: input.metadata ? { ...input.metadata } : undefined,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });
}
