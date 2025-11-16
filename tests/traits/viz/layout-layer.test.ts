import { describe, it, expect } from 'vitest';
import { join } from 'node:path';

import { parseTrait } from '../../../src/parsers/index.ts';
import { ParameterValidator } from '../../../src/validation/parameter-validator.ts';
import LayoutLayerTrait from '../../../traits/viz/layout-layer.trait.ts';

const traitDir = join(__dirname, '..', '..', '..', 'traits', 'viz');
const yamlPath = join(traitDir, 'layout-layer.trait.yaml');

describe('LayoutLayer trait', () => {
  it('parses YAML definition', async () => {
    const result = await parseTrait(yamlPath);
    expect(result.success).toBe(true);
    const def = result.data!;

    expect(def.trait.name).toBe('LayoutLayer');
    expect(def.schema.viz_layout_blend_mode?.validation?.enum).toContain('multiply');
  });

  it('exposes TS definition with metadata', () => {
    expect(LayoutLayerTrait.trait.tags).toContain('layer');
    expect(LayoutLayerTrait.schema.viz_layout_type?.default).toBe('layer');
  });

  it('validates parameters via generated schema', () => {
    const validator = new ParameterValidator();
    const valid = validator.validate('LayoutLayer', {
      blendMode: 'multiply',
      syncInteractions: true,
      sharedChannels: ['x', 'color'],
      orderHint: ['MarkArea', 'MarkLine'],
      projection: 'cartesian',
    });

    expect(valid.valid).toBe(true);

    const invalid = validator.validate('LayoutLayer', {
      blendMode: 'difference',
    });
    expect(invalid.valid).toBe(false);
  });
});
