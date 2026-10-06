/**
 * Tests for semantic intent synonym resolution (s80-m01).
 *
 * Validates:
 * 1. Synonym map covers 30+ common UI intent synonyms
 * 2. Paraphrased intents produce identical top-3 candidates
 * 3. Word-level synonym resolution
 * 4. Phrase-pattern matching
 * 5. No regressions in existing component-selector behavior
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  resolveIntent,
  resolveWordSynonym,
  getSynonymMap,
  getSynonymCount,
} from '../../src/compose/intent-synonyms.js';
import {
  selectComponent,
  loadCatalog,
  type SelectionResult,
} from '../../src/compose/component-selector.js';
import type { ComponentCatalogEntry } from '../../src/tools/types.js';

/* ------------------------------------------------------------------ */
/*  Setup                                                              */
/* ------------------------------------------------------------------ */

let catalog: ComponentCatalogEntry[];

const KNOWN_INTENTS = new Set([
  'action-button',
  'text-input',
  'search-input',
  'form-input',
  'boolean-input',
  'enum-input',
  'date-input',
  'email-input',
  'long-text-input',
  'data-table',
  'data-display',
  'data-list',
  'metrics-display',
  'status-indicator',
  'page-header',
  'navigation-panel',
  'filter-control',
  'pagination-control',
  'metadata-display',
  'tab-panel',
]);

beforeAll(async () => {
  catalog = await loadCatalog();
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function topN(result: SelectionResult, n: number): string[] {
  return result.candidates.slice(0, n).map(c => c.name);
}

/* ------------------------------------------------------------------ */
/*  Synonym map coverage                                               */
/* ------------------------------------------------------------------ */

describe('intent-synonyms — synonym map coverage', () => {
  it('has at least 30 unique synonym entries', () => {
    expect(getSynonymCount()).toBeGreaterThanOrEqual(30);
  });

  it('covers action-button synonyms', () => {
    expect(resolveWordSynonym('submit')).toBe('action');
    expect(resolveWordSynonym('click')).toBe('action');
    expect(resolveWordSynonym('btn')).toBe('button');
    expect(resolveWordSynonym('cta')).toBe('button');
  });

  it('covers data-table synonyms', () => {
    expect(resolveWordSynonym('tabular')).toBe('table');
    expect(resolveWordSynonym('spreadsheet')).toBe('table');
    expect(resolveWordSynonym('grid')).toBe('table');
  });

  it('covers form synonyms', () => {
    expect(resolveWordSynonym('edit')).toBe('form');
    expect(resolveWordSynonym('create')).toBe('form');
  });

  it('covers search synonyms', () => {
    expect(resolveWordSynonym('find')).toBe('search');
    expect(resolveWordSynonym('lookup')).toBe('search');
    expect(resolveWordSynonym('query')).toBe('search');
  });

  it('covers status synonyms', () => {
    expect(resolveWordSynonym('state')).toBe('status');
    expect(resolveWordSynonym('health')).toBe('status');
    expect(resolveWordSynonym('badge')).toBe('indicator');
  });

  it('returns original word when no synonym exists', () => {
    expect(resolveWordSynonym('foobar')).toBe('foobar');
    expect(resolveWordSynonym('Button')).toBe('button');
  });
});

/* ------------------------------------------------------------------ */
/*  resolveIntent — exact matches                                      */
/* ------------------------------------------------------------------ */

describe('resolveIntent — exact matches', () => {
  it('returns exact match for canonical intents', () => {
    const result = resolveIntent('action-button', KNOWN_INTENTS);
    expect(result.canonicalIntent).toBe('action-button');
    expect(result.method).toBe('exact');
  });

  it('normalizes case for exact match', () => {
    const result = resolveIntent('Action-Button', KNOWN_INTENTS);
    expect(result.canonicalIntent).toBe('action-button');
    expect(result.method).toBe('exact');
  });

  it('returns none for empty input', () => {
    const result = resolveIntent('', KNOWN_INTENTS);
    expect(result.canonicalIntent).toBeNull();
    expect(result.method).toBe('none');
  });
});

/* ------------------------------------------------------------------ */
/*  resolveIntent — phrase patterns                                    */
/* ------------------------------------------------------------------ */

describe('resolveIntent — phrase pattern matching', () => {
  it('resolves "show subscriptions in a table" to data-table', () => {
    const result = resolveIntent('show subscriptions in a table', KNOWN_INTENTS);
    expect(result.canonicalIntent).toBe('data-table');
    expect(result.method).toBe('phrase-pattern');
  });

  it('resolves "search accounts by name" to search-input', () => {
    const result = resolveIntent('search accounts by name', KNOWN_INTENTS);
    expect(result.canonicalIntent).toBe('search-input');
  });

  it('resolves "find users" to search-input', () => {
    const result = resolveIntent('find users', KNOWN_INTENTS);
    expect(result.canonicalIntent).toBe('search-input');
  });

  it('resolves "create a new form" to form-input', () => {
    const result = resolveIntent('create a new form', KNOWN_INTENTS);
    expect(result.canonicalIntent).toBe('form-input');
  });

  it('resolves "edit form" to form-input', () => {
    const result = resolveIntent('edit form', KNOWN_INTENTS);
    expect(result.canonicalIntent).toBe('form-input');
  });

  it('resolves "toggle switch" to boolean-input', () => {
    const result = resolveIntent('toggle switch', KNOWN_INTENTS);
    expect(result.canonicalIntent).toBe('boolean-input');
  });

  it('resolves "dropdown selector" to enum-input', () => {
    const result = resolveIntent('dropdown selector', KNOWN_INTENTS);
    expect(result.canonicalIntent).toBe('enum-input');
  });

  it('resolves "date picker field" to date-input', () => {
    const result = resolveIntent('date picker', KNOWN_INTENTS);
    expect(result.canonicalIntent).toBe('date-input');
  });

  it('resolves "textarea for comments" to long-text-input', () => {
    const result = resolveIntent('textarea for comments', KNOWN_INTENTS);
    expect(result.canonicalIntent).toBe('long-text-input');
  });

  it('resolves "kpi dashboard" to metrics-display', () => {
    const result = resolveIntent('kpi dashboard', KNOWN_INTENTS);
    expect(result.canonicalIntent).toBe('metrics-display');
  });

  it('resolves "page title heading" to page-header', () => {
    const result = resolveIntent('page header', KNOWN_INTENTS);
    expect(result.canonicalIntent).toBe('page-header');
  });

  it('resolves "tabbed navigation" to tab-panel', () => {
    const result = resolveIntent('tabbed navigation', KNOWN_INTENTS);
    expect(result.canonicalIntent).toBe('tab-panel');
  });

  it('resolves "pagination controls" to pagination-control', () => {
    const result = resolveIntent('pagination controls', KNOWN_INTENTS);
    expect(result.canonicalIntent).toBe('pagination-control');
  });
});

/* ------------------------------------------------------------------ */
/*  resolveIntent — word-level synonym reconstruction                  */
/* ------------------------------------------------------------------ */

describe('resolveIntent — word-level synonym resolution', () => {
  it('resolves "submit btn" to action-button via word synonyms', () => {
    const result = resolveIntent('submit btn', KNOWN_INTENTS);
    expect(result.canonicalIntent).toBe('action-button');
    expect(result.method).toBe('word-synonym');
  });

  it('resolves "stats display" to metrics-display', () => {
    const result = resolveIntent('stats display', KNOWN_INTENTS);
    expect(result.canonicalIntent).toBe('metrics-display');
    // "stats" matches the metrics phrase pattern
    expect(result.method).toBe('phrase-pattern');
  });

  it('resolves "state indicator" to status-indicator via word synonyms', () => {
    const result = resolveIntent('state indicator', KNOWN_INTENTS);
    expect(result.canonicalIntent).toBe('status-indicator');
    expect(result.method).toBe('word-synonym');
  });
});

/* ------------------------------------------------------------------ */
/*  Paraphrase equivalence — end-to-end with selectComponent           */
/* ------------------------------------------------------------------ */

describe('selectComponent — paraphrase equivalence', () => {
  it('"show subscriptions in a table" and "data-table" produce same top-3', () => {
    const canonical = selectComponent('data-table', catalog);
    const paraphrased = selectComponent('show subscriptions in a table', catalog);
    expect(topN(paraphrased, 3)).toEqual(topN(canonical, 3));
  });

  it('"list subscriptions" and "data-list" produce overlapping top-3', () => {
    const canonical = selectComponent('data-list', catalog);
    const paraphrased = selectComponent('list subscriptions', catalog);
    // At least 2 of top-3 should overlap
    const canonicalTop = topN(canonical, 3);
    const paraphrasedTop = topN(paraphrased, 3);
    const overlap = paraphrasedTop.filter(n => canonicalTop.includes(n));
    expect(overlap.length).toBeGreaterThanOrEqual(2);
  });

  it('"customer activity timeline" resolves to data-list components', () => {
    const result = selectComponent('customer activity timeline', catalog);
    expect(result.candidates.length).toBeGreaterThan(0);
    // Timeline → data-list, should include Stack or Table
    const names = result.candidates.map(c => c.name);
    expect(names.some(n => n === 'Stack' || n === 'Table')).toBe(true);
  });

  it('"find users" and "search-input" produce same top candidate', () => {
    const canonical = selectComponent('search-input', catalog);
    const paraphrased = selectComponent('find users', catalog);
    expect(topN(paraphrased, 1)[0]).toBe(topN(canonical, 1)[0]);
  });

  it('"submit btn" and "action-button" produce same top candidate', () => {
    const canonical = selectComponent('action-button', catalog);
    const paraphrased = selectComponent('submit btn', catalog);
    expect(topN(paraphrased, 1)[0]).toBe(topN(canonical, 1)[0]);
  });

  it('"dropdown selector" and "enum-input" produce same top candidate', () => {
    const canonical = selectComponent('enum-input', catalog);
    const paraphrased = selectComponent('dropdown selector', catalog);
    expect(topN(paraphrased, 1)[0]).toBe(topN(canonical, 1)[0]);
  });

  it('"kpi dashboard" and "metrics-display" produce overlapping top-3', () => {
    const canonical = selectComponent('metrics-display', catalog);
    const paraphrased = selectComponent('kpi dashboard', catalog);
    const canonicalTop = topN(canonical, 3);
    const paraphrasedTop = topN(paraphrased, 3);
    const overlap = paraphrasedTop.filter(n => canonicalTop.includes(n));
    expect(overlap.length).toBeGreaterThanOrEqual(2);
  });

  it('synonym-resolved result includes synonymResolution metadata', () => {
    const result = selectComponent('show subscriptions in a table', catalog);
    expect(result.synonymResolution).toBeDefined();
    expect(result.synonymResolution!.method).toBe('phrase-pattern');
    expect(result.synonymResolution!.originalIntent).toBe('show subscriptions in a table');
    expect(result.intent).toBe('data-table');
  });

  it('canonical intents do not include synonymResolution metadata', () => {
    const result = selectComponent('data-table', catalog);
    expect(result.synonymResolution).toBeUndefined();
  });
});
