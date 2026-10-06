/**
 * Contract tests for the component selection engine (s51-m02).
 *
 * Validates:
 * 1. selectComponent(intent, catalog) returns ranked candidates
 * 2. Scoring uses context, category, trait, and prop signals
 * 3. Top candidate for 'action-button' is Button
 * 4. Top candidate for 'data-table' is Table
 * 5. Top candidate for 'text-input' is Input
 * 6. Returns confidence score per candidate
 * 7. Handles unknown intents gracefully (returns empty or with warning)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  selectComponent,
  loadCatalog,
  type SelectionResult,
} from '../../src/compose/component-selector.js';
import type { ComponentCatalogEntry } from '../../src/tools/types.js';

/* ------------------------------------------------------------------ */
/*  Catalog loading                                                    */
/* ------------------------------------------------------------------ */

let catalog: ComponentCatalogEntry[];

beforeAll(async () => {
  catalog = await loadCatalog();
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function topName(result: SelectionResult): string | undefined {
  return result.candidates[0]?.name;
}

function topN(result: SelectionResult, n: number): string[] {
  return result.candidates.slice(0, n).map(c => c.name);
}

function hasCandidate(result: SelectionResult, name: string): boolean {
  return result.candidates.some(c => c.name === name);
}

/* ------------------------------------------------------------------ */
/*  Core selection contracts                                           */
/* ------------------------------------------------------------------ */

describe('selectComponent — core contracts', () => {
  it('returns ranked candidates array', () => {
    const result = selectComponent('action-button', catalog);
    expect(result.candidates).toBeInstanceOf(Array);
    expect(result.candidates.length).toBeGreaterThan(0);
  });

  it('candidates have name, confidence, and reason', () => {
    const result = selectComponent('action-button', catalog);
    for (const c of result.candidates) {
      expect(c.name).toBeTruthy();
      expect(typeof c.confidence).toBe('number');
      expect(c.confidence).toBeGreaterThanOrEqual(0);
      expect(c.confidence).toBeLessThanOrEqual(1);
      expect(c.reason).toBeTruthy();
    }
  });

  it('candidates are sorted by confidence descending', () => {
    const result = selectComponent('action-button', catalog);
    for (let i = 1; i < result.candidates.length; i++) {
      expect(result.candidates[i - 1].confidence).toBeGreaterThanOrEqual(
        result.candidates[i].confidence,
      );
    }
  });

  it('top candidate confidence is normalized to 1.0', () => {
    const result = selectComponent('action-button', catalog);
    expect(result.candidates[0].confidence).toBe(1);
  });

  it('includes the intent in the result', () => {
    const result = selectComponent('action-button', catalog);
    expect(result.intent).toBe('action-button');
  });
});

/* ------------------------------------------------------------------ */
/*  Success criteria: specific intent → top candidate                  */
/* ------------------------------------------------------------------ */

describe('selectComponent — intent-to-component mappings', () => {
  it('top candidate for "action-button" is Button', () => {
    const result = selectComponent('action-button', catalog);
    expect(topName(result)).toBe('Button');
  });

  it('top candidate for "data-table" is Table', () => {
    const result = selectComponent('data-table', catalog);
    expect(topName(result)).toBe('Table');
  });

  it('top candidate for "text-input" is Input', () => {
    const result = selectComponent('text-input', catalog);
    expect(topName(result)).toBe('Input');
  });

  it('top candidate for "search-input" is SearchInput', () => {
    const result = selectComponent('search-input', catalog);
    expect(topName(result)).toBe('SearchInput');
    expect(topN(result, 2)).toContain('Input');
  });

  it('header search slots still keep SearchInput ahead of Input', () => {
    const result = selectComponent('search-input', catalog, {
      intentContext: 'search input',
      slotPosition: 'header',
    });
    expect(topName(result)).toBe('SearchInput');
    expect(result.candidates.findIndex((candidate) => candidate.name === 'SearchInput')).toBeLessThan(
      result.candidates.findIndex((candidate) => candidate.name === 'Input'),
    );
  });

  it('top candidate for "page-header" includes Text', () => {
    const result = selectComponent('page-header', catalog);
    expect(topN(result, 3)).toContain('Text');
  });

  it('top candidate for "status-indicator" is a Badge variant', () => {
    const result = selectComponent('status-indicator', catalog);
    expect(topName(result)).toMatch(/Badge/);
  });

  it('"form-input" returns Input and Select in top 3', () => {
    const result = selectComponent('form-input', catalog);
    const top3 = topN(result, 3);
    expect(top3).toContain('Input');
    expect(top3).toContain('Select');
  });

  it('"boolean-input" prioritizes toggle-style controls', () => {
    const result = selectComponent('boolean-input', catalog);
    expect(topN(result, 2).some((name) => name === 'Toggle' || name === 'Checkbox')).toBe(true);
  });

  it('"enum-input" prefers Select', () => {
    const result = selectComponent('enum-input', catalog);
    expect(topName(result)).toBe('Select');
  });

  it('"enum-input" keeps Select ahead of Input in main form slots', () => {
    const result = selectComponent('enum-input', catalog, {
      intentContext: ['Subscription form view'],
      slotPosition: 'main',
    });
    expect(topName(result)).toBe('Select');
  });

  it('"date-input" prefers DatePicker', () => {
    const result = selectComponent('date-input', catalog);
    expect(topName(result)).toBe('DatePicker');
  });

  it('"email-input" prefers Input', () => {
    const result = selectComponent('email-input', catalog);
    expect(topName(result)).toBe('Input');
  });

  it('"long-text-input" includes Textarea', () => {
    const result = selectComponent('long-text-input', catalog);
    expect(topN(result, 2)).toContain('Textarea');
  });

  it('"long-text-input" keeps Textarea ahead of Input in main form slots', () => {
    const result = selectComponent('long-text-input', catalog, {
      intentContext: ['Subscription form view'],
      slotPosition: 'main',
    });
    expect(topName(result)).toBe('Textarea');
  });

  it('"metrics-display" includes Card in top 3', () => {
    const result = selectComponent('metrics-display', catalog);
    expect(topN(result, 3)).toContain('Card');
  });

  it('"navigation-panel" includes Tabs or Stack', () => {
    const result = selectComponent('navigation-panel', catalog);
    const top3 = topN(result, 3);
    expect(top3.some(n => n === 'Tabs' || n === 'Stack')).toBe(true);
  });

  it('"filter-control" includes Select', () => {
    const result = selectComponent('filter-control', catalog);
    expect(hasCandidate(result, 'Select')).toBe(true);
  });

  it('search-oriented filter controls prefer SearchInput over generic Input', () => {
    const result = selectComponent('filter-control', catalog, {
      intentContext: 'search accounts by name',
      slotPosition: 'header',
    });
    expect(topName(result)).toBe('SearchInput');
    expect(result.candidates.findIndex((candidate) => candidate.name === 'SearchInput')).toBeLessThan(
      result.candidates.findIndex((candidate) => candidate.name === 'Input'),
    );
  });

  it('"data-display" includes Card', () => {
    const result = selectComponent('data-display', catalog);
    expect(hasCandidate(result, 'Card')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Scoring signals                                                    */
/* ------------------------------------------------------------------ */

describe('selectComponent — scoring signals', () => {
  it('preferred component gets highest score', () => {
    const result = selectComponent('action-button', catalog);
    const buttonCandidate = result.candidates.find(c => c.name === 'Button');
    expect(buttonCandidate).toBeTruthy();
    expect(buttonCandidate!.confidence).toBe(1);
    expect(buttonCandidate!.reason).toContain('preferred');
  });

  it('tag matches contribute to score', () => {
    const result = selectComponent('action-button', catalog);
    const button = result.candidates.find(c => c.name === 'Button');
    expect(button!.reason).toContain('tag');
  });

  it('context matches contribute to score', () => {
    const result = selectComponent('form-input', catalog);
    const input = result.candidates.find(c => c.name === 'Input');
    expect(input).toBeTruthy();
    // Input is in 'form' context which matches the form-input intent
    expect(input!.confidence).toBeGreaterThan(0);
  });

  it('components with more traits get trait bonus', () => {
    // Compare two results where a traited component should score higher
    const result = selectComponent('text-input', catalog);
    const tagInput = result.candidates.find(c => c.name === 'TagInput');
    if (tagInput) {
      expect(tagInput.reason).toContain('trait');
    }
  });

  it('name keyword matching boosts relevant components', () => {
    // "data-table" keywords are "data" and "table"
    const result = selectComponent('data-table', catalog);
    const table = result.candidates.find(c => c.name === 'Table');
    expect(table!.reason).toContain('name contains');
  });

  it('non-search form fields do not bias toward SearchInput', () => {
    const result = selectComponent('form-input', catalog, {
      intentContext: 'email address field',
    });
    expect(topName(result)).toBe('Input');
    const searchInputIndex = result.candidates.findIndex((candidate) => candidate.name === 'SearchInput');
    if (searchInputIndex !== -1) {
      expect(searchInputIndex).toBeGreaterThan(
        result.candidates.findIndex((candidate) => candidate.name === 'Input'),
      );
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Unknown / edge-case intents                                        */
/* ------------------------------------------------------------------ */

describe('selectComponent — edge cases', () => {
  it('unknown intent returns warning', () => {
    const result = selectComponent('completely-unknown-intent', catalog);
    expect(result.warning).toBeTruthy();
    expect(result.warning).toContain('Unknown intent');
  });

  it('unknown intent still returns keyword-based matches', () => {
    // "button" keyword should match Button via name
    const result = selectComponent('submit-button', catalog);
    expect(hasCandidate(result, 'Button')).toBe(true);
  });

  it('empty intent returns warning and no candidates', () => {
    const result = selectComponent('', catalog);
    expect(result.warning).toBeTruthy();
    expect(result.candidates).toHaveLength(0);
  });

  it('whitespace-only intent returns warning', () => {
    const result = selectComponent('   ', catalog);
    expect(result.warning).toBeTruthy();
    expect(result.candidates).toHaveLength(0);
  });

  it('empty catalog returns no candidates', () => {
    const result = selectComponent('action-button', []);
    expect(result.candidates).toHaveLength(0);
  });

  it('respects topN option', () => {
    const result = selectComponent('action-button', catalog, { topN: 2 });
    expect(result.candidates.length).toBeLessThanOrEqual(2);
  });

  it('respects minConfidence option', () => {
    const result = selectComponent('action-button', catalog, { minConfidence: 0.5 });
    for (const c of result.candidates) {
      expect(c.confidence).toBeGreaterThanOrEqual(0.5);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Catalog loading                                                    */
/* ------------------------------------------------------------------ */

describe('loadCatalog', () => {
  it('loads catalog with 80+ components', () => {
    expect(catalog.length).toBeGreaterThanOrEqual(80);
  });

  it('catalog entries have required fields', () => {
    for (const entry of catalog) {
      expect(entry.name).toBeTruthy();
      expect(entry.displayName).toBeTruthy();
      expect(entry.categories).toBeInstanceOf(Array);
      expect(entry.tags).toBeInstanceOf(Array);
      expect(entry.contexts).toBeInstanceOf(Array);
      expect(entry.regions).toBeInstanceOf(Array);
    }
  });

  it('catalog includes known primitives', () => {
    const names = catalog.map(c => c.name);
    expect(names).toContain('Button');
    expect(names).toContain('Card');
    expect(names).toContain('Text');
    expect(names).toContain('Input');
    expect(names).toContain('Select');
    expect(names).toContain('Table');
    expect(names).toContain('Stack');
    expect(names).toContain('Grid');
  });
});

/* ------------------------------------------------------------------ */
/*  Broad intent coverage (10+ intents)                                */
/* ------------------------------------------------------------------ */

describe('selectComponent — broad intent coverage', () => {
  const intentCases: [string, string[]][] = [
    ['action-button', ['Button']],
    ['text-input', ['Input']],
    ['form-input', ['Input', 'Select']],
    ['data-table', ['Table']],
    ['data-display', ['Card', 'Table', 'Stack']],
    ['data-list', ['Stack', 'Table']],
    ['metrics-display', ['Card', 'Badge']],
    ['status-indicator', ['StatusBadge', 'Badge', 'ColorizedBadge']],
    ['page-header', ['Text', 'DetailHeader']],
    ['navigation-panel', ['Stack', 'Tabs']],
    ['filter-control', ['Select', 'Input']],
    ['pagination-control', ['Text', 'Button']],
    ['metadata-display', ['Stack', 'Text', 'Badge']],
  ];

  for (const [intent, expectedInTop] of intentCases) {
    it(`"${intent}" returns at least one expected component in candidates`, () => {
      const result = selectComponent(intent, catalog);
      expect(result.candidates.length).toBeGreaterThan(0);
      const names = result.candidates.map(c => c.name);
      const hasExpected = expectedInTop.some(expected => names.includes(expected));
      expect(
        hasExpected,
        `Expected one of [${expectedInTop.join(', ')}] in candidates for "${intent}", got [${names.join(', ')}]`,
      ).toBe(true);
    });
  }
});

describe('patternBoost option', () => {
  it('boosts the named component when patternBoost is provided', () => {
    const baseline = selectComponent('data-display', catalog);
    const baselineScore = baseline.candidates.find(c => c.name === 'StatusTimeline')?.confidence ?? 0;

    const boosted = selectComponent('data-display', catalog, {
      patternBoost: { componentName: 'StatusTimeline', boost: 0.30, patternId: 'status-timeline' },
    });
    const boostedScore = boosted.candidates.find(c => c.name === 'StatusTimeline')?.confidence ?? 0;

    expect(boostedScore).toBeGreaterThan(baselineScore);
    const boostedEntry = boosted.candidates.find(c => c.name === 'StatusTimeline');
    expect(boostedEntry?.reason).toContain('field pattern');
    expect(boostedEntry?.reason).toContain('status-timeline');
  });

  it('does not boost non-matching components', () => {
    const result = selectComponent('action-button', catalog, {
      patternBoost: { componentName: 'PricingSummary', boost: 0.30, patternId: 'pricing-summary' },
    });
    // Button should still be top for action-button regardless of pricing pattern
    expect(result.candidates[0]?.name).toBe('Button');
    const buttonEntry = result.candidates.find(c => c.name === 'Button');
    expect(buttonEntry?.reason).not.toContain('field pattern');
  });
});
