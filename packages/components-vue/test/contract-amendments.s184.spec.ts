import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { Select, Text } from '../src/index.js';

describe('Sprint 184 Vue contract amendments', () => {
  it('renders Select.placeholder as the disabled empty-value choice', () => {
    const wrapper = mount(Select, {
      props: {
        id: 'plan',
        label: 'Plan',
        defaultValue: '',
        placeholder: 'Choose a plan',
        options: [{ value: 'pro', label: 'Pro' }],
      },
    });

    const options = wrapper.findAll('option');
    expect(options.map((option) => option.attributes('value'))).toEqual(['', 'pro']);
    expect(options[0].attributes('disabled')).toBeDefined();
    expect((options[0].element as HTMLOptionElement).selected).toBe(true);
  });

  it('maps Text.label to an accessible description without replacing its value', () => {
    const wrapper = mount(Text, {
      props: {
        content: 'active',
        label: 'Canonical lifecycle state',
      },
    });

    expect(wrapper.text()).toBe('active');
    expect(wrapper.attributes('aria-description')).toBe('Canonical lifecycle state');
    expect(wrapper.attributes('label')).toBeUndefined();
  });
});
