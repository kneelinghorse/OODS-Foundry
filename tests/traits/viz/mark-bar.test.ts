import { describe, it, expect } from 'vitest';
import { join } from 'node:path';

import { parseTrait } from '../../../src/parsers/index.ts';
import { ParameterValidator } from '../../../src/validation/parameter-validator.ts';
import MarkBarTrait from '../../../traits/viz/mark-bar.trait.ts';

const traitDir = join(__dirname, '..', '..', '..', 'traits', 'viz');
const yamlPath = join(traitDir, 'mark-bar.trait.yaml');

describe('MarkBar trait', () => {
  it('parses YAML definition with conflicts and dependencies', async () => {
    const result = await parseTrait(yamlPath);

    expect(result.success).toBe(true);
    const def = result.data!;

    expect(def.trait.name).toBe('MarkBar');
    expect(def.dependencies).toEqual(['EncodingPositionX', 'EncodingPositionY']);
    expect(def.metadata?.conflicts_with).toEqual(['MarkLine', 'MarkPoint', 'MarkArea']);
    expect(def.semantics?.viz_mark_orientation?.ui_hints?.component).toBe('VizOrientationBadge');
  });

  it('exposes TypeScript definition with governed tokens', () => {
    expect(MarkBarTrait.token_mapping).toBeUndefined();
    expect(MarkBarTrait.tokens).toHaveProperty('viz.mark.bar.fill.default');
    expect(MarkBarTrait.schema.viz_mark_orientation?.validation).toEqual({
      enum: ['vertical', 'horizontal'],
    });
  });

  it('accepts valid parameter payloads', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('MarkBar', {
      orientation: 'horizontal',
      bandPadding: 0.2,
      cornerRadius: 4,
      stacking: 'normalize',
    });

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects invalid parameter payloads', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('MarkBar', {
      orientation: 'diagonal',
      bandPadding: 1.2,
    });

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toMatch(/Value must be one of/);
  });
});
