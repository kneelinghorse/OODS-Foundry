// Governed-measure registry loader (sprint-117, Phase-3 resolution).
//
// Reads the standalone DATA artifact at ../schemas/measure-registry.json (bundled
// to dist/schemas/ by the package.json wildcard cp; skip-listed from Generator A
// so it never enters generated.ts), parses it ONCE, and memoizes a Map keyed by
// the governed-measure reference (the value of KpiPanel.measureRef, e.g.
// 'gm.revenue.total'). Mirrors the JSON-load PATTERN of registry.ts
// (fileURLToPath + path.join + try/catch FALLBACK) but resolves CROSS-DIR
// (src/tools -> src/schemas), and adds module-level memoization.
//
// measure-resolver.ts consumes it at dashboard.render's spec-ingestion boundary whenever
// resolveMeasures is on, which is the default.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { KpiPanel, TemporalGranularity } from '@oods/viz-core';
// AJV-validate-at-load (sprint-118 m03): a FRESH Ajv2020 with NO useDefaults — do NOT
// reuse lib/ajv.ts getAjv() (useDefaults:true would mutate-fill entries). Mirrors the
// manifest-validator precedent (object-catalog/manifest-validator.ts:30,92-95).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - subpath import for draft-2020-12 support
import Ajv2020Import from 'ajv/dist/2020.js';
import addFormatsImport from 'ajv-formats';
import measureRegistrySchema from '../schemas/measure-registry.schema.json' with { type: 'json' };

const Ajv2020: any = (Ajv2020Import as any).default ?? Ajv2020Import;
const addFormats: any = (addFormatsImport as any).default ?? addFormatsImport;
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateRegistry = ajv.compile(measureRegistrySchema);

// A single governed-measure entry. entityField + aggregate are the AUTHORITATIVE
// compute inputs (they OVERRIDE the author's field/aggregate when resolved);
// defaultComparison/defaultThreshold are author-overridable fallbacks (?? fill).
// The remaining fields are governance/provenance metadata UNREAD by computeKpi.
export interface MeasureEntry {
  /** Canonical measure name. */
  name: string;
  /** The dataset column the measure aggregates — overrides KpiPanel.field. */
  entityField: string;
  /** The point-in-time aggregate — overrides KpiPanel.aggregate. */
  aggregate: NonNullable<KpiPanel['aggregate']>;
  /**
   * Governance classifier (e.g. 'metric' | 'dimension'). DELIBERATELY NOT the
   * overloaded `role` (PatternField.role, pragmatic_role) NOR `semantics`
   * (SemanticMapping) — none of those meanings apply here.
   */
  measureRole: string;
  /**
   * Whether the measure is additive across rows (sprint-118 m03). ABSENT === true
   * (back-compat: the s117 entries carry no `additive` and stay byte-identical). When
   * false, a `sum` rollup is BLOCKED at the resolver boundary with OODS-V133 — summing a
   * ratio/price (e.g. value/quantity) is meaningless. Only summation is blocked.
   */
  additive?: boolean;
  /**
   * Optional declared time-grain (sprint-122 m02). When set AND resolveMeasures=true, the
   * panel's actual period data is validated against this grain at resolve time — the finest
   * observed granularity of the periodField cells must equal expectedGrain, else OODS-V138.
   * ABSENT === no grain check (back-compat). In lockstep with measure-registry.schema.json.
   */
  expectedGrain?: TemporalGranularity;
  /** Optional UI label. */
  displayName?: string;
  /** Optional renderer-agnostic number-format hint. */
  format?: string;
  /** Optional unit label. */
  unit?: string;
  /** Author-overridable default comparison (filled only when the panel omits comparison). */
  defaultComparison?: KpiPanel['comparison'];
  /** Author-overridable default threshold (filled only when the panel omits threshold). */
  defaultThreshold?: KpiPanel['threshold'];
  /** Free-text provenance note. */
  provenance?: string;
}

interface MeasureRegistryFile {
  schemaVersion?: string;
  measures?: Record<string, MeasureEntry>;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Loader lives in src/tools/; the artifact in src/schemas/ — cross-dir (mirror
// the registry.ts PATTERN, not its same-dir './registry.json').
const REGISTRY_PATH = path.join(__dirname, '..', 'schemas', 'measure-registry.json');

// Module-level singleton: parse once, memoize.
let cached: Map<string, MeasureEntry> | undefined;

/**
 * Raised when the registry artifact is PRESENT but malformed — unparseable JSON or
 * AJV-invalid against measure-registry.schema.json. Carries OODS-V132; the resolver
 * routes it through the dashboard.render onPanelError seam (FAIL CLOSED), never a
 * silent empty Map (which would masquerade as a V130 unknown-measure miss).
 */
export class MalformedMeasureRegistryError extends Error {
  readonly code = 'OODS-V132';
  constructor(detail: string) {
    super(`Malformed measure registry: ${detail}`);
    this.name = 'MalformedMeasureRegistryError';
  }
}

/**
 * Load (and memoize) the governed-measure registry as a Map keyed by measure
 * reference. Failure posture (sprint-118 m03):
 *   - FILE missing/unreadable  -> THROW a typed registry error; never memoize an empty fallback.
 *   - PRESENT but malformed     -> THROW MalformedMeasureRegistryError (V132, fail closed).
 * A missing measure KEY (registry valid, ref absent) stays the resolver's V130 case.
 */
export function loadMeasureRegistry(): Map<string, MeasureEntry> {
  if (cached) {
    return cached;
  }
  const registry = new Map<string, MeasureEntry>();
  let raw: string;
  try {
    raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
  } catch (error) {
    throw new MalformedMeasureRegistryError(`registry could not be read: ${error instanceof Error ? error.message : String(error)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new MalformedMeasureRegistryError('registry JSON is unparseable');
  }
  if (!validateRegistry(parsed)) {
    const first = validateRegistry.errors?.[0];
    const where = first ? `${first.instancePath || '/'} ${first.message ?? ''}`.trim() : 'failed schema validation';
    throw new MalformedMeasureRegistryError(where);
  }
  const file = parsed as MeasureRegistryFile;
  if (file.measures && typeof file.measures === 'object') {
    for (const [key, entry] of Object.entries(file.measures)) {
      registry.set(key, entry);
    }
  }
  cached = registry;
  return cached;
}

/**
 * TEST SEAM (sprint-118 m03): clear the memoized registry so a test can re-load after
 * mocking the file (e.g. the malformed-registry fail-closed path). Inert in production.
 */
export function resetMeasureRegistryCache(): void {
  cached = undefined;
}

/**
 * Resolve a governed-measure reference to its entry, or `undefined` when the key
 * is not registered.
 */
export function resolveMeasure(ref: string): MeasureEntry | undefined {
  return loadMeasureRegistry().get(ref);
}
