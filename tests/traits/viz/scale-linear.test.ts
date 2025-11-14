import { describe, it, expect } from 'vitest';
import { join } from 'node:path';

import { parseTrait } from '../../../src/parsers/index.ts';
import { ParameterValidator } from '../../../src/validation/parameter-validator.ts';
import ScaleLinearTrait from '../../../traits/viz/scale-linear.trait.ts';

const traitDir = join(__dirname, '..', '..', '..', 'traits', 'viz');
const yamlPath = join(traitDir, 'scale-linear.trait.yaml');

describe('ScaleLinear trait', () => {
  it('parses YAML definition with domain semantics', async () => {
    const result = await parseTrait(yamlPath);

    expect(result.success).toBe(true);
    const def = result.data!;

    expect(def.trait.name).toBe('ScaleLinear');
    expect(def.semantics?.viz_scale_linear_domain_min?.ui_hints?.component).toBe('NumericPreview');
    expect(def.metadata?.allows).toContain('EncodingPositionX');
  });

  it('exposes TypeScript defaults for domain + mode', () => {
    expect(ScaleLinearTrait.schema.viz_scale_linear_domain_min?.default).toBe(0);
    expect(ScaleLinearTrait.schema.viz_scale_linear_mode?.default).toBe('continuous');
  });

  it('validates scale bounds payloads', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('ScaleLinear', {
      domainMin: 0,
      domainMax: 100,
      rangeMin: 0,
      rangeMax: 1,
      mode: 'continuous',
    });

    expect(result.valid).toBe(true);
  });

  it('rejects invalid mode identifiers', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('ScaleLinear', {
      domainMin: 0,
      domainMax: 1,
      rangeMin: 0,
      rangeMax: 1,
      mode: 'log',
    });

    expect(result.valid).toBe(false);
  });
});
