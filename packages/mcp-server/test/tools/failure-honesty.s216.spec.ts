import fs from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import * as catalogSource from '../../src/tools/catalog.shared.js';
import * as traits from '../../src/objects/trait-loader.js';
import * as renderer from '@oods/viz-render';
import { renderDocument, resetTokensCssCache } from '../../src/render/document.js';
import { loadMeasureRegistry, resetMeasureRegistryCache } from '../../src/tools/measure-registry.js';
import { composeObject } from '../../src/objects/trait-composer.js';
import { loadObject } from '../../src/objects/object-loader.js';
import { handle as catalog } from '../../src/tools/catalog.list.js';
import { handle as viz } from '../../src/tools/viz.render.js';
import { handle as certify } from '../../src/tools/artifact.certify.js';
import { ToolError } from '../../src/errors/tool-error.js';
afterEach(() => { vi.restoreAllMocks(); resetTokensCssCache(); resetMeasureRegistryCache(); });
function unreadable(suffix: string) {
  const read = fs.readFileSync;
  vi.spyOn(fs, 'readFileSync').mockImplementation(((file: any, ...args: any[]) => {
    if (String(file).endsWith(suffix)) throw new Error('missing fixture file');
    return (read as any)(file, ...args);
  }) as any);
}
it('a full page cannot silently omit unavailable tokens', () => {
  resetTokensCssCache(); unreadable('/dist/css/tokens.css');
  expect(() => renderDocument({ screenHtml: '<main>Hello</main>' })).toThrow(/token/i);
});
it('a missing measure registry is an explicit registry error rather than an empty map', () => {
  resetMeasureRegistryCache(); unreadable('/schemas/measure-registry.json');
  expect(() => loadMeasureRegistry()).toThrow(/registry/i);
});
it('a typed catalog cause survives its public boundary', async () => {
  vi.spyOn(catalogSource, 'readComponentsDataset').mockImplementation(() => { throw new ToolError('OODS-N014', 'missing catalog'); });
  await expect(catalog({})).rejects.toMatchObject({ opiCode: 'OODS-N014' });
});
it('an unavailable required trait cannot produce a partially composed object', () => {
  const object = loadObject('User');
  vi.spyOn(traits, 'loadTrait').mockImplementation(() => { throw new Error('trait unavailable'); });
  expect(() => composeObject(object)).toThrow(/trait.*unavailable/i);
});
it.each(['light', 'dark'] as const)('%s certification names an actual render failure', async theme => {
  const rendered = await viz({ chartType: 'bar', rows: [{ x: 'A', y: 3 }], encodings: { x: { field: 'x', type: 'nominal' }, y: { field: 'y', type: 'quantitative' } }, output: { includeNormalizedSpec: true } });
  const real = renderer.renderVegaLiteToSvg;
  vi.spyOn(renderer, 'renderVegaLiteToSvg').mockImplementationOnce(real).mockRejectedValue(new Error('render fault s216'));
  const result = await certify({ spec: rendered.normalizedSpec!, theme });
  expect(result.determinism?.stable).toBe(false);
  expect(JSON.stringify(result.notes)).toContain('render fault s216');
});
