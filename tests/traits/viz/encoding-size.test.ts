import { describe, it, expect } from 'vitest';
import { join } from 'node:path';

import { parseTrait } from '../../../src/parsers/index.ts';
import { ParameterValidator } from '../../../src/validation/parameter-validator.ts';
import EncodingSizeTrait from '../../../traits/viz/encoding-size.trait.ts';

const traitDir = join(__dirname, '..', '..', '..', 'traits', 'viz');
const yamlPath = join(traitDir, 'encoding-size.trait.yaml');

describe('EncodingSize trait', () => {
  it('parses YAML definition describing perceptual ranges', async () => {
    const result = await parseTrait(yamlPath);

    expect(result.success).toBe(true);
    const def = result.data!;

    expect(def.trait.name).toBe('EncodingSize');
    expect(def.schema.viz_encoding_size_range_min.defaultFromParameter).toBe('rangeMin');
    expect(def.metadata?.accessibility?.rule_reference).toBe('A11Y-R-02');
  });

  it('exposes TypeScript defaults for strategy + max size', () => {
    expect(EncodingSizeTrait.schema.viz_encoding_size_strategy?.default).toBe('area');
    expect(EncodingSizeTrait.schema.viz_encoding_size_range_max?.default).toBe(36);
  });

  it('validates governed size configuration', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('EncodingSize', {
      rangeMin: 8,
      rangeMax: 40,
      strategy: 'radius',
      minPixelArea: 64,
      maxPixelArea: 400,
    });

    expect(result.valid).toBe(true);
  });

  it('rejects range values outside allowed bounds', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('EncodingSize', {
      rangeMin: 40,
      rangeMax: 6,
      strategy: 'area',
    });

    expect(result.valid).toBe(false);
  });
});
