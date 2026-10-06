import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Textarea } from '../../src/components/base/Textarea.js';

describe('OODS.Textarea', () => {
  it('renders a textarea linked to its label', () => {
    const markup = renderToStaticMarkup(
      <Textarea id="notes" label="Notes" rows={6} />
    );

    expect(markup).toContain('<textarea');
    expect(markup).toContain('rows="6"');
    expect(markup).toContain('for="notes"');
  });

  it('wires validation and description metadata into aria-describedby', () => {
    const markup = renderToStaticMarkup(
      <Textarea
        id="summary"
        label="Summary"
        description="Provide implementation context."
        validation={{ state: 'info', message: 'Keep this concise.' }}
      />
    );

    expect(markup).toContain('aria-describedby="summary-description summary-validation"');
    expect(markup).toContain('id="summary-description"');
    expect(markup).toContain('id="summary-validation"');
  });
});
