import { describe, expect, it } from 'vitest';
import { generateSpatialScaffold } from '@/viz/patterns/spatial-scaffold.js';

describe('spatial scaffold generation', () => {
  it('builds choropleth scaffold with region/value fields and a11y defaults', () => {
    const output = generateSpatialScaffold({
      type: 'choropleth',
      regionField: 'state',
      valueField: 'cases',
      geoSource: 'us-states.topojson',
    });

    expect(output).toContain('ChoroplethMap');
    expect(output).toContain('state');
    expect(output).toContain('cases');
    expect(output).toContain('--oods-viz-scale-sequential-05');
    expect(output).toContain('tableFallback');
    expect(output).toContain('narrative');
  });

  it('builds bubble scaffold with custom coordinate fields', () => {
    const output = generateSpatialScaffold({
      type: 'bubble',
      latField: 'lat',
      lonField: 'lng',
      sizeField: 'population',
      colorField: 'region',
    });

    expect(output).toContain('BubbleMap');
    expect(output).toContain("latitudeField='lat'");
    expect(output).toContain("longitudeField='lng'");
    expect(output).toContain("sizeField='population'");
    expect(output).toContain('tableFallback');
  });
});
