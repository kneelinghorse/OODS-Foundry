import { describe, it, expect } from 'vitest';
import { join } from 'node:path';

import { parseTrait } from '../../../src/parsers/index.ts';
import { ParameterValidator } from '../../../src/validation/parameter-validator.ts';
import EncodingPositionYTrait from '../../../traits/viz/encoding-position-y.trait.ts';

const traitDir = join(__dirname, '..', '..', '..', 'traits', 'viz');
const yamlPath = join(traitDir, 'encoding-position-y.trait.yaml');

describe('EncodingPositionY trait', () => {
  it('parses YAML definition with aggregation semantics', async () => {
    const result = await parseTrait(yamlPath);

    expect(result.success).toBe(true);
    const def = result.data!;

    expect(def.trait.name).toBe('EncodingPositionY');
    expect(def.semantics?.viz_encoding_y_aggregate?.semantic_type).toBe('viz.encoding.aggregate');
    expect(def.metadata?.allows).toContain('MarkBar');
  });

  it('exposes TypeScript defaults for aggregate + scale', () => {
    expect(EncodingPositionYTrait.schema.viz_encoding_y_aggregate?.default).toBe('sum');
    expect(EncodingPositionYTrait.schema.viz_encoding_y_scale?.default).toBe('linear');
  });

  it('validates aggregation payloads', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('EncodingPositionY', {
      fieldKinds: ['quantitative'],
      defaultScale: 'linear',
      aggregate: 'mean',
    });

    expect(result.valid).toBe(true);
  });

  it('rejects invalid aggregation keywords', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('EncodingPositionY', {
      fieldKinds: ['quantitative'],
      defaultScale: 'linear',
      aggregate: 'mode',
    });

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toMatch(/Value must be one of/);
  });
});
