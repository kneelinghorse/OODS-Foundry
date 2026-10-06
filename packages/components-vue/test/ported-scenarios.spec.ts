import { PORTED_COMPONENT_IDS, portedScenarios } from '@oods/component-contracts';
import { mount } from '@vue/test-utils';
import { type Component } from 'vue';
import { describe, expect, it, vi } from 'vitest';

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

const implementations: Readonly<Record<string, Component>> = {
  AuditTimeline,
  CancellationSummary,
  PaginationBar,
  PriceBadge,
  RelativeTimestamp,
  SearchInput,
  StatusBadge,
  StatusTimeline,
};

describe('@oods/components-vue shared ported scenarios', () => {
  it('maps exactly one executable scenario to every separately governed component', () => {
    expect(portedScenarios.map((scenario) => scenario.oodsComponentId)).toEqual(PORTED_COMPONENT_IDS);
    expect(portedScenarios.map((scenario) => scenario.id)).toEqual([
      'audit-timeline-transitions',
      'cancellation-summary-boolean',
      'pagination-bar-navigation',
      'price-badge-currency',
      'relative-timestamp-fixed',
      'search-input-clear',
      'status-badge-mapped',
      'status-timeline-history',
    ]);
  });

  for (const scenario of portedScenarios) {
    it(`${scenario.id} executes the ${scenario.oodsComponentId} contract`, async () => {
      const implementation = implementations[scenario.oodsComponentId];
      expect(implementation, scenario.id).toBeDefined();
      const wrapper = mount(implementation, { props: scenario.props });
      const component = wrapper.get(`[data-oods-component="${scenario.oodsComponentId}"]`);

      switch (scenario.id) {
        case 'audit-timeline-transitions': {
          expect(component.attributes('role')).toBe('log');
          expect(component.get('time').attributes('datetime')).toBe('2026-09-05T12:00:00Z');
          expect(component.get('[data-timeline-label="true"]').text()).toBe('Subscription created');
          break;
        }
        case 'cancellation-summary-boolean': {
          expect(component.get('dt').text()).toBe('Cancel at period end');
          expect(component.get('dd').text()).toBe('Yes');
          expect(component.text()).not.toContain('true');
          break;
        }
        case 'pagination-bar-navigation': {
          expect(component.attributes('aria-label')).toBe('Pagination');
          expect(component.get('[aria-current="page"]').text()).toBe('2');
          expect(component.get('[data-pagination-range="true"]').text()).toBe('Showing 26–50 of 80');
          await component.get('[data-pagination-next="true"]').trigger('click');
          expect(wrapper.emitted('pageChange')).toEqual([[3]]);
          expect(wrapper.emitted('change')).toEqual([[3]]);
          expect(wrapper.emitted('update')).toEqual([[3]]);
          break;
        }
        case 'price-badge-currency': {
          expect(component.attributes('data-price')).toBe('true');
          expect(component.attributes('data-badge-variant')).toBe('price');
          expect(component.attributes('data-badge-variant')).not.toBe('usd');
          expect(component.attributes('data-currency')).toBe('USD');
          expect(component.text()).toMatch(/\$25\.00|US\$25\.00/);
          break;
        }
        case 'relative-timestamp-fixed': {
          expect(component.element.tagName).toBe('TIME');
          expect(component.attributes('datetime')).toBe('2026-09-05T12:00:00Z');
          expect(component.text()).toBe('2 hours ago');
          break;
        }
        case 'search-input-clear': {
          const input = component.get('input[type="search"]');
          expect((input.element as HTMLInputElement).value).toBe('past due');
          expect(component.get('[data-search-clear="true"]').attributes('aria-label')).toBe('Clear search');
          await component.get('[data-search-clear="true"]').trigger('click');
          expect(wrapper.emitted('clear')).toEqual([[]]);
          expect(wrapper.emitted('valueChange')).toEqual([['']]);
          expect(wrapper.emitted('update')).toEqual([['']]);
          break;
        }
        case 'status-badge-mapped': {
          expect(component.text()).toContain('Past Due');
          expect(component.attributes('data-tone')).toBe('critical');
          expect(component.attributes('title')).toContain('Renewal payment failed');
          // s222-m02 (#2502 ruling 11): the status mark is the shared SVG alert icon, not the ⚠︎ glyph.
          expect(component.get('.oods-badge__icon svg path').attributes('d')).toBe('M8 2.5l6 11H2z');
          expect(component.get('.oods-badge__icon').text()).toBe('');
          break;
        }
        case 'status-timeline-history': {
          expect(component.get('[data-timeline-current="true"]').text()).toContain('Current status: Active');
          expect(component.get('[data-timeline-transitions="true"]').text()).toContain('past_due, cancelled');
          expect(component.get('[data-timeline-empty="true"]').text()).toBe('No events');
          break;
        }
        default:
          throw new Error(`Missing executable Vue assertion for ${scenario.id}`);
      }
      wrapper.unmount();
    });
  }

  it('debounces search publication while keeping the model update immediate', async () => {
    vi.useFakeTimers();
    const wrapper = mount(SearchInput, {
      props: { debounceMs: 200, minQueryLength: 2 },
    });
    await wrapper.get('input').setValue('pa');
    expect(wrapper.emitted('update:modelValue')).toEqual([['pa']]);
    expect(wrapper.emitted('search')).toBeUndefined();
    await vi.advanceTimersByTimeAsync(199);
    expect(wrapper.emitted('search')).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(wrapper.emitted('valueChange')).toEqual([['pa']]);
    expect(wrapper.emitted('search')).toEqual([['pa']]);
    wrapper.unmount();
    vi.useRealTimers();
  });
});
