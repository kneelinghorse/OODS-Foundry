import { describe, it, expect } from 'vitest';
import { join } from 'node:path';

import { parseTrait } from '../../../src/parsers/index.ts';
import { ParameterValidator } from '../../../src/validation/parameter-validator.ts';
import MarkAreaTrait from '../../../traits/viz/mark-area.trait.ts';

const traitDir = join(__dirname, '..', '..', '..', 'traits', 'viz');
const yamlPath = join(traitDir, 'mark-area.trait.yaml');

describe('MarkArea trait', () => {
  it('parses YAML definition that enforces baseline semantics', async () => {
    const result = await parseTrait(yamlPath);

    expect(result.success).toBe(true);
    const def = result.data!;

    expect(def.trait.name).toBe('MarkArea');
    expect(def.schema.viz_area_baseline.validation?.enum).toEqual(['zero', 'min']);
    expect(def.view_extensions?.detail?.[0]?.component).toBe('VizAreaPreview');
  });

  it('exposes TypeScript defaults for opacity and curve', () => {
    expect(MarkAreaTrait.schema.viz_area_opacity?.default).toBe(0.65);
    expect(MarkAreaTrait.schema.viz_area_curve?.default).toBe('linear');
  });

  it('accepts valid parameter payloads', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('MarkArea', {
      curve: 'step',
      opacity: 0.8,
      baseline: 'zero',
      tension: 0.25,
    });

    expect(result.valid).toBe(true);
  });

  it('rejects opacity outside the governed range', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('MarkArea', {
      opacity: 1.5,
    });

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toMatch(/<= 1/);
  });
});
