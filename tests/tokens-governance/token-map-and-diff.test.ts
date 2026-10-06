/**
 * s169 m03 — the first tests this tool has ever had.
 *
 * ── WHY IT HAD NONE, AND WHY THAT IS FIXED HERE RATHER THAN LATER ──
 * `tools/tokens-governance/index.ts` shipped as a CLI with a bare top-level `await main()`
 * and zero exports, so importing it EXECUTED the command-line program. That is not an
 * oversight with a small cost: it is why a gate whose entire job is policing token changes
 * could report **Δ0** for a sprint that modified 63 token leaves, and no test noticed. The
 * module now guards its entry point and exports its pure functions; these are the unit
 * tests that become possible as a result.
 *
 * ── WHAT IS COVERED, AND WHY EACH ONE ──
 * Every test below corresponds to a defect that was live at s168's tip:
 *   1. FILE-SCOPED KEYS   — two files declaring the same dotted path used to collapse into
 *                           one entry, the last writer winning. That is the Δ0 mechanism.
 *   2. DIFF OVER THOSE KEYS — a real edit in file X must survive an identical path in file Y.
 *   3. REMOVAL CLASSES    — "removed" conflated a de-duplication with a value leaving the
 *                           graph entirely; a reviewer needs to be able to tell them apart.
 *   4. CELL-SCOPED CONTRAST — grouping by dot-prefix alone paired a foreground from one
 *                           brand cell with a background from another.
 *   5. THE FILE UNIVERSE  — the gate governed files the build never compiles.
 *
 * Each keying/diff test is written so that reverting the fix makes it RED, and says so.
 */
import { describe, expect, it } from 'vitest';

import {
  classifyRemoval,
  collectDtcgTokens,
  computeContrastDeltas,
  computeTokenDiff,
  filterTokensForBrand,
  isGovernedSourceFile,
  scopedTokenKey,
} from '../../tools/tokens-governance/index.ts';

type Entry = {
  key: string;
  path: string;
  segments: string[];
  value: string | number;
  cssVariable: string | null;
  description: string | null;
  sourceHint: string;
};

/** Parse one DTCG document as the tool does, into a file-scoped map. */
function loadFixture(filePath: string, doc: Record<string, unknown>): Map<string, Entry> {
  const tokens = new Map<string, Entry>();
  collectDtcgTokens(doc, [], { tokens, filePath });
  return tokens;
}

function merge(...maps: Array<Map<string, Entry>>): Map<string, Entry> {
  const out = new Map<string, Entry>();
  for (const map of maps) for (const [key, value] of map) out.set(key, value);
  return out;
}

const colour = (value: string) => ({ $type: 'color', $value: value });

describe('s169 m03 — file-scoped token map', () => {
  it('two files declaring the SAME path produce TWO entries, not one', () => {
    // THE Δ0 MECHANISM, in miniature. Keyed by path alone this map has one entry and the
    // second file silently wins; keyed by file::path it has two and both are visible.
    const shadowed = merge(
      loadFixture('packages/tokens/src/tokens/base/reference/colour.json', {
        ref: { color: { neutral: { 100: colour('#ffffff') } } },
      }),
      loadFixture('packages/tokens/src/tokens/base.json', {
        ref: { color: { neutral: { 100: colour('#eeeeee') } } },
      }),
    );

    expect(shadowed.size).toBe(2);
    expect([...shadowed.keys()]).toEqual([
      'packages/tokens/src/tokens/base/reference/colour.json::ref.color.neutral.100',
      'packages/tokens/src/tokens/base.json::ref.color.neutral.100',
    ]);
    // Both values survive — neither file erased the other.
    expect([...shadowed.values()].map((entry) => entry.value)).toEqual(['#ffffff', '#eeeeee']);
  });

  it('the token’s own identity stays UNSCOPED, because the codebase is grepped with it', () => {
    // `buildSearchStrings` searches the repo for `path`, `key` and `cssVariable`. Scoping
    // any of those would produce `…json::color.brand.A.text.primary`, which matches nothing
    // on disk, and every orphan/leak verdict would silently become "unreferenced".
    const map = loadFixture('packages/tokens/src/tokens/brands/A/base.json', {
      color: { brand: { A: { text: { primary: colour('#123456') } } } },
    });
    const [entry] = [...map.values()];
    expect(entry.path).toBe('color.brand.A.text.primary');
    expect(entry.key).toBe('color-brand-a-text-primary');
    expect(entry.cssVariable).toBe('--oods-color-brand-a-text-primary');
    expect(entry.sourceHint).toBe('packages/tokens/src/tokens/brands/A/base.json');
    // ...and the MAP key is the scoped one.
    expect(scopedTokenKey(entry.sourceHint, entry.path)).toBe(
      'packages/tokens/src/tokens/brands/A/base.json::color.brand.A.text.primary',
    );
    expect(map.has(scopedTokenKey(entry.sourceHint, entry.path))).toBe(true);
  });
});

describe('s169 m03 — diff over composite keys', () => {
  const OTHER_FILE = 'packages/tokens/src/tokens/base.json';
  const BRAND_FILE = 'packages/tokens/src/tokens/brands/A/base.json';

  const brandDoc = (value: string) => ({ color: { brand: { A: { text: { primary: colour(value) } } } } });
  const shadowDoc = { color: { brand: { A: { text: { primary: colour('#000000') } } } } };

  it('an edit in one file is NOT erased by an identical path in another file', () => {
    // Path-keyed, `base.json` is walked last in both maps, its unchanged `#000000` wins on
    // both sides, and the diff reports NOTHING. That is exactly what produced Δ0.
    const base = merge(loadFixture(BRAND_FILE, brandDoc('#111111')), loadFixture(OTHER_FILE, shadowDoc));
    const head = merge(loadFixture(BRAND_FILE, brandDoc('#222222')), loadFixture(OTHER_FILE, shadowDoc));

    const diff = computeTokenDiff(base, head);
    expect(diff.summary).toMatchObject({ added: 0, removed: 0, modified: 1 });
    expect(diff.changes.modified[0]).toMatchObject({
      path: 'color.brand.A.text.primary',
      sourceHint: BRAND_FILE,
      valueBefore: '#111111',
      valueAfter: '#222222',
    });
  });

  it('a path present in one file and absent in another is an add, not a modification', () => {
    const base = loadFixture(OTHER_FILE, shadowDoc);
    const head = merge(loadFixture(OTHER_FILE, shadowDoc), loadFixture(BRAND_FILE, brandDoc('#333333')));

    const diff = computeTokenDiff(base, head);
    expect(diff.summary).toMatchObject({ added: 1, removed: 0, modified: 0 });
    expect(diff.changes.added[0]).toMatchObject({ sourceHint: BRAND_FILE, valueAfter: '#333333' });
  });

  it('brand filtering keeps non-brand tokens and only the requested brand’s cells', () => {
    const map = merge(
      loadFixture('packages/tokens/src/tokens/brands/A/base.json', {
        color: { brand: { A: { text: { primary: colour('#a') } } } },
      }),
      loadFixture('packages/tokens/src/tokens/brands/B/base.json', {
        color: { brand: { B: { text: { primary: colour('#b') } } } },
      }),
      loadFixture('packages/tokens/src/tokens/base/reference/colour.json', {
        ref: { color: { neutral: { 100: colour('#n') } } },
      }),
    );

    const forA = [...filterTokensForBrand(map, 'A').values()].map((entry) => entry.path).sort();
    expect(forA).toEqual(['color.brand.A.text.primary', 'ref.color.neutral.100']);
  });
});

describe('s169 m03 — removal classification', () => {
  const DELETED_FILE = 'packages/tokens/src/tokens/base/motion.json';
  const SURVIVOR_FILE = 'packages/tokens/src/tokens/base/reference/colour.json';

  it('DUPLICATE-REMOVED: path and identical value both survive in another file', () => {
    const removed = [...loadFixture('packages/tokens/src/tokens/brands/A/base.json', {
      ref: { typography: { body: { $type: 'fontFamily', $value: 'Inter' } } },
    }).values()][0];

    const head = loadFixture(SURVIVOR_FILE, {
      ref: { typography: { body: { $type: 'fontFamily', $value: 'Inter' } } },
    });

    expect(classifyRemoval(removed, head)).toBe('duplicate-removed');
  });

  it('PLAIN: the path survives elsewhere but with a DIFFERENT value', () => {
    // Value equality is required, not just path equality — otherwise a genuine value change
    // executed as delete-here/keep-there would be filed as a harmless de-duplication.
    const removed = [...loadFixture(DELETED_FILE, {
      ref: { motion: { fast: { $type: 'duration', $value: '{ref.motion.base}' } } },
    }).values()][0];

    const head = loadFixture(SURVIVOR_FILE, {
      ref: { motion: { fast: { $type: 'duration', $value: '120ms' } } },
    });

    expect(classifyRemoval(removed, head)).toBe('plain');
  });

  it('PLAIN: the path survives NOWHERE at head', () => {
    const removed = [...loadFixture(DELETED_FILE, {
      ref: { motion: { fast: { $type: 'duration', $value: '{ref.motion.base}' } } },
    }).values()][0];

    expect(classifyRemoval(removed, new Map())).toBe('plain');
  });

  it('a same-file entry is never its own survivor', () => {
    // The survivor must be a DIFFERENT file; otherwise an entry could vouch for itself and
    // every removal would classify duplicate-removed.
    const doc = { ref: { typography: { body: { $type: 'fontFamily', $value: 'Inter' } } } };
    const removed = [...loadFixture(SURVIVOR_FILE, doc).values()][0];
    expect(classifyRemoval(removed, loadFixture(SURVIVOR_FILE, doc))).toBe('plain');
  });

  it('the summary counts the two classes separately', () => {
    const base = merge(
      loadFixture('packages/tokens/src/tokens/brands/A/base.json', {
        ref: { typography: { body: { $type: 'fontFamily', $value: 'Inter' } } },
      }),
      loadFixture(DELETED_FILE, {
        ref: { motion: { fast: { $type: 'duration', $value: '{ref.motion.base}' } } },
      }),
    );
    const head = loadFixture(SURVIVOR_FILE, {
      ref: { typography: { body: { $type: 'fontFamily', $value: 'Inter' } } },
    });

    const diff = computeTokenDiff(base, head);
    expect(diff.summary.removed).toBe(2);
    expect(diff.summary.duplicateRemoved).toBe(1);
    expect(diff.changes.removed.map((change) => change.removalClass).sort()).toEqual([
      'duplicate-removed',
      'plain',
    ]);
  });
});

describe('s169 m03 — contrast grouping is cell-scoped', () => {
  const A_BASE = 'packages/tokens/src/tokens/brands/A/base.json';
  const A_DARK = 'packages/tokens/src/tokens/brands/A/dark.json';

  const statusDoc = (text: string, surface: string) => ({
    color: { brand: { A: { status: { info: { text: colour(text), surface: colour(surface) } } } } },
  });

  it('the same dotted prefix in two cells produces TWO groups, never one blended pair', async () => {
    // Grouped by dot-prefix alone, A/base's `status.info.*` and A/dark's collapse into ONE
    // group and whichever file is walked last supplies BOTH operands — or worse, one cell's
    // foreground is checked against the other's background: a ratio no rendered surface
    // ever shows. The fixtures are deliberately inverted (dark-on-light vs light-on-dark)
    // so a blended pair is arithmetically obvious, not merely structurally wrong.
    const base = merge(
      loadFixture(A_BASE, statusDoc('#111111', '#eeeeee')),
      loadFixture(A_DARK, statusDoc('#f0f0f0', '#101010')),
    );
    const head = merge(
      loadFixture(A_BASE, statusDoc('#222222', '#dddddd')),
      loadFixture(A_DARK, statusDoc('#e0e0e0', '#202020')),
    );

    const diff = computeTokenDiff(base, head);
    const findings = await computeContrastDeltas(diff, base, head, 'A');

    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.group)).toEqual([
      `${A_BASE}::color.brand.A.status.info`,
      `${A_DARK}::color.brand.A.status.info`,
    ]);

    // Each finding's two operands come from ONE file — the whole point of the scope.
    for (const finding of findings) {
      const [file] = finding.group.split('::');
      expect(head.get(scopedTokenKey(file, finding.foregroundPath))).toBeDefined();
      expect(head.get(scopedTokenKey(file, finding.backgroundPath))).toBeDefined();
    }

    // Within a cell both pairs are legible; ACROSS cells they would be ~1:1. A group that
    // blended the two would therefore have shown a catastrophic (and fictional) ratio.
    for (const finding of findings) expect(finding.headRatio).toBeGreaterThan(4.5);
    expect(findings[0].foregroundHead).not.toBe(findings[1].foregroundHead);
  });
});

describe('s169 m03 — the governed file universe matches the build', () => {
  it('includes what the build compiles', () => {
    expect(isGovernedSourceFile('packages/tokens/src/tokens/brands/A/base.json')).toBe(true);
    expect(isGovernedSourceFile('packages/tokens/src/tokens/base/reference/colour.json')).toBe(true);
  });

  it('excludes presets and the repo-root tokens/ directory, which the build reads NEITHER', () => {
    expect(isGovernedSourceFile('packages/tokens/src/presets/dark-minimal.json')).toBe(false);
    expect(isGovernedSourceFile('tokens/theme.json')).toBe(false);
    expect(isGovernedSourceFile('tokens/maps/saas-billing.status-map.json')).toBe(false);
  });

  it('excludes non-JSON files', () => {
    expect(isGovernedSourceFile('packages/tokens/src/tokens/README.md')).toBe(false);
  });
});
