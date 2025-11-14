import { describe, it, expect } from 'vitest';
import { join } from 'node:path';

import { parseTrait } from '../../../src/parsers/index.ts';
import { ParameterValidator } from '../../../src/validation/parameter-validator.ts';
import EncodingPositionXTrait from '../../../traits/viz/encoding-position-x.trait.ts';

const traitDir = join(__dirname, '..', '..', '..', 'traits', 'viz');
const yamlPath = join(traitDir, 'encoding-position-x.trait.yaml');

describe('EncodingPositionX trait', () => {
  it('parses YAML definition with axis controls', async () => {
    const result = await parseTrait(yamlPath);

    expect(result.success).toBe(true);
    const def = result.data!;

    expect(def.trait.name).toBe('EncodingPositionX');
    expect(def.view_extensions?.form?.[0]?.component).toBe('VizAxisControls');
    expect(def.dependencies?.[0]).toBe('ScaleLinear');
  });

  it('exposes TypeScript schema defaults', () => {
    expect(EncodingPositionXTrait.schema.viz_encoding_x_scale?.default).toBe('linear');
    expect(EncodingPositionXTrait.schema.viz_encoding_x_sort?.default).toBe('none');
  });

  it('validates axis configuration payloads', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('EncodingPositionX', {
      fieldKinds: ['nominal', 'quantitative'],
      defaultScale: 'linear',
      axisTitle: 'Region',
      sorting: 'ascending',
    });

    expect(result.valid).toBe(true);
  });

  it('rejects unsupported scale identifiers', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('EncodingPositionX', {
      fieldKinds: ['nominal'],
      defaultScale: 'log',
    });

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toMatch(/Value must be one of/);
  });
});
