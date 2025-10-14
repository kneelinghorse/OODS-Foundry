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

  it('applies intent and size classes for styling and focus visibility', () => {
    const markup = renderToStaticMarkup(
      <Button intent="danger" size="lg">
        Delete
      </Button>
    );

    expect(markup).toContain('bg-rose-600');
    expect(markup).toContain('h-12');
    expect(markup).toContain('focus-visible');
  });

  it('supports rendering as child and does not leak button attributes', () => {
    const markup = renderToStaticMarkup(
      <Button asChild intent="success">
        <a href="/settings">Settings</a>
      </Button>
    );

    expect(markup.startsWith('<a')).toBe(true);
    expect(markup).not.toContain('type="button"');
    expect(markup).toContain('bg-emerald-600');
  });
});
