import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from '../../src/components/base/Button.js';

describe('OODS.Button', () => {
  it('renders a native button element with type=button by default', () => {
    const markup = renderToStaticMarkup(<Button>Submit</Button>);

    expect(markup.startsWith('<button')).toBe(true);
    expect(markup).toContain('type="button"');
    expect(markup).toContain('Submit');
  });

  it('carries intent and size for the shared stylesheet instead of utility classes', () => {
    const markup = renderToStaticMarkup(
      <Button intent="danger" size="lg">
        Delete
      </Button>
    );

    // Sprint 200 m02: chrome comes from @oods/component-styles through the cmp roles, keyed on these attributes.
    expect(markup).toContain('class="oods-button"');
    expect(markup).toContain('data-intent="danger"');
    expect(markup).toContain('data-size="lg"');
    expect(markup.match(/class="([^"]*)"/)![1]).toBe('oods-button');
  });

  it('supports rendering as child and does not leak button attributes', () => {
    const markup = renderToStaticMarkup(
      <Button asChild intent="success">
        <a href="/settings">Settings</a>
      </Button>
    );

    expect(markup.startsWith('<a')).toBe(true);
    expect(markup).not.toContain('type="button"');
    expect(markup).toContain('data-intent="success"');
  });
});
