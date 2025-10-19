import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Checkbox } from '../../src/components/base/Checkbox.js';

describe('OODS.Checkbox', () => {
  it('renders checkbox input linked to label', () => {
    const markup = renderToStaticMarkup(
      <Checkbox id="ack" label="Acknowledge policy" />
    );

    expect(markup).toContain('type="checkbox"');
    expect(markup).toContain('for="ack"');
  });

  it('exposes validation state in aria metadata', () => {
    const markup = renderToStaticMarkup(
      <Checkbox
        id="tos"
        label="Accept terms"
        description="Required before continuing."
        validation={{ state: 'error', message: 'Please accept the terms.' }}
        required
      />
    );

    expect(markup).toContain('aria-describedby="tos-description tos-validation"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('data-validation-state="error"');
  });
});
