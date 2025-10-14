import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { parseTrait } from '../../src/parsers/index.ts';
import { ParameterValidator } from '../../src/validation/parameter-validator.ts';
import StatefulTraitModule from '../../traits/lifecycle/Stateful.trait.ts';

const traitDir = join(__dirname, '..', '..', 'traits', 'lifecycle');
const yamlPath = join(traitDir, 'Stateful.trait.yaml');

describe('Stateful trait', () => {
  it('parses YAML definition with canonical schema and semantics', async () => {
    const result = await parseTrait(yamlPath);

    expect(result.success).toBe(true);
    const def = result.data!;

    expect(def.trait.name).toBe('Stateful');
    expect(def.parameters).toBeDefined();
    const statesParam = def.parameters?.find((param) => param.name === 'states');
    expect(statesParam?.type).toBe('string[]');
    const initialStateParam = def.parameters?.find((param) => param.name === 'initialState');
    expect(initialStateParam?.type).toBe('string');

    expect(def.schema.status.validation).toMatchObject({ enumFromParameter: 'states' });
    expect(def.semantics?.status?.token_mapping).toBe('tokenMap(status.state.*)');
    expect(def.view_extensions?.timeline?.[0]?.component).toBe('StateTransitionEvent');
  });

  it('parses TypeScript definition preserving `as const` defaults', () => {
    const def = StatefulTraitModule;

    expect(def.parameters?.[0]?.default).toEqual(['draft', 'active', 'paused', 'archived']);
    expect(def.tokens).toHaveProperty('status.state.default.bg');
    expect(def.tokens).toHaveProperty('status.timeline.connector');
  });

  it('validates a compliant parameter payload', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Stateful', {
      states: ['draft', 'active', 'archived'],
      initialState: 'draft',
    });

    expect(result.valid).toBe(true);
    expect(result.summary.errors).toBe(0);
  });

  it('rejects an initial state that is not declared', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('Stateful', {
      states: ['draft', 'active', 'archived'],
      initialState: 'paused',
    });

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toBe('Initial state must match one of the declared states.');
    expect(result.issues[0]?.location.path).toBe('/initialState');
  });
});
