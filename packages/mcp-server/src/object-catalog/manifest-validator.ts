/**
 * Object Catalog manifest validator (Forge-owned).
 *
 * Re-homed in s106-m02 from the deleted src/concordance/ module when the
 * Concordance integration was torn down (decision #633). Forge owns the
 * semantic protocol (decision #634), so the SemanticManifest envelope schema
 * and the G1 structural-validation logic now live under object-catalog/.
 *
 * Loads the frozen manifest schema at module init and exposes a single
 * validateManifest(payload) entry. No network calls.
 *
 * schema_version handling (carried over from the original validator):
 *   The frozen manifest.schema.json is at envelope 1.0.0 (no schema_version
 *   property at the root, additionalProperties:false). Manifests Forge emits
 *   may carry schema_version "1.1.0". To honor both:
 *     1. If the payload has schema_version, run it through the version policy
 *        (warn on minor mismatch, throw on major).
 *     2. Strip schema_version before AJV so the strict additionalProperties:false
 *        check doesn't reject it.
 */

// Match the existing lib/ajv.ts pattern: ajv's empty exports map breaks NodeNext
// subpath resolution at type-check time, and ajv-formats ships CJS with default
// export riding on module.exports.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - subpath import for draft-2020-12 support
import Ajv2020Import from 'ajv/dist/2020.js';
import type { ErrorObject, ValidateFunction } from 'ajv';
import addFormatsImport from 'ajv-formats';
import manifestSchema from './protocol/manifest.schema.json' with { type: 'json' };

const Ajv2020: any = (Ajv2020Import as any).default ?? Ajv2020Import;
const addFormats: any = (addFormatsImport as any).default ?? addFormatsImport;

/** Forge pins the manifest schema_version to this value. */
export const FORGE_SCHEMA_VERSION_PIN = '1.1.0';

/** Raised when an observed schema_version differs from the Forge pin at the major level. */
export class SchemaVersionError extends Error {
  constructor(public expected: string, public observed: string) {
    super(`schema_version major mismatch: expected ${expected}, observed ${observed}.`);
    this.name = 'SchemaVersionError';
  }
}

type VersionMatchKind = 'exact' | 'patch' | 'minor' | 'major';

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

function parse(version: string): [number, number, number] {
  const m = SEMVER_RE.exec(version);
  if (!m) throw new Error(`Invalid semver: ${version}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function compareSchemaVersion(observed: string, expected: string): VersionMatchKind {
  const [eMajor, eMinor, ePatch] = parse(expected);
  const [oMajor, oMinor, oPatch] = parse(observed);
  if (oMajor !== eMajor) return 'major';
  if (oMinor !== eMinor) return 'minor';
  if (oPatch !== ePatch) return 'patch';
  return 'exact';
}

/**
 * Three-tier schema_version policy:
 *   - 'major' throws SchemaVersionError
 *   - 'minor' / 'patch' return a warning string
 *   - 'exact' returns null
 */
function applySchemaVersionPolicy(observed: string, expected: string = FORGE_SCHEMA_VERSION_PIN): string | null {
  switch (compareSchemaVersion(observed, expected)) {
    case 'major':
      throw new SchemaVersionError(expected, observed);
    case 'minor':
      return `schema_version minor mismatch: expected ${expected}, observed ${observed}. Continuing.`;
    case 'patch':
      return `schema_version patch mismatch: expected ${expected}, observed ${observed}. OK.`;
    case 'exact':
      return null;
  }
}

export interface ValidationResult {
  valid: boolean;
  /** AJV-native error shape — instancePath/message/keyword/params preserved for downstream mapping. */
  errors: ErrorObject[];
  /** Non-fatal version-policy notes (e.g. minor schema_version drift). */
  warnings: string[];
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const manifestValidator: ValidateFunction = ajv.compile(manifestSchema);

export function validateManifest(payload: unknown): ValidationResult {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return {
      valid: false,
      errors: [
        {
          keyword: 'type',
          instancePath: '',
          schemaPath: '#/type',
          params: { type: 'object' },
          message: 'must be object',
        },
      ],
      warnings: [],
    };
  }

  const raw = payload as Record<string, unknown>;
  const warnings: string[] = [];

  const observed = typeof raw.schema_version === 'string' ? raw.schema_version : null;
  if (observed !== null) {
    const warning = applySchemaVersionPolicy(observed);
    if (warning) warnings.push(warning);
  }

  const stripped: Record<string, unknown> = { ...raw };
  delete stripped.schema_version;

  const valid = manifestValidator(stripped) as boolean;

  return {
    valid,
    errors: valid ? [] : [...(manifestValidator.errors ?? [])],
    warnings,
  };
}

export { manifestSchema };
