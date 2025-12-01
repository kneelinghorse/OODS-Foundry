import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { registerSpatialDashboardWidgets, resolveGridSpan } from '../../../src/viz/contexts/dashboard-spatial-context.js';
import type { RenderContext } from '../../../src/types/render-context.js';

const MOCK_CONTEXT: RenderContext<{ readonly id: string }> = {
  object: { id: 'object:mock' },
  data: { id: 'fixture' },
  theme: { id: 'default', tokens: {} },
  permissions: [],
  viewport: { width: 1280, height: 720 },
};

describe('Dashboard spatial context', () => {
  it('embeds spatial widgets with grid span metadata', () => {
    const widgets = registerSpatialDashboardWidgets({
      traitId: 'SpatialDashboard',
      widgets: [
        {
          id: 'choropleth',
          title: 'Choropleth',
          kind: 'choropleth',
          render: () => <div data-testid="choropleth-body">map</div>,
        },
        {
          id: 'bubble',
          title: 'Bubble',
          kind: 'bubble',
          render: () => <div data-testid="bubble-body">bubble</div>,
        },
      ],
      viewportWidth: 960,
    });

    const markup = renderToStaticMarkup(
      <>
        {widgets.map((extension) => (
          <React.Fragment key={extension.id}>{extension.render(MOCK_CONTEXT)}</React.Fragment>
        ))}
      </>
    );

    expect(markup).toContain('data-dashboard-widget="spatial"');
    expect(markup).toContain('data-grid-span-cols="2"');
    expect(markup).toContain('data-grid-span-rows="2"');
    expect(markup).toContain('data-spatial-kind="bubble"');
  });

  it('respects grid span overrides and viewport width', () => {
    const compactSpan = resolveGridSpan({ cols: 3, rows: 1 }, 480);
    expect(compactSpan.cols).toBe(1); // collapses to single column on narrow viewports
    expect(compactSpan.rows).toBe(1);

    const wideSpan = resolveGridSpan({ cols: 1, rows: 1 }, 1280);
    expect(wideSpan.cols).toBe(1);
    expect(wideSpan.rows).toBe(1);
  });
});
