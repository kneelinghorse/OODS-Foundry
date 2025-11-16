import { describe, it, expect } from 'vitest';
import { join } from 'node:path';

import { parseTrait } from '../../../src/parsers/index.ts';
import { ParameterValidator } from '../../../src/validation/parameter-validator.ts';
import LayoutConcatTrait from '../../../traits/viz/layout-concat.trait.ts';

const traitDir = join(__dirname, '..', '..', '..', 'traits', 'viz');
const yamlPath = join(traitDir, 'layout-concat.trait.yaml');

describe('LayoutConcat trait', () => {
  it('parses YAML definition', async () => {
    const result = await parseTrait(yamlPath);
    expect(result.success).toBe(true);
    const def = result.data!;

    expect(def.trait.name).toBe('LayoutConcat');
    expect(def.schema.viz_layout_direction?.validation?.enum).toContain('grid');
  });

  it('surfaces TS schema defaults', () => {
    expect(LayoutConcatTrait.schema.viz_layout_type?.default).toBe('concat');
    expect(LayoutConcatTrait.schema.viz_layout_projection?.validation?.enum).toContain(
      'polar'
    );
  });

  it('validates parameter payloads', () => {
    const validator = new ParameterValidator();
    const valid = validator.validate('LayoutConcat', {
      direction: 'horizontal',
      gap: 24,
      sharedChannels: ['color'],
      maxSections: 4,
      projection: 'cartesian',
    });

    expect(valid.valid).toBe(true);

    const invalid = validator.validate('LayoutConcat', {
      direction: 'diagonal',
      gap: -4,
    });
    expect(invalid.valid).toBe(false);
  });
});
