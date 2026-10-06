import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { Table } from '../src/index.js';

describe('@oods/components-vue Table empty affordance', () => {
  it('renders non-empty text spanning every declared column when rows are empty', () => {
    const wrapper = mount(Table, {
      props: {
        caption: 'Subscriptions',
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'status', label: 'Status' },
        ],
        rows: [],
      },
    });

    try {
      const body = wrapper.get('tbody');
      expect(body.text()).toBe('No rows available.');
      expect(body.text().trim().length).toBeGreaterThan(0);
      expect(body.findAll('tr')).toHaveLength(1);
      expect(body.get('td').attributes('colspan')).toBe('2');
    } finally {
      wrapper.unmount();
    }
  });

  // s222-m02 (#2502 ruling 11): a caption hidden on request stays the table's accessible name; only its box is hidden.
  it('keeps a hidden caption as the table name', () => {
    const hidden = mount(Table, { props: { caption: 'Invoices', showCaption: false, columns: [{ key: 'n', label: 'Invoice' }], rows: [{ id: '1', n: 'INV-1' }] } });
    const shown = mount(Table, { props: { caption: 'Invoices', columns: [{ key: 'n', label: 'Invoice' }], rows: [] } });
    try {
      expect(hidden.get('caption').text()).toBe('Invoices');
      expect(hidden.get('caption').attributes('data-visually-hidden')).toBe('true');
      expect(shown.get('caption').attributes('data-visually-hidden')).toBeUndefined();
    } finally {
      hidden.unmount();
      shown.unmount();
    }
  });
});
