/**
 * Component selection engine.
 *
 * Given a slot intent description and the component catalog,
 * picks the best-fit component(s) using deterministic heuristic
 * scoring based on catalog metadata.
 *
 * Scoring signals (in priority order):
 *   1. Explicit intent mapping (known intent → component name)
 *   2. Tag keyword overlap
 *   3. Context match
 *   4. Region match
 *   5. Category match
 *   6. Trait coverage bonus
 */
import type { ComponentCatalogSummary } from '../tools/types.js';
import { scoreFieldAffinity, type FieldHint } from './field-affinity.js';
import { getPositionAffinity, type SlotPosition } from './position-affinity.js';
import { resolveIntent, type SynonymResolution } from './intent-synonyms.js';
export type { FieldHint } from './field-affinity.js';
export type { SlotPosition } from './position-affinity.js';
export type { SynonymResolution } from './intent-synonyms.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SelectionCandidate {
  /** Component name from catalog. */
  name: string;
  /** Confidence score 0–1. */
  confidence: number;
  /** Human-readable reason for selection. */
  reason: string;
}

export interface SelectionResult {
  /** Ranked candidates, highest confidence first. */
  candidates: SelectionCandidate[];
  /** The intent that was matched (canonical if synonym-resolved). */
  intent: string;
  /** Raw confidence score of the top candidate before normalization (0–1). */
  rawConfidence: number;
  /** Warning if intent is unknown or no good matches found. */
  warning?: string;
  /** Synonym resolution metadata (present when input was paraphrased). */
  synonymResolution?: SynonymResolution;
}

/* ------------------------------------------------------------------ */
/*  Intent → signal mappings                                           */
/* ------------------------------------------------------------------ */

/**
 * Known intents map to preferred component names and metadata signals.
 * The selector uses these to boost exact matches.
 */
interface IntentSignals {
  /** Preferred component name(s), in priority order. */
  preferredComponents?: string[];
  /** Tags the intent expects to match. */
  tags?: string[];
  /** Contexts where this intent makes sense. */
  contexts?: string[];
  /** Regions where this intent fits. */
  regions?: string[];
  /** Categories this intent biases toward. */
  categories?: string[];
}

const INTENT_MAP: Record<string, IntentSignals> = {
  'action-button': {
    preferredComponents: ['Button'],
    tags: ['action', 'interactive'],
    regions: ['actions'],
    categories: ['primitive'],
  },
  'text-input': {
    preferredComponents: ['Input', 'TagInput'],
    tags: ['interactive', 'input'],
    contexts: ['form'],
    regions: ['forms', 'form'],
    categories: ['primitive', 'behavioral'],
  },
  'search-input': {
    preferredComponents: ['SearchInput', 'Input'],
    tags: ['search', 'filtering', 'interactive'],
    contexts: ['list', 'form'],
    regions: ['header', 'actions', 'forms', 'form'],
    categories: ['behavioral', 'primitive'],
  },
  'form-input': {
    preferredComponents: ['Input', 'Select', 'TagInput'],
    tags: ['interactive', 'input'],
    contexts: ['form'],
    regions: ['forms', 'form'],
  },
  'boolean-input': {
    preferredComponents: ['Toggle', 'Checkbox', 'Switch'],
    tags: ['interactive', 'input'],
    contexts: ['form'],
    regions: ['forms', 'form'],
    categories: ['behavioral', 'primitive'],
  },
  'enum-input': {
    preferredComponents: ['Select', 'TagInput', 'Input'],
    tags: ['interactive', 'input', 'select'],
    contexts: ['form'],
    regions: ['forms', 'form'],
    categories: ['primitive', 'behavioral'],
  },
  'date-input': {
    preferredComponents: ['DatePicker', 'Input'],
    tags: ['interactive', 'input', 'date'],
    contexts: ['form'],
    regions: ['forms', 'form'],
    categories: ['behavioral', 'primitive'],
  },
  'email-input': {
    preferredComponents: ['Input'],
    tags: ['interactive', 'input', 'email'],
    contexts: ['form'],
    regions: ['forms', 'form'],
    categories: ['primitive'],
  },
  'long-text-input': {
    preferredComponents: ['Textarea', 'Input'],
    tags: ['interactive', 'input', 'text'],
    contexts: ['form'],
    regions: ['forms', 'form'],
    categories: ['primitive'],
  },
  'data-table': {
    preferredComponents: ['Table'],
    tags: ['data', 'tabular'],
    contexts: ['list', 'detail'],
    regions: ['main'],
  },
  'data-display': {
    preferredComponents: ['Card', 'Table', 'Stack'],
    tags: ['data', 'container', 'surface'],
    contexts: ['detail', 'list'],
    regions: ['main'],
  },
  'data-list': {
    preferredComponents: ['Stack', 'Table'],
    tags: ['data', 'container'],
    contexts: ['list'],
    regions: ['main', 'list'],
  },
  'metrics-display': {
    preferredComponents: ['Card', 'Text', 'Stack'],
    tags: ['container', 'surface', 'data'],
    contexts: ['card', 'detail'],
    regions: ['card', 'main'],
  },
  'status-indicator': {
    preferredComponents: ['StatusBadge', 'Badge', 'ColorizedBadge'],
    tags: ['status', 'indicator'],
    contexts: ['inline', 'detail', 'list'],
    regions: ['badges', 'inline'],
    categories: ['lifecycle', 'visual'],
  },
  'page-header': {
    preferredComponents: ['Text', 'DetailHeader'],
    tags: ['heading', 'title'],
    contexts: ['detail'],
    regions: ['main'],
  },
  'navigation-panel': {
    preferredComponents: ['Stack', 'Tabs'],
    tags: ['navigation', 'container'],
    contexts: ['detail', 'list'],
    regions: ['contextPanel', 'main'],
  },
  'filter-control': {
    preferredComponents: ['Select', 'Input'],
    tags: ['filter', 'interactive'],
    contexts: ['list', 'form'],
    regions: ['actions', 'forms'],
  },
  'pagination-control': {
    preferredComponents: ['Text', 'Button'],
    tags: ['navigation', 'pagination'],
    contexts: ['list'],
    regions: ['actions'],
  },
  'metadata-display': {
    preferredComponents: ['Stack', 'Text', 'Card'],
    tags: ['metadata', 'summary'],
    contexts: ['detail'],
    regions: ['detail', 'contextPanel'],
  },
  'tab-panel': {
    preferredComponents: ['Tabs'],
    tags: ['navigation', 'container', 'tab'],
    contexts: ['detail'],
    regions: ['main'],
  },
};

/* ------------------------------------------------------------------ */
/*  Scoring weights                                                    */
/* ------------------------------------------------------------------ */

const WEIGHTS = {
  /** Exact preferred component match. */
  preferredComponent: 0.40,
  /** Tag keyword overlap (per matching tag). */
  tagMatch: 0.08,
  /** Context overlap (per matching context). */
  contextMatch: 0.10,
  /** Region overlap (per matching region). */
  regionMatch: 0.06,
  /** Category overlap (per matching category). */
  categoryMatch: 0.05,
  /** Trait count bonus (having traits = richer component). */
  traitBonus: 0.02,
  /** Keyword match in component name or displayName. */
  nameKeyword: 0.15,
  /** Keyword overlap with component tags (intent-driven). */
  keywordTagMatch: 0.12,
  /** Keyword overlap with component traits (intent-driven). */
  keywordTraitMatch: 0.12,
  /** Keyword overlap with component contexts (intent-driven). */
  keywordContextMatch: 0.12,
  /** Additive bias for SearchInput in search-oriented slots. */
  searchIntentBias: 0.25,
} as const;

/** Maximum possible score (used for normalization). */
const MAX_RAW_SCORE = 1.0;

/* ------------------------------------------------------------------ */
/*  Scoring engine                                                     */
/* ------------------------------------------------------------------ */

function tokenizeIntent(intent: string | string[] | undefined): string[] {
  const parts = Array.isArray(intent) ? intent : intent ? [intent] : [];
  const tokens: string[] = [];
  for (const part of parts) {
    if (!part || typeof part !== 'string') continue;
    tokens.push(
      ...part
        .toLowerCase()
        .split(/[-_\s]+/)
        .filter(Boolean),
    );
  }
  return tokens;
}

const CONTEXT_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'the',
  'or',
  'for',
  'with',
  'without',
  'to',
  'of',
  'in',
  'on',
  'at',
  'by',
  'from',
  'into',
  'over',
  'under',
  'between',
  'within',
  'via',
  'per',
  'content',
  'tab',
  'tabs',
  'panel',
  'panels',
  'section',
  'sections',
  'field',
  'fields',
  'group',
  'groups',
  'form',
  'forms',
  'detail',
  'details',
  'list',
  'lists',
  'dashboard',
  'dashboards',
  'page',
  'pages',
  'view',
  'views',
  'screen',
  'screens',
  'layout',
  'layouts',
  'header',
  'headers',
  'body',
  'main',
  'primary',
  'secondary',
  'data',
  'display',
  'item',
  'items',
  'record',
  'records',
  'entry',
  'entries',
  'entity',
  'entities',
  'overview',
]);

const SEARCH_SIGNAL_KEYWORDS = new Set([
  'find',
  'lookup',
  'query',
  'search',
]);

function filterContextTokens(tokens: string[]): string[] {
  return tokens.filter((token) => (
    token.length > 1
    && !/^\d+$/.test(token)
    && !CONTEXT_STOPWORDS.has(token)
  ));
}

function isSearchOrientedSlot(
  intent: string,
  keywords: string[],
  contextKeywords: string[],
): boolean {
  if (intent === 'search-input') {
    return true;
  }

  if (intent !== 'filter-control') {
    return false;
  }

  return [...keywords, ...contextKeywords].some((keyword) => SEARCH_SIGNAL_KEYWORDS.has(keyword));
}

function intersectionList(a: string[], b: string[]): string[] {
  const setB = new Set((b || []).map(s => s.toLowerCase()));
  const matches: string[] = [];
  for (const item of a) {
    const lower = item.toLowerCase();
    if (setB.has(lower)) {
      matches.push(lower);
    }
  }
  return matches;
}

function intersectionCount(a: string[], b: string[]): number {
  return intersectionList(a, b).length;
}

function scoreComponent(
  component: ComponentCatalogSummary,
  intent: string,
  signals: IntentSignals | undefined,
  keywords: string[],
  contextKeywords: string[],
): {
  score: number;
  reasons: string[];
  keywordTagMatches: number;
  keywordTraitMatches: number;
  contextTagMatches: number;
  contextTraitMatches: number;
} {
  let score = 0;
  const reasons: string[] = [];
  const componentTags = component.tags ?? [];
  const componentTraits = component.traits ?? [];
  const keywordTagMatches = intersectionList(keywords, componentTags);
  const keywordTraitMatches = intersectionList(keywords, componentTraits);
  const contextTagMatches = intersectionList(contextKeywords, componentTags);
  const contextTraitMatches = intersectionList(contextKeywords, componentTraits);
  const keywordContextMatches = intersectionList(keywords, component.contexts ?? []);

  // 1. Preferred component match
  if (signals?.preferredComponents) {
    const rank = signals.preferredComponents.indexOf(component.name);
    if (rank !== -1) {
      // First preferred gets full weight, subsequent get diminishing scores
      const preferredScore = WEIGHTS.preferredComponent * (1 - rank * 0.15);
      score += Math.max(preferredScore, WEIGHTS.preferredComponent * 0.3);
      reasons.push(`preferred for "${intent}" (rank ${rank + 1})`);
    }
  }

  // 2. Tag keyword overlap
  if (signals?.tags) {
    const overlap = intersectionCount(signals.tags, componentTags);
    if (overlap > 0) {
      score += WEIGHTS.tagMatch * Math.min(overlap, 3);
      reasons.push(`${overlap} tag match(es)`);
    }
  }

  // Also match intent keywords against component tags
  if (keywordTagMatches.length > 0) {
    score += WEIGHTS.keywordTagMatch * Math.min(keywordTagMatches.length, 3);
    const label = keywordTagMatches.slice(0, 3).join(', ');
    reasons.push(`tag match (${label})`);
  }

  // 3. Context match
  if (signals?.contexts) {
    const overlap = intersectionCount(signals.contexts, component.contexts ?? []);
    if (overlap > 0) {
      score += WEIGHTS.contextMatch * Math.min(overlap, 2);
      reasons.push(`${overlap} context match(es)`);
    }
  }

  if (keywordContextMatches.length > 0) {
    score += WEIGHTS.keywordContextMatch * Math.min(keywordContextMatches.length, 2);
    const label = keywordContextMatches.slice(0, 2).join(', ');
    reasons.push(`context match (${label})`);
  }

  // 4. Region match
  if (signals?.regions) {
    const overlap = intersectionCount(signals.regions, component.regions ?? []);
    if (overlap > 0) {
      score += WEIGHTS.regionMatch * Math.min(overlap, 2);
      reasons.push(`${overlap} region match(es)`);
    }
  }

  // 5. Category match
  if (signals?.categories) {
    const overlap = intersectionCount(signals.categories, component.categories ?? []);
    if (overlap > 0) {
      score += WEIGHTS.categoryMatch * Math.min(overlap, 2);
      reasons.push(`${overlap} category match(es)`);
    }
  }

  // 6. Trait keyword overlap
  if (keywordTraitMatches.length > 0) {
    score += WEIGHTS.keywordTraitMatch * Math.min(keywordTraitMatches.length, 2);
    const label = keywordTraitMatches.slice(0, 2).join(', ');
    reasons.push(`trait match (${label})`);
  }

  // 7. Trait bonus
  if (componentTraits.length > 0) {
    score += WEIGHTS.traitBonus * Math.min(componentTraits.length, 3);
    reasons.push(`${componentTraits.length} trait(s)`);
  }

  // 8. Name keyword match
  const nameLower = component.name.toLowerCase();
  const displayLower = component.displayName.toLowerCase();
  for (const kw of keywords) {
    if (nameLower.includes(kw) || displayLower.includes(kw)) {
      score += WEIGHTS.nameKeyword;
      reasons.push(`name contains "${kw}"`);
      break; // Only count once
    }
  }

  return {
    score: Math.min(score, MAX_RAW_SCORE),
    reasons,
    keywordTagMatches: keywordTagMatches.length,
    keywordTraitMatches: keywordTraitMatches.length,
    contextTagMatches: contextTagMatches.length,
    contextTraitMatches: contextTraitMatches.length,
  };
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export interface SelectOptions {
  /** Max number of candidates to return (default: 5). */
  topN?: number;
  /** Minimum confidence threshold (default: 0.05). */
  minConfidence?: number;
  /**
   * Additional context strings used to extract keyword signals
   * (e.g., user intent, slot descriptions, tab labels).
   */
  intentContext?: string | string[];
  /**
   * When true, prefer candidates with keyword tag/trait matches
   * whenever such matches exist.
   */
  preferKeywordMatches?: boolean;
  /**
   * Optional field metadata hint for field-type-aware scoring.
   * When provided, components that naturally fit the field type
   * receive a 0.15–0.30 score boost.
   */
  fieldHint?: FieldHint;
  /**
   * Optional slot position for position-aware scoring.
   * When provided, components are multiplied by 0.85–1.15x
   * based on how well they fit the target position.
   */
  slotPosition?: SlotPosition;
  /**
   * Optional pattern boost for multi-field pattern matches.
   * When a field pattern (e.g., status-timeline, pricing-summary)
   * detected a composite component, that component receives
   * the specified score boost (0.20–0.35).
   */
  patternBoost?: { componentName: string; boost: number; patternId: string };
}

/**
 * Select the best-fit component(s) for a given slot intent.
 *
 * @param intent - Typed intent string (e.g., "action-button", "data-table")
 * @param catalog - Array of ComponentCatalogSummary from the component catalog
 * @param options - Selection options
 * @returns Ranked list of candidates with confidence scores
 */
export function selectComponent(
  intent: string,
  catalog: ComponentCatalogSummary[],
  options: SelectOptions = {},
): SelectionResult {
  const { topN = 5, minConfidence = 0.05, intentContext, preferKeywordMatches = false, fieldHint, slotPosition, patternBoost } = options;

  if (!intent || !intent.trim()) {
    return {
      intent: '',
      candidates: [],
      rawConfidence: 0,
      warning: 'Empty intent provided; no components selected.',
    };
  }

  const normalizedIntent = intent.trim().toLowerCase();

  // Synonym resolution: try to map paraphrased intents to canonical keys
  const knownIntents = new Set(Object.keys(INTENT_MAP));
  const resolution = resolveIntent(normalizedIntent, knownIntents);
  const effectiveIntent = resolution.canonicalIntent ?? normalizedIntent;

  // Once a phrase resolves, score its canonical meaning. Words such as "a" in
  // "show subscriptions in a table" must not boost every component whose name contains a.
  const slotKeywords = tokenizeIntent(effectiveIntent);
  const contextKeywords = filterContextTokens(tokenizeIntent(intentContext));
  const keywords = Array.from(new Set([...slotKeywords, ...contextKeywords]));
  const signals = INTENT_MAP[effectiveIntent];
  const searchOrientedSlot = isSearchOrientedSlot(effectiveIntent, keywords, contextKeywords);

  const scored = catalog.map(component => {
    const {
      score,
      reasons,
      keywordTagMatches,
      keywordTraitMatches,
      contextTagMatches,
      contextTraitMatches,
    } = scoreComponent(
      component,
      effectiveIntent,
      signals,
      keywords,
      contextKeywords,
    );

    // Apply field affinity boost when fieldHint is provided
    let finalScore = score;
    const finalReasons = [...reasons];
    if (fieldHint) {
      const affinity = scoreFieldAffinity(component.name, fieldHint);
      if (affinity.boost > 0) {
        finalScore = Math.min(finalScore + affinity.boost, MAX_RAW_SCORE);
        finalReasons.push(affinity.reason);
      }
    }

    // Apply position affinity multiplier when slotPosition is provided
    if (slotPosition) {
      const posAffinity = getPositionAffinity(component.name, slotPosition);
      if (posAffinity.multiplier !== 1.0) {
        finalScore = Math.min(finalScore * posAffinity.multiplier, MAX_RAW_SCORE);
        finalReasons.push(posAffinity.reason);
      }
    }

    if (searchOrientedSlot && component.name === 'SearchInput') {
      finalScore = Math.min(finalScore + WEIGHTS.searchIntentBias, MAX_RAW_SCORE);
      finalReasons.push('search intent bias');
    }

    // Apply multi-field pattern boost when a composite component matches
    if (patternBoost && component.name === patternBoost.componentName) {
      finalScore = Math.min(finalScore + patternBoost.boost, MAX_RAW_SCORE);
      finalReasons.push(`field pattern: ${patternBoost.patternId}`);
    }

    return {
      name: component.name,
      confidence: finalScore,
      reason: finalReasons.length > 0 ? finalReasons.join('; ') : 'no matching signals',
      keywordTagMatches,
      keywordTraitMatches,
      contextTagMatches,
      contextTraitMatches,
    };
  });

  const hasContextMatches = scored.some(
    (entry) => entry.contextTagMatches > 0 || entry.contextTraitMatches > 0,
  );
  const pool = preferKeywordMatches && hasContextMatches
    ? scored.filter((entry) => entry.contextTagMatches > 0 || entry.contextTraitMatches > 0)
    : scored;

  // Sort by confidence descending, then alphabetically for ties
  pool.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (searchOrientedSlot) {
      if (a.name === 'SearchInput' && b.name !== 'SearchInput') return -1;
      if (b.name === 'SearchInput' && a.name !== 'SearchInput') return 1;
    }
    return a.name.localeCompare(b.name);
  });

  const filtered = pool.filter(c => c.confidence >= minConfidence);
  const candidates = filtered.slice(0, topN);

  // Capture raw top confidence before normalization
  const rawConfidence = candidates.length > 0 ? candidates[0].confidence : 0;

  // Normalize confidence scores so the top candidate is 1.0 (if any)
  if (candidates.length > 0 && candidates[0].confidence > 0) {
    const topScore = candidates[0].confidence;
    for (const c of candidates) {
      c.confidence = Math.round((c.confidence / topScore) * 100) / 100;
    }
  }

  const result: SelectionResult = {
    intent: effectiveIntent,
    candidates,
    rawConfidence: Math.round(rawConfidence * 100) / 100,
  };

  // Include synonym resolution metadata when the intent was resolved
  if (resolution.method !== 'exact' && resolution.method !== 'none') {
    result.synonymResolution = resolution;
  }

  if (!signals) {
    result.warning = `Unknown intent "${normalizedIntent}"; results based on keyword matching only.`;
  }

  if (candidates.length === 0) {
    result.warning = `No components matched intent "${normalizedIntent}" above confidence threshold.`;
  }

  return result;
}

/**
 * Load the component catalog from the catalog.list tool handler.
 * Convenience wrapper that returns just the entries.
 */
export async function loadCatalog(): Promise<ComponentCatalogSummary[]> {
  const { handle } = await import('../tools/catalog.list.js');
  const result = await handle({ detail: 'summary' });
  return result.components as ComponentCatalogSummary[];
}
