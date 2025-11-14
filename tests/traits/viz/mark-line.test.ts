import { describe, it, expect } from 'vitest';
import { join } from 'node:path';

import { parseTrait } from '../../../src/parsers/index.ts';
import { ParameterValidator } from '../../../src/validation/parameter-validator.ts';
import MarkLineTrait from '../../../traits/viz/mark-line.trait.ts';

const traitDir = join(__dirname, '..', '..', '..', 'traits', 'viz');
const yamlPath = join(traitDir, 'mark-line.trait.yaml');

describe('MarkLine trait', () => {
  it('parses YAML definition with preview components', async () => {
    const result = await parseTrait(yamlPath);

    expect(result.success).toBe(true);
    const def = result.data!;

    expect(def.trait.name).toBe('MarkLine');
    expect(def.view_extensions?.detail?.[0]?.component).toBe('VizLinePreview');
    expect(def.metadata?.conflicts_with).toContain('MarkBar');
  });

  it('exposes TypeScript defaults for curve + stroke width', () => {
    expect(MarkLineTrait.schema.viz_line_curve?.default).toBe('linear');
    expect(MarkLineTrait.schema.viz_line_stroke_width?.validation).toEqual({
      minimum: 1,
      maximum: 8,
    });
  });

  it('validates curve and stroke width bounds', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('MarkLine', {
      curve: 'monotone',
      strokeWidth: 3,
      join: 'round',
      enableMarkers: true,
    });

    expect(result.valid).toBe(true);
  });

  it('rejects unsupported curve names', () => {
    const validator = new ParameterValidator();
    const result = validator.validate('MarkLine', {
      curve: 'spline',
    });

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toMatch(/Value must be one of/);
  });
});
