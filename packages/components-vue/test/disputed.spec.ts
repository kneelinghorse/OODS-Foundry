import { mount } from '@vue/test-utils';
import { h, isProxy } from 'vue';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AuditSummaryCard, SortIndicator, TimelineEntryLabel, InlineLabel } from '../src/index.js';
describe('the last three retained component obligations', () => {
  it('announces audit summary terms and the latest real actor/time, with honest absence', async () => {
    const wrapper = mount(AuditSummaryCard, { props: { auditLog: [{ transitioned_at: '2026-09-06T12:00:00Z', actor_id: 'last', to_state: 'paused' }, { transitioned_at: '2026-09-05T12:00:00Z', actor_id: 'first' }] } });
    expect(wrapper.text()).toContain('Transitions2Last actorlastLast transitionSep 6, 2026, 12:00 PM'); expect(wrapper.get('time').attributes('datetime')).toBe('2026-09-06T12:00:00Z');
    await wrapper.setProps({ auditLog: [], showLastActor: false }); expect(wrapper.text()).not.toContain('Last actor'); expect(wrapper.text()).toContain('Not recorded'); wrapper.unmount();
  });
  it('cycles aria-sort using Enter, Space and pointer and emits exactly one state per activation', async () => {
    const user = userEvent.setup(); const wrapper = mount(SortIndicator, { attachTo: document.body, props: { sortField: 'name' }, attrs: { 'data-oods-action': 'sortRows' } });
    try {
      expect(wrapper.findAll('[data-oods-action]')).toHaveLength(1); expect(wrapper.get('[data-oods-action="sortRows"]').element.tagName).toBe('BUTTON');
      const button = wrapper.get('button').element; await user.tab(); expect(document.activeElement).toBe(button); expect(wrapper.get('th').attributes('aria-sort')).toBe('none');
      await user.keyboard('{Enter}'); expect(wrapper.get('th').attributes('aria-sort')).toBe('ascending');
      await user.keyboard(' '); expect(wrapper.get('th').attributes('aria-sort')).toBe('descending');
      await user.click(button); expect(wrapper.get('th').attributes('aria-sort')).toBe('none');
      expect(wrapper.emitted('change')?.some(([state]) => isProxy(state))).toBe(false);
      expect(() => structuredClone(wrapper.emitted('change'))).not.toThrow();
      expect(wrapper.emitted('change')?.map(([state]) => state)).toEqual([{ field: 'name', direction: 'asc', active: true }, { field: 'name', direction: 'desc', active: true }, { field: 'name', direction: 'asc', active: false }]);
      await wrapper.setProps({ sortField: 'price', sortActive: true, sortDirection: 'desc', triStateSort: false }); await user.click(button); expect(wrapper.get('th').attributes('aria-sort')).toBe('ascending');
    } finally { wrapper.unmount(); }
  });
  it.each([undefined, 8, 0, 'invalid'] as const)('matches InlineLabel truncation for maxLength=%s', maxLength => {
    const label = 'A sufficiently long timeline label which needs compact truncation';
    const inline = mount(InlineLabel, { props: { label, maxLength: maxLength ?? 40 } }); const timeline = mount(TimelineEntryLabel, { props: { label, maxLength } });
    expect(timeline.text()).toBe(inline.text()); expect(timeline.attributes('data-oods-component')).toBe('TimelineEntryLabel'); inline.unmount(); timeline.unmount();
  });
  it('keeps full labels outside compact mode and honors authored child content', () => {
    const full = mount(TimelineEntryLabel, { props: { compact: false, label: 'x'.repeat(80) } }); expect(full.text()).toHaveLength(80); full.unmount();
    const authored = mount(TimelineEntryLabel, { props: { label: 'ignored' }, slots: { default: () => h('strong', 'Authored label') } }); expect(authored.get('strong').text()).toBe('Authored label'); authored.unmount();
  });
});
