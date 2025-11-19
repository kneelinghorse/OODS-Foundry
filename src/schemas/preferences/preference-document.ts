import { z } from 'zod';

import {
  PreferenceMetadataSchema,
  type PreferenceMetadataInput,
  normalizePreferenceMetadata,
  SEMVER_PATTERN,
} from './preference-metadata.js';

const PREFERENCE_KEY_PATTERN = /^[a-z0-9._-]+$/i;

export type PreferencePrimitive = string | number | boolean | null;
export type PreferenceValue =
  | PreferencePrimitive
  | PreferenceValue[]
  | {
      [key: string]: PreferenceValue;
    };
export type PreferenceRecord = Record<string, PreferenceValue>;

const PreferenceScalarSchema = z.union([
  z.string().trim().max(2048),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const PreferenceValueSchema: z.ZodType<PreferenceValue> = z.lazy(() =>
  z.union([
    PreferenceScalarSchema,
    z.array(PreferenceValueSchema).max(128),
    z.record(z.string().regex(PREFERENCE_KEY_PATTERN), PreferenceValueSchema),
  ])
);

const PreferenceMapSchema = z
  .record(z.string().regex(PREFERENCE_KEY_PATTERN), PreferenceValueSchema)
  .default({})
  .transform((record) => clonePreferenceRecord(record));

export const PreferenceDocumentSchema = z
  .object({
    version: z.string().regex(SEMVER_PATTERN, 'version must follow semver (e.g., 1.0.0).'),
    preferences: PreferenceMapSchema,
    metadata: PreferenceMetadataSchema,
  })
  .strict();

export type PreferenceDocument = z.infer<typeof PreferenceDocumentSchema>;
export type PreferenceDocumentInput = Partial<z.input<typeof PreferenceDocumentSchema>>;

export interface NormalizePreferenceDocumentOptions {
  readonly clock?: () => string;
  readonly defaultVersion?: string;
  readonly schemaVersion?: string;
}

export function normalizePreferenceDocument(
  input: PreferenceDocumentInput,
  options: NormalizePreferenceDocumentOptions = {}
): PreferenceDocument {
  const version = input.version ?? options.defaultVersion ?? '1.0.0';
  const rawPreferences = (input.preferences ?? {}) as PreferenceRecord;
  const preferences = clonePreferenceRecord(rawPreferences);

  const metadataInput: PreferenceMetadataInput = {
    ...input.metadata,
    schemaVersion: input.metadata?.schemaVersion ?? options.schemaVersion ?? version,
  };

  const metadata = normalizePreferenceMetadata(metadataInput, {
    clock: options.clock,
    schemaVersionFallback: options.schemaVersion ?? version,
    updatedBy: input.metadata?.updatedBy,
    source: input.metadata?.source,
  });

  return PreferenceDocumentSchema.parse({
    version,
    preferences,
    metadata,
  });
}

export function clonePreferenceRecord(record: PreferenceRecord): PreferenceRecord {
  const clone: PreferenceRecord = {};
  for (const [key, value] of Object.entries(record)) {
    clone[key] = clonePreferenceValue(value);
  }
  return clone;
}

export function clonePreferenceValue(value: PreferenceValue): PreferenceValue {
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => clonePreferenceValue(entry));
  }
  if (isPreferenceRecord(value)) {
    const clone: PreferenceRecord = {};
    for (const [key, entry] of Object.entries(value)) {
      clone[key] = clonePreferenceValue(entry);
    }
    return clone;
  }
  return value;
}

function isPreferenceRecord(value: PreferenceValue): value is PreferenceRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
