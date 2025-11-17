/* @vitest-environment jsdom */

import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Heatmap } from '../../../src/components/viz/Heatmap.js';
import { createHeatmapSpec } from './__fixtures__/heatmapSpec.js';

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

let originalCanvasContext: typeof HTMLCanvasElement.prototype.getContext;

beforeAll(() => {
  originalCanvasContext = HTMLCanvasElement.prototype.getContext;
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(),
  });
});

afterAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: originalCanvasContext,
  });
});

beforeEach(() => {
  embedSpy.mockClear();
});

describe('Heatmap accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(<Heatmap spec={createHeatmapSpec()} renderer="vega-lite" />);
    await waitFor(() => expect(embedSpy).toHaveBeenCalledTimes(1));
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
