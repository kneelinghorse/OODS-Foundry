import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { parseTrait } from '../../src/parsers/index.ts';
import { ParameterValidator } from '../../src/validation/parameter-validator.ts';
import LabelledTraitModule from '../../traits/content/Labelled.trait.ts';

const traitDir = join(__dirname, '..', '..', 'traits', 'content');
const yamlPath = join(traitDir, 'Labelled.trait.yaml');

describe('Labelled trait', () => {
  it('parses YAML definition with semantic text mappings', async () => {
    const result = await parseTrait(yamlPath);

    expect(result.success).toBe(true);
    const def = result.data!;

    expect(def.trait.name).toBe('Labelled');
    expect(def.schema.label.required).toBe(true);
    expect(def.semantics?.label?.token_mapping).toBe('tokenMap(text.label.*)');
    expect(def.view_extensions?.inline?.[0]?.component).toBe('InlineLabel');
  });

  it('parses TypeScript definition and exposes documentation metadata', () => {
    const def = LabelledTraitModule;

    expect(def.metadata?.owners).toContain('uxcopy@oods.systems');
    expect(def.tokens).toHaveProperty('text.placeholder.default.color');
  });

  it('treats an empty parameter object as valid', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Labelled', {});

    expect(result.valid).toBe(true);
    expect(result.summary.errors).toBe(0);
  });

  it('rejects unknown parameter keys', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Labelled', {
      unexpected: true,
    });

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toBe("Unknown property 'unexpected'");
    expect(result.issues[0]?.location.path).toBe('/');
  });
});
