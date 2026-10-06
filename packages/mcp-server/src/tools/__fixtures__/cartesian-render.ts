// Shared cartesian fidelity operands; extracted without changing their data or encodings.
import type { VizRenderInput } from "../../schemas/generated.js";

export const SALES = [
  { region: 'North', quarter: '2024-01', revenue: 120000, units: 340 },
  { region: 'South', quarter: '2024-01', revenue: 135000, units: 410 },
  { region: 'North', quarter: '2024-02', revenue: 128000, units: 360 },
  { region: 'South', quarter: '2024-02', revenue: 142000, units: 430 },
  { region: 'North', quarter: '2024-03', revenue: 131000, units: 372 },
  { region: 'South', quarter: '2024-03', revenue: 150000, units: 455 },
] as const;

export interface FidelityCase {
  readonly chartType: NonNullable<VizRenderInput['chartType']>;
  readonly encodings: Record<string, unknown>;
  // The Vega mark type the chart compiles to. Used to assert the rendered SVG
  // actually drew data marks of the right kind, not just an empty <svg> shell.
  readonly svgMark: 'rect' | 'line' | 'area' | 'symbol';
}

// Per-chart encodings chosen so each compiles to a meaningful, drawable chart:
// bar (categorical x + measure y), line/area (temporal x + measure y), scatter
// (two measures), heatmap (two dimensions + a quantitative color).
export const CASES: readonly FidelityCase[] = [
  {
    chartType: 'bar',
    svgMark: 'rect',
    encodings: { x: { field: 'region', scale: 'band' }, y: { field: 'revenue', aggregate: 'sum' } },
  },
  {
    chartType: 'line',
    svgMark: 'line',
    encodings: {
      x: { field: 'quarter', scale: 'temporal' },
      y: { field: 'revenue', aggregate: 'sum' },
      color: { field: 'region' },
    },
  },
  {
    chartType: 'area',
    svgMark: 'area',
    encodings: { x: { field: 'quarter', scale: 'temporal' }, y: { field: 'revenue', aggregate: 'sum' } },
  },
  {
    chartType: 'scatter',
    svgMark: 'symbol',
    encodings: {
      x: { field: 'revenue', scale: 'linear' },
      y: { field: 'units', scale: 'linear' },
      color: { field: 'region' },
    },
  },
  {
    chartType: 'heatmap',
    svgMark: 'rect',
    encodings: {
      x: { field: 'region', scale: 'band' },
      y: { field: 'quarter', scale: 'band' },
      color: { field: 'revenue', scale: 'linear' },
    },
  },
];
