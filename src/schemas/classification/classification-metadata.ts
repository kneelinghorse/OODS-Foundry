import { z } from 'zod';

import {
  CLASSIFICATION_MODES,
  HIERARCHY_STORAGE_MODELS,
  TAG_POLICIES,
} from './constants.js';

export const ClassificationMetadataSchema = z
  .object({
    mode: z.enum(CLASSIFICATION_MODES),
    hierarchyStorageModel: z.enum(HIERARCHY_STORAGE_MODELS),
    tagPolicy: z.enum(TAG_POLICIES),
    tagLimit: z
      .number()
      .int()
      .min(1)
      .max(200),
    primaryCategoryRequired: z.boolean(),
    taxonomyVersion: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .optional(),
    lastIndexedAt: z.string().datetime().optional(),
    governance: z
      .object({
        synonymsEnabled: z.boolean(),
        moderationQueue: z.boolean(),
        spamHeuristics: z
          .object({
            maxTagsPerItem: z
              .number()
              .int()
              .min(1)
              .max(200),
            velocityThreshold: z
              .number()
              .int()
              .min(1)
              .max(1_000),
          })
          .strict(),
      })
      .strict(),
    source: z
      .object({
        dataset: z
          .string()
          .trim()
          .min(2)
          .max(120)
          .optional(),
        version: z
          .string()
          .trim()
          .min(1)
          .max(64)
          .optional(),
        generatedAt: z.string().datetime().optional(),
      })
      .strict(),
  })
  .strict()
  .transform((value) => ({
    ...value,
    governance: Object.freeze({
      ...value.governance,
      spamHeuristics: Object.freeze({ ...value.governance.spamHeuristics }),
    }),
    source: Object.freeze({ ...value.source }),
  }));

export type ClassificationMetadata = z.infer<typeof ClassificationMetadataSchema>;
export type ClassificationMetadataInput = Partial<ClassificationMetadata>;

export function normalizeClassificationMetadata(
  input: ClassificationMetadataInput | undefined
): ClassificationMetadata {
  const sanitized = {
    mode: input?.mode ?? 'hybrid',
    hierarchyStorageModel: input?.hierarchyStorageModel ?? 'materialized_path',
    tagPolicy: input?.tagPolicy ?? 'moderated',
    tagLimit: input?.tagLimit ?? 10,
    primaryCategoryRequired: input?.primaryCategoryRequired ?? false,
    taxonomyVersion: input?.taxonomyVersion,
    lastIndexedAt: input?.lastIndexedAt,
    governance: {
      synonymsEnabled: input?.governance?.synonymsEnabled ?? true,
      moderationQueue: input?.governance?.moderationQueue ?? true,
      spamHeuristics: {
        maxTagsPerItem: input?.governance?.spamHeuristics?.maxTagsPerItem ?? 20,
        velocityThreshold: input?.governance?.spamHeuristics?.velocityThreshold ?? 100,
      },
    },
    source: {
      dataset: input?.source?.dataset,
      version: input?.source?.version,
      generatedAt: input?.source?.generatedAt,
    },
  };

  return ClassificationMetadataSchema.parse(sanitized);
}
