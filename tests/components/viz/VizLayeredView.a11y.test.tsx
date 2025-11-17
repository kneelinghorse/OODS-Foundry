/* @vitest-environment jsdom */

import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { VizLayeredView } from '../../../src/components/viz/VizLayeredView.js';
import { createLayeredViewSpec } from './__fixtures__/layeredViewSpec.js';

const embedSpy = vi.hoisted(() => vi.fn(() => Promise.resolve({ view: { finalize: vi.fn() } })));
vi.mock('../../../src/viz/runtime/vega-embed-loader.js', () => ({
  loadVegaEmbed: () => Promise.resolve(embedSpy),
  preloadVegaEmbed: () => Promise.resolve(embedSpy),
}));

beforeEach(() => {
  embedSpy.mockClear();
});

expect.extend({ toHaveNoViolations });

let originalCanvasGetContext: typeof HTMLCanvasElement.prototype.getContext;

beforeAll(() => {
  originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(),
  });
});

afterAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: originalCanvasGetContext,
  });
});

describe('VizLayeredView accessibility', () => {
  it(
    'has no axe violations',
    { timeout: 15000 },
    async () => {
      const { container } = render(<VizLayeredView spec={createLayeredViewSpec()} />);
      await waitFor(() => expect(embedSpy).toHaveBeenCalledTimes(1));
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    }
  );
});
