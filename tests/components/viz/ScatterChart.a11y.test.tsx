/* @vitest-environment jsdom */

import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScatterChart } from '../../../src/components/viz/ScatterChart.js';
import { createScatterChartSpec } from './__fixtures__/scatterChartSpec.js';

expect.extend({ toHaveNoViolations });

const embedSpy = vi.hoisted(() => vi.fn(() => Promise.resolve({ view: { finalize: vi.fn() } })));
vi.mock('../../../src/viz/runtime/vega-embed-loader.js', () => ({
  loadVegaEmbed: () => Promise.resolve(embedSpy),
  preloadVegaEmbed: () => Promise.resolve(embedSpy),
}));

vi.mock('echarts', () => ({
  __esModule: true,
  init: vi.fn(() => ({
    setOption: vi.fn(),
    dispose: vi.fn(),
    resize: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    dispatchAction: vi.fn(),
  })),
}));

let originalCanvasGetContext: typeof HTMLCanvasElement.prototype.getContext;

beforeAll(() => {
  originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(),
  });
});

beforeEach(() => {
  embedSpy.mockClear();
});

describe('ScatterChart accessibility', () => {
  it(
    'has no axe violations',
    { timeout: 15000 },
    async () => {
      const { container } = render(<ScatterChart spec={createScatterChartSpec()} />);
      await waitFor(() => expect(embedSpy).toHaveBeenCalledTimes(1));
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    }
  );
});

afterAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: originalCanvasGetContext,
  });
});
