/**
 * Synonym resolution for component-selector intents.
 *
 * Maps paraphrased or alternative intent phrases to canonical
 * INTENT_MAP keys so that "show subscriptions in a table" and
 * "list subscriptions" resolve to the same component candidates.
 */

/* ------------------------------------------------------------------ */
/*  Word-level synonym map                                             */
/* ------------------------------------------------------------------ */

/**
 * Maps alternative words to their canonical equivalents.
 * Each key is a synonym; the value is the canonical token
 * used in INTENT_MAP keys.
 */
const WORD_SYNONYMS: Record<string, string> = {
  // action-button synonyms
  submit: 'action',
  click: 'action',
  trigger: 'action',
  invoke: 'action',
  execute: 'action',
  btn: 'button',
  cta: 'button',

  // data-table / data-list synonyms
  tabular: 'table',
  spreadsheet: 'table',
  grid: 'table',
  rows: 'table',
  listing: 'list',
  feed: 'list',
  collection: 'list',
  catalog: 'list',
  directory: 'list',
  inventory: 'list',

  // data-display synonyms
  inspect: 'display',
  show: 'display',
  present: 'display',
  render: 'display',
  visualize: 'display',
  exhibit: 'display',

  // form-input synonyms
  edit: 'form',
  create: 'form',
  new: 'form',
  compose: 'form',
  fill: 'form',
  enter: 'input',
  type: 'input',
  write: 'input',
  field: 'input',

  // search-input synonyms
  find: 'search',
  lookup: 'search',
  query: 'search',
  seek: 'search',
  locate: 'search',
  discover: 'search',

  // status-indicator synonyms
  state: 'status',
  condition: 'status',
  health: 'status',
  badge: 'indicator',
  label: 'indicator',
  tag: 'indicator',
  flag: 'indicator',

  // page-header synonyms
  title: 'header',
  heading: 'header',
  headline: 'header',
  banner: 'header',
  masthead: 'header',

  // navigation-panel synonyms
  nav: 'navigation',
  menu: 'navigation',
  sidebar: 'navigation',
  breadcrumb: 'navigation',

  // filter-control synonyms
  refine: 'filter',
  narrow: 'filter',
  sieve: 'filter',
  sort: 'filter',

  // metrics-display synonyms
  stats: 'metrics',
  statistics: 'metrics',
  kpi: 'metrics',
  numbers: 'metrics',
  analytics: 'metrics',
  scorecard: 'metrics',

  // metadata-display synonyms
  info: 'metadata',
  properties: 'metadata',
  attributes: 'metadata',
  details: 'metadata',
  summary: 'metadata',
  specs: 'metadata',

  // boolean-input synonyms
  toggle: 'boolean',
  switch: 'boolean',
  checkbox: 'boolean',
  'on/off': 'boolean',
  onoff: 'boolean',

  // enum-input synonyms
  dropdown: 'enum',
  picker: 'enum',
  choose: 'enum',
  select: 'enum',
  selector: 'enum',
  options: 'enum',

  // date-input synonyms
  calendar: 'date',
  datetime: 'date',
  datepicker: 'date',
  schedule: 'date',

  // long-text-input synonyms
  textarea: 'long',
  multiline: 'long',
  description: 'long',
  paragraph: 'long',
  notes: 'long',
  comment: 'long',
  comments: 'long',

  // tab-panel synonyms
  tabs: 'tab',
  tabbed: 'tab',

  // pagination-control synonyms
  paging: 'pagination',
  paginate: 'pagination',
  pages: 'pagination',
  'next/prev': 'pagination',
  previous: 'pagination',
};

/* ------------------------------------------------------------------ */
/*  Phrase-level intent patterns                                        */
/* ------------------------------------------------------------------ */

/**
 * Ordered list of phrase patterns that map natural language
 * to canonical intent keys. Checked in priority order;
 * first match wins.
 */
interface IntentPattern {
  /** Regex to test against the normalized intent string. */
  test: RegExp;
  /** Canonical INTENT_MAP key to return. */
  canonicalIntent: string;
}

const INTENT_PATTERNS: IntentPattern[] = [
  // Search patterns (before general input patterns)
  { test: /\bsearch\b/, canonicalIntent: 'search-input' },
  { test: /\bfind\b/, canonicalIntent: 'search-input' },
  { test: /\blookup\b/, canonicalIntent: 'search-input' },
  { test: /\bquery\b/, canonicalIntent: 'search-input' },

  // Table/list patterns
  { test: /\b(?:in\s+a\s+)?table\b/, canonicalIntent: 'data-table' },
  { test: /\btabular\b/, canonicalIntent: 'data-table' },
  { test: /\bspreadsheet\b/, canonicalIntent: 'data-table' },
  { test: /\bgrid\s*view\b/, canonicalIntent: 'data-table' },
  { test: /\blist\b.*\b(?:items?|records?|entries|rows)\b/, canonicalIntent: 'data-list' },
  { test: /\bshow\b.*\blist\b/, canonicalIntent: 'data-list' },
  { test: /\bfeed\b/, canonicalIntent: 'data-list' },
  { test: /\btimeline\b/, canonicalIntent: 'data-list' },

  // Form patterns
  { test: /\b(?:edit|create|new)\s+(?:a\s+)?form\b/, canonicalIntent: 'form-input' },
  { test: /\bform\b.*\b(?:input|field)s?\b/, canonicalIntent: 'form-input' },
  { test: /\b(?:edit|update|modify)\b.*\b(?:details?|record|entry)\b/, canonicalIntent: 'form-input' },

  // Boolean input patterns
  { test: /\b(?:toggle|switch|on\s*\/?\s*off|checkbox)\b/, canonicalIntent: 'boolean-input' },

  // Date input patterns (before enum to avoid "picker" matching enum first)
  { test: /\bdate\b/, canonicalIntent: 'date-input' },
  { test: /\bcalendar\b/, canonicalIntent: 'date-input' },

  // Enum input patterns
  { test: /\b(?:dropdown|select|picker)\b/, canonicalIntent: 'enum-input' },

  // Long text patterns
  { test: /\b(?:textarea|multiline|long\s+text|paragraph|rich\s+text)\b/, canonicalIntent: 'long-text-input' },

  // Status patterns
  { test: /\bstatus\b.*\b(?:indicator|badge|label)\b/, canonicalIntent: 'status-indicator' },
  { test: /\b(?:badge|tag)\b.*\bstatus\b/, canonicalIntent: 'status-indicator' },

  // Header patterns
  { test: /\bpage\s+(?:header|title|heading)\b/, canonicalIntent: 'page-header' },

  // Metrics patterns
  { test: /\b(?:kpi|metrics?|stats|scorecard|analytics)\b/, canonicalIntent: 'metrics-display' },

  // Navigation patterns
  { test: /\b(?:nav|navigation|menu|sidebar)\b.*\b(?:panel|bar|area)\b/, canonicalIntent: 'navigation-panel' },
  { test: /\btab\s*(?:panel|bar|navigation)\b/, canonicalIntent: 'tab-panel' },
  { test: /\btabbed\b/, canonicalIntent: 'tab-panel' },

  // Filter patterns
  { test: /\bfilter\b.*\b(?:control|panel|bar|input)\b/, canonicalIntent: 'filter-control' },

  // Pagination patterns
  { test: /\b(?:pagination|paging|paginate)\b/, canonicalIntent: 'pagination-control' },

  // Button patterns
  { test: /\b(?:action|submit|cta)\s*button\b/, canonicalIntent: 'action-button' },
  { test: /\bbutton\b/, canonicalIntent: 'action-button' },

  // Metadata patterns
  { test: /\b(?:metadata|properties|attributes)\b.*\b(?:display|panel|section)\b/, canonicalIntent: 'metadata-display' },

  // Generic display (low priority — checked last)
  { test: /\bdetail\b.*\b(?:view|display|card)\b/, canonicalIntent: 'data-display' },
  { test: /\b(?:inspect|view|show)\b.*\b(?:detail|record|entry)\b/, canonicalIntent: 'data-display' },
];

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export interface SynonymResolution {
  /** The canonical intent key (INTENT_MAP key), or null if no match. */
  canonicalIntent: string | null;
  /** How the resolution was determined. */
  method: 'exact' | 'phrase-pattern' | 'word-synonym' | 'none';
  /** The original input intent. */
  originalIntent: string;
}

/**
 * Resolve a synonym token to its canonical form.
 * Returns the original token if no synonym exists.
 */
export function resolveWordSynonym(word: string): string {
  return WORD_SYNONYMS[word.toLowerCase()] ?? word.toLowerCase();
}

/**
 * Resolve an intent string to a canonical INTENT_MAP key.
 *
 * Resolution order:
 * 1. Exact match against knownIntents (already canonical)
 * 2. Phrase-pattern matching against natural language
 * 3. Word-level synonym resolution → reconstruct intent key
 *
 * @param intent - Free-text or typed intent string
 * @param knownIntents - Set of canonical INTENT_MAP keys
 */
export function resolveIntent(
  intent: string,
  knownIntents: Set<string>,
): SynonymResolution {
  const original = intent;
  const normalized = intent.trim().toLowerCase();

  if (!normalized) {
    return { canonicalIntent: null, method: 'none', originalIntent: original };
  }

  // 1. Exact match — already a canonical intent
  if (knownIntents.has(normalized)) {
    return { canonicalIntent: normalized, method: 'exact', originalIntent: original };
  }

  // 2. Phrase-pattern matching
  for (const pattern of INTENT_PATTERNS) {
    if (pattern.test.test(normalized)) {
      return {
        canonicalIntent: pattern.canonicalIntent,
        method: 'phrase-pattern',
        originalIntent: original,
      };
    }
  }

  // 3. Word-level synonym resolution
  const tokens = normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(resolveWordSynonym);

  // Try to reconstruct a known intent from resolved tokens
  // e.g., ["submit", "btn"] → ["action", "button"] → "action-button"
  for (let len = Math.min(tokens.length, 3); len >= 2; len--) {
    for (let start = 0; start <= tokens.length - len; start++) {
      const candidate = tokens.slice(start, start + len).join('-');
      if (knownIntents.has(candidate)) {
        return {
          canonicalIntent: candidate,
          method: 'word-synonym',
          originalIntent: original,
        };
      }
    }
  }

  // Try single-token partial matches (e.g., "table" → "data-table")
  for (const token of tokens) {
    for (const known of knownIntents) {
      if (known.endsWith(`-${token}`) || known.startsWith(`${token}-`)) {
        return {
          canonicalIntent: known,
          method: 'word-synonym',
          originalIntent: original,
        };
      }
    }
  }

  return { canonicalIntent: null, method: 'none', originalIntent: original };
}

/**
 * Get the full word-level synonym map (for testing/introspection).
 */
export function getSynonymMap(): Readonly<Record<string, string>> {
  return WORD_SYNONYMS;
}

/**
 * Get the count of unique synonym entries.
 */
export function getSynonymCount(): number {
  return Object.keys(WORD_SYNONYMS).length;
}
