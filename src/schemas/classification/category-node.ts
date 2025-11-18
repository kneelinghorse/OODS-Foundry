import { z } from 'zod';

import { CLASSIFICATION_MODES, type ClassificationMode } from './constants.js';
import {
  CATEGORY_IDENTIFIER_PATTERN,
  CATEGORY_SLUG_PATTERN,
  LTREE_PATH_PATTERN,
  normalizeIdentifier,
  normalizeLtreePath,
  normalizeSlug,
  normalizeSynonymList,
} from './utils.js';

const IdentifierSchema = z
  .string()
  .regex(CATEGORY_IDENTIFIER_PATTERN, 'category identifiers must be lowercase a-z, 0-9, "_" or "-".');

const SlugSchema = z
  .string()
  .regex(CATEGORY_SLUG_PATTERN, 'slugs must be kebab-case (lowercase letters, digits, "-").');

export const CategoryNodeSchema = z
  .object({
    id: IdentifierSchema,
    slug: SlugSchema,
    name: z
      .string()
      .trim()
      .min(2)
      .max(160),
    description: z
      .string()
      .trim()
      .min(4)
      .max(320)
      .optional(),
    parentId: IdentifierSchema.optional().nullable(),
    ltreePath: z
      .string()
      .regex(LTREE_PATH_PATTERN, 'ltreePath must be dot-delimited and contain lowercase alphanumerics or "_".'),
    depth: z
      .number()
      .int()
      .min(0)
      .max(64),
    ancestors: z.array(IdentifierSchema).max(32),
    childCount: z
      .number()
      .int()
      .min(0)
      .max(100_000),
    isSelectable: z.boolean(),
    synonyms: z.array(SlugSchema).max(32),
    mode: z.enum(CLASSIFICATION_MODES),
    updatedAt: z.string().datetime().optional(),
    metadata: z
      .object({
        source: z
          .string()
          .trim()
          .min(2)
          .max(120)
          .optional(),
        externalId: z
          .string()
          .trim()
          .min(2)
          .max(120)
          .optional(),
        sortKey: z
          .number()
          .int()
          .min(0)
          .max(1000)
          .optional(),
      })
      .strip()
      .optional(),
  })
  .strict()
  .transform((value) => ({
    ...value,
    ancestors: Object.freeze([...value.ancestors]),
    synonyms: Object.freeze([...value.synonyms]),
    metadata: value.metadata ? Object.freeze({ ...value.metadata }) : undefined,
  }));

export type CategoryNode = z.infer<typeof CategoryNodeSchema>;

export type CategoryNodeInput = Omit<
  z.input<typeof CategoryNodeSchema>,
  'ltreePath' | 'ancestors' | 'synonyms' | 'parentId'
> & {
  readonly ltreePath?: string;
  readonly path?: string | readonly string[];
  readonly ancestors?: readonly string[];
  readonly synonyms?: readonly string[];
  readonly parentId?: string | null;
  readonly mode?: ClassificationMode;
};

/**
 * Normalize a category node using canonical identifiers, slug rules, and ltree paths.
 */
export function normalizeCategoryNode(input: CategoryNodeInput): CategoryNode {
  if (!input) {
    throw new TypeError('Category node input is required.');
  }

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) {
    throw new Error('Category node name is required.');
  }

  const baseIdentifier = typeof input.id === 'string' ? input.id : name;
  const identifier = normalizeIdentifier(baseIdentifier);
  const slugSource = typeof input.slug === 'string' ? input.slug : name;
  const slug = normalizeSlug(slugSource);

  const ancestors = (input.ancestors ?? []).map((ancestor) => normalizeIdentifier(ancestor));
  const fallbackSegments =
    ancestors.length > 0
      ? [...ancestors, identifier]
      : (input.parentId ? [normalizeIdentifier(input.parentId), identifier] : [identifier]);

  const { path, ...rest } = input as CategoryNodeInput & { path?: string | readonly string[] };

  const pathCandidate = input.ltreePath ?? path;
  const ltreePath = normalizeLtreePath(pathCandidate, fallbackSegments);
  const depth = input.depth ?? Math.max(ltreePath.split('.').length - 1, 0);
  const parentId = input.parentId ? normalizeIdentifier(input.parentId) : undefined;

  return CategoryNodeSchema.parse({
    ...rest,
    id: identifier,
    slug,
    name,
    ancestors,
    ltreePath,
    depth,
    parentId,
    childCount: input.childCount ?? 0,
    isSelectable: input.isSelectable ?? true,
    synonyms: normalizeSynonymList(input.synonyms),
    mode: input.mode ?? 'taxonomy',
  });
}
