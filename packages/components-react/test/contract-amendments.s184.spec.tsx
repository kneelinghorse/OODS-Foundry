/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Select, Text } from '../src/index.js';

afterEach(cleanup);

describe('Sprint 184 React contract amendments', () => {
  it('renders Select.placeholder as the disabled empty-value choice', () => {
    render(
      <Select
        id="plan"
        label="Plan"
        defaultValue=""
        placeholder="Choose a plan"
        options={[{ value: 'pro', label: 'Pro' }]}
      />
    );

    const select = screen.getByLabelText('Plan') as HTMLSelectElement;
    const placeholder = screen.getByRole('option', { name: 'Choose a plan' }) as HTMLOptionElement;
    expect([...select.options].map((option) => option.value)).toEqual(['', 'pro']);
    expect(placeholder.disabled).toBe(true);
    expect(placeholder.selected).toBe(true);
  });

  it('maps Text.label to an accessible description without replacing its value', () => {
    render(
      <Text label="Canonical lifecycle state">active</Text>
    );

    const text = screen.getByText('active');
    expect(text.textContent).toBe('active');
    expect(text.getAttribute('aria-description')).toBe('Canonical lifecycle state');
    expect(text.hasAttribute('label')).toBe(false);
  });

  it('preserves an explicit native accessible description over the schema label', () => {
    render(
      <Text label="Schema label" aria-description="Consumer description">active</Text>
    );

    expect(screen.getByText('active').getAttribute('aria-description')).toBe('Consumer description');
  });
});
