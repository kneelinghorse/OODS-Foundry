import { describe, it, expect } from 'vitest';
import { join } from 'node:path';

import { parseTrait } from '../../../src/parsers/index.ts';
import { ParameterValidator } from '../../../src/validation/parameter-validator.ts';
import ScaleTemporalTrait from '../../../traits/viz/scale-temporal.trait.ts';

const traitDir = join(__dirname, '..', '..', '..', 'traits', 'viz');
const yamlPath = join(traitDir, 'scale-temporal.trait.yaml');

describe('ScaleTemporal trait', () => {
  it('parses YAML definition with timezone semantics', async () => {
    const result = await parseTrait(yamlPath);

    expect(result.success).toBe(true);
    const def = result.data!;

    expect(def.trait.name).toBe('ScaleTemporal');
    expect(def.semantics?.viz_scale_temporal_timezone?.semantic_type).toBe('viz.scale.timezone');
    expect(def.view_extensions?.detail?.[0]?.props?.type).toBe('temporal');
  });

  it('exposes TypeScript defaults for nice interval + format', () => {
    expect(ScaleTemporalTrait.schema.viz_scale_temporal_nice?.default).toBe('month');
    expect(ScaleTemporalTrait.schema.viz_scale_temporal_output_format?.default).toBe('YYYY-MM-DD');
  });

  it('validates temporal scale payloads', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('ScaleTemporal', {
      domainStart: '2025-01-01T00:00:00Z',
      domainEnd: '2025-01-31T23:59:59Z',
      rangeMin: 0,
      rangeMax: 1,
      timezone: 'America/New_York',
      nice: 'week',
      outputFormat: 'MMM d'
    });

    expect(result.valid).toBe(true);
  });

  it('rejects invalid nice interval names', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('ScaleTemporal', {
      domainStart: '2025-01-01T00:00:00Z',
      domainEnd: '2025-01-31T23:59:59Z',
      rangeMin: 0,
      rangeMax: 1,
      nice: 'hour'
    });

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toMatch(/Value must be one of/);
  });
});
