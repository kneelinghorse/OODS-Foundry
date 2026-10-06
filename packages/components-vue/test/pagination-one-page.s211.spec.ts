import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { PaginationBar } from '../src/index.js';

/** s211-m02: "15 records Showing 1–15 of 15" said the count twice; one page says it once, more pages add the range. */
describe('PaginationBar says its count once', () => {
  it('on one page shows the count and no range', () => {
    const wrapper = mount(PaginationBar, { props: { page: 1, pageSize: 20, totalItems: 15 } });
    expect(wrapper.get('[data-pagination-count="true"]').text()).toBe('15 records');
    expect(wrapper.find('[data-pagination-range="true"]').exists()).toBe(false);
  });
  it('on more than one page shows the range as well', () => {
    const wrapper = mount(PaginationBar, { props: { page: 2, pageSize: 10, totalItems: 15 } });
    expect(wrapper.get('[data-pagination-range="true"]').text()).toBe('Showing 11–15 of 15');
  });
});
