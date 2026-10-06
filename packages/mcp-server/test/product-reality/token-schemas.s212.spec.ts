/** New v1 contracts must describe real producer output and catch broken export/forced-color shapes. */
import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
const root = path.resolve(import.meta.dirname, '../../../..');
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const ajv = new Ajv({ strict: true, allErrors: true }); addFormats(ajv);
const tailwind = ajv.compile(read('schemas/tailwind-tokens.v1.json'));
const highContrast = ajv.compile(read('schemas/high-contrast-map.v1.json'));
const tokens = () => read('packages/tokens/dist/tailwind/tokens.json');
const hc = () => read('packages/tokens/src/tokens/themes/high-contrast/map.json');

describe('new token schema definitions at existing identifiers', () => {
  it('accepts the actual built export including numeric values and passthrough metadata', () => {
    const data = tokens(); expect(Object.keys(data.flat).length).toBeGreaterThan(1000);
    expect(Object.values(data.flat).some((entry: any) => typeof entry.value === 'number')).toBe(true);
    // s221-m01: Style Dictionary 5 (s220-m02, 92795f5076, #2471) keeps only token nodes; every flat entry is a tree node.
    expect(data.tokens).not.toHaveProperty('mappings');
    expect((Object.values(data.flat) as any[]).filter(entry => entry.path.reduce((node: any, key: string) => node?.[key], data.tokens)?.key !== `{${entry.path.join('.')}}`)).toEqual([]);
    expect(tailwind(data), JSON.stringify(tailwind.errors)).toBe(true);
  });
  it.each(['missing-flat', 'wrong-meta-tool', 'invalid-date', 'array-tree', 'missing-value', 'empty-path', 'wrong-variable-name', 'wrong-variable-key', 'extra-flat-field', 'wrong-schema'])('rejects Tailwind corruption: %s', mutation => {
    const data = tokens(), key = Object.keys(data.flat)[0];
    if (mutation === 'missing-flat') delete data.flat;
    if (mutation === 'wrong-meta-tool') data.meta.tool = 'unrelated-exporter';
    if (mutation === 'invalid-date') data.meta.generatedAt = 'yesterday';
    if (mutation === 'array-tree') data.tokens = [];
    if (mutation === 'missing-value') delete data.flat[key].value;
    if (mutation === 'empty-path') data.flat[key].path = [];
    if (mutation === 'wrong-variable-name') data.flat[key].cssVariable = 'missing-prefix';
    if (mutation === 'wrong-variable-key') data.cssVariables['color'] = 'red';
    if (mutation === 'extra-flat-field') data.flat[key].unrecognized = true;
    if (mutation === 'wrong-schema') data.$schema = 'https://example.invalid/schema';
    expect(tailwind(data)).toBe(false);
  });
  it('preserves the real forced-color map, including its distinct pixel width', () => {
    const data = hc(); expect(data.mappings.sys.focus.width).toBe('2px');
    expect(highContrast(data), JSON.stringify(highContrast.errors)).toBe(true);
  });
  it.each(['literal-color', 'unknown-system-color', 'width-as-color', 'negative-width', 'missing-focus', 'empty-group', 'array-group', 'wrong-schema'])('rejects HC corruption: %s', mutation => {
    const data = hc();
    if (mutation === 'literal-color') data.mappings.sys.text.primary = '#000000';
    if (mutation === 'unknown-system-color') data.mappings.sys.surface.canvas = 'Canvass';
    if (mutation === 'width-as-color') data.mappings.sys.focus.width = 'Canvas';
    if (mutation === 'negative-width') data.mappings.sys.focus.width = '-2px';
    if (mutation === 'missing-focus') delete data.mappings.sys.focus;
    if (mutation === 'empty-group') data.mappings.sys.status = {};
    if (mutation === 'array-group') data.mappings.sys.text = [];
    if (mutation === 'wrong-schema') data.$schema = 'https://example.invalid/schema';
    expect(highContrast(data)).toBe(false);
  });
  it('allows real zero values and optional type metadata without changing producer semantics', () => {
    const data = tokens(), first = Object.values(data.flat)[0] as any;
    first.value = 0; first.originalValue = null; first.type = 'number';
    expect(tailwind(data), JSON.stringify(tailwind.errors)).toBe(true);
    const map = hc(); map.mappings.sys.focus.width = '0';
    expect(highContrast(map), JSON.stringify(highContrast.errors)).toBe(true);
  });
});
