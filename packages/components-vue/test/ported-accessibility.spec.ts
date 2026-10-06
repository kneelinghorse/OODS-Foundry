import { mount } from '@vue/test-utils';
import { axe } from 'vitest-axe';
import { defineComponent, h } from 'vue';
import { describe, expect, it } from 'vitest';

import {
  AuditTimeline,
  CancellationSummary,
  PaginationBar,
  PriceBadge,
  RelativeTimestamp,
  SearchInput,
  StatusBadge,
  StatusTimeline,
} from '../src/ported.js';

const AccessibilityShowcase = defineComponent({
  name: 'PortedAccessibilityShowcase',
  setup() {
    return () => h('main', { 'aria-label': 'Ported Vue component showcase' }, [
      h(StatusBadge, { status: 'past_due' }),
      h(PriceBadge, { amountCents: 2500, currency: 'usd' }),
      h(StatusTimeline, { status: 'active', allowedTransitions: ['paused'] }),
      h(AuditTimeline, { events: [{ label: 'Created', timestamp: '2026-09-05T12:00:00Z' }] }),
      h(CancellationSummary, { cancelAtPeriodEnd: true }),
      h(SearchInput, { id: 'subscriptions-search', label: 'Search subscriptions', value: 'past due' }),
      h(PaginationBar, { page: 2, pageSize: 25, totalItems: 80 }),
      h(RelativeTimestamp, { datetime: '2026-09-05T12:00:00Z', relative: '2 hours ago' }),
    ]);
  },
});

describe('@oods/components-vue ported accessibility outcomes', () => {
  it('names search, pagination, status, and timeline semantics without color-only signals', () => {
    const wrapper = mount(AccessibilityShowcase);
    expect(wrapper.get('[data-oods-component="SearchInput"] label').attributes('for')).toBe('subscriptions-search');
    expect(wrapper.get('[data-oods-component="SearchInput"] input').attributes('type')).toBe('search');
    expect(wrapper.get('[data-oods-component="PaginationBar"]').attributes('aria-label')).toBe('Pagination');
    expect(wrapper.get('[data-oods-component="PaginationBar"] [aria-current="page"]').text()).toBe('2');
    expect(wrapper.get('[data-oods-component="StatusBadge"]').attributes('aria-label')).toBe('Status: Past Due');
    expect(wrapper.get('[data-oods-component="StatusBadge"]').text()).toContain('Past Due');
    expect(wrapper.get('[data-oods-component="AuditTimeline"]').attributes('role')).toBe('log');
    expect(wrapper.get('[data-oods-component="RelativeTimestamp"]').attributes('datetime')).toBe('2026-09-05T12:00:00Z');
  });

  it('does not publish a page event from disabled boundary controls', async () => {
    // Two pages: on the first, previous is the disabled boundary; on the last, next is.
    const first = mount(PaginationBar, { props: { page: 1, pageSize: 25, totalItems: 30 } });
    const previous = first.get('[data-pagination-prev="true"]');
    expect(previous.attributes('disabled')).toBeDefined();
    await previous.trigger('click');
    expect(first.emitted('pageChange')).toBeUndefined();
    const last = mount(PaginationBar, { props: { page: 2, pageSize: 25, totalItems: 30 } });
    const next = last.get('[data-pagination-next="true"]');
    expect(next.attributes('disabled')).toBeDefined();
    await next.trigger('click');
    expect(last.emitted('pageChange')).toBeUndefined();
  });

  it('shows the count and range but no page controls when everything fits one page (s210-m01)', () => {
    const wrapper = mount(PaginationBar, { props: { page: 1, pageSize: 25, totalItems: 25 } });
    expect(wrapper.get('[data-pagination-count="true"]').text()).toBe('25 records');
    expect(wrapper.find('[data-pagination-prev="true"]').exists()).toBe(false);
    expect(wrapper.find('[data-pagination-next="true"]').exists()).toBe(false);
    expect(wrapper.find('[data-pagination-current="true"]').exists()).toBe(false);
  });

  it('has no automated axe violations for the nondegenerate showcase', async () => {
    const wrapper = mount(AccessibilityShowcase, { attachTo: document.body });
    const result = await axe(wrapper.element, {
      rules: {
        'color-contrast': { enabled: false },
      },
    });
    expect(result.violations).toEqual([]);
    wrapper.unmount();
  });
});
