import { describe, it, expect } from 'vitest';
import { join } from 'node:path';

import { parseTrait } from '../../../src/parsers/index.ts';
import { ParameterValidator } from '../../../src/validation/parameter-validator.ts';
import MarkPointTrait from '../../../traits/viz/mark-point.trait.ts';

const traitDir = join(__dirname, '..', '..', '..', 'traits', 'viz');
const yamlPath = join(traitDir, 'mark-point.trait.yaml');

describe('MarkPoint trait', () => {
  it('parses YAML definition exposing glyph semantics', async () => {
    const result = await parseTrait(yamlPath);

    expect(result.success).toBe(true);
    const def = result.data!;

    expect(def.trait.name).toBe('MarkPoint');
    expect(def.semantics?.viz_point_shape?.semantic_type).toBe('viz.mark.shape');
    expect(def.metadata?.accessibility?.rule_reference).toBe('A11Y-R-01');
  });

  it('exposes TypeScript defaults for shape and opacity', () => {
    expect(MarkPointTrait.schema.viz_point_shape?.default).toBe('circle');
    expect(MarkPointTrait.schema.viz_point_opacity?.default).toBe(0.85);
  });

  it('accepts valid scatterplot parameter payloads', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('MarkPoint', {
      shape: 'diamond',
      size: 64,
      fill: 'hollow',
      strokeWidth: 2,
      opacity: 0.75,
    });

    expect(result.valid).toBe(true);
  });

  it('rejects invalid shape identifiers', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('MarkPoint', {
      shape: 'hexagon',
    });

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toMatch(/Value must be one of/);
  });
});
