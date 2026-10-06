/**
 * Context beside the design (Sprint 203 m05): the decisions and evidence about an object, shown next
 * to the running preview of that object's screen.
 *
 * Forge reaches into no other product's store to get them. It has no path to a caller's external stores
 * and is not going to grow one: a direct reader would couple the portable bundle to another product's
 * schema and break it for everyone who is not its author. So context arrives from the caller — the
 * agent has already fetched it with the tools that exist (`cmos_decisions` search, `cmos_context`
 * search and evidence-reading tools) — and Forge's job is to check it, key it to the
 * composition, store it on the version so it travels with the lineage, and render it.
 *
 * Because Forge cannot re-run the caller's search, every item has to carry its own provenance or it is
 * worth nothing: where it came from, the query that produced it, and when it was fetched. An item that
 * cannot say those things is refused rather than shown, and an object with no results says what was
 * searched instead of showing an empty panel that could mean either "nothing" or "not asked".
 */
/** One thing the caller found about this object, with enough provenance to be worth believing. */
export interface ContextItem {
  /** Where it came from, as the caller's own tool names it: `decisions.search`, `evidence.search`, `people.get`. */
  source: string;
  /** The identifier in that source, so the reader can go and find it. */
  id: string;
  title: string;
  /** What it says. `body` is the whole thing; `excerpt` is the caller's own shortening, never Forge's. */
  body?: string;
  excerpt?: string;
  url?: string;
  /** The time the item itself carries — when the decision was taken, not when it was fetched. */
  timestamp?: string;
  /** The query that produced it. Without this the panel cannot say why the item is here. */
  query: string;
  /** When the caller fetched it. */
  fetchedAt: string;
  /** The object this is about: the composition's object name, or its Forge URN. */
  object?: string;
  urn?: string;
}

/** What was searched when a source returned nothing, so an empty panel is a statement rather than a silence. */
export interface ContextSearch {
  source: string;
  query: string;
  fetchedAt: string;
  /** How many the caller's search returned; zero is the point of recording it. */
  found: number;
}

export interface PreviewContextInput {
  items?: ContextItem[];
  searched?: ContextSearch[];
}

/** An item after Forge has keyed it and judged its age against the version it is attached to. */
export interface StoredContextItem extends ContextItem {
  /**
   * True when this item was gathered for an earlier version of the design than the one it now sits
   * beside — it arrived with an ancestor and was carried forward by an edit, so what it says was true
   * of a screen that has since changed. Marked rather than hidden: staleness is information.
   *
   * It is deliberately NOT "fetched before this version was composed". A caller always fetches before
   * it calls, so that rule marks every item on every fresh composition and the mark stops meaning
   * anything. What is worth flagging is context that has outlived the version it was gathered for.
   */
  staleForVersion: boolean;
}

export interface StoredContext {
  /** The object the whole panel is keyed to, and the URN form of it. */
  object: string;
  urn: string;
  items: StoredContextItem[];
  searched: ContextSearch[];
  /** When Forge stored it. */
  attachedAt: string;
  /** The version it was gathered for; a later version carrying it forward marks its items stale. */
  attachedToVersion: number;
}

/** The Forge URN of a registry object. Objects are named and versioned; this is the two joined. */
export function objectUrn(name: string, version: string): string {
  return `urn:oods:object:${name}@${version}`;
}

export class ContextRefusal extends Error {
  constructor(readonly code: string, message: string, readonly data: Record<string, unknown>) {
    super(message);
    this.name = 'ContextRefusal';
  }
}

const isNonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const ISO = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Check every item, key the panel to the composition's object, and mark what is older than the version.
 *
 * Nothing is repaired on the way through. An item missing its provenance, or naming a different object
 * from the one the composition shows, is refused with a typed error and **nothing is written** — a
 * half-stored panel would be worse than none, because the reader could not tell which half.
 */
export function validateContext(
  input: PreviewContextInput,
  composition: { object: string; urn: string; version: number },
  now: string = new Date().toISOString(),
): StoredContext {
  const items = input.items ?? [];
  const searched = input.searched ?? [];
  if (items.length > 200) {
    throw new ContextRefusal('OODS-V206', `A version carries at most 200 context items; ${items.length} were supplied.`, { supplied: items.length, limit: 200 });
  }

  const accepted: StoredContextItem[] = [];
  for (const [index, item] of items.entries()) {
    const where = `contextItems[${index}]`;
    for (const field of ['source', 'id', 'title', 'query', 'fetchedAt'] as const) {
      if (!isNonEmpty(item?.[field])) {
        throw new ContextRefusal('OODS-V206', `${where}.${field} is required: a context item without it cannot say where it came from or why it is here.`, { index, field, item });
      }
    }
    if (!ISO.test(item.fetchedAt)) {
      throw new ContextRefusal('OODS-V206', `${where}.fetchedAt must be an ISO-8601 timestamp; received ${JSON.stringify(item.fetchedAt)}.`, { index, field: 'fetchedAt', value: item.fetchedAt });
    }
    if (item.timestamp !== undefined && !ISO.test(item.timestamp)) {
      throw new ContextRefusal('OODS-V206', `${where}.timestamp must be an ISO-8601 timestamp; received ${JSON.stringify(item.timestamp)}.`, { index, field: 'timestamp', value: item.timestamp });
    }
    if (!isNonEmpty(item.body) && !isNonEmpty(item.excerpt)) {
      throw new ContextRefusal('OODS-V206', `${where} needs a body or an excerpt: an item with no content cannot be read beside the design.`, { index, item });
    }
    // Keyed to the composition, not merely adjacent to it.
    const named = item.object ?? item.urn;
    if (named !== undefined) {
      const matches = item.object === composition.object || item.urn === composition.urn;
      if (!matches) {
        throw new ContextRefusal(
          'OODS-V207',
          `${where} names ${JSON.stringify(named)}, but this composition shows ${composition.object} (${composition.urn}). Context is keyed to the object on the screen; nothing was written.`,
          { index, named, object: composition.object, urn: composition.urn },
        );
      }
    }
    // Current for the version it arrives with; carryContextForward marks it when a later one inherits it.
    accepted.push({ ...item, staleForVersion: false });
  }

  for (const [index, search] of searched.entries()) {
    for (const field of ['source', 'query', 'fetchedAt'] as const) {
      if (!isNonEmpty(search?.[field])) {
        throw new ContextRefusal('OODS-V206', `contextSearched[${index}].${field} is required: an empty result has to say what was searched.`, { index, field, search });
      }
    }
    if (typeof search.found !== 'number' || !Number.isInteger(search.found) || search.found < 0) {
      throw new ContextRefusal('OODS-V206', `contextSearched[${index}].found must be a count; received ${JSON.stringify(search.found)}.`, { index, value: search.found });
    }
  }

  return { object: composition.object, urn: composition.urn, items: accepted, searched, attachedAt: now, attachedToVersion: composition.version };
}

/**
 * Carry a parent version's context onto the version an edit records.
 *
 * The design changed and the context did not, so every item is marked: it was gathered for an earlier
 * version. Nothing is re-dated — each item keeps the `fetchedAt` it actually carries — because the
 * point of the mark is that the reader can see the gap rather than have it smoothed over.
 */
export function carryContextForward(context: StoredContext, version: number): StoredContext {
  return { ...context, attachedToVersion: version, items: context.items.map(item => ({ ...item, staleForVersion: true })) };
}

/** Field-schema guard kept beside the type so a caller can narrow a stored record without casting. */
export function isStoredContext(value: unknown): value is StoredContext {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<StoredContext>;
  return typeof record.object === 'string' && typeof record.urn === 'string' && Array.isArray(record.items) && Array.isArray(record.searched);
}
