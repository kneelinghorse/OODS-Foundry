import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseTrait } from '../../../src/parsers/index.ts';
import { ParameterValidator } from '../../../src/validation/parameter-validator.ts';
import InteractionHighlightTrait from '../../../traits/viz/interaction-highlight.trait.ts';

const traitDir = join(__dirname, '..', '..', '..', 'traits', 'viz');
const yamlPath = join(traitDir, 'interaction-highlight.trait.yaml');

describe('InteractionHighlight trait', () => {
  it('parses YAML definition with schema + state machine', async () => {
    const result = await parseTrait(yamlPath);

    expect(result.success).toBe(true);
    const def = result.data!;
    expect(def.trait.name).toBe('InteractionHighlight');
    expect(def.schema).toHaveProperty('viz_interaction_highlight_property');
    expect(def.state_machine?.states).toContain('highlighted');
  });

  it('exposes TypeScript definition with defaults', () => {
    expect(InteractionHighlightTrait.schema.viz_interaction_highlight_trigger?.defaultFromParameter).toBe('trigger');
    expect(InteractionHighlightTrait.parameters?.[0]?.name).toBe('fields');
  });

  it('validates parameter payloads', () => {
    const validator = new ParameterValidator();
    const valid = validator.validate('InteractionHighlight', {
      fields: ['region'],
      trigger: 'hover',
      property: 'strokeWidth',
      activeValue: 1,
      inactiveValue: 0.3,
    });

    expect(valid.valid).toBe(true);

    const invalid = validator.validate('InteractionHighlight', {
      trigger: 'hover',
    });

    expect(invalid.valid).toBe(false);
  });
});
