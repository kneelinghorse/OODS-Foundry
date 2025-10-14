import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { parseTrait } from '../../src/parsers/index.ts';
import { ParameterValidator } from '../../src/validation/parameter-validator.ts';
import ColorizedTraitModule from '../../traits/visual/Colorized.trait.ts';

const traitDir = join(__dirname, '..', '..', 'traits', 'visual');
const yamlPath = join(traitDir, 'Colorized.trait.yaml');

describe('Colorized trait', () => {
  it('parses YAML definition with dependency on Stateful', async () => {
    const result = await parseTrait(yamlPath);

    expect(result.success).toBe(true);
    const def = result.data!;

    expect(def.trait.name).toBe('Colorized');
    expect(def.dependencies).toContain('Stateful');
    expect(def.semantics?.color_state?.token_mapping).toBe('tokenMap(status.state.*)');
    expect(def.view_extensions?.form?.[0]?.component).toBe('ColorStatePicker');
  });

  it('parses TypeScript definition exposing readonly color state tokens', () => {
    const def = ColorizedTraitModule;

    expect(def.parameters?.[0]?.default).toEqual(['neutral', 'info', 'success', 'warning', 'danger']);
    expect(def.tokens).toHaveProperty('status.state.badge.radius');
  });

  it('accepts a curated color state list', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Colorized', {
      colorStates: ['neutral', 'info', 'success'],
    });

    expect(result.valid).toBe(true);
    expect(result.summary.errors).toBe(0);
  });

  it('rejects duplicate color states for violating uniqueness', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Colorized', {
      colorStates: ['neutral', 'neutral'],
    });

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain('Each color state must be unique');
    expect(result.issues[0]?.location.path).toBe('/colorStates');
  });
});
