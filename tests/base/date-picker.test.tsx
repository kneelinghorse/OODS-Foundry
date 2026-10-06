import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DatePicker } from '../../src/components/base/DatePicker.js';

describe('OODS.DatePicker', () => {
  it('renders a date input linked to its label', () => {
    const markup = renderToStaticMarkup(
      <DatePicker id="ship-date" label="Ship date" />
    );

    expect(markup).toContain('type="date"');
    expect(markup).toContain('for="ship-date"');
    expect(markup).toContain('form-field__date-picker');
  });

  it('preserves validation metadata and description wiring', () => {
    const markup = renderToStaticMarkup(
      <DatePicker
        id="renewal-date"
        label="Renewal date"
        description="Choose the subscription renewal date."
        validation={{ state: 'error', message: 'Renewal date is required.' }}
        required
      />
    );

    expect(markup).toContain('aria-describedby="renewal-date-description renewal-date-validation"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('data-validation-state="error"');
  });
});
