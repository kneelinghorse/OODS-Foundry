import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Banner } from '../../src/components/base/Banner.js';

describe('OODS.Banner', () => {
  it('renders mapped status tokens with polite live region', () => {
    const markup = renderToStaticMarkup(
      <Banner status="trialing" domain="subscription" />
    );

    expect(markup.startsWith('<div')).toBe(true);
    expect(markup).toContain('role="status"');
    expect(markup).toContain('Trialing');
    expect(markup).toContain('--statusable-banner-background');
  });

  it('escalates negative tone to role="alert"', () => {
    const markup = renderToStaticMarkup(
      <Banner tone="critical" title="Subscription canceled" description="All usage has stopped." />
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('data-tone="critical"');
  });
});
