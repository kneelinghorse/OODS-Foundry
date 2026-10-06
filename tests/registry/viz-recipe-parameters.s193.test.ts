import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TraitLoader } from '../../src/registry/trait-loader.js';
import { TraitResolver } from '../../src/registry/resolver.js';

const names = [
  'EncodingColor', 'EncodingOpacity', 'EncodingPositionX', 'EncodingPositionY',
  'EncodingShape', 'EncodingSize', 'MarkArea', 'MarkBar', 'MarkLine', 'MarkPoint',
  'MarkRect', 'ScaleLinear', 'ScaleTemporal', 'ScatterPlot',
];

describe('visualization authoring parameters through the canonical trait resolver', () => {
  it.each(names)('%s accepts its authored intent without weakening unknown-property validation', async name => {
    const loader = new TraitLoader({ roots: [path.resolve('traits')] });
    const resolver = new TraitResolver({ loader });
    const parameters = { renderIntent: '{"chartType":"bar"}' };
    const [resolved] = await resolver.resolveReferences([{ name: `viz/${name}`, parameters }]);
    expect(resolved.parameters.renderIntent).toBe(parameters.renderIntent);
    if (resolved.definition.parameters?.some(parameter => parameter.name === 'previewSvg')) {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sample" />';
      const [preview] = await resolver.resolveReferences([{ name: `viz/${name}`, parameters: { ...parameters, previewSvg: svg } }]);
      expect(preview.parameters.previewSvg).toBe(svg);
    }
    await expect(resolver.resolveReferences([{ name: `viz/${name}`, parameters: { ...parameters, undeclaredAuthoringParameter: true } }]))
      .rejects.toThrow("Unknown property 'undeclaredAuthoringParameter'");
  });
});
