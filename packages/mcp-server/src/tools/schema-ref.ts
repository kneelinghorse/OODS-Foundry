import crypto from 'node:crypto';
import type { UiSchema } from '../schemas/generated.js';

export type SchemaRefRecord = {
  ref: string;
  // Loosened UiSchema -> unknown (sprint-109 Decision 1) so the same TTL cache
  // can hold viz specs/datasets (datasetRef + specRef) as well as UiSchemas.
  // The UiSchema-typed accessors below preserve type safety for their callers
  // via internal casts; generic callers use createValueRef / resolveValueRef.
  schema: unknown;
  source: string;
  /** Human title of what the ref holds (e.g. "Subscription detail"); the preview document is titled with it. */
  label?: string;
  createdAt: string;
  expiresAt: string;
  createdAtMs: number;
  expiresAtMs: number;
};

const CACHE = new Map<string, SchemaRefRecord>();

/** Why a ref cannot be used: never issued here (or issued by another server), past its lifetime, or dropped for room. */
export type UnavailableRef = 'missing' | 'expired' | 'evicted';

/**
 * Refs this server issued and no longer holds, with why (s206-m03). Until then pruning ran before every lookup, so an
 * expired ref always read as unknown and 'expired' could never be answered. Bounded; the oldest are forgotten first.
 */
const GONE = new Map<string, Exclude<UnavailableRef, 'missing'>>();
const GONE_MAX = 1000;
function rememberGone(ref: string, why: Exclude<UnavailableRef, 'missing'>): void {
  GONE.delete(ref);
  GONE.set(ref, why);
  if (GONE.size > GONE_MAX) GONE.delete(GONE.keys().next().value!);
}

function ttlMs(): number {
  const raw = process.env.MCP_SCHEMA_REF_TTL_MS;
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 30 * 60 * 1000;
  }
  return parsed;
}

function maxEntries(): number {
  const raw = process.env.MCP_SCHEMA_REF_MAX;
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 250;
  }
  return parsed;
}

function nowMs(): number {
  return Date.now();
}

function iso(ts: number): string {
  return new Date(ts).toISOString();
}

function pruneExpired(now = nowMs()): void {
  for (const [ref, record] of CACHE.entries()) {
    if (record.expiresAtMs <= now) {
      CACHE.delete(ref);
      rememberGone(ref, 'expired');
    }
  }
}

function pruneOverflow(): void {
  const limit = maxEntries();
  if (CACHE.size <= limit) return;
  const records = Array.from(CACHE.values()).sort((a, b) => a.createdAtMs - b.createdAtMs);
  const overflow = records.length - limit;
  for (let i = 0; i < overflow; i += 1) {
    CACHE.delete(records[i].ref);
    rememberGone(records[i].ref, 'evicted');
  }
}

function buildRef(source: string): string {
  const suffix = crypto.randomUUID().split('-')[0];
  return `${source}-${suffix}`;
}

type HydrateSchemaRefOptions = {
  ref?: string;
  source?: string;
};

export function hydrateSchemaRef(schema: unknown, options: HydrateSchemaRefOptions = {}): SchemaRefRecord {
  const source = options.source ?? 'compose';
  const ref = options.ref?.trim() ? options.ref : buildRef(source);
  const createdAtMs = nowMs();
  const expiresAtMs = createdAtMs + ttlMs();
  const record: SchemaRefRecord = {
    ref,
    schema: structuredClone(schema),
    source,
    createdAt: iso(createdAtMs),
    expiresAt: iso(expiresAtMs),
    createdAtMs,
    expiresAtMs,
  };
  pruneExpired(createdAtMs);
  CACHE.set(record.ref, record);
  GONE.delete(record.ref);
  pruneOverflow();
  return record;
}

export function createSchemaRef(schema: UiSchema, source = 'compose', label?: string): SchemaRefRecord {
  const record = hydrateSchemaRef(schema, { source });
  if (label) record.label = label;
  return record;
}

export function resolveSchemaRef(ref: string): { ok: true; record: SchemaRefRecord; schema: UiSchema } | { ok: false; reason: UnavailableRef } {
  const now = nowMs();
  pruneExpired(now);
  const record = CACHE.get(ref);
  if (!record) {
    return { ok: false, reason: GONE.get(ref) ?? 'missing' };
  }
  // The UiSchema-typed accessors only resolve refs created via createSchemaRef,
  // so this cast is sound; generic values use resolveValueRef.
  return { ok: true, record, schema: structuredClone(record.schema) as UiSchema };
}

/** What happened to an unavailable ref, as the rest of a sentence that starts with the ref. */
export function unavailableRefWords(reason: UnavailableRef): string {
  if (reason === 'expired') return 'has expired';
  if (reason === 'evicted') return 'is no longer held';
  return 'is not known to this server';
}

/**
 * Why a schemaRef cannot be used and what to do, for every tool that takes one (s206-m03): one wording, naming the
 * tool an agent can call today (the schema tool's save and load actions; schema.save and schema.load are retired).
 */
export function unavailableSchemaRef(ref: string, reason: UnavailableRef): { code: 'OODS-N003' | 'OODS-N004'; message: string; hint: string } {
  const minutes = Math.max(1, Math.round(ttlMs() / 60_000));
  const lifetime = `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const why = reason === 'expired'
    ? `A schemaRef lives ${lifetime} (MCP_SCHEMA_REF_TTL_MS) in the server that issued it.`
    : reason === 'evicted'
      ? `This server keeps at most ${maxEntries()} schemaRefs (MCP_SCHEMA_REF_MAX) and dropped the oldest to make room.`
      : `A schemaRef lives only in the server your MCP client started, for ${lifetime}, so a ref from another conversation, another client or before a restart is not here.`;
  return {
    code: reason === 'missing' ? 'OODS-N003' : 'OODS-N004',
    message: `schemaRef '${ref}' ${unavailableRefWords(reason)}. ${why}`,
    hint: 'Run design.compose again in this conversation for a fresh schemaRef, or pass the schema inline in the schema field. To keep a screen across conversations, save it with the schema tool (action: save) and load it by name (action: load).',
  };
}

export function describeSchemaRef(record: SchemaRefRecord): Pick<SchemaRefRecord, 'ref' | 'source' | 'createdAt' | 'expiresAt'> {
  return {
    ref: record.ref,
    source: record.source,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  };
}

/* ------------------------------------------------------------------ */
/*  Generic value refs (sprint-109 m04) — same TTL cache, any value.  */
/*  Used by viz.render for datasetRef (input) + specRef (output).     */
/* ------------------------------------------------------------------ */

export function createValueRef(value: unknown, source = 'value'): SchemaRefRecord {
  return hydrateSchemaRef(value, { source });
}

export function resolveValueRef(
  ref: string,
): { ok: true; record: SchemaRefRecord; value: unknown } | { ok: false; reason: UnavailableRef } {
  const result = resolveSchemaRef(ref);
  if (!result.ok) {
    return result;
  }
  return { ok: true, record: result.record, value: result.schema };
}

/* ------------------------------------------------------------------ */
/*  TTL warning (s86-m03)                                              */
/* ------------------------------------------------------------------ */

const TTL_WARNING_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export interface TtlWarning {
  message: string;
  remainingMs: number;
  recommendation: string;
}

/**
 * Compute a proactive TTL warning when a schemaRef is approaching expiration.
 * Returns undefined when the TTL is healthy (> 5 minutes remaining).
 */
export function computeTtlWarning(record: SchemaRefRecord, now = nowMs()): TtlWarning | undefined {
  const remainingMs = record.expiresAtMs - now;

  if (remainingMs <= 0) {
    return {
      message: `SchemaRef "${record.ref}" has expired.`,
      remainingMs: 0,
      recommendation: 'Re-compose to obtain a fresh schemaRef, or use schema (action=save) to persist before expiry.',
    };
  }

  if (remainingMs <= TTL_WARNING_THRESHOLD_MS) {
    const remainingMin = Math.ceil(remainingMs / 60_000);
    return {
      message: `SchemaRef "${record.ref}" expires in ~${remainingMin} minute${remainingMin === 1 ? '' : 's'}.`,
      remainingMs,
      recommendation: 'Call schema (action=save) to persist the schema, or re-compose to obtain a fresh schemaRef.',
    };
  }

  return undefined;
}
