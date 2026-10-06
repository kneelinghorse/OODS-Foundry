import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { defaultVizIntent, VIZ_CONTROL_IDS, VIZ_PREVIEW_TYPES } from '@oods/component-contracts';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { loadObject } from '../../src/objects/object-loader.js';
import type { UiElement } from '../../src/schemas/generated.js';
const root = path.resolve(import.meta.dirname, '../../../..');
const samples = JSON.parse(fs.readFileSync(path.join(root, 'packages/component-contracts/fixtures/viz-preview-samples.v1.json'), 'utf8'));
const fixtures = [
  ['MarkArea', 'VizAreaControls', ['VizAreaControls', 'VizRoleBadge']],
  ['MarkBar', 'VizMarkControls', ['VizMarkControls', 'VizMarkPreview', 'VizRoleBadge']],
  ['MarkLine', 'VizLineControls', ['VizLineControls', 'VizLinePreview', 'VizRoleBadge']],
  ['MarkPoint', 'VizPointControls', ['VizPointControls', 'VizPointPreview', 'VizRoleBadge']],
  ['MarkRect', 'VizHeatmapControls', ['VizHeatmapControls', 'VizHeatmapPreview']],
  ['ScatterPlot', 'VizScatterControls', ['VizScatterControls', 'VizScatterPreview']],
  ['EncodingPositionX', 'VizAxisControls', ['VizAxisControls', 'VizAxisSummary', 'VizEncodingBadge']],
  ['EncodingColor', 'VizColorControls', ['VizColorControls', 'VizColorLegendConfig', 'VizEncodingBadge']],
  ['EncodingSize', 'VizSizeControls', ['VizSizeControls', 'VizSizeSummary', 'VizEncodingBadge']],
  ['EncodingShape', 'VizShapeControls', ['VizShapeControls', 'VizShapeLegend']],
  ['EncodingOpacity', 'VizOpacityControls', ['VizOpacityControls', 'VizOpacitySummary']],
  ['ScaleLinear', 'VizScaleControls', ['VizScaleControls', 'VizScaleSummary']],
] as const;
vi.mock('../../src/objects/object-loader.js', async importOriginal => {
  const original = await importOriginal<typeof import('../../src/objects/object-loader.js')>();
  return { ...original, loadObject(name: string) {
    if (!name.startsWith('S193Viz')) return original.loadObject(name);
    const fixture = fixtures.find(([trait]) => name === `S193Viz${trait}`);
    if (!fixture) throw new Error(`Unknown bounded fixture ${name}`);
    const object = structuredClone(original.loadObject('Product')); object.object.name = name;
    const preview = fixture[2].find(id => Object.hasOwn(VIZ_PREVIEW_TYPES, id));
    object.traits.push({ name: `viz/${fixture[0]}`, parameters: { renderIntent: JSON.stringify(defaultVizIntent(fixture[1])), ...(preview ? { previewSvg: samples.samples[preview].svg } : {}) } });
    return object;
  } };
});
const nodes = (roots: UiElement[]): UiElement[] => roots.flatMap(node => [node, ...nodes(node.children ?? [])]);

describe('Viz recipes are declared by real traits, without editing composed schemas', () => {
  it.each(fixtures)('%s places and generates its declared input/preview recipes', async (trait, _control, expected) => {
    const seen = new Set<string>();
    for (const context of ['form', 'detail', 'list'] as const) {
      const result = await compose({ object: `S193Viz${trait}`, context });
      expect(result.status, JSON.stringify(result.warnings)).toBe('ok');
      const before = JSON.stringify(result.schema);
      for (const node of nodes(result.schema.screens)) {
        if (!expected.includes(node.component as never)) continue;
        seen.add(node.component);
        if ((VIZ_CONTROL_IDS as readonly string[]).includes(node.component)) {
          expect(context, `${node.component} must not become an editor on a read-only detail/list`).toBe('form');
          expect(node.bindings?.onChange).toBe(`handle${node.component}Change`);
          expect(node.props?.value).toEqual(defaultVizIntent(_control));
        }
        if (Object.hasOwn(VIZ_PREVIEW_TYPES, node.component)) expect(node.props?.svg).toBe(samples.samples[node.component].svg);
      }
      for (const framework of ['react', 'vue'] as const) {
        const generated = await generate({ schema: result.schema, framework, profile: 'build' });
        expect(generated.status, JSON.stringify(generated.errors)).toBe('ok');
        expect(generated.artifact?.files.length).toBeGreaterThan(0);
      }
      expect(JSON.stringify(result.schema)).toBe(before);
    }
    expect([...seen].sort()).toEqual([...expected].sort());
  });
  it('the bounded fixtures collectively place all 25 new identities; the bound public payment chart stays unchanged', async () => {
    expect(new Set(fixtures.flatMap(fixture => [...fixture[2]])).size).toBe(25);
    expect(loadObject('Product').traits.some(trait => trait.name.startsWith('viz/'))).toBe(false);
    const form = await compose({ object: 'Subscription', context: 'form' });
    expect(nodes(form.schema.screens).some(node => node.component.startsWith('Viz'))).toBe(false);
    const detail = await compose({ object: 'Subscription', context: 'detail' });
    // s220-m01: the bound payment chart is bars (VizMarkPreview), still exactly one on the detail.
    expect(nodes(detail.schema.screens).filter(node => node.component === 'VizMarkPreview')).toHaveLength(1);
  });
});

describe('Authoring parameters fail before unsupported intent can reach generated code', () => {
  it('rejects malformed JSON, unsupported bindings, and scalar coercion while preserving zero opacity', async () => {
    const { resolveTraitRecipeProps } = await import('../../src/compose/trait-recipes.js');
    const resolve = (value: unknown) => resolveTraitRecipeProps({ ref: { parameters: { renderIntent: value } }, definition: { parameters: [] } } as never, { component: 'VizOpacityControls', props: { intentParameter: 'renderIntent' } } as never);
    expect(() => resolve('{')).toThrow();
    expect(() => resolve('{"encodings":{"z":{"field":"x"}}}')).toThrow(/supported Cartesian/);
    expect(() => resolve({ opacity: 0 })).toThrow(/JSON-encoded/);
    expect(resolve('{"opacity":0}').value).toEqual({ opacity: 0 });
  });
});
