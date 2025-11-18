import { z } from 'zod';

import { CATEGORY_SLUG_PATTERN, normalizeSlug } from './utils.js';

export const TermSchema = z
  .object({
    id: z.string().min(8).optional(),
    tenantId: z
      .string()
      .trim()
      .min(3),
    slug: z
      .string()
      .regex(CATEGORY_SLUG_PATTERN, 'term slugs must be kebab-case.'),
    name: z
      .string()
      .trim()
      .min(2)
      .max(160),
    description: z
      .string()
      .trim()
      .min(4)
      .max(512)
      .optional(),
    language: z
      .string()
      .trim()
      .min(2)
      .max(16)
      .optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
  })
  .strict();

export type Term = z.infer<typeof TermSchema>;

export interface TermInput extends Partial<Omit<Term, 'slug'>> {
  readonly tenantId: string;
  readonly slug?: string;
  readonly name: string;
  readonly metadata?: Record<string, unknown> | undefined;
}

/**
 * Normalize canonical term payloads so taxonomy + tags share identical slugs.
 */
export function normalizeTerm(input: TermInput): Term {
  if (!input) {
    throw new TypeError('Term input is required.');
  }

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) {
    throw new Error('Term name is required.');
  }

  const slugSource = typeof input.slug === 'string' && input.slug.trim().length > 0 ? input.slug : name;
  const slug = normalizeSlug(slugSource);

  return TermSchema.parse({
    id: input.id,
    tenantId: input.tenantId.trim(),
    slug,
    name,
    description: input.description?.trim() || undefined,
    language: input.language?.trim() || undefined,
    metadata: input.metadata ? { ...input.metadata } : undefined,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });
}
