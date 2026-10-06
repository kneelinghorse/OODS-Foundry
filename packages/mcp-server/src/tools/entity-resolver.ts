/**
 * Stage1 targetEntity → OODS object resolver (Path B).
 *
 * Stage1 BridgeSummary `actions[].targetEntity` is an ORCA entity id shaped
 * `entity-<slug>` (e.g. `entity-customer`, `entity-billing`). OODS objects
 * live on disk as `<ObjectName>.object.yaml`. Bridging the two is OODS's
 * responsibility per the Path B agreement (2026-04-15, PS-2026-04-15-010).
 *
 * Rules mirror Stage1 contract v1.2.4 §3 (slugification) and §4
 * (canonical_name confidence-signal taxonomy), published 2026-04-15 as a
 * follow-up to intel_request 797c51a2:
 *
 *   1. If `canonical_name` is supplied with confidence ≥ 0.75 (§4 emission
 *      threshold) and the name matches a known OODS object, use it.
 *      `canonical_name` is singular PascalCase — passed through from
 *      `entity.name` upstream, never re-derived by Stage1 or OODS.
 *   2. Otherwise consult the alias table at
 *      `docs/integration/stage1-entity-aliases.json` for irregular mappings
 *      (e.g. `entity-customer → User` when a dedicated Customer object
 *      doesn't yet exist).
 *   3. Otherwise apply the §3 narrow rule — strip `entity-` prefix (leaving
 *      the lowercase core) and case-insensitively match against the indexed
 *      OODS object names. Stage1 normalizes singularization, PascalCase, and
 *      punctuation stripping UPSTREAM of the slug step, so the consumer
 *      must NOT replicate that work on the slug itself. Do NOT mirror
 *      Stage1's `packages/stage1-core/src/utils/slugify.ts` — that utility
 *      is for suite/app ids only; entity slug handling is intentionally
 *      narrower (contract v1.2.4 §3 ¶126 flags this drift risk explicitly).
 *   4. Otherwise return `{ via: 'unresolved' }`. Consumers MUST retain the
 *      raw id on composed nodes as `meta.unresolvedEntity` instead of
 *      dropping it — authors can then fill gaps incrementally by editing
 *      the alias table.
 *
 * §4 taxonomy (for reference; OODS accepts Stage1's combined confidence and
 * does not recompute signals locally):
 *   - url_slug_match:      0.40
 *   - text_label_match:    0.30
 *   - schema_org_type:     0.35
 *   - recurrence_support:  0.10
 * Signals combine sum-with-cap. Below 0.75, `canonical_name` is omitted but
 * `signals[]` stays populated — the resolver falls back to alias/slug rather
 * than honoring a low-confidence hint.
 *
 * Empty-state caveat: Stage1 pure-DOM captures (no `--api` flag upstream)
 * emit `{ id, hint, confidence: 0, signals: [] }` because their
 * `entity_catalog.json` only populates with API-aware runs. This is
 * infrastructure-side, not a consumer bug; Stage1 Sprint 42 tracks it. The
 * resolver's alias/slug fallback paths handle empty-state cleanly.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listObjects } from '../objects/object-loader.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const DEFAULT_ALIAS_FILE = path.join(
  REPO_ROOT,
  'docs/integration/stage1-entity-aliases.json',
);

/** Minimum Stage1-side confidence to honor a canonical_name hint. */
export const CANONICAL_NAME_MIN_CONFIDENCE = 0.75;

/** Raw shape of the alias JSON file on disk. */
interface AliasFileShape {
  version?: string;
  updated?: string;
  aliases?: Record<string, string>;
}

/** Outcome of a resolver call. */
export type EntityResolution =
  | {
    rawId: string;
    objectName: string;
    via: 'canonical_name' | 'alias' | 'slug';
    confidence?: number;
    reason: string;
  }
  | {
    rawId: string;
    via: 'unresolved';
    reason: string;
  };

/** Options accepted by {@link resolveEntity}. */
export interface ResolveEntityOptions {
  /** Optional Stage1-supplied canonical_name hint. */
  canonicalName?: string;
  /** Stage1-side confidence for the hint (0..1). */
  canonicalNameConfidence?: number;
  /**
   * Injected alias table — primarily for tests. When omitted, the default
   * alias file at `docs/integration/stage1-entity-aliases.json` is read once
   * per process and cached.
   */
  aliases?: Record<string, string>;
  /**
   * Injected set of known OODS object names. When omitted the resolver reads
   * `listObjects()` from the object-loader index.
   */
  knownObjects?: ReadonlySet<string> | readonly string[];
}

/* ------------------------------------------------------------------ */
/*  Alias-table loading (lazy, cached)                                 */
/* ------------------------------------------------------------------ */

let cachedAliases: Record<string, string> | null = null;

/** Clear the cached alias table. Primarily for tests. */
export function clearEntityAliasCache(): void {
  cachedAliases = null;
}

function loadAliasFile(filePath: string): Record<string, string> {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as AliasFileShape;
    return parsed.aliases ?? {};
  } catch {
    return {};
  }
}

function getAliases(override?: Record<string, string>): Record<string, string> {
  if (override) return override;
  if (cachedAliases) return cachedAliases;
  cachedAliases = loadAliasFile(DEFAULT_ALIAS_FILE);
  return cachedAliases;
}

function getKnownObjects(
  override?: ReadonlySet<string> | readonly string[],
): ReadonlySet<string> {
  if (override) {
    return override instanceof Set ? override : new Set(override);
  }
  return new Set(listObjects());
}

/**
 * Case-insensitive lookup against the indexed object-name set. Returns the
 * canonical (original-case) object name on match, or undefined on miss. On
 * collisions (multiple objects whose names differ only in case) we pick
 * whichever `Set` iteration surfaces first — collisions are not expected in
 * the OODS naming convention, but the predictable deterministic behavior
 * beats throwing from a resolver that should never throw.
 */
function findObjectCaseInsensitive(
  known: ReadonlySet<string>,
  lowerNeedle: string,
): string | undefined {
  for (const name of known) {
    if (name.toLowerCase() === lowerNeedle) return name;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  Slugification fallback                                             */
/* ------------------------------------------------------------------ */

/**
 * Strip the `entity-` prefix and return the lowercase core, matching the
 * Stage1 contract v1.2.4 §3 slug rule exactly.
 *
 * Stage1 produces `targetEntity.id` as `'entity-' + entity.name.toLowerCase()`
 * — no splitting, no PascalCasing, no singularization at the slug step.
 * Upstream passes (API normalize + route derivation) handle all name shaping
 * BEFORE the slug is built, so the consumer must not redo that work.
 *
 * Examples:
 *   entity-customer    → "customer"
 *   entity-userrole    → "userrole"    (Stage1 already normalized UserRole)
 *   entity-address     → "address"
 *   entity-            → ""            (prefix-only, caller treats as miss)
 */
export function stripEntityPrefix(rawId: string): string {
  return rawId.replace(/^entity-/, '').toLowerCase();
}

/**
 * @deprecated v1.2.4 contract replaced broad slugification with §3 narrow
 * rule. Use {@link stripEntityPrefix} + a case-insensitive lookup against
 * known OODS object names instead. Kept as a thin wrapper so any older
 * caller continues to compile; new code must not call this.
 */
export function slugifyEntityId(rawId: string): string {
  return stripEntityPrefix(rawId);
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Resolve a Stage1 raw entity id to an OODS object name.
 *
 * Never throws; callers should treat a `via: 'unresolved'` result as
 * intentional (author must add an alias or object file) rather than as an
 * error.
 */
export function resolveEntity(
  rawId: string | null | undefined,
  options: ResolveEntityOptions = {},
): EntityResolution {
  const trimmed = typeof rawId === 'string' ? rawId.trim() : '';
  if (trimmed.length === 0) {
    return {
      rawId: '',
      via: 'unresolved',
      reason: 'empty or missing entity id',
    };
  }

  const known = getKnownObjects(options.knownObjects);

  // 1. canonical_name hint takes precedence when confidence ≥ threshold.
  if (
    options.canonicalName
    && options.canonicalName.trim().length > 0
    && (options.canonicalNameConfidence ?? 0) >= CANONICAL_NAME_MIN_CONFIDENCE
  ) {
    const hint = options.canonicalName.trim();
    if (known.has(hint)) {
      return {
        rawId: trimmed,
        objectName: hint,
        via: 'canonical_name',
        confidence: options.canonicalNameConfidence,
        reason: `canonical_name hint "${hint}" confirmed against OODS object index`,
      };
    }
  }

  // 2. Alias table.
  const aliases = getAliases(options.aliases);
  const aliasHit = aliases[trimmed];
  if (aliasHit && known.has(aliasHit)) {
    return {
      rawId: trimmed,
      objectName: aliasHit,
      via: 'alias',
      reason: `alias table entry "${trimmed}" → "${aliasHit}"`,
    };
  }

  // 3. Contract v1.2.4 §3 narrow slug rule: strip `entity-` prefix and match
  // the lowercase core against known OODS object names case-insensitively.
  // Stage1 normalizes PascalCase/singularization/punctuation upstream so the
  // slug is already the final form; recreating that logic here would produce
  // drift on every naming edge case.
  const stripped = stripEntityPrefix(trimmed);
  if (stripped.length > 0) {
    const match = findObjectCaseInsensitive(known, stripped);
    if (match) {
      return {
        rawId: trimmed,
        objectName: match,
        via: 'slug',
        reason: `stripped "${trimmed}" → "${stripped}" matched object "${match}" (contract §3)`,
      };
    }
  }

  // 4. Unresolved — author must fill the alias table or add an object.
  const aliasTargetMissing = aliasHit && !known.has(aliasHit)
    ? ` (alias maps to "${aliasHit}" but no such object is indexed)`
    : '';
  return {
    rawId: trimmed,
    via: 'unresolved',
    reason: `no canonical_name, alias, or slug match for "${trimmed}"${aliasTargetMissing}`,
  };
}

/** Convenience predicate for call sites that only care about resolution. */
export function isResolved(
  resolution: EntityResolution,
): resolution is Extract<EntityResolution, { via: 'canonical_name' | 'alias' | 'slug' }> {
  return resolution.via !== 'unresolved';
}
