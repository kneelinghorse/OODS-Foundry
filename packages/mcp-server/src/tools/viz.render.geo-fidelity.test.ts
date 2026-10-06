// viz.render geo render-fidelity goldens (sprint-112 m03).
//
// The sibling network-fidelity suite pins the echartsSpec for the 4 hierarchy/flow
// types at the viz.render BOUNDARY. This closes the analogous gap for the 2 geo
// types: for choropleth/bubble_map it pins the produced echartsSpec to a golden, so
// any drift in the engine -> handler -> ECharts payload is caught, and it asserts
// determinism (same input -> byte-identical echartsSpec).
//
// echartsSpec is JSON-safe (the handler drops the tooltip-formatter closure; bubble
// sizes survive as per-datum numbers). The snapshot includes __registration (the
// FeatureCollection the client re-registers — geo specs are NOT self-contained).
// Colours are RESOLVED (rgb/hex), never var(--token), so the golden is render-faithful.

import { describe, expect, it } from 'vitest';
import type { VizRenderInput } from '../schemas/generated.js';
import { handle } from './viz.render.js';

const render = (input: Record<string, unknown>) => handle(input as unknown as VizRenderInput);

const US_STATES = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'CA',
      properties: { region: 'CA', state_name: 'California' },
      geometry: { type: 'Polygon', coordinates: [[[-124, 32], [-114, 32], [-114, 42], [-124, 42], [-124, 32]]] },
    },
    {
      type: 'Feature',
      id: 'NV',
      properties: { region: 'NV', state_name: 'Nevada' },
      geometry: { type: 'Polygon', coordinates: [[[-120, 35], [-114, 35], [-114, 42], [-120, 42], [-120, 35]]] },
    },
  ],
};
const SALES_BY_STATE = [
  { state: 'CA', sales: 580 },
  { state: 'NV', sales: 96 },
];
const CITIES = [
  { city: 'San Francisco', lng: -122.4, lat: 37.8, pop: 874 },
  { city: 'Las Vegas', lng: -115.1, lat: 36.2, pop: 646 },
];
const TRADE_FLOWS = [
  { from: 'CA', to: 'NV', oLng: -120, oLat: 37, dLng: -116, dLat: 39, volume: 540 },
  { from: 'NV', to: 'CA', oLng: -116, oLat: 39, dLng: -120, dLat: 37, volume: 210 },
];

const CASES: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
  [
    'choropleth',
    {
      chartType: 'choropleth',
      geo: {
        geojson: US_STATES,
        rows: SALES_BY_STATE,
        join: { dataKey: 'state', featureProperty: 'region' },
        valueField: 'sales',
        colorScale: 'linear',
      },
      name: 'State sales',
    },
  ],
  [
    'bubble_map',
    {
      chartType: 'bubble_map',
      geo: {
        geojson: US_STATES,
        rows: CITIES,
        longitudeField: 'lng',
        latitudeField: 'lat',
        sizeField: 'pop',
        colorField: 'pop',
        colorScale: 'linear',
      },
      name: 'City population',
    },
  ],
  [
    'flow_map',
    {
      chartType: 'flow_map',
      geo: {
        geojson: US_STATES,
        rows: TRADE_FLOWS,
        originLongitudeField: 'oLng',
        originLatitudeField: 'oLat',
        destinationLongitudeField: 'dLng',
        destinationLatitudeField: 'dLat',
        strengthField: 'volume',
        curvature: 0.3,
      },
      name: 'Trade flows',
    },
  ],
];

describe('viz.render geo render-fidelity goldens', () => {
  for (const [name, input] of CASES) {
    it(`${name}: the produced echartsSpec matches the committed golden`, async () => {
      const out = await render(input);
      expect(out.status).toBe('ok');
      expect(out.chartType).toBe(name);
      // The renderable payload is the ECharts option; pin it (the specRef trio is
      // per-call unique, so snapshot only the payload).
      expect(out.echartsSpec).toMatchSnapshot();
    });

    it(`${name}: same input -> byte-identical echartsSpec (determinism gate)`, async () => {
      const a = await render(input);
      const b = await render(input);
      expect(JSON.stringify(a.echartsSpec)).toBe(JSON.stringify(b.echartsSpec));
    });
  }
});
