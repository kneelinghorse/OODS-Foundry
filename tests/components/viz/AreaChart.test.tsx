/* @vitest-environment jsdom */

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AreaChart } from '../../../src/components/viz/AreaChart.js';
import { createAreaChartSpec } from './__fixtures__/areaChartSpec.js';

const embedSpy = vi.hoisted(() => vi.fn(() => Promise.resolve({ view: { finalize: vi.fn() } })));

vi.mock('vega-embed', () => ({
  __esModule: true,
  default: embedSpy,
}));

const disposeMock = vi.fn();
const setOptionMock = vi.fn();
const resizeMock = vi.fn();
const onMock = vi.fn();
const offMock = vi.fn();
const dispatchActionMock = vi.fn();

const echartsInstance = {
  dispose: disposeMock,
  setOption: setOptionMock,
  resize: resizeMock,
  on: onMock,
  off: offMock,
  dispatchAction: dispatchActionMock,
};

const initSpy = vi.hoisted(() => vi.fn(() => echartsInstance));

vi.mock('echarts', () => ({
  __esModule: true,
  init: initSpy,
}));

type ResizeCallback = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void;
const resizeCallbacks = new Set<ResizeCallback>();

class MockResizeObserver {
  private readonly callback: ResizeCallback;

  constructor(callback: ResizeCallback) {
    this.callback = callback;
    resizeCallbacks.add(callback);
  }

  observe(): void {
    // noop
  }

  unobserve(): void {
    // noop
  }

  disconnect(): void {
    resizeCallbacks.delete(this.callback);
  }

  takeRecords(): ResizeObserverEntry[] {
    return [];
  }
}

const originalResizeObserver = globalThis.ResizeObserver;

beforeAll(() => {
  // @ts-expect-error -- test shim for ResizeObserver
  globalThis.ResizeObserver = MockResizeObserver;
});

afterAll(() => {
  if (originalResizeObserver) {
    globalThis.ResizeObserver = originalResizeObserver;
  } else {
    // @ts-expect-error -- cleanup shim
    delete globalThis.ResizeObserver;
  }
});

afterEach(() => {
  resizeCallbacks.clear();
  cleanup();
  embedSpy.mockClear();
  initSpy.mockClear();
  setOptionMock.mockClear();
  onMock.mockClear();
  dispatchActionMock.mockClear();
});

const flushTimers = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

describe('AreaChart', () => {
  it('renders Vega-Lite surface with stacked encoding and accessibility fallbacks', async () => {
    render(<AreaChart spec={createAreaChartSpec()} renderer="vega-lite" />);
    await flushTimers();

    await waitFor(() => expect(embedSpy).toHaveBeenCalledTimes(1));

    const table = screen.getByRole('table', { name: /monthly revenue contribution by segment/i });
    expect(table).toBeInTheDocument();

    const specArg = embedSpy.mock.calls[0]?.[1] as Record<string, unknown> | undefined;
    const encoding = Array.isArray((specArg as { layer?: Array<{ encoding?: Record<string, unknown> }> })?.layer)
      ? (specArg as { layer?: Array<{ encoding?: Record<string, unknown> }> }).layer?.[0]?.encoding
      : (specArg as { encoding?: Record<string, unknown> })?.encoding;

    const y2Field = (encoding?.y2 as { field?: string } | undefined)?.field;
    expect(y2Field).toBe('stack_start');
  });

  it('switches to ECharts renderer when requested and configures stacking baseline', async () => {
    render(<AreaChart spec={createAreaChartSpec()} renderer="echarts" />);
    await flushTimers();

    await waitFor(() => expect(initSpy).toHaveBeenCalledTimes(1));
    expect(setOptionMock).toHaveBeenCalledTimes(1);

    const option = setOptionMock.mock.calls[0]?.[0] as {
      series?: Array<{ stack?: string }> | { stack?: string };
      yAxis?: Array<{ min?: number }> | { min?: number };
    } | undefined;
    const series = option?.series ? (Array.isArray(option.series) ? option.series : [option.series]) : [];
    expect(series.length).toBeGreaterThan(0);
    expect(series.every((entry) => typeof entry?.stack === 'string' && entry.stack.length > 0)).toBe(true);

    const yAxis = option?.yAxis ? (Array.isArray(option.yAxis) ? option.yAxis[0] : option.yAxis) : undefined;
    expect(yAxis?.min).toBe(0);
  });

  it('disables motion classes when prefers-reduced-motion is set', async () => {
    const originalMatchMedia = globalThis.matchMedia;
    const matchMediaMock = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    try {
      // @ts-expect-error -- test override
      globalThis.matchMedia = matchMediaMock;
      render(<AreaChart spec={createAreaChartSpec()} renderer="vega-lite" />);
      await flushTimers();
      await waitFor(() => expect(embedSpy).toHaveBeenCalledTimes(1));
      const renderer = screen.getByTestId('area-chart-renderer');
      expect(renderer.className.includes('transition-opacity')).toBe(false);
    } finally {
      if (originalMatchMedia) {
        globalThis.matchMedia = originalMatchMedia;
      } else {
        // @ts-expect-error -- cleanup
        delete globalThis.matchMedia;
      }
    }
  });
});
