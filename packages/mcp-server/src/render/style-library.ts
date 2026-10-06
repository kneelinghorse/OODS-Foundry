// Style-library key→var mapping loader (sprint-123, brand-contract A1).
//
// Reads the standalone DATA artifact at ../schemas/style-library.json (bundled to
// dist/schemas/ by the package.json wildcard cp; skip-listed from Generator A so it
// never enters generated.ts), AJV-validates it against style-library-artifact.schema.json,
// and memoizes the result ONCE. The render-path resolver (brand-overlay.ts
// resolveSkinOverlay) consumes the returned mappings to turn a measured colour delta into
// --sys-/--ref- skin declarations. Mirrors the JSON-load + validate-at-load PATTERN of
// measure-registry.ts, but FAILS CLOSED on a missing OR malformed artifact: the library is
// always shipped with the package, and a silent empty map would V140 every measured colour
// key (masquerading as an unmapped-key miss) rather than surfacing the install/config fault.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// AJV-validate-at-load: a FRESH Ajv2020 with NO useDefaults (do NOT reuse lib/ajv.ts
// getAjv() — useDefaults:true would mutate-fill the artifact). Mirrors measure-registry.ts.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - subpath import for draft-2020-12 support
import Ajv2020Import from 'ajv/dist/2020.js';
import addFormatsImport from 'ajv-formats';
import styleLibrarySchema from '../schemas/style-library-artifact.schema.json' with { type: 'json' };

const Ajv2020: any = (Ajv2020Import as any).default ?? Ajv2020Import;
const addFormats: any = (addFormatsImport as any).default ?? addFormatsImport;
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateLibrary = ajv.compile(styleLibrarySchema);

/**
 * The Forge-owned style-library mapping, hand-written in lockstep with
 * style-library-artifact.schema.json (single source of truth for the resolver). `mappings`
 * keys are FULL dotted leaf-paths of a measured colour delta (e.g. 'color.surface.default');
 * values are the target --sys-/--ref- skin custom-property the colour should reach.
 */
export interface StyleLibraryArtifact {
  mappings: Record<string, string>;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Loader lives in src/render/; the artifact in src/schemas/ — cross-dir (mirror the
// measure-registry.ts path math: render/ -> ../schemas, same depth as tools/).
const LIBRARY_PATH = path.join(__dirname, '..', 'schemas', 'style-library.json');

// Module-level singleton: parse + validate once, memoize.
let cached: StyleLibraryArtifact | undefined;

/**
 * Raised when the style-library artifact is MISSING or malformed — unreadable, unparseable
 * JSON, or AJV-invalid against style-library-artifact.schema.json. FAIL CLOSED: the library is
 * a shipped invariant of the package, so an absent/broken artifact is a config fault, never a
 * silent empty map (which would surface as a V140 unmapped-key miss for every measured colour).
 */
export class MalformedStyleLibraryError extends Error {
  constructor(detail: string) {
    super(`Malformed style library: ${detail}`);
    this.name = 'MalformedStyleLibraryError';
  }
}

/**
 * Load (and memoize) the style-library mapping. LOAD-ONCE: parsed + validated on the first
 * call, cached thereafter — NO per-render FS read. FAILS CLOSED on a missing/unparseable/
 * AJV-invalid artifact (MalformedStyleLibraryError).
 */
export function loadStyleLibrary(): StyleLibraryArtifact {
  if (cached) {
    return cached;
  }
  let raw: string;
  try {
    raw = fs.readFileSync(LIBRARY_PATH, 'utf8');
  } catch {
    throw new MalformedStyleLibraryError('style-library.json is missing or unreadable');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new MalformedStyleLibraryError('style-library.json is unparseable');
  }
  if (!validateLibrary(parsed)) {
    const first = validateLibrary.errors?.[0];
    const where = first ? `${first.instancePath || '/'} ${first.message ?? ''}`.trim() : 'failed schema validation';
    throw new MalformedStyleLibraryError(where);
  }
  cached = parsed as StyleLibraryArtifact;
  return cached;
}

/**
 * TEST SEAM: clear the memoized library so a test can re-load after mocking the file.
 * Inert in production.
 */
export function resetStyleLibraryCache(): void {
  cached = undefined;
}
