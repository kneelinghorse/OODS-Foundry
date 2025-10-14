import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { parseTrait } from '../../src/parsers/index.ts';
import { ParameterValidator } from '../../src/validation/parameter-validator.ts';
import ArchivableTraitModule from '../../traits/lifecycle/Archivable.trait.ts';

const traitDir = join(__dirname, '..', '..', 'traits', 'lifecycle');
const yamlPath = join(traitDir, 'Archivable.trait.yaml');

describe('Archivable trait', () => {
  it('parses YAML definition with archival semantics', async () => {
    const result = await parseTrait(yamlPath);

    expect(result.success).toBe(true);
    const def = result.data!;

    expect(def.trait.name).toBe('Archivable');
    expect(def.dependencies).toContain('Stateful');
    expect(def.schema.is_archived.type).toBe('boolean');
    expect(def.semantics?.archived_at?.token_mapping).toBe('tokenMap(status.archive.timestamp)');
  });

  it('exposes TypeScript retention metadata', () => {
    const def = ArchivableTraitModule;

    expect(def.parameters?.[0]?.default).toBe(30);
    expect(def.metadata?.maturity).toBe('stable');
    expect(def.tokens).toHaveProperty('status.archive.primary.bg');
  });

  it('accepts a configuration with restoration enabled', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Archivable', {
      retainHistory: true,
      restoreWindowDays: 45,
    });

    expect(result.valid).toBe(true);
    expect(result.summary.errors).toBe(0);
  });

  it('rejects restore windows when history retention is disabled', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Archivable', {
      retainHistory: false,
      restoreWindowDays: 15,
    });

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toBe(
      'restoreWindowDays is not allowed when retainHistory is false.'
    );
    expect(result.issues[0]?.location.path).toBe('/');
  });
});
