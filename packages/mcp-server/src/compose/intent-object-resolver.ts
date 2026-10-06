/**
 * Intent + object hybrid resolver (s62-m06).
 *
 * Resolves the relationship between intent strings and object names:
 * - Auto-detects object names mentioned in intent strings
 * - Auto-detects context keywords (detail, list, form) from intent
 * - Generates synthetic intent when only object is provided
 * - Fuzzy-matches unknown object names to suggest closest match
 */

import { listObjects } from '../objects/object-loader.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ResolvedIntent {
  /** Final intent string (may be synthetic) */
  intent: string;
  /** Detected or provided object name */
  object?: string;
  /** Detected or provided context */
  context?: string;
  /** How the object was resolved */
  objectSource?: 'explicit' | 'auto-detected';
  /** How the context was resolved */
  contextSource?: 'explicit' | 'auto-detected';
  /** How the intent was resolved */
  intentSource?: 'explicit' | 'synthetic';
  /** Warnings from resolution */
  warnings: string[];
}

export interface FuzzyMatchResult {
  /** Best matching object name */
  match: string;
  /** Edit distance (lower = closer) */
  distance: number;
  /** Similarity score 0..1 */
  similarity: number;
}

/* ------------------------------------------------------------------ */
/*  Context detection                                                  */
/* ------------------------------------------------------------------ */

const CONTEXT_KEYWORDS: Record<string, string> = {
  detail: 'detail',
  details: 'detail',
  profile: 'detail',
  view: 'detail',
  show: 'detail',
  inspect: 'detail',
  list: 'list',
  table: 'list',
  browse: 'list',
  index: 'list',
  directory: 'list',
  catalog: 'list',
  form: 'form',
  edit: 'form',
  register: 'form',
  signup: 'form',
};

const OBJECT_CONFIDENCE_CONTEXT_KEYWORDS = [
  'detail',
  'details',
  'profile',
  'list',
  'table',
  'index',
  'directory',
  'catalog',
  'form',
  'register',
  'signup',
] as const;

const OBJECT_REFERENCE_VERBS = [
  'show',
  'view',
  'inspect',
  'open',
  'browse',
  'edit',
  'render',
  'compose',
  'build',
] as const;

/**
 * Extract context from intent string.
 * Returns the first matching context keyword, or undefined.
 */
function detectContextFromIntent(intent: string): string | undefined {
  const lower = intent.toLowerCase();
  const words = lower.split(/\s+/);

  for (const word of words) {
    if (word in CONTEXT_KEYWORDS) {
      return CONTEXT_KEYWORDS[word];
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  Object detection                                                   */
/* ------------------------------------------------------------------ */

/**
 * Detect an object name mentioned in the intent string.
 * Requires a word-boundary match plus at least one confidence signal:
 * - exact-case object mention outside sentence-initial position
 * - immediate adjacency to a layout/context keyword
 * - explicit object reference phrasing such as "show me the Product"
 */
function detectObjectFromIntent(intent: string): string | undefined {
  const known = listObjects();
  const ranked = [...known]
    .map(name => scoreObjectIntentMatch(intent, name))
    .filter((candidate): candidate is ObjectIntentCandidate => candidate !== undefined)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.name.length !== a.name.length) return b.name.length - a.name.length;
      return a.name.localeCompare(b.name);
    });

  return ranked[0]?.name;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface ObjectIntentCandidate {
  name: string;
  score: number;
}

function scoreObjectIntentMatch(intent: string, name: string): ObjectIntentCandidate | undefined {
  if (!hasWordBoundaryMatch(intent, name)) {
    return undefined;
  }

  let score = 1;

  if (hasExactCaseObjectMatch(intent, name)) {
    score++;
  }

  if (hasAdjacentContextKeyword(intent, name)) {
    score++;
  }

  if (hasExplicitObjectReference(intent, name)) {
    score++;
  }

  return score >= 2 ? { name, score } : undefined;
}

function hasWordBoundaryMatch(intent: string, name: string): boolean {
  return new RegExp(`\\b${escapeRegex(name)}\\b`, 'i').test(intent);
}

function hasExactCaseObjectMatch(intent: string, name: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegex(name)}\\b`, 'g');
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(intent)) !== null) {
    if (!isSentenceInitialMatch(intent, match.index)) {
      return true;
    }
  }

  return false;
}

function hasAdjacentContextKeyword(intent: string, name: string): boolean {
  const contextPattern = OBJECT_CONFIDENCE_CONTEXT_KEYWORDS
    .map(escapeRegex)
    .join('|');

  const pattern = new RegExp(
    `(?:\\b(?:${contextPattern})\\b\\s+\\b${escapeRegex(name)}\\b|\\b${escapeRegex(name)}\\b\\s+\\b(?:${contextPattern})\\b)`,
    'i',
  );

  return pattern.test(intent);
}

function hasExplicitObjectReference(intent: string, name: string): boolean {
  const verbPattern = OBJECT_REFERENCE_VERBS.map(escapeRegex).join('|');
  const pattern = new RegExp(
    `\\b(?:${verbPattern})\\b\\s+(?:me\\s+)?(?:the\\s+|a\\s+|an\\s+)?\\b${escapeRegex(name)}\\b`,
    'g',
  );
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(intent)) !== null) {
    const nameStart = match.index + match[0].lastIndexOf(name);
    if (!isSentenceInitialMatch(intent, nameStart)) {
      return true;
    }
  }

  return false;
}

function isSentenceInitialMatch(intent: string, start: number): boolean {
  let i = start - 1;

  while (i >= 0 && /\s/.test(intent[i])) {
    i--;
  }

  return i < 0 || /[.!?]/.test(intent[i]);
}

/* ------------------------------------------------------------------ */
/*  Fuzzy matching                                                     */
/* ------------------------------------------------------------------ */

/**
 * Levenshtein edit distance between two strings.
 */
function editDistance(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;

  // Short-circuit
  if (la === 0) return lb;
  if (lb === 0) return la;

  const dp: number[][] = Array.from({ length: la + 1 }, () =>
    Array.from({ length: lb + 1 }, () => 0),
  );

  for (let i = 0; i <= la; i++) dp[i][0] = i;
  for (let j = 0; j <= lb; j++) dp[0][j] = j;

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return dp[la][lb];
}

/**
 * Find the closest matching object name for a given query.
 * Returns undefined if no objects are available.
 */
export function fuzzyMatchObject(query: string): FuzzyMatchResult | undefined {
  const known = listObjects();
  if (known.length === 0) return undefined;

  let bestMatch = known[0];
  let bestDistance = editDistance(query, bestMatch);

  for (let i = 1; i < known.length; i++) {
    const d = editDistance(query, known[i]);
    if (d < bestDistance) {
      bestDistance = d;
      bestMatch = known[i];
    }
  }

  const maxLen = Math.max(query.length, bestMatch.length);
  const similarity = maxLen === 0 ? 1 : 1 - bestDistance / maxLen;

  return { match: bestMatch, distance: bestDistance, similarity };
}

/* ------------------------------------------------------------------ */
/*  Main resolver                                                      */
/* ------------------------------------------------------------------ */

/**
 * Resolve intent, object, and context from potentially partial inputs.
 *
 * Modes:
 * 1. intent + object: intent drives layout detection, object drives components
 * 2. object only: synthetic intent generated as '{name} {context} view'
 * 3. intent only (with auto-detect): scans intent for known object names
 * 4. intent only (no match): passes through unchanged
 */
export function resolveIntentObject(
  intent: string | undefined,
  object: string | undefined,
  context: string | undefined,
): ResolvedIntent {
  const warnings: string[] = [];

  let resolvedObject = object;
  let resolvedContext = context;
  let resolvedIntent = intent?.trim() || '';
  let objectSource: ResolvedIntent['objectSource'];
  let contextSource: ResolvedIntent['contextSource'];
  let intentSource: ResolvedIntent['intentSource'] = 'explicit';

  // Auto-detect object from intent when no explicit object provided
  if (!resolvedObject && resolvedIntent) {
    const detected = detectObjectFromIntent(resolvedIntent);
    if (detected) {
      resolvedObject = detected;
      objectSource = 'auto-detected';
    }
  } else if (resolvedObject) {
    objectSource = 'explicit';
  }

  // Auto-detect context from intent when no explicit context provided
  if (!resolvedContext && resolvedIntent) {
    const detected = detectContextFromIntent(resolvedIntent);
    if (detected) {
      resolvedContext = detected;
      contextSource = 'auto-detected';
    }
  } else if (resolvedContext) {
    contextSource = 'explicit';
  }

  // Generate synthetic intent when object provided but no/empty intent
  if (resolvedObject && !resolvedIntent) {
    const ctx = resolvedContext ?? 'detail';
    resolvedIntent = `${resolvedObject} ${ctx} view`;
    intentSource = 'synthetic';
  }

  return {
    intent: resolvedIntent,
    object: resolvedObject,
    context: resolvedContext,
    objectSource,
    contextSource,
    intentSource,
    warnings,
  };
}
