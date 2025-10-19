import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Select } from '../../src/components/base/Select.js';

describe('OODS.Select', () => {
  it('renders options and associates label', () => {
    const markup = renderToStaticMarkup(
      <Select id="plan" label="Plan">
        <option value="">Select a plan</option>
        <option value="starter">Starter</option>
      </Select>
    );

    expect(markup).toContain('<label class="form-field__label" for="plan">');
    expect(markup).toContain('<select');
    expect(markup).toContain('id="plan"');
  });

  it('applies validation state styles and aria-invalid', () => {
    const markup = renderToStaticMarkup(
      <Select
        id="status"
        label="Status"
        validation={{ state: 'success', message: 'Synced with billing.' }}
        required
      >
        <option value="active">Active</option>
      </Select>
    );

    expect(markup).toContain('data-validation-state="success"');
    expect(markup).toContain('--form-field-border');
    expect(markup).not.toContain('aria-invalid="true"');
  });
});
