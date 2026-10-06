import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

import { parseTrait } from '../../../src/parsers/index.ts';
import { ParameterValidator } from '../../../src/validation/parameter-validator.ts';
import ScaleTemporalTrait from '../../../traits/viz/scale-temporal.trait.ts';
import { validateNormalizedVizSpec, type NormalizedVizSpec } from '../../../packages/viz-core/src/spec/normalized-viz-spec.js';
import { toVegaLiteSpec } from '../../../packages/viz-core/src/adapters/vega-lite-adapter.js';
import { toEChartsOption } from '../../../packages/viz-core/src/adapters/echarts-adapter.js';
import { vizControlFields } from '../../../packages/component-contracts/src/viz-controls.js';

const traitDir = join(__dirname, '..', '..', '..', 'traits', 'viz');
const yamlPath = join(traitDir, 'scale-temporal.trait.yaml');

describe('ScaleTemporal trait', () => {
  it('parses the breaking 0.3.0 YAML definition with UTC semantics', async () => {
    const result = await parseTrait(yamlPath);

    expect(result.success).toBe(true);
    const def = result.data!;

    expect(def.trait.name).toBe('ScaleTemporal');
    expect(def.trait.version).toBe('0.3.0');
    expect(def.semantics).not.toHaveProperty('viz_scale_temporal_timezone');
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

  it('removes the unused parameter, field and bindings from both source contracts', async () => {
    const parameterSchema = JSON.parse(readFileSync(join(traitDir, '../../schemas/traits/scale-temporal.parameters.schema.json'), 'utf8'));
    const yaml = (await parseTrait(yamlPath)).data!;
    expect(parameterSchema.properties).not.toHaveProperty('timezone');
    for (const trait of [ScaleTemporalTrait, yaml]) {
      expect(trait.trait.version).toBe('0.3.0');
      expect(trait.parameters?.some(parameter => parameter.name === 'timezone')).toBe(false);
      expect(trait.schema).not.toHaveProperty('viz_scale_temporal_timezone');
      expect(JSON.stringify(trait.view_extensions)).not.toContain('timezoneField');
    }
  });

  it('rejects the removed timezone parameter while retaining UTC renderer behavior', () => {
    const validator = new ParameterValidator();
    expect(validator.validate('ScaleTemporal', {
      domainStart: '2026-01-01T00:00:00Z', domainEnd: '2026-12-31T23:59:59Z',
      rangeMin: 0, rangeMax: 1, timezone: 'America/New_York',
    }).valid).toBe(false);
    const spec: NormalizedVizSpec = {
      data: { values: [{ date: '2026-03-08T07:30:00Z', value: 4 }] },
      marks: [{ trait: 'MarkLine' }],
      encoding: { x: { field: 'date', trait: 'EncodingPositionX', scale: 'temporal' }, y: { field: 'value', trait: 'EncodingPositionY', type: 'quantitative' } },
      a11y: { description: 'A temporal chart rendered in UTC.' },
    };
    expect(validateNormalizedVizSpec(spec).valid).toBe(true);
    const attemptedOverride = structuredClone(spec);
    Object.assign(attemptedOverride.encoding.x!, { timezone: 'America/New_York' });
    expect(validateNormalizedVizSpec(attemptedOverride).valid).toBe(false);
    const vega = toVegaLiteSpec(spec);
    expect('encoding' in vega && vega.encoding.x).toMatchObject({ scale: { type: 'utc' } });
    expect(toEChartsOption(spec).useUTC).toBe(true);
    expect(vizControlFields('VizScaleControls').map(field => field.key)).toEqual(['x.field', 'x.scale']);
  });
});
