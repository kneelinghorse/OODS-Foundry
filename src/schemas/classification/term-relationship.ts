import { z } from 'zod';

export const TermRelationshipSchema = z
  .object({
    tenantId: z
      .string()
      .trim()
      .min(3),
    objectType: z
      .string()
      .trim()
      .min(2)
      .max(120),
    objectId: z.string().min(4),
    termTaxonomyId: z.string().min(8),
    field: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .optional(),
    createdAt: z.string().datetime().optional(),
  })
  .strict();

export type TermRelationship = z.infer<typeof TermRelationshipSchema>;

export interface TermRelationshipInput extends Partial<TermRelationship> {
  readonly tenantId: string;
  readonly objectType: string;
  readonly objectId: string;
  readonly termTaxonomyId: string;
}

/**
 * Normalize a relationship entry between a domain object and taxonomy usage.
 */
export function normalizeTermRelationship(input: TermRelationshipInput): TermRelationship {
  if (!input) {
    throw new TypeError('term relationship input is required.');
  }

  return TermRelationshipSchema.parse({
    tenantId: input.tenantId.trim(),
    objectType: input.objectType.trim().toLowerCase(),
    objectId: input.objectId,
    termTaxonomyId: input.termTaxonomyId,
    field: input.field?.trim() || undefined,
    createdAt: input.createdAt,
  });
}
