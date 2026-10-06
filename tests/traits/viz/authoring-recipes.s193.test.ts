import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { parseTrait } from '../../../src/parsers/index.ts';

const names = ['encoding-color', 'encoding-position-x', 'encoding-position-y', 'encoding-size', 'encoding-opacity', 'encoding-shape', 'mark-area', 'mark-bar', 'mark-line', 'mark-point', 'mark-rect', 'scatter-plot', 'scale-linear', 'scale-temporal'];
describe('Visualization authoring traits retain equivalent typed input directives in both sources', () => {
  it.each(names)('%s parses and connects every authoring input/SVG directive to a declared parameter', async name => {
    const result = await parseTrait(join(import.meta.dirname, '../../../traits/viz', `${name}.trait.yaml`));
    expect(result.success, JSON.stringify(result.errors)).toBe(true);
    const ts = (await import(`../../../traits/viz/${name}.trait.ts`)).default;
    const yaml = result.data!;
    for (const trait of [ts, yaml]) {
      const intent = trait.parameters.find((parameter: { name: string }) => parameter.name === 'renderIntent');
      expect(intent).toMatchObject({ type: 'string', default: '{}' });
      for (const extension of Object.values(trait.view_extensions ?? {}).flat() as Array<{ props?: Record<string, string> }>) {
        for (const key of ['intentParameter', 'svgParameter']) {
          const parameter = extension.props?.[key];
          if (parameter) expect(trait.parameters.some((row: { name: string; type: string }) => row.name === parameter && row.type === 'string')).toBe(true);
        }
      }
    }
    expect(yaml.view_extensions).toEqual(ts.view_extensions);
  });
});
