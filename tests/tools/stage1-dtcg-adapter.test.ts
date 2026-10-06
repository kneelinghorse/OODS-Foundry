// s166 m04 — Stage1 fig_local_tokens → DTCG adapter v0 proof suite.
//
// Three layers, all hermetic to this repo:
//  1. UNIT — synthetic fixtures pin every conversion rule (scope skip, mode split,
//     Light-or-first base, identical-duplicate merge, first-wins collision RECORDING,
//     leaf-vs-group rename, null-unresolved, font-weight mapping).
//  2. SAMPLE CONFORMANCE — a synthetic mixed-kind export converts to a base set where
//     every leaf is a $type/$value DTCG token, and the coverage report accounts for every
//     input token (converted + unresolved + skipped), so the report cannot silently drift
//     from the output it describes.
//  3. SD INGEST — that base set builds through the SAME machinery as the packages/tokens
//     build (style-dictionary + tokens-studio preprocessor + expand typesMap +
//     css/variables), proving "tokens.build ingests it without error".
import { describe, expect, it } from 'vitest';
import StyleDictionary from 'style-dictionary';
import { register as registerSdTransforms, expandTypesMap } from '@tokens-studio/sd-transforms';
import {
  convertFigLocalTokens,
  slugifyMode,
  type DtcgNode,
  type FigLocalTokensFile,
} from '../../tools/stage1-dtcg/adapter.js';

function figFile(tokens: FigLocalTokensFile['tokens']): FigLocalTokensFile {
  return {
    kind: 'fig_local_tokens',
    version: '1.0.0',
    generated_at: '2026-07-27T18:12:44.530Z',
    source: { file_label: 'unit-fixture', fig_version: 1 },
    tokens,
  };
}

function leaves(node: DtcgNode, prefix: string[] = []): Array<{ path: string; token: Record<string, unknown> }> {
  const found: Array<{ path: string; token: Record<string, unknown> }> = [];
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) continue;
    const child = value as Record<string, unknown>;
    if (child && typeof child === 'object' && '$value' in child) {
      found.push({ path: [...prefix, key].join('/'), token: child });
    } else if (child && typeof child === 'object') {
      found.push(...leaves(child as DtcgNode, [...prefix, key]));
    }
  }
  return found;
}

describe('stage1-dtcg adapter — unit conversion rules', () => {
  it('rejects a non-fig_local_tokens input loudly', () => {
    expect(() => convertFigLocalTokens({ kind: 'something_else', tokens: [] })).toThrow(
      /Unsupported input kind/
    );
  });

  it('converts color/number/text_style and SKIPS other kinds with counts (never silently)', () => {
    const { base, report } = convertFigLocalTokens(
      figFile([
        { name: 'Brand/Red', kind: 'color', values: [{ mode: 'Light', value: '#3355cc' }] },
        { name: 'Spacing/S', kind: 'number', values: [{ mode: 'Value', value: 8 }] },
        {
          name: 'Heading/H4',
          kind: 'text_style',
          values: [{ value: { fontFamily: 'Inter', fontSize: 20, fontStyle: 'Bold' } }],
        },
        { name: 'Copy/CTA', kind: 'string', values: [{ value: 'Buy' }] },
        { name: 'Show Heart', kind: 'boolean', values: [{ value: false }] },
      ])
    );
    const found = leaves(base);
    expect(found.map((leaf) => leaf.path).sort()).toEqual(['Brand/Red', 'Heading/H4', 'Spacing/S']);
    expect(report.inScope).toBe(3);
    expect(report.converted).toBe(3);
    expect(report.skippedByKind).toEqual({ string: 1, boolean: 1 });
  });

  it('maps text_style to DTCG typography (px size, name AND numeric weight forms)', () => {
    const { base, report } = convertFigLocalTokens(
      figFile([
        {
          name: 'H1',
          kind: 'text_style',
          values: [{ value: { fontFamily: 'Roboto Slab', fontSize: 32, fontStyle: '900' } }],
        },
        {
          name: 'Body',
          kind: 'text_style',
          values: [{ value: { fontFamily: 'Inter', fontSize: 16, fontStyle: 'Semibold' } }],
        },
      ])
    );
    const found = Object.fromEntries(leaves(base).map((leaf) => [leaf.path, leaf.token]));
    expect(found['H1'].$value).toEqual({
      fontFamily: 'Roboto Slab',
      fontSize: '32px',
      fontWeight: 900,
      fontStyle: 'normal',
    });
    expect(found['Body'].$value).toEqual({
      fontFamily: 'Inter',
      fontSize: '16px',
      fontWeight: 600,
      fontStyle: 'normal',
    });
    expect(report.unmappedFontStyles).toEqual([]);
  });

  it('splits modes: Light (or first) becomes base, every other mode an overlay set', () => {
    const { base, modes, report } = convertFigLocalTokens(
      figFile([
        {
          name: 'Surface/Canvas',
          kind: 'color',
          values: [
            { mode: 'Draft', value: '#eeeeee' },
            { mode: 'Light', value: '#ffffff' },
            { mode: 'Dark', value: '#111111' },
          ],
        },
        {
          name: 'Grid/Columns',
          kind: 'number',
          // No Light mode: FIRST listed value is base (disclosed heuristic).
          values: [
            { mode: 'Desktop', value: 12 },
            { mode: 'Mobile', value: 4 },
          ],
        },
      ])
    );
    expect(leaves(base).map((leaf) => leaf.token.$value)).toEqual(['#ffffff', 12]);
    expect(leaves(modes['draft']).map((leaf) => leaf.token.$value)).toEqual(['#eeeeee']);
    expect(leaves(modes['dark']).map((leaf) => leaf.token.$value)).toEqual(['#111111']);
    expect(leaves(modes['mobile']).map((leaf) => leaf.token.$value)).toEqual([4]);
    expect(report.baseModeChoices).toEqual({ Light: 1, Desktop: 1 });
    expect(modes['desktop']).toBeUndefined();
  });

  it('merges identical duplicates silently-but-counted; RECORDS first-wins collisions', () => {
    const { base, report } = convertFigLocalTokens(
      figFile([
        { name: 'Neutrals/White', kind: 'color', values: [{ mode: 'Light', value: '#ffffff' }] },
        { name: 'Neutrals/White', kind: 'color', values: [{ mode: 'Light', value: '#ffffff' }] },
        { name: 'Neutral/Gray', kind: 'color', values: [{ mode: 'Light', value: '#cccccc' }] },
        { name: 'Neutral/Gray', kind: 'color', values: [{ mode: 'Light', value: '#dddddd' }] },
      ])
    );
    expect(report.identicalDuplicatesMerged).toBe(1);
    expect(report.collisions).toEqual([
      {
        path: 'Neutral/Gray',
        set: 'base',
        kept: { $type: 'color', $value: '#cccccc' },
        dropped: { $type: 'color', $value: '#dddddd' },
      },
    ]);
    const found = Object.fromEntries(leaves(base).map((leaf) => [leaf.path, leaf.token]));
    expect(found['Neutral/Gray'].$value).toBe('#cccccc');
  });

  it('renames a leaf whose name is also a group prefix (a DTCG node cannot be both)', () => {
    const { base, report } = convertFigLocalTokens(
      figFile([
        { name: 'Primary', kind: 'color', values: [{ value: '#3355cc' }] },
        { name: 'Primary/Hover', kind: 'color', values: [{ value: '#2a45a8' }] },
      ])
    );
    const paths = leaves(base).map((leaf) => leaf.path).sort();
    expect(paths).toEqual(['Primary (value)', 'Primary/Hover']);
    expect(report.leafGroupConflictsRenamed).toEqual([{ name: 'Primary', renamedTo: 'Primary (value)' }]);
  });

  it('counts null-valued tokens as unresolved by name, converting nothing for them', () => {
    const { base, report } = convertFigLocalTokens(
      figFile([
        { name: 'Gradient/Missing', kind: 'color', values: [{ mode: 'Light', value: null }] },
        { name: 'Brand/Red', kind: 'color', values: [{ mode: 'Light', value: '#3355cc' }] },
      ])
    );
    expect(report.unresolved).toEqual({ count: 1, names: ['Gradient/Missing'] });
    expect(leaves(base)).toHaveLength(1);
  });

  it('sanitizes DTCG-reserved characters and slugs mode names', () => {
    const { base, modes } = convertFigLocalTokens(
      figFile([
        {
          name: 'Type/v2.5 $special',
          kind: 'number',
          values: [
            { mode: 'Light', value: 1 },
            { mode: 'HC - Light', value: 2 },
          ],
        },
      ])
    );
    expect(leaves(base)[0].path).toBe('Type/v2-5 -special');
    expect(Object.keys(modes)).toEqual(['hc-light']);
    expect(slugifyMode('HC - Light')).toBe('hc-light');
  });
});

// A small export shaped like a real fig-extract run: two modes, every v0 kind, two kinds
// outside scope, and one null value from an unsupplied library.
const SAMPLE = figFile([
  {
    name: 'Brand/Accent',
    kind: 'color',
    values: [
      { mode: 'Light', value: '#3355cc' },
      { mode: 'Dark', value: '#8fa6ff' },
    ],
  },
  {
    name: 'Brand/Ink',
    kind: 'color',
    values: [
      { mode: 'Light', value: '#1f2328' },
      { mode: 'Dark', value: '#f0f3f6' },
    ],
  },
  { name: 'Surface/Canvas', kind: 'color', values: [{ mode: 'Light', value: '#ffffff' }] },
  { name: 'Library/Gradient', kind: 'color', values: [{ mode: 'Light', value: null }] },
  { name: 'Spacing/S', kind: 'number', values: [{ mode: 'Value', value: 8 }] },
  { name: 'Spacing/M', kind: 'number', values: [{ mode: 'Value', value: 16 }] },
  { name: 'Radius/Card', kind: 'number', values: [{ mode: 'Value', value: 8 }] },
  {
    name: 'Heading/H2',
    kind: 'text_style',
    values: [{ value: { fontFamily: 'Inter', fontSize: 24, fontStyle: 'Bold' } }],
  },
  {
    name: 'Body/Default',
    kind: 'text_style',
    values: [{ value: { fontFamily: 'Inter', fontSize: 16, fontStyle: 'Regular' } }],
  },
  { name: 'Copy/CTA', kind: 'string', values: [{ value: 'Continue' }] },
  { name: 'Show Badge', kind: 'boolean', values: [{ value: true }] },
]);

describe('stage1-dtcg adapter — sample conversion conformance', () => {
  const { base, modes, report } = convertFigLocalTokens(SAMPLE);

  it('every leaf is a $type/$value DTCG token of a v0-scope type', () => {
    const found = leaves(base);
    expect(found.length).toBeGreaterThan(0);
    for (const { token } of found) {
      expect(['color', 'number', 'typography']).toContain(token.$type);
      expect(token.$value).toBeDefined();
    }
    expect(leaves(modes['dark']).map((leaf) => leaf.token.$value)).toEqual(['#8fa6ff', '#f0f3f6']);
  });

  it('the coverage report accounts for every input token (no silent drift)', () => {
    const found = leaves(base);
    expect(found.length).toBe(report.converted);
    expect(report.scopeKinds).toEqual(['color', 'number', 'text_style']);
    expect(report.source.totalTokens).toBe(SAMPLE.tokens.length);
    expect(report.inScope).toBe(9);
    expect(report.converted).toBe(8);
    expect(report.unresolved).toEqual({ count: 1, names: ['Library/Gradient'] });
    const skipped = Object.values(report.skippedByKind as Record<string, number>).reduce(
      (sum, count) => sum + count,
      0
    );
    expect(report.inScope + skipped).toBe(report.source.totalTokens);
    expect(report.converted + report.unresolved.count).toBe(report.inScope);
    expect(report.disclosedLimitations.length).toBeGreaterThanOrEqual(4);
  });
});

describe('stage1-dtcg adapter — SD ingest (the tokens.build machinery accepts the output)', () => {
  it('style-dictionary + tokens-studio preprocessor builds css/variables from the base set without error', async () => {
    const { base } = convertFigLocalTokens(SAMPLE);
    registerSdTransforms(StyleDictionary);
    const sd = new StyleDictionary({
      tokens: base as Record<string, unknown>,
      preprocessors: ['tokens-studio'],
      expand: { typesMap: expandTypesMap },
      log: { warnings: 'disabled', verbosity: 'silent' },
      platforms: {
        css: {
          transformGroup: 'tokens-studio',
          transforms: ['name/kebab'],
          files: [{ destination: 'tokens.css', format: 'css/variables' }],
        },
      },
    });
    await sd.hasInitialized;
    const outputs = await sd.formatAllPlatforms({ cache: false });
    const css = outputs.css?.[0]?.output;
    expect(typeof css).toBe('string');
    // The expand step decomposes each typography token into its parts, so the variable
    // count exceeds the leaf count; the floor pins "every token emitted something".
    const variableCount = (css as string).match(/--[\w-]+:/g)?.length ?? 0;
    expect(variableCount).toBeGreaterThanOrEqual(leaves(base).length);
    expect(css).toContain('#3355cc');
  });
});
