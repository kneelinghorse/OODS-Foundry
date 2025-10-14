import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { parseTrait } from '../../src/parsers/index.ts';
import { ParameterValidator } from '../../src/validation/parameter-validator.ts';
import CancellableTraitModule from '../../traits/lifecycle/Cancellable.trait.ts';

const traitDir = join(__dirname, '..', '..', 'traits', 'lifecycle');
const yamlPath = join(traitDir, 'Cancellable.trait.yaml');

describe('Cancellable trait', () => {
  it('parses YAML definition with lifecycle dependency', async () => {
    const result = await parseTrait(yamlPath);

    expect(result.success).toBe(true);
    const def = result.data!;

    expect(def.trait.name).toBe('Cancellable');
    expect(def.dependencies).toContain('Stateful');
    expect(def.semantics?.cancel_at_period_end?.token_mapping).toBe('tokenMap(status.cancel.*)');
    expect(def.view_extensions?.detail?.[0]?.component).toBe('CancellationSummary');
  });

  it('exposes TypeScript parameter validation linkage', () => {
    const def = CancellableTraitModule;

    expect(def.parameters?.[2]?.name).toBe('requireReason');
    expect(def.schema.cancellation_reason_code?.validation).toMatchObject({
      enumFromParameter: 'allowedReasons',
    });
  });

  it('accepts cancellation parameters within configured window', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Cancellable', {
      allowCancellationAfterStart: true,
      cancellationWindowHours: 48,
    });

    expect(result.valid).toBe(true);
    expect(result.summary.errors).toBe(0);
  });

  it('rejects missing reasons when requireReason is enabled', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Cancellable', {
      requireReason: true,
    });

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toBe('Cancellation reason configuration is incomplete.');
    expect(result.issues[0]?.location.path).toBe('/');
  });
});
