import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ContextKind } from '../../src/contexts/index.js';
import { RenderObject } from '../../src/components/RenderObject.js';
import { createUserDashboardExample } from '../../examples/dashboards/user-adoption.js';
import { createSubscriptionDashboardExample } from '../../examples/dashboards/subscription-mrr.js';
import { createProductDashboardExample } from '../../examples/dashboards/product-analytics.js';

function renderExample(context: ContextKind, factory: () => { object: any; data: any }): string {
  const { object, data } = factory();
  return renderToStaticMarkup(<RenderObject object={object} context={context} data={data} />);
}

describe('Dashboard contexts', () => {
  it('renders chart panels in dashboard context', () => {
    const markup = renderExample('dashboard', createUserDashboardExample);
    expect(markup).toContain('data-view-context="dashboard"');
    expect(markup).toContain('data-chart-panel="user-dashboard:adoption-grid"');
    expect(markup).toContain('data-chart-panel="user-dashboard:retention"');
  });

  it('renders dashboard traits when using detail context', () => {
    const markup = renderExample('detail', createUserDashboardExample);
    expect(markup).toContain('data-view-context="detail"');
    expect(markup).toContain('data-chart-panel="user-dashboard:retention"');
  });

  it('renders dashboard traits when using timeline context', () => {
    const markup = renderExample('timeline', createUserDashboardExample);
    expect(markup).toContain('data-view-context="timeline"');
    expect(markup).toContain('data-chart-panel="user-dashboard:sentiment"');
  });

  it('renders subscription dashboard panels', () => {
    const markup = renderExample('dashboard', createSubscriptionDashboardExample);
    expect(markup).toContain('data-chart-panel="subscription:revenue"');
    expect(markup).toContain('Recurring revenue');
  });

  it('renders product analytics dashboard panels', () => {
    const markup = renderExample('dashboard', createProductDashboardExample);
    expect(markup).toContain('data-chart-panel="product:usage-grid"');
    expect(markup).toContain('Feature usage grid');
  });
});
