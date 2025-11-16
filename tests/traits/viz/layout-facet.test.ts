import { describe, it, expect } from 'vitest';
import { join } from 'node:path';

import { parseTrait } from '../../../src/parsers/index.ts';
import { ParameterValidator } from '../../../src/validation/parameter-validator.ts';
import LayoutFacetTrait from '../../../traits/viz/layout-facet.trait.ts';

const traitDir = join(__dirname, '..', '..', '..', 'traits', 'viz');
const yamlPath = join(traitDir, 'layout-facet.trait.yaml');

describe('LayoutFacet trait', () => {
  it('parses YAML definition with schema mappings', async () => {
    const result = await parseTrait(yamlPath);

    expect(result.success).toBe(true);
    const def = result.data!;

    expect(def.trait.name).toBe('LayoutFacet');
    expect(def.schema.viz_layout_rows_field?.description).toContain('facet rows');
    expect(def.schema.viz_layout_projection?.validation?.enum).toContain('cartesian');
  });

  it('exposes TypeScript definition with semantic hints', () => {
    expect(LayoutFacetTrait.semantics?.viz_layout_shared_channels?.ui_hints?.component).toBe(
      'ListSummary'
    );
    expect(LayoutFacetTrait.schema.viz_layout_type?.default).toBe('facet');
  });

  it('validates parameter payloads through the generator schema', () => {
    const validator = new ParameterValidator();
    const valid = validator.validate('LayoutFacet', {
      rowField: 'region',
      columnField: 'segment',
      wrapDirection: 'row',
      maxPanels: 6,
      sharedChannels: ['x', 'color'],
      projection: 'cartesian',
    });

    expect(valid.valid).toBe(true);
    expect(valid.issues).toHaveLength(0);

    const invalid = validator.validate('LayoutFacet', {
      wrapDirection: 'diagonal',
    });

    expect(invalid.valid).toBe(false);
  });
});
