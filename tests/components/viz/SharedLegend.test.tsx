/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { SharedLegend } from '../../../src/components/viz/SharedLegend.js';
import { createBarChartSpec } from './__fixtures__/barChartSpec.js';

describe('SharedLegend', () => {
  it('renders legend entries derived from color encoding', () => {
    render(<SharedLegend spec={createBarChartSpec()} />);
    const items = screen.getAllByTestId('shared-legend-item');
    expect(items.length).toBeGreaterThan(0);
  });

  it('returns null when color channel is unavailable', () => {
    const spec = createBarChartSpec();
    delete spec.encoding.color;
    spec.marks = spec.marks.map((mark) => {
      const encodings = mark.encodings ?? {};
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- local destructuring to remove color
      const { color: _color, ...rest } = encodings;
      return {
        ...mark,
        encodings: rest,
      };
    });
    const { container } = render(<SharedLegend spec={spec} />);
    expect(container).toBeEmptyDOMElement();
  });
});
