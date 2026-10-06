import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { derivePatternSources, generatePatternSources, PATTERN_DIRECTORY, PATTERN_SOURCES_PATH, ROOT, serializePatternSources } from '../../../scripts/product-reality/s195-pattern-sources.js';

const readSources = () => readdirSync(path.join(ROOT, PATTERN_DIRECTORY)).filter(name => name.endsWith('.spec.json')).sort()
  .map(name => ({ specPath: `${PATTERN_DIRECTORY}/${name}`, bytes: readFileSync(path.join(ROOT, PATTERN_DIRECTORY, name), 'utf8') }));

describe('generated authored pattern bundle (s195-m03)', () => {
  it('regenerates identical package bytes independently of directory enumeration order', () => {
    const source = readSources();
    const expected = readFileSync(path.join(ROOT, PATTERN_SOURCES_PATH), 'utf8');
    expect(serializePatternSources(derivePatternSources(source))).toBe(expected);
    expect(serializePatternSources(derivePatternSources(source.reverse()))).toBe(expected);
    expect(generatePatternSources({ check: true })).toHaveLength(23);
  });

  it('rejects aliases, duplicates and unsupported base marks while allowing explicit-only authored patterns', () => {
    const source = readSources()[0]!;
    expect(() => derivePatternSources([source, source])).toThrow('Duplicate pattern identity');
    const spec = JSON.parse(source.bytes);
    spec.id = 'bubble-distribution';
    expect(() => derivePatternSources([{ ...source, bytes: JSON.stringify(spec) }])).toThrow('Invalid pattern identity');
    spec.id = 'pattern:viz:uncatalogued';
    expect(derivePatternSources([{ specPath: `${PATTERN_DIRECTORY}/uncatalogued.spec.json`, bytes: JSON.stringify(spec) }])[0].baseChartType).toBe('scatter');
    spec.marks[0].trait = 'MarkUnknown';
    expect(() => derivePatternSources([{ specPath: `${PATTERN_DIRECTORY}/uncatalogued.spec.json`, bytes: JSON.stringify(spec) }])).toThrow('supported Cartesian base mark');
    expect(() => derivePatternSources([{ specPath: source.specPath, bytes: JSON.stringify(spec) }])).toThrow('Pattern path differs from identity');
  });

  it('rejects malformed authored IR during generation before packaging it for runtime', () => {
    const source = readSources()[0]!;
    const spec = JSON.parse(source.bytes);
    delete spec.a11y;
    expect(() => derivePatternSources([{ ...source, bytes: JSON.stringify(spec) }])).toThrow('Normalized Viz Spec validation failed');
  });

  it('writes only beneath an explicit root and detects an exact authored-byte change in check mode', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'oods-pattern-sources-'));
    try {
      mkdirSync(path.join(root, PATTERN_DIRECTORY), { recursive: true });
      const source = readSources();
      for (const row of source) writeFileSync(path.join(root, row.specPath), row.bytes);
      const first = generatePatternSources({ root });
      expect(generatePatternSources({ root, check: true })).toEqual(first);
      // Whitespace has no parsed-data effect, but source provenance must move.
      writeFileSync(path.join(root, source[0]!.specPath), source[0]!.bytes + '\n');
      expect(() => generatePatternSources({ root, check: true })).toThrow('Generated pattern sources are stale');
      const next = generatePatternSources({ root });
      expect(next[0]!.spec).toEqual(first[0]!.spec);
      expect(next[0]!.specSha256).not.toBe(first[0]!.specSha256);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
