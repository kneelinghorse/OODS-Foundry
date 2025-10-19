import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Badge } from '../../src/components/base/Badge.js';

describe('OODS.Badge', () => {
  it('renders mapped status metadata', () => {
    const markup = renderToStaticMarkup(
      <Badge status="trialing" domain="subscription" />
    );

    expect(markup.startsWith('<span')).toBe(true);
    expect(markup).toContain('data-status="trialing"');
    expect(markup).toContain('Trialing');
    expect(markup).toContain('--statusable-badge-background');
  });

  it('respects explicit tone when no status provided', () => {
    const markup = renderToStaticMarkup(<Badge tone="critical">At Risk</Badge>);

    expect(markup).toContain('At Risk');
    expect(markup).toContain('data-tone="critical"');
  });
});
