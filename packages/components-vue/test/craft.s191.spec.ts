import { mount } from '@vue/test-utils';
import { h } from 'vue';
import { describe, expect, it } from 'vitest';
import { SearchInput, PaginationBar } from '../src/ported.js';
import { ArchivedRowOverlay, Button } from '../src/index.js';

describe('s191 producer craft preserves native behavior', () => {
  it('keeps the search label with its field while input, clear and submit retain their events', async () => {
    const wrapper = mount(SearchInput, { props: { label: 'Search subscriptions', clearable: true } });
    const field = wrapper.get('.oods-field');
    expect(field.get('label').attributes('for')).toBe(field.get('input').attributes('id'));
    await field.get('input').setValue('Team');
    expect(wrapper.emitted('search')).toEqual([['Team']]);
    // s221-m02 (#2482 ruling 2): the root is a search landmark div, as React's (a form cannot sit inside a consumer's
    // form); Enter still searches at once, and cancels the key's default so no enclosing form submits.
    expect(wrapper.find('form').exists()).toBe(false);
    expect(wrapper.attributes('role')).toBe('search');
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    field.get('input').element.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(wrapper.emitted('search')).toEqual([['Team'], ['Team']]);
    await field.get('input').trigger('keydown', { key: 'Escape' });
    expect(wrapper.emitted('clear')).toEqual([[]]);
    expect(wrapper.emitted('search')?.at(-1)).toEqual(['']);
    wrapper.unmount();
  });
  it('puts native pagination items under the shared list reset and still navigates', async () => {
    const wrapper = mount(PaginationBar, { props: { page: 1, pageSize: 5, totalItems: 11 } });
    expect(wrapper.get('.oods-pagination-bar__pages').element.tagName).toBe('UL');
    expect(wrapper.find('.oods-pagination-items').exists()).toBe(false);
    await wrapper.get('[data-pagination-next]').trigger('click');
    expect(wrapper.emitted('pageChange')).toEqual([[2]]);
    wrapper.unmount();
  });
  it('lets callers style the archive container without losing the accessible child button', () => {
    const wrapper = mount(ArchivedRowOverlay, { props: { isArchived: true }, attrs: { style: { minWidth: '0px' } }, slots: { default: () => h(Button, { class: 'oods-collection-row' }, () => 'Team') } });
    expect((wrapper.element as HTMLElement).style.minWidth).toBe('0px');
    expect(wrapper.attributes('aria-hidden')).toBe('false');
    expect(wrapper.get('button').classes()).toEqual(['oods-button', 'oods-collection-row']);
    expect(wrapper.get('button').attributes('data-size')).toBe('md');
    expect(wrapper.get('button').text()).toBe('Team');
    wrapper.unmount();
  });
});
