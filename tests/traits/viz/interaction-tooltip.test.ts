import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseTrait } from '../../../src/parsers/index.ts';
import { ParameterValidator } from '../../../src/validation/parameter-validator.ts';
import InteractionTooltipTrait from '../../../traits/viz/interaction-tooltip.trait.ts';

const traitDir = join(__dirname, '..', '..', '..', 'traits', 'viz');
const yamlPath = join(traitDir, 'interaction-tooltip.trait.yaml');

describe('InteractionTooltip trait', () => {
  it('parses YAML definition', async () => {
    const result = await parseTrait(yamlPath);

    expect(result.success).toBe(true);
    const def = result.data!;
    expect(def.trait.name).toBe('InteractionTooltip');
    expect(def.schema).toHaveProperty('viz_interaction_tooltip_fields');
    expect(def.state_machine?.states).toContain('visible');
  });

  it('exports TypeScript definition with semantic hints', () => {
    expect(InteractionTooltipTrait.semantics?.viz_interaction_tooltip_trigger?.ui_hints?.component).toBe('Badge');
  });

  it('validates tooltip parameters', () => {
    const validator = new ParameterValidator();
    const valid = validator.validate('InteractionTooltip', {
      fields: ['region', 'mrr'],
      trigger: 'focus',
      alignment: 'top',
    });

    expect(valid.valid).toBe(true);

    const invalid = validator.validate('InteractionTooltip', {
      trigger: 'hover',
    });

    expect(invalid.valid).toBe(false);
  });
});
