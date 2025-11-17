/* @vitest-environment jsdom */

import { act, cleanup, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { LineChart } from '../../../src/components/viz/LineChart.js';
import { createLineChartSpec } from './__fixtures__/lineChartSpec.js';

expect.extend({ toHaveNoViolations });

const embedSpy = vi.hoisted(() => vi.fn(() => Promise.resolve({ view: { finalize: vi.fn() } })));

vi.mock('../../../src/viz/runtime/vega-embed-loader.js', () => ({
  loadVegaEmbed: () => Promise.resolve(embedSpy),
  preloadVegaEmbed: () => Promise.resolve(embedSpy),
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
    // measurements triggered manually in tests
  }

  unobserve(): void {
    // unused
  }

  disconnect(): void {
    resizeCallbacks.delete(this.callback);
  }

  takeRecords(): ResizeObserverEntry[] {
    return [];
  }
}

const originalResizeObserver = globalThis.ResizeObserver;
let originalCanvasGetContext: typeof HTMLCanvasElement.prototype.getContext;

const flushTimers = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

beforeAll(() => {
  // @ts-expect-error -- test shim
  globalThis.ResizeObserver = MockResizeObserver;
  originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(),
  });
});

afterAll(() => {
  if (originalResizeObserver) {
    globalThis.ResizeObserver = originalResizeObserver;
  } else {
    // @ts-expect-error -- cleanup shim
    delete globalThis.ResizeObserver;
  }
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: originalCanvasGetContext,
  });
});

afterEach(() => {
  resizeCallbacks.clear();
  cleanup();
});

beforeEach(() => {
  embedSpy.mockClear();
});

function emitResize(width: number): void {
  for (const callback of [...resizeCallbacks]) {
    callback([{ contentRect: { width, height: 320 } } as ResizeObserverEntry], {} as ResizeObserver);
  }
}

describe('LineChart accessibility', () => {
  it(
    'has no axe violations',
    { timeout: 15000 },
    async () => {
      const { container } = render(<LineChart spec={createLineChartSpec()} />);
      await flushTimers();
      await act(async () => {
        emitResize(640);
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      await waitFor(() => expect(embedSpy).toHaveBeenCalled());
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    }
  );
});
