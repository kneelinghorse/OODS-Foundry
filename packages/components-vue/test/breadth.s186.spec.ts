import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref } from 'vue';
import { describe, expect, it } from 'vitest';

import {
  AddressCollectionPanel, AddressSummaryBadge, AddressValidationTimeline, AuditEvent, ClassificationPanel, FilterPanel,
  MembershipAuditTimeline, MembershipPanel, MessageEventTimeline, MessageStatusBadge, PreferencePanel, PreferenceSummaryBadge,
  PreferenceTimeline, PriceSummary, RoleBadgeList, TagManager, TagPills,
  AddressEditor, PreferenceEditor, RoleAssignmentForm, StatusSelector, TagInput, TemplatePicker,
} from '../src/index.js';

// Every expectation here mirrors the HTML renderer (renderPanelSection,
// renderFilterPanel, renderSummarySection): same aliases, same precedence,
// same fallbacks, same unwired controls.
describe('Sprint 186 Vue wave-2 components', () => {
  it('ClassificationPanel defaults its heading, resolves aliases in renderer order, and lets the slot replace the summary', async () => {
    const wrapper = mount(ClassificationPanel, { attrs: { id: 'panel', class: 'consumer' } });
    try {
      expect(wrapper.element.tagName).toBe('SECTION');
      expect(wrapper.attributes('id')).toBe('panel');
      expect(wrapper.classes()).toContain('consumer');
      expect(wrapper.attributes('data-panel-type')).toBe('classification');
      expect(wrapper.get('[data-panel-header] > h2').text()).toBe('Classification');
      expect(wrapper.find('[data-panel-subtitle]').exists()).toBe(false);
      expect(wrapper.get('[data-panel-content]').element.childNodes).toHaveLength(0);
      await wrapper.setProps({ name: 'By name', metadata: 'Meta', emptyMessage: 'Empty' });
      expect(wrapper.get('h2').text()).toBe('By name');
      expect(wrapper.get('[data-panel-subtitle]').text()).toBe('Meta');
      expect(wrapper.get('[data-panel-content] > [data-panel-summary]').text()).toBe('Empty');
      await wrapper.setProps({ heading: 'By heading', description: 'Description', body: 'Body' });
      expect(wrapper.get('h2').text()).toBe('By heading');
      expect(wrapper.get('[data-panel-subtitle]').text()).toBe('Description');
      expect(wrapper.get('[data-panel-summary]').text()).toBe('Body');
      await wrapper.setProps({ label: 'By label', subtitle: 'Subtitle', text: 'Text' });
      expect(wrapper.get('h2').text()).toBe('By label');
      expect(wrapper.get('[data-panel-subtitle]').text()).toBe('Subtitle');
      expect(wrapper.get('[data-panel-summary]').text()).toBe('Text');
      await wrapper.setProps({ title: 'By title', summary: 'Summary' });
      expect(wrapper.get('h2').text()).toBe('By title');
      expect(wrapper.get('[data-panel-summary]').text()).toBe('Summary');
      await wrapper.setProps({ title: ' ' });
      expect(wrapper.get('h2').text()).toBe('By label');
      for (const attribute of ['title', 'label', 'heading', 'name']) expect(wrapper.attributes(attribute)).toBeUndefined();
    } finally { wrapper.unmount(); }
  });

  it('ClassificationPanel renders authored slot content in the content area instead of the summary', () => {
    const wrapper = mount(ClassificationPanel, {
      props: { summary: 'Summary' },
      slots: { default: () => h('ul', [h('li', 'Electronics')]) },
    });
    try {
      expect(wrapper.find('[data-panel-summary]').exists()).toBe(false);
      expect(wrapper.get('[data-panel-content] > ul > li').text()).toBe('Electronics');
    } finally { wrapper.unmount(); }
    const text = mount(ClassificationPanel, { props: { summary: 'Summary' }, slots: { default: () => 'Bound text' } });
    try {
      expect(text.get('[data-panel-content]').text()).toBe('Bound text');
    } finally { text.unmount(); }
  });

  it('FilterPanel renders an empty immediate region by default and labels descriptors by label, field, then Filter', async () => {
    const wrapper = mount(FilterPanel, { attrs: { id: 'filters' } });
    try {
      expect(wrapper.element.tagName).toBe('ASIDE');
      expect(wrapper.attributes('id')).toBe('filters');
      expect(wrapper.attributes('role')).toBe('region');
      expect(wrapper.attributes('aria-label')).toBe('Filters');
      expect(wrapper.attributes('data-behavioral')).toBe('filter');
      expect(wrapper.attributes('data-filter-mode')).toBe('immediate');
      expect(wrapper.find('fieldset, button, [data-active-filters]').exists()).toBe(false);
      await wrapper.setProps({ filters: [{ field: 'status', label: 'Status' }, { field: 'release_channel' }, {}, 'bogus' as never, null as never] });
      expect(wrapper.findAll('legend').map((legend) => legend.text())).toEqual(['Status', 'release_channel', 'Filter']);
      expect(wrapper.findAll('fieldset[data-collapsible="true"]')).toHaveLength(3);
      await wrapper.setProps({ collapsible: false });
      expect(wrapper.get('fieldset').attributes('data-collapsible')).toBeUndefined();
      await wrapper.setProps({ mode: '' });
      expect(wrapper.attributes('data-filter-mode')).toBe('immediate');
    } finally { wrapper.unmount(); }
  });

  it('FilterPanel announces the active count politely and reactively, adds Apply only in batch mode, and stays unwired', async () => {
    const active = ref<Array<Record<string, unknown>>>([{ field: 'status', operator: 'eq', value: 'active' }]);
    const mode = ref('immediate');
    const wrapper = mount(defineComponent({
      setup: () => () => h(FilterPanel, { activeFilters: active.value, mode: mode.value }),
    }));
    try {
      const live = wrapper.get('[data-active-filters]');
      expect(live.attributes('aria-live')).toBe('polite');
      expect(wrapper.get('[data-filter-count]').text()).toBe('1 active');
      expect(wrapper.find('button[data-filter-apply]').exists()).toBe(false);
      const clear = wrapper.get('button[data-filter-clear-all]');
      expect(clear.attributes('type')).toBe('button');
      await clear.trigger('click');
      // Only the native click bubbles; the panel declares no emits and changes nothing on activation.
      expect(Object.keys(wrapper.emitted())).toEqual(['click']);
      expect(wrapper.get('[data-filter-count]').text()).toBe('1 active');
      active.value = [...active.value, { field: 'sku', operator: 'in', value: [] }];
      mode.value = 'batch';
      await nextTick();
      expect(wrapper.get('[data-filter-count]').text()).toBe('2 active');
      expect(wrapper.get('button[data-filter-apply]').text()).toBe('Apply');
      active.value = [];
      await nextTick();
      expect(wrapper.find('[data-active-filters]').exists()).toBe(false);
    } finally { wrapper.unmount(); }
    const authored = mount(FilterPanel, { props: { mode: 'batch', filters: [{ field: 'status' }] }, slots: { default: () => h('p', 'Authored filters') } });
    try {
      expect(authored.find('fieldset, button').exists()).toBe(false);
      expect(authored.get('aside > p').text()).toBe('Authored filters');
    } finally { authored.unmount(); }
  });

  for (const [name, Panel, panelType, defaultTitle] of [
    ['AddressCollectionPanel', AddressCollectionPanel, 'address', 'Addresses'],
    ['MembershipPanel', MembershipPanel, 'membership', 'Membership'],
    ['PreferencePanel', PreferencePanel, 'preference', 'Preferences'],
  ] as const) {
    it(`${name} mirrors renderPanelSection with its own marker, panel type and default title`, async () => {
      const wrapper = mount(Panel, { attrs: { id: 'panel' } });
      try {
        expect(wrapper.element.tagName).toBe('SECTION');
        expect(wrapper.attributes('id')).toBe('panel');
        expect(wrapper.attributes('data-oods-component')).toBe(name);
        expect(wrapper.attributes('data-panel-type')).toBe(panelType);
        expect(wrapper.get('[data-panel-header] > h2').text()).toBe(defaultTitle);
        expect(wrapper.get('[data-panel-content]').element.childNodes).toHaveLength(0);
        await wrapper.setProps({ name: 'By name', metadata: 'Meta', emptyMessage: 'Empty' });
        expect(wrapper.get('h2').text()).toBe('By name');
        expect(wrapper.get('[data-panel-subtitle]').text()).toBe('Meta');
        expect(wrapper.get('[data-panel-summary]').text()).toBe('Empty');
        for (const attribute of ['name', 'metadata', 'emptyMessage']) expect(wrapper.attributes(attribute)).toBeUndefined();
      } finally { wrapper.unmount(); }
      const authored = mount(Panel, { props: { summary: 'Summary' }, slots: { default: () => h('p', 'Authored') } });
      try {
        expect(authored.find('[data-panel-summary]').exists()).toBe(false);
        expect(authored.get('[data-panel-content] > p').text()).toBe('Authored');
      } finally { authored.unmount(); }
    });
  }

  it('TagManager mirrors renderTagManager: aliases, tag normalization, the labelled add input, and an unwired submit', async () => {
    const wrapper = mount(TagManager, { attrs: { id: 'tags' } });
    try {
      expect(wrapper.element.tagName).toBe('FORM');
      expect(wrapper.attributes('id')).toBe('tags');
      expect(wrapper.attributes('data-form-type')).toBe('tag-manager');
      expect(wrapper.get('[data-form-header] > h2').text()).toBe('Tag Manager');
      expect(wrapper.find('[data-form-subtitle]').exists()).toBe(false);
      expect(wrapper.findAll('[data-tag-item]')).toHaveLength(0);
      const input = wrapper.get('input[name="newTag"]');
      expect(wrapper.get('[data-form-control="input"] > span').text()).toBe('Add Tag');
      await input.setValue('gamma');
      const submit = new Event('submit', { cancelable: true });
      wrapper.element.dispatchEvent(submit);
      expect(submit.defaultPrevented).toBe(true);
      expect((input.element as HTMLInputElement).value).toBe('gamma');
      await wrapper.setProps({ heading: 'By heading', hint: 'Hint', tags: ['alpha', { label: 'beta' }, { name: 'gamma' }, { role: 'delta' }, { value: 'epsilon' }, { id: 'zeta' }, 7, true, null, undefined, { other: 'ignored' }, ''] });
      expect(wrapper.get('h2').text()).toBe('By heading');
      expect(wrapper.get('[data-form-subtitle]').text()).toBe('Hint');
      expect(wrapper.findAll('[data-tag-item]').map((item) => item.text())).toEqual(['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', '7', 'true']);
      await wrapper.setProps({ label: 'By label', description: 'Description', tags: undefined, value: ['from value'] });
      expect(wrapper.get('h2').text()).toBe('By label');
      expect(wrapper.get('[data-form-subtitle]').text()).toBe('Description');
      expect(wrapper.findAll('[data-tag-item]').map((item) => item.text())).toEqual(['from value']);
      for (const attribute of ['tags', 'value', 'label', 'heading', 'hint']) expect(wrapper.attributes(attribute)).toBeUndefined();
    } finally { wrapper.unmount(); }
    const authored = mount(TagManager, { props: { tags: ['alpha'] }, slots: { default: () => h('ul', [h('li', 'Authored tags')]) } });
    try {
      expect(authored.find('[data-tag-list], input').exists()).toBe(false);
      expect(authored.get('[data-form-content] > ul > li').text()).toBe('Authored tags');
    } finally { authored.unmount(); }
  });

  it('TagPills substitutes {{ tag_count }} with the total count, limits visible pills, and falls back to +hidden without a template', async () => {
    const wrapper = mount(TagPills, { props: { tags: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'], maxVisible: 3, overflowLabel: '+{{ tag_count }}' } });
    const pills = () => wrapper.findAll('[data-tag-pill]').map((pill) => pill.text());
    const overflow = () => (wrapper.find('[data-tag-overflow]').exists() ? wrapper.get('[data-tag-overflow]').text() : null);
    try {
      expect(wrapper.attributes('data-summary-type')).toBe('tag-pills');
      expect(pills()).toEqual(['alpha', 'beta', 'gamma']);
      expect(overflow()).toBe('+5');
      expect(wrapper.text()).not.toContain('{{ tag_count }}');
      await wrapper.setProps({ tags: ['alpha', 'beta', 'gamma'], maxVisible: '2', overflowLabel: undefined });
      expect(pills()).toEqual(['alpha', 'beta']);
      expect(overflow()).toBe('+1');
      await wrapper.setProps({ tags: undefined, value: [{ label: 'from value' }, 7], maxVisible: undefined });
      expect(pills()).toEqual(['from value', '7']);
      expect(overflow()).toBeNull();
      await wrapper.setProps({ value: undefined, tags: ['alpha'], maxVisible: 0, overflowLabel: '{{ tag_count }} tags hidden' });
      expect(pills()).toEqual([]);
      expect(overflow()).toBe('1 tags hidden');
    } finally { wrapper.unmount(); }
    const authored = mount(TagPills, { props: { tags: ['alpha'] }, slots: { default: () => h('em', 'Authored') } });
    try {
      expect(authored.find('[data-tag-pill]').exists()).toBe(false);
      expect(authored.get('em').text()).toBe('Authored');
    } finally { authored.unmount(); }
  });

  it('badge-family summaries resolve label and status aliases in renderer order over the Badge substrate', async () => {
    const address = mount(AddressSummaryBadge, { props: { role: 'billing' }, attrs: { id: 'address' } });
    try {
      expect(address.attributes('data-oods-component')).toBe('AddressSummaryBadge');
      expect(address.classes()).toContain('oods-badge');
      expect(address.get('[data-oods-badge-label]').text()).toBe('billing');
      expect(address.attributes('data-badge-status')).toBe('billing');
      expect(address.attributes('data-badge-variant')).toBe('address');
      expect(address.attributes('role')).toBeUndefined();
      expect(address.attributes('id')).toBe('address');
      await address.setProps({ text: 'Text alias', state: 'verified', variant: 'compact' });
      expect(address.get('[data-oods-badge-label]').text()).toBe('Text alias');
      expect(address.attributes('data-badge-status')).toBe('verified');
      expect(address.attributes('data-badge-variant')).toBe('compact');
    } finally { address.unmount(); }
    const message = mount(MessageStatusBadge);
    try {
      expect(message.get('[data-oods-badge-label]').text()).toBe('Message');
      expect(message.attributes('data-badge-status')).toBeUndefined();
      expect(message.attributes('data-badge-variant')).toBe('message');
      await message.setProps({ value: 'queued', delivery: 'sent' });
      expect(message.get('[data-oods-badge-label]').text()).toBe('sent');
      expect(message.attributes('data-badge-status')).toBe('sent');
    } finally { message.unmount(); }
    const preference = mount(PreferenceSummaryBadge, { props: { version: 'v2', tone: 'warning', emphasis: 'solid' } });
    try {
      expect(preference.get('[data-oods-badge-label]').text()).toBe('Preferences');
      expect(preference.attributes('data-badge-status')).toBe('v2');
      expect(preference.attributes('data-tone')).toBe('warning');
      expect(preference.attributes('data-emphasis')).toBe('solid');
    } finally { preference.unmount(); }
    const authored = mount(PreferenceSummaryBadge, { props: { namespace: 'alerts' }, slots: { default: () => h('strong', 'Authored') } });
    try {
      expect(authored.find('[data-oods-badge-label]').exists()).toBe(false);
      expect(authored.get('strong').text()).toBe('Authored');
    } finally { authored.unmount(); }
    const roles = mount(RoleBadgeList);
    try {
      expect(roles.text()).toBe('Roles');
      expect(roles.attributes('data-badge-variant')).toBe('roles');
      await roles.setProps({ badges: [{ name: 'owner' }, { role: 'admin' }], tone: 'accent', label: 'Unused' });
      expect(roles.findAll('[data-role-badge]').map((item) => item.text())).toEqual(['owner', 'admin']);
      expect(roles.attributes('data-badge-variant')).toBe('accent');
      // label outranks text in the fallback, exactly as renderRoleBadgeList reads them.
      await roles.setProps({ badges: undefined, roles: [], text: 'No roles yet' });
      expect(roles.text()).toBe('Unused');
      await roles.setProps({ label: undefined });
      expect(roles.text()).toBe('No roles yet');
    } finally { roles.unmount(); }
  });

  it('timeline-family logs mirror renderTimelineContainer: title aliases, first-array event keys, item aliases, empty state and authored children', async () => {
    const wrapper = mount(MessageEventTimeline, { attrs: { id: 'log' }, props: { messages: [{ title: 'Welcome email', at: '2026-09-01T09:00:00Z' }], statuses: [{ status: 'delivered' }] } });
    const labels = () => wrapper.findAll('[data-timeline-label]').map((item) => item.text());
    try {
      expect(wrapper.attributes('data-oods-component')).toBe('MessageEventTimeline');
      expect(wrapper.attributes('role')).toBe('log');
      expect(wrapper.attributes('id')).toBe('log');
      expect(wrapper.attributes('data-timeline-type')).toBe('message');
      expect(wrapper.get('h2[data-timeline-title]').text()).toBe('Message Timeline');
      // messages precede statuses in the renderer's event keys, so statuses are ignored here.
      expect(labels()).toEqual(['Welcome email']);
      expect(wrapper.get('time[data-timeline-time]').attributes('datetime')).toBe('2026-09-01T09:00:00Z');
      await wrapper.setProps({ name: 'By name', heading: 'By heading', messages: undefined, statuses: [{ state: 'queued', updatedAt: '2026-09-01T10:00:00Z', from: 'a', to: 'b' }, 7, null, 'plain'] });
      expect(wrapper.get('h2').text()).toBe('By heading');
      expect(labels()).toEqual(['queued', '7', 'plain']);
      expect(wrapper.get('[data-timeline-detail]').text()).toBe('a');
      await wrapper.setProps({ statuses: [] });
      expect(wrapper.get('[data-timeline-empty]').text()).toBe('No events');
      expect(wrapper.findAll('[data-timeline-events] > li')).toHaveLength(1);
    } finally { wrapper.unmount(); }
    const authored = mount(PreferenceTimeline, { props: { title: 'Authored', changes: [{ event: 'x' }] }, slots: { default: () => h('li', 'Authored event') } });
    try {
      expect(authored.find('[data-timeline-label]').exists()).toBe(false);
      expect(authored.get('[data-timeline-events] > li').text()).toBe('Authored event');
    } finally { authored.unmount(); }
    const membership = mount(MembershipAuditTimeline, { props: { history: [{ name: 'Joined workspace', createdAt: '2026-08-01T00:00:00Z', reason: 'Invited' }] } });
    try {
      expect(membership.attributes('data-timeline-type')).toBe('membership');
      expect(membership.get('h2').text()).toBe('Membership Timeline');
      expect(membership.get('[data-timeline-label]').text()).toBe('Joined workspace');
      expect(membership.get('[data-timeline-detail]').text()).toBe('Invited');
    } finally { membership.unmount(); }
    const address = mount(AddressValidationTimeline, { props: { validations: [] } });
    try {
      expect(address.get('h2').text()).toBe('Address Validation Timeline');
      expect(address.get('[data-timeline-empty]').text()).toBe('No events');
    } finally { address.unmount(); }
  });

  it('AuditEvent mirrors renderEventArticle alias orders, with a lone reason as both label and detail', async () => {
    const wrapper = mount(AuditEvent, { attrs: { id: 'event' } });
    try {
      expect(wrapper.element.tagName).toBe('ARTICLE');
      expect(wrapper.attributes('id')).toBe('event');
      expect(wrapper.attributes('data-event-type')).toBe('audit');
      expect(wrapper.get('[data-event-label]').text()).toBe('Audit Event');
      expect(wrapper.find('time, [data-event-detail]').exists()).toBe(false);
      await wrapper.setProps({ reason: 'Rotated keys' });
      expect(wrapper.get('[data-event-label]').text()).toBe('Rotated keys');
      expect(wrapper.get('[data-event-detail]').text()).toBe('Rotated keys');
      await wrapper.setProps({ status: 'active', state: 'ignored', reason: 'Why', text: 'ignored', createdAt: '2026-01-01T00:00:00Z', updatedAt: 'ignored', code: 'E1', message: 'Msg' });
      expect(wrapper.get('[data-event-label]').text()).toBe('active');
      expect(wrapper.get('time[data-event-time]').attributes('datetime')).toBe('2026-01-01T00:00:00Z');
      expect(wrapper.get('[data-event-detail]').text()).toBe('Why');
    } finally { wrapper.unmount(); }
    const authored = mount(AuditEvent, { props: { event: 'user.updated' }, slots: { default: () => h('p', 'Authored body') } });
    try {
      expect(authored.find('[data-event-label]').exists()).toBe(false);
      expect(authored.get('p').text()).toBe('Authored body');
    } finally { authored.unmount(); }
  });

  it('PriceSummary reads each term from its aliases in renderer order, formats zero as currency, and falls back to a paragraph or an empty list', async () => {
    const wrapper = mount(PriceSummary, { attrs: { id: 'summary', lang: 'en' } });
    const items = () => wrapper.findAll('[data-summary-item]').map((item) => [item.get('dt').text(), item.get('dd').text()]);
    try {
      expect(wrapper.element.tagName).toBe('SECTION');
      expect(wrapper.attributes('id')).toBe('summary');
      expect(wrapper.attributes('lang')).toBe('en');
      expect(wrapper.attributes('data-summary-type')).toBe('price');
      expect(wrapper.get('h2[data-summary-title]').text()).toBe('Price Summary');
      expect(wrapper.get('dl').element.childNodes).toHaveLength(0);
      await wrapper.setProps({ unitAmountCents: 0, currencyCode: 'eur', pricingModel: 'tiered', billingInterval: 'year' });
      expect(items()).toEqual([['Amount', '€0.00'], ['Currency', 'eur'], ['Model', 'Tiered'], ['Interval', 'Year']]);
      await wrapper.setProps({ amountCents: 2500, currency: '', model: 'recurring', interval: 'month' });
      expect(items()).toEqual([['Amount', '€25.00'], ['Currency', 'eur'], ['Model', 'Recurring'], ['Interval', 'Month']]);
      await wrapper.setProps({ amount: '29.00', currency: 'usd' });
      expect(items()[0]).toEqual(['Amount', '$0.29']);
      expect(items()[1]).toEqual(['Currency', 'usd']);
      await wrapper.setProps({ label: 'Plan pricing', heading: 'Ignored' });
      expect(wrapper.get('h2').text()).toBe('Plan pricing');
      for (const attribute of ['label', 'heading', 'amount', 'currency', 'model', 'interval']) expect(wrapper.attributes(attribute)).toBeUndefined();
    } finally { wrapper.unmount(); }
    const fallback = mount(PriceSummary, { props: { text: 'No price recorded' } });
    try {
      expect(fallback.find('dl').exists()).toBe(false);
      expect(fallback.get('p[data-summary-fallback]').text()).toBe('No price recorded');
    } finally { fallback.unmount(); }
    const authored = mount(PriceSummary, {
      props: { amount: 1, summary: 'Unused fallback' },
      slots: { default: () => h('dl', [h('div', { 'data-summary-item': 'true' }, [h('dt', 'Authored'), h('dd', 'Value')])]) },
    });
    try {
      expect(authored.findAll('[data-summary-item]').map((item) => [item.get('dt').text(), item.get('dd').text()])).toEqual([['Authored', 'Value']]);
      expect(authored.find('[data-summary-fallback]').exists()).toBe(false);
    } finally { authored.unmount(); }
  });

  // m05: the form family mirrors renderFormContainer and its control renderers.
  it('StatusSelector defaults its label and options, honours status, and emits the chosen value with modelValue', async () => {
    const wrapper = mount(StatusSelector, { props: { status: 'inactive' } });
    expect(wrapper.attributes('data-summary-type')).toBe('status-selector');
    expect(wrapper.get('label > span').text()).toBe('Status');
    const select = wrapper.get('select[name="status"]');
    expect([...(select.element as HTMLSelectElement).options].map((option) => option.value)).toEqual(['draft', 'active', 'inactive']);
    expect((select.element as HTMLSelectElement).value).toBe('inactive');
    await wrapper.setProps({ title: 'Lifecycle', options: [{ id: 'a', label: 'Alpha' }, 'beta', null], modelValue: 'beta' });
    expect(wrapper.get('label > span').text()).toBe('Lifecycle');
    // s221-m01: a scalar option's label is readable (s215-m01 #2388, 25d727945); the authored 'Alpha' still wins.
    expect([...(select.element as HTMLSelectElement).options].map((option) => [option.value, option.textContent])).toEqual([['a', 'Alpha'], ['beta', 'Beta']]);
    expect((select.element as HTMLSelectElement).value).toBe('beta');
    await select.setValue('a');
    expect(wrapper.emitted('update:modelValue')).toEqual([['a']]);
    expect(wrapper.emitted('change')).toEqual([['a']]);
    const authored = mount(StatusSelector, { props: { options: [] }, slots: { default: () => h('em', 'Authored') } });
    expect(authored.find('select').exists()).toBe(false);
    expect(authored.text()).toBe('Authored');
  });

  it('TagInput resolves its legend from title/label/heading/name, lists normalized tags, and forwards typed text', async () => {
    const wrapper = mount(TagInput, { props: { name: 'By name', hint: 'Hint' } });
    expect(wrapper.element.tagName).toBe('FIELDSET');
    expect(wrapper.get('legend').text()).toBe('By name');
    expect(wrapper.get('[data-form-subtitle]').text()).toBe('Hint');
    expect(wrapper.find('[data-tag-list]').exists()).toBe(false);
    const input = wrapper.get('input[name="tag"]');
    expect((input.element as HTMLInputElement).value).toBe('');
    await input.setValue('x');
    expect(wrapper.emitted('update:modelValue')).toEqual([['x']]);
    expect(wrapper.emitted('input')).toEqual([['x']]);
    // setValue triggers input then change on a text input.
    expect(wrapper.emitted('change')).toEqual([['x']]);
    await wrapper.setProps({ heading: 'By heading', tags: [{ label: 'Alpha' }, { name: 'Beta' }, { id: 'id-only' }, 'gamma', 4] });
    expect(wrapper.get('legend').text()).toBe('By heading');
    expect(wrapper.findAll('[data-tag-item]').map((item) => item.text())).toEqual(['Alpha', 'Beta', 'id-only', 'gamma', '4']);
    expect(mount(TagInput).get('legend').text()).toBe('Tag Input');
  });

  it('AddressEditor resolves street/region/postal aliases in renderer order and emits the whole record from any input', async () => {
    const wrapper = mount(AddressEditor, { props: { line1: 'L1', state: 'CA', zip: '90210' } });
    expect(wrapper.get('[data-form-header] > h2').text()).toBe('Address Editor');
    expect((wrapper.get('input[name="street"]').element as HTMLInputElement).value).toBe('L1');
    expect((wrapper.get('input[name="region"]').element as HTMLInputElement).value).toBe('CA');
    expect((wrapper.get('input[name="postalCode"]').element as HTMLInputElement).value).toBe('90210');
    await wrapper.get('input[name="street"]').setValue('New');
    expect(wrapper.emitted('change')).toEqual([[{ street: 'New', city: '', region: 'CA', postalCode: '90210' }]]);
  });

  it('PreferenceEditor, RoleAssignmentForm and TemplatePicker default their titles and options and let the slot replace the body', async () => {
    const preference = mount(PreferenceEditor);
    expect(preference.get('[data-form-header] > h2').text()).toBe('Preference Editor');
    expect([...(preference.get('select[name="namespace"]').element as HTMLSelectElement).options].map((option) => option.value)).toEqual(['default']);
    expect((preference.get('textarea').element as HTMLTextAreaElement).value).toBe('');
    await preference.setProps({ json: '{"a":1}', namespaces: ['x'] });
    expect((preference.get('textarea').element as HTMLTextAreaElement).value).toBe('{"a":1}');
    const role = mount(RoleAssignmentForm);
    expect(role.get('[data-form-header] > h2').text()).toBe('Role Assignment');
    expect([...(role.get('select[name="role"]').element as HTMLSelectElement).options].map((option) => option.textContent)).toEqual(['Select...']);
    await role.setProps({ roles: ['admin'], availableRoles: ['viewer'], defaultRoleId: 'admin', member: 'm@example.test' });
    expect([...(role.get('select[name="role"]').element as HTMLSelectElement).options].map((option) => option.value)).toEqual(['admin']);
    expect((role.get('select[name="role"]').element as HTMLSelectElement).value).toBe('admin');
    expect((role.get('input[name="assignee"]').element as HTMLInputElement).value).toBe('m@example.test');
    const picker = mount(TemplatePicker);
    expect(picker.get('legend').text()).toBe('Template Picker');
    expect([...(picker.get('select[name="template"]').element as HTMLSelectElement).options].map((option) => option.textContent)).toEqual(['Select...']);
    expect([...(picker.get('select[name="channel"]').element as HTMLSelectElement).options].map((option) => option.value)).toEqual(['email', 'sms', 'in_app']);
    const authored = mount(TemplatePicker, { props: { options: ['a'], value: 'a' }, slots: { default: () => h('p', 'Authored') } });
    expect(authored.find('select').exists()).toBe(false);
    expect(authored.get('[data-form-content]').text()).toBe('Authored');
  });
});
