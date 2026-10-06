// Deterministic, timezone-pinned temporal parsing for the field profiler
// (sprint-110 m01).
//
// WHY hand-rolled (not Date.parse): Date.parse is host-timezone- and partly
// host-implementation-dependent for date-only and non-ISO strings, which would
// make a profile (and therefore a recommendation, and therefore a committed
// golden) non-deterministic across machines. Every value here is parsed by
// explicit regex into UTC components via Date.UTC — no host TZ, no host locale
// (the month-name table is a fixed English map, not Intl).
//
// Scope: TYPING + granularity/regularity only. No rendering, no timeUnit
// emission — those stay with the explicit encoding path.

export type TemporalGranularity = 'year' | 'quarter' | 'month' | 'day' | 'time';

export interface ParsedTemporal {
  readonly granularity: TemporalGranularity;
  readonly year: number;
  /** 0-based month index (0 = January). */
  readonly monthIndex: number;
  /** 1-based quarter (1–4). */
  readonly quarter: number;
  /** UTC epoch milliseconds (date pinned to midnight UTC for date-only values). */
  readonly utcMs: number;
}

const GRANULARITY_RANK: Record<TemporalGranularity, number> = {
  year: 0,
  quarter: 1,
  month: 2,
  day: 3,
  time: 4,
};

// Fixed English month-name table (first three letters). Deterministic by design
// — NOT locale-derived.
const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const ISO_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH = /^(\d{4})-(\d{2})$/;
const ISO_QUARTER = /^(\d{4})-?[Qq]([1-4])$/;
const SLASH_MDY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const SLASH_YMD = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;
const MON_DAY_YEAR = /^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/;
const MON_YEAR = /^([A-Za-z]{3,9})\s+(\d{4})$/;
const BARE_YEAR = /^(\d{4})$/;

function quarterOf(monthIndex: number): number {
  return Math.floor(monthIndex / 3) + 1;
}

function buildDay(year: number, monthIndex: number, day: number, granularity: TemporalGranularity): ParsedTemporal {
  return {
    granularity,
    year,
    monthIndex,
    quarter: quarterOf(monthIndex),
    utcMs: Date.UTC(year, monthIndex, day),
  };
}

function monthIndexFromName(name: string): number | null {
  const key = name.slice(0, 3).toLowerCase();
  return key in MONTH_INDEX ? MONTH_INDEX[key] : null;
}

/**
 * Parse a single cell into UTC temporal components, or `null` when it is not a
 * recognised temporal value. Bare 4-digit years are only accepted when
 * `allowBareYear` is true — the general type-detection path keeps them off so a
 * column of 4-digit counts is not misread as dates; the year-only branch (which
 * gates on the field NAME) turns them on.
 */
export function parseTemporalValue(value: unknown, allowBareYear: boolean): ParsedTemporal | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }
  const text = String(value).trim();
  if (text === '') {
    return null;
  }

  let m: RegExpMatchArray | null;

  if ((m = text.match(ISO_DATETIME))) {
    const [, y, mo, d, h, mi, s] = m;
    const monthIndex = Number(mo) - 1;
    if (monthIndex < 0 || monthIndex > 11) return null;
    return {
      granularity: 'time',
      year: Number(y),
      monthIndex,
      quarter: quarterOf(monthIndex),
      utcMs: Date.UTC(Number(y), monthIndex, Number(d), Number(h), Number(mi), s ? Number(s) : 0),
    };
  }
  if ((m = text.match(ISO_DAY))) {
    const monthIndex = Number(m[2]) - 1;
    if (monthIndex < 0 || monthIndex > 11) return null;
    return buildDay(Number(m[1]), monthIndex, Number(m[3]), 'day');
  }
  if ((m = text.match(ISO_QUARTER))) {
    const quarter = Number(m[2]);
    return buildDay(Number(m[1]), (quarter - 1) * 3, 1, 'quarter');
  }
  if ((m = text.match(ISO_MONTH))) {
    const monthIndex = Number(m[2]) - 1;
    if (monthIndex < 0 || monthIndex > 11) return null;
    return buildDay(Number(m[1]), monthIndex, 1, 'month');
  }
  if ((m = text.match(SLASH_MDY))) {
    const monthIndex = Number(m[1]) - 1;
    const day = Number(m[2]);
    if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;
    return buildDay(Number(m[3]), monthIndex, day, 'day');
  }
  if ((m = text.match(SLASH_YMD))) {
    const monthIndex = Number(m[2]) - 1;
    const day = Number(m[3]);
    if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;
    return buildDay(Number(m[1]), monthIndex, day, 'day');
  }
  if ((m = text.match(MON_DAY_YEAR))) {
    const monthIndex = monthIndexFromName(m[1]);
    if (monthIndex === null) return null;
    return buildDay(Number(m[3]), monthIndex, Number(m[2]), 'day');
  }
  if ((m = text.match(MON_YEAR))) {
    const monthIndex = monthIndexFromName(m[1]);
    if (monthIndex === null) return null;
    return buildDay(Number(m[2]), monthIndex, 1, 'month');
  }
  if (allowBareYear && (m = text.match(BARE_YEAR))) {
    return buildDay(Number(m[1]), 0, 1, 'year');
  }
  return null;
}

/**
 * True when every present value parses as an unambiguous date/time (bare years
 * excluded). Used by the type inferencer to decide `temporal`.
 */
export function everyValueIsTemporal(present: ReadonlyArray<unknown>): boolean {
  if (present.length === 0) {
    return false;
  }
  return present.every((v) => parseTemporalValue(v, false) !== null);
}

export function unitIndexFor(parsed: ParsedTemporal, target: TemporalGranularity): number {
  switch (target) {
    case 'year':
      return parsed.year;
    case 'quarter':
      return parsed.year * 4 + (parsed.quarter - 1);
    case 'month':
      return parsed.year * 12 + parsed.monthIndex;
    case 'day':
      return Math.floor(parsed.utcMs / 86_400_000);
    case 'time':
      return parsed.utcMs;
  }
}

/**
 * The FINEST granularity present across the parsed cells (e.g. a column mixing
 * 'month' and 'day' values keys at 'day'). Empty input defaults to 'year' (the
 * coarsest), but callers pass a non-empty array. Used by summarizeTemporal AND
 * the KPI period-axis builder (sprint-114) so both scan the GRANULARITY_RANK
 * table the same way.
 */
export function finestGranularity(parsed: ReadonlyArray<ParsedTemporal>): TemporalGranularity {
  let granularity: TemporalGranularity = 'year';
  for (const p of parsed) {
    if (GRANULARITY_RANK[p.granularity] > GRANULARITY_RANK[granularity]) {
      granularity = p.granularity;
    }
  }
  return granularity;
}

/**
 * Summarise a temporal field: its finest granularity and whether its DISTINCT
 * time points are evenly spaced. Parses with bare years allowed (the field is
 * already classified temporal by the time we get here). Regularity is judged on
 * distinct, sorted unit indices so repeated time points (e.g. a series measured
 * per region per month) do not read as irregular. ≤2 distinct points are
 * trivially regular.
 */
export function summarizeTemporal(
  present: ReadonlyArray<unknown>,
): { granularity: TemporalGranularity; regular: boolean } | null {
  const parsed: ParsedTemporal[] = [];
  for (const v of present) {
    const p = parseTemporalValue(v, true);
    if (p === null) {
      return null;
    }
    parsed.push(p);
  }
  if (parsed.length === 0) {
    return null;
  }

  const granularity = finestGranularity(parsed);

  const distinct = [...new Set(parsed.map((p) => unitIndexFor(p, granularity)))].sort((a, b) => a - b);
  if (distinct.length <= 2) {
    return { granularity, regular: true };
  }
  const step = distinct[1] - distinct[0];
  const regular = step > 0 && distinct.every((value, i) => i === 0 || value - distinct[i - 1] === step);
  return { granularity, regular };
}
