/* @vitest-environment jsdom */

// s166 m01 (FF#23, Forge-Demos intel_alert 6b595d87): the browser Heatmap component
// REPLACES the adapter's visualMap with its own (applyHeatmapVisualMap), so the viz-core
// call-site fix alone leaves the component path broken — a dimensionless visualMap binds
// to the LAST dataset dimension, and a trailing non-measure field (a string) blanks every
// cell to fill:none. This pins the component override carrying its own name-form dimension.
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Heatmap } from '../../../src/components/viz/Heatmap.js';
import { createHeatmapSpec } from './__fixtures__/heatmapSpec.js';

vi.mock('vega-embed', () => ({
  __esModule: true,
  default: vi.fn(() => Promise.resolve({ view: { finalize: vi.fn() } })),
}));

const setOptionMock = vi.fn();
const echartsInstance = {
  dispose: vi.fn(),
  setOption: setOptionMock,
  resize: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  dispatchAction: vi.fn(),
};
const initSpy = vi.hoisted(() => vi.fn());
initSpy.mockImplementation(() => echartsInstance);
vi.mock('echarts', () => ({
  __esModule: true,
  init: initSpy,
}));

// The FF#23 shape: measure ('tickets') NOT last — 'shift' (a string) is the final
// dataset dimension, exactly where a dimensionless visualMap binds.
const TRAILING_FIELD_ROWS = [
  { day: 'Monday', hour: '08:00', tickets: 12, shift: 'early' },
  { day: 'Monday', hour: '12:00', tickets: 26, shift: 'mid' },
  { day: 'Tuesday', hour: '08:00', tickets: 15, shift: 'early' },
  { day: 'Tuesday', hour: '12:00', tickets: 32, shift: 'mid' },
];

interface CapturedVisualMap {
  readonly dimension?: unknown;
  readonly min?: number;
  readonly max?: number;
  readonly inRange?: { color?: readonly string[] };
}

describe('Heatmap — s166 m01 component visualMap carries its own dimension (FF#23)', () => {
  beforeEach(() => {
    initSpy.mockClear();
    setOptionMock.mockClear();
  });

  it('binds the visualMap to the measure FIELD by name on a trailing-field spec (fails at HEAD: undefined)', async () => {
    const spec = createHeatmapSpec({ data: { values: TRAILING_FIELD_ROWS } });
    render(<Heatmap spec={spec} renderer="echarts" />);
    await waitFor(() => expect(initSpy).toHaveBeenCalledTimes(1));

    const option = setOptionMock.mock.calls[0]?.[0] as { visualMap?: CapturedVisualMap } | undefined;
    expect(option?.visualMap).toBeDefined();
    // The component override must carry its own dimension — it replaces the adapter's
    // (already-dimensioned) visualMap wholesale.
    expect(option?.visualMap?.dimension).toBe('tickets');
    // Keep-green: the override still carries the mapper's ramp and matrix extent.
    expect(option?.visualMap?.inRange?.color?.length).toBeGreaterThan(0);
    expect(option?.visualMap?.min).toBe(12);
    expect(option?.visualMap?.max).toBe(32);
  });

  it('keep-green: the measure-last base fixture carries the same dimension', async () => {
    render(<Heatmap spec={createHeatmapSpec()} renderer="echarts" />);
    await waitFor(() => expect(initSpy).toHaveBeenCalledTimes(1));

    const option = setOptionMock.mock.calls[0]?.[0] as { visualMap?: CapturedVisualMap } | undefined;
    expect(option?.visualMap?.dimension).toBe('tickets');
  });
});
