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
    // s221-m02 (#2482 ruling 2): one markup across React and Vue; the mapped status paints through the badge's own
    // component variables (the React-only statusable-* classes and variables are gone).
    expect(markup).toContain('--cmp-badge-background:var(--sys-status-accent-surface)');
  });

  it('respects explicit tone when no status provided', () => {
    const markup = renderToStaticMarkup(<Badge tone="critical">At Risk</Badge>);

    expect(markup).toContain('At Risk');
    expect(markup).toContain('data-tone="critical"');
  });
});
