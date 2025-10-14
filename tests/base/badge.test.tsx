import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Badge } from '../../src/components/base/Badge.js';

describe('OODS.Badge', () => {
  it('renders a span element with its children', () => {
    const markup = renderToStaticMarkup(<Badge>Active</Badge>);

    expect(markup.startsWith('<span')).toBe(true);
    expect(markup).toContain('Active');
  });

  it('applies the intent variant styles', () => {
    const markup = renderToStaticMarkup(<Badge intent="warning">Pending</Badge>);

    expect(markup).toContain('bg-amber-50');
    expect(markup).toContain('ring-amber-200');
  });
});
