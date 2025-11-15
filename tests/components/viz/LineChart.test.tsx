/* @vitest-environment jsdom */

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { LineChart } from '../../../src/components/viz/LineChart.js';
import { createLineChartSpec } from './__fixtures__/lineChartSpec.js';

const embedSpy = vi.hoisted(() => vi.fn(() => Promise.resolve({ view: { finalize: vi.fn() } })));

vi.mock('vega-embed', () => ({
  __esModule: true,
  default: embedSpy,
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
    // no-op – callers trigger measurements via emitResize
  }

  unobserve(): void {
    // not needed for tests
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
  // @ts-expect-error -- test shim
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
});

const flushTimers = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

beforeEach(() => {
  embedSpy.mockClear();
});

function emitResize(width: number): void {
  for (const callback of [...resizeCallbacks]) {
    callback([{ contentRect: { width, height: 320 } } as ResizeObserverEntry], {} as ResizeObserver);
  }
}

describe('LineChart', () => {
  it('renders the chart container, narrative, and table fallback', async () => {
    render(<LineChart spec={createLineChartSpec()} />);
    await flushTimers();

    await waitFor(() => expect(embedSpy).toHaveBeenCalledTimes(1));

    const table = screen.getByRole('table', { name: /monthly active subscribers table/i });
    expect(table).toBeInTheDocument();

    const narrative = screen.getByText(/Active subscribers trend upward/i);
    expect(narrative).toBeInTheDocument();
  });

  it('updates the Vega spec when the container width changes', async () => {
    render(<LineChart spec={createLineChartSpec()} />);
    await flushTimers();

    await waitFor(() => expect(embedSpy).toHaveBeenCalledTimes(1));

    await act(async () => {
      emitResize(420);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    await waitFor(() => expect(embedSpy).toHaveBeenCalledTimes(2));

    const latestSpec = embedSpy.mock.calls[embedSpy.mock.calls.length - 1]?.[1] as { width?: number } | undefined;
    expect(latestSpec?.width).toBe(420);
  });

  it('disables motion effects when prefers-reduced-motion is set', async () => {
    const originalMatchMedia = globalThis.matchMedia;
    const matchMediaMock = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    try {
      // @ts-expect-error -- test stub
      globalThis.matchMedia = matchMediaMock;

    render(<LineChart spec={createLineChartSpec()} />);
    await flushTimers();

    await waitFor(() => expect(embedSpy).toHaveBeenCalledTimes(1));

    const renderer = screen.getByTestId('line-chart-renderer');
    await waitFor(() => {
      expect(renderer.className.trim()).toBe('h-full w-full min-w-0');
    });
    } finally {
      if (originalMatchMedia) {
        globalThis.matchMedia = originalMatchMedia;
      } else {
        // @ts-expect-error -- cleanup mock
        delete globalThis.matchMedia;
      }
    }
  });
});
