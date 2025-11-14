import { describe, it, expect } from 'vitest';
import { join } from 'node:path';

import { parseTrait } from '../../../src/parsers/index.ts';
import { ParameterValidator } from '../../../src/validation/parameter-validator.ts';
import EncodingColorTrait from '../../../traits/viz/encoding-color.trait.ts';

const traitDir = join(__dirname, '..', '..', '..', 'traits', 'viz');
const yamlPath = join(traitDir, 'encoding-color.trait.yaml');

describe('EncodingColor trait', () => {
  it('parses YAML definition with redundancy metadata', async () => {
    const result = await parseTrait(yamlPath);

    expect(result.success).toBe(true);
    const def = result.data!;

    expect(def.trait.name).toBe('EncodingColor');
    expect(def.schema.viz_encoding_color_redundancy.validation?.enum).toEqual([
      'texture',
      'shape',
      'label',
    ]);
    expect(def.metadata?.accessibility?.rule_reference).toBe('A11Y-R-01');
  });

  it('exposes TypeScript palette defaults', () => {
    expect(EncodingColorTrait.schema.viz_encoding_color_scheme?.default).toBe('categorical');
    expect(EncodingColorTrait.tokens).toHaveProperty('viz.encoding.color.palette.diverging');
  });

  it('validates redundancy + contrast payloads', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('EncodingColor', {
      supportedSchemes: ['categorical', 'sequential'],
      defaultScheme: 'categorical',
      redundancyMechanism: 'texture',
      minContrast: 4.8,
      channel: 'fill',
    });

    expect(result.valid).toBe(true);
  });

  it('rejects unsupported palette categories', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('EncodingColor', {
      supportedSchemes: ['categorical'],
      defaultScheme: 'heat',
      redundancyMechanism: 'label',
    });

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toMatch(/Value must be one of/);
  });
});
