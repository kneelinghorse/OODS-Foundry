import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { parseTrait } from '../../src/parsers/index.ts';
import { ParameterValidator } from '../../src/validation/parameter-validator.ts';
import TaggableTraitModule from '../../traits/behavioral/Taggable.trait.ts';

const traitDir = join(__dirname, '..', '..', 'traits', 'behavioral');
const yamlPath = join(traitDir, 'Taggable.trait.yaml');

describe('Taggable trait', () => {
  it('parses YAML definition with taxonomy semantics', async () => {
    const result = await parseTrait(yamlPath);

    expect(result.success).toBe(true);
    const def = result.data!;

    expect(def.trait.name).toBe('Taggable');
    expect(def.schema.tags.type).toBe('string[]');
    expect(def.semantics?.tags?.token_mapping).toBe('tokenMap(taxonomy.tag.*)');
    expect(def.view_extensions?.form?.[0]?.component).toBe('TagInput');
  });

  it('exposes TypeScript defaults and token contract', () => {
    const def = TaggableTraitModule;

    expect(def.parameters?.[0]?.default).toBe(10);
    expect(def.tokens).toHaveProperty('taxonomy.tag.chip.bg');
  });

  it('accepts a valid curated tag configuration', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Taggable', {
      maxTags: 8,
      allowCustomTags: false,
      allowedTags: ['priority', 'design', 'finance'],
      caseSensitive: false,
    });

    expect(result.valid).toBe(true);
    expect(result.summary.errors).toBe(0);
  });

  it('requires allowedTags when custom tags are disabled', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Taggable', {
      allowCustomTags: false,
    });

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toBe('Configuration for allowCustomTags is invalid.');
    expect(result.issues[0]?.location.path).toBe('/');
  });
});
