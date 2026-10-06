import { mount } from '@vue/test-utils';
import { h } from 'vue';
import { describe, expect, it } from 'vitest';
import { ArchivedRowOverlay, BillingCardMeta, CycleProgressCard, PaymentEventTimeline, PaymentTimeline } from '../src/index.js';

const period = { periodStart: '2026-01-01T00:00:00Z', periodEnd: '2026-01-31T00:00:00Z', now: '2026-01-13T00:00:00Z' };
describe('Billable and Archivable presentation intent', () => {
  it.each([
    [{ ...period, progress: 0.4 }, 40, '18 days'],
    [{ ...period, now: '2026-01-16T00:00:00Z' }, 50, '15 days'],
    [{ ...period, progress: 0.4, now: '2026-02-01T00:00:00Z' }, 100, '0 days'],
  ] as const)('announces the actual cycle and lets an ended period override stale progress', (props, percent, days) => {
    const wrapper = mount(CycleProgressCard, { props });
    expect(wrapper.get('progress').element.value).toBe(percent);
    expect(wrapper.get('progress').attributes('aria-label')).toBe(`${percent}% complete · ${days} remaining`);
    wrapper.unmount();
  });
  it.each([PaymentTimeline, PaymentEventTimeline])('keeps payment dates chronological and names a missing next payment', async (Component) => {
    const wrapper = mount(Component, { props: { lastPayment: '2026-02-01T00:00:00Z', nextPayment: '2026-01-01T00:00:00Z', amount: 0, currency: 'usd', paymentStatus: 'failed' } });
    expect(wrapper.findAll('time').map((time) => time.attributes('datetime'))).toEqual(['2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z']);
    expect(wrapper.text()).toContain('$0.00 USD · failed');
    await wrapper.setProps({ nextPayment: undefined, amount: 1999, currency: 'jpy', minorUnits: 1 });
    expect(wrapper.text()).toContain('No payment scheduled');
    expect(wrapper.text()).toContain('¥1,999 JPY');
    expect(wrapper.text()).not.toContain('undefined');
    wrapper.unmount();
  });
  it('preserves minor units in the card phrase', () => {
    const wrapper = mount(BillingCardMeta, { props: { amount: 1999, currency: 'usd', minorUnits: 100, interval: 'yearly' } });
    expect(wrapper.text()).toBe('$19.99 · yearly'); wrapper.unmount();
  });
  it('keeps active children untouched and archived children accessible with the trait label', async () => {
    const wrapper = mount(ArchivedRowOverlay, { slots: { default: () => h('button', 'Team') } });
    expect(wrapper.text()).toBe('Team'); expect(wrapper.attributes('data-archived')).toBeUndefined(); expect(wrapper.attributes('role')).toBeUndefined();
    await wrapper.setProps({ isArchived: true, label: 'Team', tabLabel: 'Past subscriptions' });
    expect(wrapper.attributes('aria-label')).toBe('Past subscriptions: Team');
    expect(wrapper.attributes('aria-hidden')).toBe('false'); expect(wrapper.attributes('data-archive-tab')).toBe('Past subscriptions');
    expect(wrapper.get('button').text()).toBe('Team');
    await wrapper.setProps({ showBadge: false, separateTab: false });
    expect(wrapper.text()).toBe('Team'); expect(wrapper.attributes('data-archive-tab')).toBeUndefined(); wrapper.unmount();
  });
});
