import * as vizRecipes from '../src/viz-recipes.js';
import { assertVizRecipeScenario } from '../../../scripts/product-reality/viz-recipe-assertions.js';
import { ArchiveEvent, CancellationEvent, StateTransitionEvent, ColorStatePicker, StatusColorLegend, CommunicationDetailPanel, GeoFieldMappingForm, GeoResolutionBadge, GeocodablePreview } from '../src/trait-recipes.js';
import { assertTraitRecipeScenario } from '../../../scripts/product-reality/trait-recipe-assertions.js';
import { NUCLEUS_COMPONENT_IDS, sharedScenarios } from '@oods/component-contracts';
import { mount } from '@vue/test-utils';
import { h, nextTick, type Component, type Slot } from 'vue';
import { describe, expect, it } from 'vitest';

import {
  AuditSummaryCard, SortIndicator, TimelineEntryLabel,
  CycleProgressCard, PaymentTimeline, PaymentEventTimeline, BillingCardMeta, ArchivedRowOverlay,
  BillingSummaryBadge, BillingAmountInput, BillingIntervalSelector,
  ArchiveSummary, ArchivePill, CancellationBadge, CancellationForm, PriceCardMeta,
  OwnerBadge, OwnershipSummary, OwnershipMeta, TagSummary,
  LabelCell, InlineLabel, FormLabelGroup, ClassificationBadge, ClassificationEditor,
  AuditTimeline,
  CancellationSummary,
  PaginationBar,
  PriceBadge,
  RelativeTimestamp,
  SearchInput,
  StatusBadge,
  StatusTimeline,
  AddressCollectionPanel,
  AddressEditor,
  AddressSummaryBadge,
  AddressValidationTimeline,
  AuditEvent,
  Badge,
  Banner,
  Button,
  Card,
  CardHeader,
  Checkbox,
  ClassificationPanel,
  ColorSwatch,
  ColorizedBadge,
  DatePicker,
  DetailHeader,
  Dialog,
  FilterPanel,
  Grid,
  Input,
  MembershipAuditTimeline,
  MembershipPanel,
  MessageEventTimeline,
  MessageStatusBadge,
  PreferenceEditor,
  PreferencePanel,
  PreferenceSummaryBadge,
  PreferenceTimeline,
  PriceSummary,
  RoleAssignmentForm,
  RoleBadgeList,
  Select,
  Stack,
  StatusSelector,
  Switch,
  Table,
  Tabs,
  TagInput,
  TagManager,
  TagPills,
  TemplatePicker,
  Text,
  Textarea,
  VizAreaPreview,
} from '../src/index.js';

import { Combobox } from '../src/index.js';
import { SegmentedControl } from '../src/index.js';

const implementations: Readonly<Record<string, Component>> = {
  ...vizRecipes,
  // s223-m02 (#2527 ruling 11).
  Combobox,
  // s223-m02 (#2527 ruling 10).
  SegmentedControl,
  ArchiveEvent, CancellationEvent, StateTransitionEvent, ColorStatePicker, StatusColorLegend, CommunicationDetailPanel, GeoFieldMappingForm, GeoResolutionBadge, GeocodablePreview,
  AuditSummaryCard, SortIndicator, TimelineEntryLabel,
  CycleProgressCard, PaymentTimeline, PaymentEventTimeline, BillingCardMeta, ArchivedRowOverlay,
  BillingSummaryBadge, BillingAmountInput, BillingIntervalSelector,
  ArchiveSummary, ArchivePill, CancellationBadge, CancellationForm, PriceCardMeta,
  OwnerBadge, OwnershipSummary, OwnershipMeta, TagSummary,
  LabelCell, InlineLabel, FormLabelGroup, ClassificationBadge, ClassificationEditor,
  AuditTimeline,
  CancellationSummary,
  PaginationBar,
  PriceBadge,
  RelativeTimestamp,
  SearchInput,
  StatusBadge,
  StatusTimeline,
  AddressCollectionPanel,
  AddressEditor,
  AddressSummaryBadge,
  AddressValidationTimeline,
  AuditEvent,
  Badge,
  Banner,
  Button,
  Card,
  CardHeader,
  Checkbox,
  ClassificationPanel,
  ColorSwatch,
  ColorizedBadge,
  DatePicker,
  DetailHeader,
  Dialog,
  FilterPanel,
  Grid,
  Input,
  MembershipAuditTimeline,
  MembershipPanel,
  MessageEventTimeline,
  MessageStatusBadge,
  PreferenceEditor,
  PreferencePanel,
  PreferenceSummaryBadge,
  PreferenceTimeline,
  PriceSummary,
  RoleAssignmentForm,
  RoleBadgeList,
  Select,
  Stack,
  StatusSelector,
  Switch,
  Table,
  Tabs,
  TagInput,
  TagManager,
  TagPills,
  TemplatePicker,
  Text,
  Textarea,
  VizAreaPreview,
};

function scenarioSlots(values: Readonly<Record<string, unknown>>): Record<string, Slot> {
  return Object.fromEntries(Object.entries(values).map(([name, value]) => [
    name,
    () => (Array.isArray(value)
      ? value.map((entry, index) => h('span', { key: index }, String(entry)))
      : h('span', {}, String(value))),
  ]));
}

describe('@oods/components-vue shared scenarios', () => {
  it('maps exactly one frozen nondegenerate scenario to every canonical component', () => {
    expect(sharedScenarios.map((scenario) => scenario.oodsComponentId)).toEqual(NUCLEUS_COMPONENT_IDS);
    expect(new Set(sharedScenarios.map((scenario) => scenario.id)).size).toBe(NUCLEUS_COMPONENT_IDS.length);
  });

  for (const scenario of sharedScenarios) {
    it(`${scenario.id} executes the ${scenario.oodsComponentId} contract`, async () => {
      const implementation = implementations[scenario.oodsComponentId];
      expect(implementation, scenario.id).toBeDefined();
      const wrapper = mount(implementation, {
        attachTo: document.body,
        props: scenario.id === 'badge-status'
          ? { ...scenario.props, icon: '!' }
          : scenario.props,
        slots: scenarioSlots(scenario.slots),
      });

      try {
        const component = wrapper.get(`[data-oods-component="${scenario.oodsComponentId}"]`);
        expect(component.text().trim().length, `${scenario.id} non-empty content`).toBeGreaterThan(0);

        switch (scenario.id) {
        case 'VizAreaControls':
        case 'VizAxisControls':
        case 'VizColorControls':
        case 'VizHeatmapControls':
        case 'VizLineControls':
        case 'VizMarkControls':
        case 'VizOpacityControls':
        case 'VizPointControls':
        case 'VizScaleControls':
        case 'VizScatterControls':
        case 'VizShapeControls':
        case 'VizSizeControls':
        case 'VizColorLegendConfig':
        case 'VizShapeLegend':
        case 'VizAxisSummary':
        case 'VizOpacitySummary':
        case 'VizScaleSummary':
        case 'VizSizeSummary':
        case 'VizEncodingBadge':
        case 'VizRoleBadge':
        case 'VizHeatmapPreview':
        case 'VizGraphPreview':
        case 'VizLinePreview':
        case 'VizMarkPreview':
        case 'VizPointPreview':
        case 'VizScatterPreview':
          assertVizRecipeScenario(scenario, component.element); break;
        case 'ArchiveEvent':
        case 'CancellationEvent':
        case 'StateTransitionEvent':
        case 'ColorStatePicker':
        case 'StatusColorLegend':
        case 'CommunicationDetailPanel':
        case 'GeoFieldMappingForm':
        case 'GeoResolutionBadge':
        case 'GeocodablePreview':
          assertTraitRecipeScenario(scenario.id, component.element); break;

          case 'AuditSummaryCard':
            expect([...component.element!.querySelectorAll('dd')].map(node => node.textContent)).toEqual(['2', 'user-2', 'Sep 6, 2026, 12:00 PM']);
            break;
          case 'SortIndicator':
            expect(component.element!.querySelector('th')?.getAttribute('aria-sort')).toBe('none');
            expect(component.element!.querySelector('button')?.getAttribute('aria-label')).toBe('Sort name');
            break;
          case 'TimelineEntryLabel':
            expect(component.element!.textContent).toBe('Long in...');
            expect(component.element!.getAttribute('data-compact')).toBe('true');
            break;
          case 'billing-cycle-progress':
            expect(component.get('progress').attributes('value')).toBe('40');
            expect(component.get('progress').attributes('aria-label')).toBe('40% complete · 18 days remaining');
            break;
          case 'billing-payment-detail':
            expect(component.attributes('aria-label')).toBe('Payments');
            expect(component.text()).toContain('Payment method: card');
            expect(component.text()).toContain('No payment scheduled');
            expect(component.text()).toContain('$19.99 USD');
            break;
          case 'billing-payment-events':
            expect(component.findAll('time').map((node) => node.attributes('datetime'))).toEqual(['2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z']);
            expect(component.attributes('aria-label')).toBe('Payment events');
            expect(component.text()).toContain('$19.99 USD');
            expect(component.text()).not.toContain('Payment method');
            break;
          case 'billing-card-minor-units':
            expect(component.text()).toBe('$19.99 · monthly');
            break;
          case 'archived-row-presentation':
            expect(component.attributes('aria-label')).toBe('Archived: Team subscription');
            expect(component.attributes('aria-hidden')).toBe('false');
            expect(component.attributes('data-archive-tab')).toBe('Archived');
            expect(component.text()).toBe('Archived');
            break;

          case 'billing-summary-minor-units':
            expect(component.text()).toBe('$19.99 · monthly');
            break;
          case 'billing-amount-half-up':
            await component.get('input').setValue('19.995');
            expect(wrapper.emitted('change')).toEqual([[2000]]);
            expect(component.get('input').attributes('aria-describedby')).toContain('-currency');
            break;
          case 'billing-interval-subscription':
            expect(component.findAll('option').map((option) => option.attributes('value'))).toEqual(['monthly', 'yearly']);
            await component.get('select').setValue('yearly');
            expect(wrapper.emitted('change')).toEqual([['yearly']]);
            break;
          case 'badge-status': {
            expect(component.text()).toContain('Past due');
            expect(component.attributes('data-tone')).toBe('critical');
            expect(component.get('[aria-hidden="true"]').text()).toBe('!');
            expect(component.find('button, a, input').exists()).toBe(false);
            break;
          }
          case 'banner-dismissible': {
            expect(component.attributes('role')).toBe('alert');
            expect(component.text()).toContain('Payment failed');
            expect(component.text()).toContain('Update card');
            const dismiss = component.get('button[aria-label="Dismiss payment warning"]');
            await dismiss.trigger('click');
            expect(wrapper.emitted('dismiss')).toEqual([[]]);
            break;
          }
          case 'button-activate': {
            expect(component.attributes('type')).toBe('button');
            (component.element as HTMLButtonElement).focus();
            await component.trigger('click');
            expect(wrapper.emitted('activate')).toHaveLength(1);
            expect(document.activeElement).toBe(component.element);
            break;
          }
          case 'card-elevated-content': {
            expect(component.element.tagName).toBe('DIV');
            expect(component.attributes('data-elevated')).toBe('true');
            expect(component.text()).toBe('Account summary');
            break;
          }
          case 'card-header-supporting-text': {
            expect(component.element.tagName).toBe('HEADER');
            expect(component.get('h2').text()).toBe('Account summary');
            expect(component.get('[data-oods-supporting]').text()).toBe('Current subscription');
            break;
          }
          case 'classification-panel-title-and-summary': {
            expect(component.element.tagName).toBe('SECTION');
            expect(component.attributes('data-panel-type')).toBe('classification');
            expect(component.get('[data-panel-header] > h2').text()).toBe('Classification');
            expect(component.get('[data-panel-header] > [data-panel-subtitle]').text()).toBe('Taxonomy and tags');
            expect(component.get('[data-panel-content] > [data-panel-summary]').text()).toBe('Electronics > Mobile > Android');
            expect(component.find('button, a, input').exists()).toBe(false);
            break;
          }
          case 'address-collection-panel-title-and-summary':
          case 'membership-panel-title-and-summary':
          case 'preference-panel-title-and-summary': {
            const expected = {
              'address-collection-panel-title-and-summary': { type: 'address', title: 'Addresses', subtitle: 'Billing and shipping', summary: '2 addresses on file' },
              'membership-panel-title-and-summary': { type: 'membership', title: 'Membership', subtitle: 'Roles and permissions', summary: 'Owner of 2 workspaces' },
              'preference-panel-title-and-summary': { type: 'preference', title: 'Preferences', subtitle: 'Namespace: notifications', summary: 'No preferences saved' },
            }[scenario.id]!;
            expect(component.element.tagName).toBe('SECTION');
            expect(component.attributes('data-panel-type')).toBe(expected.type);
            expect(component.get('[data-panel-header] > h2').text()).toBe(expected.title);
            expect(component.get('[data-panel-header] > [data-panel-subtitle]').text()).toBe(expected.subtitle);
            expect(component.get('[data-panel-content] > [data-panel-summary]').text()).toBe(expected.summary);
            expect(component.find('button, a, input').exists()).toBe(false);
            break;
          }
          case 'tag-manager-list-and-add-control': {
            expect(component.element.tagName).toBe('FORM');
            expect(component.attributes('data-form-type')).toBe('tag-manager');
            expect(component.get('[data-form-header] > h2').text()).toBe('Tags');
            expect(component.findAll('[data-tag-list] > [data-tag-item]').map((item) => item.text())).toEqual(['alpha', 'beta']);
            const input = component.get('input[name="newTag"]');
            expect(input.attributes('type')).toBe('text');
            expect(input.attributes('placeholder')).toBe('Type a tag');
            expect(component.get('[data-form-control="input"] > span').text()).toBe('Add Tag');
            await input.setValue('gamma');
            await component.trigger('submit');
            expect((input.element as HTMLInputElement).value).toBe('gamma');
            expect(component.findAll('[data-tag-item]')).toHaveLength(2);
            break;
          }
          case 'address-summary-badge-role':
          case 'message-status-badge-delivery':
          case 'preference-summary-badge-namespace-and-version': {
            const expected = {
              'address-summary-badge-role': { label: 'Billing address', status: 'billing', variant: 'address' },
              'message-status-badge-delivery': { label: 'delivered', status: 'delivered', variant: 'message' },
              'preference-summary-badge-namespace-and-version': { label: 'notifications', status: 'v3', variant: 'preference' },
            }[scenario.id]!;
            expect(component.classes()).toContain('oods-badge');
            expect(component.get('[data-oods-badge-label]').text()).toBe(expected.label);
            expect(component.attributes('data-badge-status')).toBe(expected.status);
            expect(component.attributes('data-badge-variant')).toBe(expected.variant);
            expect(component.attributes('data-status')).toBe(expected.status);
            expect(component.attributes('role')).toBeUndefined();
            expect(component.find('button, a, input').exists()).toBe(false);
            break;
          }
          case 'role-badge-list-items': {
            expect(component.element.tagName).toBe('SPAN');
            expect(component.attributes('data-badge-variant')).toBe('session');
            expect(component.findAll('[data-role-badge]').map((item) => item.text())).toEqual(['owner', 'billing-admin']);
            expect(component.find('button, a, input').exists()).toBe(false);
            break;
          }
          case 'tag-pills-overflow-template': {
            expect(component.element.tagName).toBe('DIV');
            expect(component.attributes('data-summary-type')).toBe('tag-pills');
            expect(component.findAll('[data-tag-pill]').map((item) => item.text())).toEqual(['alpha', 'beta', 'gamma']);
            // The template is substituted with the total tag count, exactly as renderTagPills does.
            expect(component.get('[data-tag-overflow]').text()).toBe('+5');
            expect(component.text()).not.toContain('{{');
            break;
          }
          case 'address-validation-timeline-events': {
            expect(component.attributes('role')).toBe('log');
            expect(component.attributes('data-timeline-type')).toBe('address-validation');
            expect(component.get('h2[data-timeline-title]').text()).toBe('Address checks');
            const items = component.findAll('[data-timeline-events] > li');
            expect(items).toHaveLength(2);
            expect(items[0]!.get('[data-timeline-label]').text()).toBe('Postal code verified');
            expect(items[0]!.get('time[data-timeline-time]').attributes('datetime')).toBe('2026-09-05T12:00:00Z');
            expect(items[0]!.get('[data-timeline-detail]').text()).toBe('Matched carrier database');
            expect(items[1]!.get('[data-timeline-label]').text()).toBe('Geocoded');
            expect(component.find('[data-timeline-empty]').exists()).toBe(false);
            break;
          }
          case 'audit-event-type-and-timestamp': {
            expect(component.element.tagName).toBe('ARTICLE');
            expect(component.attributes('data-event-type')).toBe('audit');
            expect(component.get('time[data-event-time]').attributes('datetime')).toBe('2026-09-05T12:00:00Z');
            expect(component.get('[data-event-label]').text()).toBe('user.updated');
            expect(component.get('[data-event-detail]').text()).toBe('Display name changed');
            break;
          }
          case 'membership-audit-timeline-empty': {
            expect(component.attributes('role')).toBe('log');
            expect(component.attributes('data-timeline-type')).toBe('membership');
            expect(component.get('h2[data-timeline-title]').text()).toBe('Membership history');
            expect(component.findAll('[data-timeline-events] > li')).toHaveLength(1);
            expect(component.get('[data-timeline-empty]').text()).toBe('No events');
            break;
          }
          case 'message-event-timeline-statuses': {
            expect(component.attributes('data-timeline-type')).toBe('message');
            expect(component.get('h2[data-timeline-title]').text()).toBe('Delivery');
            expect(component.get('[data-timeline-label]').text()).toBe('delivered');
            expect(component.get('time[data-timeline-time]').attributes('datetime')).toBe('2026-09-02T09:00:00Z');
            break;
          }
          case 'preference-timeline-changes': {
            expect(component.attributes('data-timeline-type')).toBe('preference');
            expect(component.get('h2[data-timeline-title]').text()).toBe('Preference changes');
            expect(component.get('[data-timeline-label]').text()).toBe('notifications.email');
            expect(component.get('time[data-timeline-time]').attributes('datetime')).toBe('2026-09-03T08:00:00Z');
            expect(component.get('[data-timeline-detail]').text()).toBe('Enabled');
            break;
          }
          case 'address-editor-fields-and-change': {
            expect(component.element.tagName).toBe('FORM');
            expect(component.attributes('data-form-type')).toBe('address-editor');
            expect(component.get('[data-form-header] > h2').text()).toBe('Shipping address');
            expect((component.get('input[name="street"]').element as HTMLInputElement).value).toBe('1 Main St');
            expect((component.get('input[name="postalCode"]').element as HTMLInputElement).value).toBe('62701');
            await component.get('input[name="city"]').setValue('Shelbyville');
            expect(wrapper.emitted('change')).toEqual([[{ street: '1 Main St', city: 'Shelbyville', region: 'IL', postalCode: '62701' }]]);
            const submit = new Event('submit', { cancelable: true });
            component.element.dispatchEvent(submit);
            expect(submit.defaultPrevented).toBe(true);
            break;
          }
          case 'preference-editor-namespace-and-document': {
            expect(component.element.tagName).toBe('FORM');
            expect(component.attributes('data-form-type')).toBe('preference-editor');
            expect(component.get('[data-form-header] > h2').text()).toBe('Preferences');
            const namespace = component.get('select[name="namespace"]').element as HTMLSelectElement;
            expect([...namespace.options].map((option) => option.textContent)).toEqual(['Notifications', 'Billing']);
            expect(namespace.value).toBe('billing');
            expect((component.get('textarea[name="preferenceDocument"]').element as HTMLTextAreaElement).value).toBe('{"email":true}');
            expect(component.find('button').exists()).toBe(false);
            break;
          }
          case 'role-assignment-form-roles': {
            expect(component.element.tagName).toBe('FORM');
            expect(component.attributes('data-form-type')).toBe('role-assignment');
            expect(component.get('[data-form-header] > h2').text()).toBe('Assign role');
            const role = component.get('select[name="role"]').element as HTMLSelectElement;
            expect([...role.options].map((option) => [option.value, option.textContent])).toEqual([['owner', 'Owner'], ['viewer', 'Viewer']]);
            expect(role.value).toBe('viewer');
            expect((component.get('input[name="assignee"]').element as HTMLInputElement).value).toBe('ada@example.test');
            break;
          }
          case 'status-selector-controlled': {
            expect(component.attributes('data-summary-type')).toBe('status-selector');
            expect(component.get('label > span').text()).toBe('Status');
            const select = component.get('select[name="status"]');
            expect([...(select.element as HTMLSelectElement).options].map((option) => option.value)).toEqual(['draft', 'active']);
            expect((select.element as HTMLSelectElement).value).toBe('active');
            await select.setValue('draft');
            expect(wrapper.emitted('change')).toEqual([['draft']]);
            expect(wrapper.emitted('update:modelValue')).toEqual([['draft']]);
            break;
          }
          case 'tag-input-typed-text': {
            expect(component.element.tagName).toBe('FIELDSET');
            expect(component.attributes('data-form-type')).toBe('tag-input');
            expect(component.get('legend').text()).toBe('Tags');
            const input = component.get('input[name="tag"]');
            expect((input.element as HTMLInputElement).value).toBe('be');
            expect(input.attributes('placeholder')).toBe('Add a tag');
            expect(component.findAll('[data-tag-item]').map((item) => item.text())).toEqual(['alpha']);
            await input.setValue('beta');
            expect(wrapper.emitted('input')).toEqual([['beta']]);
            expect(wrapper.emitted('update:modelValue')).toEqual([['beta']]);
            break;
          }
          case 'template-picker-selects': {
            expect(component.element.tagName).toBe('FIELDSET');
            expect(component.attributes('data-form-type')).toBe('template-picker');
            expect(component.get('legend').text()).toBe('Notification template');
            const template = component.get('select[name="template"]').element as HTMLSelectElement;
            expect([...template.options].map((option) => [option.value, option.textContent])).toEqual([['welcome', 'Welcome']]);
            expect(template.value).toBe('welcome');
            const channel = component.get('select[name="channel"]').element as HTMLSelectElement;
            expect([...channel.options].map((option) => option.value)).toEqual(['email', 'sms']);
            expect(channel.value).toBe('sms');
            break;
          }
          case 'filter-panel-batch-mode': {
            expect(component.element.tagName).toBe('ASIDE');
            expect(component.attributes('role')).toBe('region');
            expect(component.attributes('aria-label')).toBe('Filters');
            expect(component.attributes('data-filter-mode')).toBe('batch');
            expect(component.findAll('legend').map((legend) => legend.text())).toEqual(['Status', 'release_channel']);
            expect(component.findAll('fieldset[data-collapsible="true"]')).toHaveLength(2);
            expect(component.get('[data-active-filters]').attributes('aria-live')).toBe('polite');
            expect(component.get('[data-filter-count]').text()).toBe('1 active');
            expect(component.get('button[data-filter-clear-all]').attributes('type')).toBe('button');
            expect(component.get('button[data-filter-apply]').text()).toBe('Apply');
            break;
          }
          case 'price-summary-terms': {
            expect(component.element.tagName).toBe('SECTION');
            expect(component.attributes('data-summary-type')).toBe('price');
            expect(component.get('h2[data-summary-title]').text()).toBe('Price Summary');
            expect(component.findAll('[data-summary-item]').map((item) => [item.get('dt').text(), item.get('dd').text()]))
              .toEqual([['Amount', '$1,299.00'], ['Currency', 'USD'], ['Model', 'Recurring'], ['Interval', 'Month']]);
            expect(component.find('button, a, input').exists()).toBe(false);
            break;
          }
          case 'detail-header-heading-level': {
            expect(component.element.tagName).toBe('HEADER');
            expect(component.get('h1').text()).toBe('Subscription details');
            expect(component.find('h2').exists()).toBe(false);
            expect(component.get('[data-oods-subtitle]').text()).toBe('Pro plan');
            expect(component.get('[data-oods-metadata]').text()).toBe('Renews monthly');
            break;
          }
          case 'color-swatch-label-and-chip': {
            expect(component.attributes('data-swatch-color')).toBe('#2563eb');
            expect(component.attributes('style')).toContain('--oods-swatch-color: #2563eb');
            expect(component.get('[data-oods-swatch-label]').text()).toBe('Ocean blue');
            expect(component.get('[data-oods-swatch-label]').attributes('aria-hidden')).toBeUndefined();
            expect(component.get('[data-oods-swatch-chip]').attributes('aria-hidden')).toBe('true');
            break;
          }
          case 'colorized-badge-color-marker': {
            expect(component.attributes('data-badge-color')).toBe('#15803d');
            expect(component.attributes('data-badge-variant')).toBe('colorized');
            expect(component.attributes('data-tone')).toBe('success');
            expect(component.classes()).toContain('oods-badge');
            expect(component.get('[data-oods-badge-label]').text()).toBe('Approved');
            expect(component.get('[data-oods-badge-label]').attributes('aria-hidden')).toBeUndefined();
            expect(component.get('[data-oods-badge-marker]').attributes('aria-hidden')).toBe('true');
            expect(component.find('button, a, input').exists()).toBe(false);
            break;
          }
          case 'viz-area-preview-frame-placeholder-and-slot': {
            expect(component.attributes()).toMatchObject({
              'data-viz-preview-type': 'area', 'data-viz-width': '640', 'data-viz-height': '360',
            });
            expect(component.text()).toBe('Authored area preview content');
            expect(component.find('[data-viz-preview-placeholder]').exists()).toBe(false);
            const empty = mount(VizAreaPreview, { props: scenario.props });
            try {
              expect(empty.get('[data-viz-preview-placeholder]').text()).toBe('Area preview (640 x 360)');
              expect(empty.find('svg, canvas').exists()).toBe(false);
            } finally {
              empty.unmount();
            }
            break;
          }
          case 'checkbox-controlled': {
            const checkbox = component.get('input[type="checkbox"]');
            expect((checkbox.element as HTMLInputElement).checked).toBe(false);
            expect((checkbox.element as HTMLInputElement).required).toBe(true);
            expect(component.get('label').attributes('for')).toBe('marketing');
            expect(component.get('.oods-field-required').text()).toBe('*');
            expect(component.get('.oods-field-required').attributes('aria-hidden')).toBe('true');
            expect(checkbox.attributes('aria-describedby')).toBe('marketing-help');
            expect(component.get('#marketing-help').text()).toBe('Choose whether to subscribe');
            await checkbox.setValue(true);
            expect(wrapper.emitted('change')).toEqual([[true]]);
            expect(wrapper.emitted('update:modelValue')).toEqual([[true]]);
            break;
          }
          // s222-m02 (#2502 ruling 11): the two components 0.4.0 adds.
          case 'switch-controlled': {
            const control = component.get('button[role="switch"]');
            expect(control.attributes('type')).toBe('button');
            expect(control.attributes('aria-checked')).toBe('false');
            expect(control.attributes('aria-labelledby')).toBe('payment-alerts-label');
            expect(component.get('#payment-alerts-label').text()).toBe('Payment alerts');
            expect(component.get('label').attributes('for')).toBe('payment-alerts');
            expect(control.attributes('aria-describedby')).toBe('payment-alerts-help');
            expect(component.get('#payment-alerts-help').text()).toBe('Email the account owner when a payment fails');
            await control.trigger('click');
            expect(wrapper.emitted('change')).toEqual([[true]]);
            expect(wrapper.emitted('update:modelValue')).toEqual([[true]]);
            // Controlled: the consumer owns checked, so the switch reports off until checked changes.
            expect(control.attributes('aria-checked')).toBe('false');
            await wrapper.setProps({ checked: true });
            expect(control.attributes('aria-checked')).toBe('true');
            break;
          }
          // s223-m02 (#2527 ruling 11): the label names the input and its list; typing filters; Down and Enter pick. The
          // consumer owns value, so the field shows Canada until value changes. combobox.spec.ts walks every key.
          case 'combobox-filter-and-pick': {
            const input = component.get('input[role="combobox"]');
            const element = input.element as HTMLInputElement;
            expect(component.get('label').attributes('for')).toBe('shipping-country');
            expect(component.get('label').attributes('id')).toBe('shipping-country-label');
            expect(element.value).toBe('Canada');
            expect(input.attributes()).toMatchObject({
              'aria-expanded': 'false',
              'aria-autocomplete': 'list',
              'aria-controls': 'shipping-country-listbox',
              'aria-describedby': 'shipping-country-help',
            });
            expect(input.attributes('aria-activedescendant')).toBeUndefined();
            expect(component.get('#shipping-country-help').text()).toBe('Type to filter. We do not ship to Japan yet.');
            const listbox = component.get('#shipping-country-listbox');
            expect(listbox.attributes('role')).toBe('listbox');
            expect(listbox.attributes('aria-labelledby')).toBe('shipping-country-label');
            expect(listbox.get('[aria-selected="true"]').text()).toBe('Canada');
            await input.setValue('UNI');
            expect(input.attributes('aria-expanded')).toBe('true');
            expect(listbox.findAll('[role="option"]:not([hidden])').map(option => option.text())).toEqual(['United Kingdom', 'United States']);
            await input.trigger('keydown', { key: 'ArrowDown' });
            expect(input.attributes('aria-activedescendant')).toBe('shipping-country-option-6');
            await input.trigger('keydown', { key: 'Enter' });
            expect(wrapper.emitted('change')).toEqual([['gb']]);
            expect(wrapper.emitted('update:modelValue')).toEqual([['gb']]);
            expect(input.attributes('aria-expanded')).toBe('false');
            expect(element.value).toBe('Canada');
            await wrapper.setProps({ value: 'gb' });
            expect(element.value).toBe('United Kingdom');
            expect(listbox.get('[aria-selected="true"]').text()).toBe('United Kingdom');
            break;
          }
          case 'dialog-confirm': {
            expect(component.element.tagName).toBe('DIALOG');
            expect(component.attributes('open')).toBeDefined();
            expect(component.attributes('aria-labelledby')).toBe('archive-workspace-title');
            expect(component.get('#archive-workspace-title').text()).toBe('Archive workspace');
            expect(component.attributes('aria-describedby')).toBe('archive-workspace-description');
            expect(component.get('#archive-workspace-description').text()).toBe('Members lose access until the workspace is restored.');
            expect(component.get('.oods-dialog__body').text()).toBe('Invoices and subscriptions stay in the archive for 30 days.');
            expect(component.findAll('.oods-dialog__footer span').map(node => node.text())).toEqual(['Cancel', 'Archive workspace']);
            await component.get('button[aria-label="Close"]').trigger('click');
            expect(wrapper.emitted('close')).toEqual([[]]);
            // The consumer owns open: the dialog stays open until open becomes false, and then it closes.
            expect(component.attributes('open')).toBeDefined();
            await wrapper.setProps({ open: false });
            expect(component.attributes('open')).toBeUndefined();
            break;
          }
          case 'date-picker-bounded': {
            const input = component.get('input');
            expect(component.get('label').attributes('for')).toBe('renewal');
            expect((input.element as HTMLInputElement).value).toBe('2026-09-30');
            expect(input.attributes()).toMatchObject({
              type: 'date',
              min: '2026-09-01',
              max: '2026-12-31',
              step: '1',
            });
            await input.setValue('2026-10-01');
            expect(wrapper.emitted('change')).toEqual([['2026-10-01']]);
            expect(wrapper.emitted('update:modelValue')).toEqual([['2026-10-01']]);
            break;
          }
          case 'grid-responsive': {
            const originalWidth = window.innerWidth;
            Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
            window.dispatchEvent(new Event('resize'));
            await nextTick();
            expect(component.findAll(':scope > span').map((child) => child.text())).toEqual([
              'First card',
              'Second card',
            ]);
            expect(component.attributes('style')).toContain('--oods-grid-min-column: 16rem');
            expect(component.attributes('style')).toContain('--cmp-spacing-stack-default');
            expect(component.attributes('style')).toContain('--oods-layout-align: stretch');
            Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
            window.dispatchEvent(new Event('resize'));
            await nextTick();
            expect(component.text()).toBe('First cardSecond card');
            Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
            break;
          }
          case 'input-invalid': {
            const input = component.get('input');
            expect(component.get('label').attributes('for')).toBe('email');
            expect((input.element as HTMLInputElement).value).toBe('invalid');
            expect((input.element as HTMLInputElement).required).toBe(true);
            expect(input.attributes('aria-invalid')).toBe('true');
            expect(input.attributes('aria-describedby')).toBe('email-help email-validation');
            expect(component.get('#email-validation').text()).toBe('Enter a valid email');
            await input.setValue('user@example.com');
            expect(wrapper.emitted('input')).toEqual([['user@example.com']]);
            expect(wrapper.emitted('update:modelValue')).toEqual([['user@example.com']]);
            break;
          }
          // s223-m02 (#2527 ruling 10): a radiogroup named by its label, one native radio per option in one group.
          // segmented-control.spec.ts walks the keys.
          case 'segmented-control-billing-period': {
            const group = component.get('[role="radiogroup"]');
            expect(group.attributes('id')).toBe('billing-period');
            expect(group.attributes('aria-labelledby')).toBe('billing-period-label');
            expect(component.get('#billing-period-label').text()).toBe('Billing period');
            expect(component.attributes('data-size')).toBe('md');
            const radios = component.findAll('input[type="radio"]');
            expect(radios.map((radio) => {
              const element = radio.element as HTMLInputElement;
              return [element.value, element.labels?.[0]?.textContent, element.name, element.checked];
            })).toEqual([
              ['monthly', 'Monthly', 'billing-period', false], ['quarterly', 'Quarterly', 'billing-period', true], ['yearly', 'Yearly', 'billing-period', false],
            ]);
            await radios[2]!.setValue(true);
            expect(wrapper.emitted('change')).toEqual([['yearly']]);
            expect(wrapper.emitted('update:modelValue')).toEqual([['yearly']]);
            await wrapper.setProps({ value: 'yearly' });
            expect(radios.map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([false, false, true]);
            break;
          }
          case 'select-controlled': {
            const select = component.get('select');
            expect(component.get('label').attributes('for')).toBe('plan');
            expect((select.element as HTMLSelectElement).value).toBe('pro');
            expect((select.element as HTMLSelectElement).selectedOptions[0]?.textContent).toBe('Pro');
            await select.setValue('basic');
            expect(wrapper.emitted('change')).toEqual([['basic']]);
            expect(wrapper.emitted('update:modelValue')).toEqual([['basic']]);
            break;
          }
          case 'stack-wrapped-row': {
            const originalWidth = window.innerWidth;
            Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
            window.dispatchEvent(new Event('resize'));
            await nextTick();
            expect(component.findAll(':scope > span').map((child) => child.text())).toEqual([
              'Primary',
              'Secondary',
            ]);
            expect(component.attributes('style')).toContain('--oods-stack-direction: row');
            expect(component.attributes('style')).toContain('--oods-stack-wrap: wrap');
            expect(component.attributes('style')).toContain('--cmp-spacing-inline-sm');
            Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
            break;
          }
          case 'table-selectable-row': {
            expect(component.get('caption').text()).toBe('Subscriptions');
            expect(component.findAll('thead th').map((cell) => cell.text())).toEqual([
              'Name',
              'Status',
            ]);
            expect(component.findAll('tbody td').map((cell) => cell.text())).toEqual([
              'Acme',
              'Active',
            ]);
            const rowAction = component.get('tbody td:first-child .oods-table-row-action');
            expect(rowAction.text()).toBe('Acme');
            expect(rowAction.attributes('aria-label')).toBeUndefined();
            (rowAction.element as HTMLButtonElement).focus();
            await rowAction.trigger('keydown', { key: 'Enter' });
            // JSDOM does not synthesize a native button's default keyboard click.
            (rowAction.element as HTMLButtonElement).click();
            await nextTick();
            expect(wrapper.emitted('rowActivate')).toEqual([['sub-1']]);
            break;
          }
          case 'tabs-keyboard': {
            expect(component.get('[role="tablist"]').attributes('aria-label')).toBe('Account sections');
            const overview = component.get('[data-tab-id="overview"]');
            overview.element.focus();
            await overview.trigger('keydown', { key: 'ArrowRight' });
            await nextTick();
            const billing = component.get('[data-tab-id="billing"]');
            expect(billing.attributes('aria-selected')).toBe('true');
            expect(document.activeElement).toBe(billing.element);
            expect(component.get('[role="tabpanel"]:not([hidden])').text()).toBe('Invoices');
            expect(component.get('[role="tabpanel"][hidden]').text()).toBe('Summary');
            expect(wrapper.emitted('change')).toEqual([['billing']]);
            break;
          }
          case 'text-semantic': {
            expect(component.element.tagName).toBe('STRONG');
            expect(component.text()).toBe('Account owner');
            expect(component.attributes('data-weight')).toBe('semibold');
            break;
          }
          case 'textarea-controlled': {
            const textarea = component.get('textarea');
            expect(component.get('label').attributes('for')).toBe('notes');
            expect((textarea.element as HTMLTextAreaElement).value).toBe('Call before renewal');
            expect((textarea.element as HTMLTextAreaElement).rows).toBe(4);
            expect(textarea.attributes('aria-describedby')).toBe('notes-help');
            expect(component.get('#notes-help').text()).toBe('Visible to account managers');
            const nextValue = 'Call before renewal. Confirm owner.';
            await textarea.setValue(nextValue);
            expect(wrapper.emitted('input')).toEqual([[nextValue]]);
            expect(wrapper.emitted('update:modelValue')).toEqual([[nextValue]]);
            break;
          }
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
            // s224-m01 (#2542 ruling 6): hideWhenDefault hides only the default. A scheduled or recorded cancellation keeps
            // its card, and a summary not asked to hide still states the field.
            const card = (props: Record<string, unknown>) => {
              const mounted = mount(implementation, { props });
              const rows = mounted.find('[data-oods-component="CancellationSummary"]').exists() ? mounted.findAll('dd').map((node) => node.text()) : null;
              mounted.unmount();
              return rows;
            };
            expect(card({ ...scenario.props, hideWhenDefault: true })).toEqual(['Yes', 'Sep 5, 2026, 12:00 PM', 'Customer request']);
            expect(card({ cancelAtPeriodEnd: false, hideWhenDefault: true })).toBeNull();
            // A generated template writes the bare attribute, which the compiler passes as an empty string; an empty code
            // is not a value.
            expect(card({ cancelAtPeriodEnd: false, code: '', hideWhenDefault: '' })).toBeNull();
            expect(card({ cancelAtPeriodEnd: false, requestedAt: '2026-09-21T16:40:00Z', hideWhenDefault: true })).toEqual(['No', 'Sep 21, 2026, 4:40 PM']);
            expect(card({ cancelAtPeriodEnd: false, code: 'budget', hideWhenDefault: true })).toEqual(['No', 'Budget']);
            expect(card({ cancelAtPeriodEnd: false })).toEqual(['No']);
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
        case 'label-cell-truncation-and-description': {
          expect(component.element?.querySelector('[data-oods-label-cell-primary]')?.textContent).toBe('Long pr...');
          expect(component.element?.querySelector('[data-oods-label-cell-description]')?.textContent).toBe('Long su...');
          break;
        }
        case 'inline-label-truncation': {
          expect(component.element?.textContent).toBe('Long in...');
          break;
        }
        case 'form-label-group-association': {
          expect(component.element?.getAttribute('for')).toBe('product-name');
          expect(component.element?.querySelector('[data-oods-form-label]')?.textContent).toBe('Product name');
          expect(component.element?.querySelector('[data-oods-form-hint]')?.textContent).toBe('Name shown to customers');
          break;
        }
        case 'classification-badge-category': {
          expect(component.element?.querySelector('[data-oods-badge-label]')?.textContent).toBe('Electronics');
          expect(component.element?.getAttribute('data-badge-status')).toBe('strict');
          expect(component.element?.getAttribute('data-badge-variant')).toBe('classification');
          break;
        }
        case 'classification-editor-presentational-controls': {
          expect(component.element?.querySelector('h2')?.textContent).toBe('Product classification');
          expect((component.element?.querySelector('[name="category"]') as HTMLInputElement).value).toBe('Electronics');
          expect((component.element?.querySelector('[name="tags"]') as HTMLInputElement).value).toBe('["alpha","beta"]');
          expect((component.element?.querySelector('[name="mode"]') as HTMLSelectElement).value).toBe('flexible');
          break;
        }
        case 'owner-badge-principal': {
          expect(component.element?.textContent).toBe('user-7');
          expect(component.element?.getAttribute('data-badge-variant')).toBe('owner');
          break;
        }
        case 'ownership-summary-terms': {
          expect(component.element?.querySelector('h2')?.textContent).toBe('Ownership Summary');
          // s221-m01: user-7 has no resolved name, so the contract reports the unresolved reference (65c1c6f84, #2426).
          expect([...component.element!.querySelectorAll('dd')].map((node) => node.textContent)).toEqual(['Owner reference not resolved', 'person', 'administrator']);
          expect(component.element?.hasAttribute('role')).toBe(false);
          break;
        }
        case 'ownership-meta-inline-terms': {
          expect(component.element?.querySelector('[data-meta-title]')?.textContent).toBe('Ownership');
          expect([...component.element!.querySelectorAll('[data-meta-item]')].map((node) => node.textContent)).toEqual(['Owner Type: organization', 'Role: custodian']);
          expect(component.element?.hasAttribute('role')).toBe(false);
          // s223-m01 (#2527 ruling 6): a card binds the owner's label and reads one phrase, as React writes it.
          const named = mount(implementation, { props: { ...scenario.props, ownerLabel: 'Northwind' } });
          expect(named.text()).toBe('Owned by Northwind · organization · custodian');
          expect(named.find('[data-meta-title]').exists()).toBe(false);
          named.unmount();
          const unnamed = mount(implementation, { props: { ...scenario.props, ownerLabel: 'Owner unavailable' } });
          expect(unnamed.text()).toBe('Organization-owned · custodian');
          unnamed.unmount();
          break;
        }
        case 'tag-summary-zero-and-tags': {
          expect([...component.element!.querySelectorAll('dd')].map((node) => node.textContent)).toEqual(['0', 'alpha, beta']);
          break;
        }
        case 'archive-pill-false':
        case 'cancellation-badge-false': {
          expect(component.element?.textContent).toBe(scenario.id === 'cancellation-badge-false' ? 'No cancellation scheduled' : 'Not archived');
          expect(component.element?.getAttribute('data-badge-status')).toBe('false');
          // s223-m01 (#2527 ruling 7): hideWhenFalse hides only the default; a recorded archive or cancellation still shows.
          const flag = scenario.id === 'cancellation-badge-false' ? 'cancelAtPeriodEnd' : 'isArchived';
          const hidden = mount(implementation, { props: { ...scenario.props, hideWhenFalse: true } });
          expect(hidden.find(`[data-oods-component="${scenario.oodsComponentId}"]`).exists()).toBe(false);
          hidden.unmount();
          // A generated template writes the bare attribute, which the compiler passes as an empty string.
          const bare = mount(implementation, { props: { ...scenario.props, hideWhenFalse: '' } });
          expect(bare.find(`[data-oods-component="${scenario.oodsComponentId}"]`).exists()).toBe(false);
          bare.unmount();
          const shown = mount(implementation, { props: { [flag]: true, hideWhenFalse: true } });
          expect(shown.text()).toBe(scenario.id === 'cancellation-badge-false' ? 'Cancellation scheduled' : 'Archived');
          shown.unmount();
          break;
        }
        case 'archive-summary-false-and-reason': {
          // Preserve false as the human-readable Archived answer and format the associated timestamp.
          expect([...component.element!.querySelectorAll('dd')].map((node) => node.textContent)).toEqual(['No', 'Sep 5, 2026, 12:00 PM', 'Retention policy']);
          // s224-m01 (#2542 ruling 6): hideWhenDefault hides only the default. This record has a date and a reason, so it
          // keeps its card; so does an archived one, and a summary not asked to hide still states the field.
          const card = (props: Record<string, unknown>) => {
            const mounted = mount(implementation, { props });
            const rows = mounted.find('[data-oods-component="ArchiveSummary"]').exists() ? mounted.findAll('dd').map((node) => node.text()) : null;
            mounted.unmount();
            return rows;
          };
          expect(card({ ...scenario.props, hideWhenDefault: true })).toEqual(['No', 'Sep 5, 2026, 12:00 PM', 'Retention policy']);
          expect(card({ isArchived: false, archivedAt: null, reason: '', hideWhenDefault: '' })).toBeNull();
          expect(card({ isArchived: false, reason: 'Retention policy', hideWhenDefault: true })).toEqual(['No', 'Retention policy']);
          expect(card({ isArchived: true, hideWhenDefault: true })).toEqual(['Yes']);
          expect(card({ isArchived: false })).toEqual(['No']);
          break;
        }
        case 'cancellation-form-presentational-controls': {
          expect(component.element?.querySelector<HTMLSelectElement>('select[name="reasonCode"]')?.value).toBe('budget');
          expect(component.element?.querySelector<HTMLTextAreaElement>('textarea[name="reason"]')?.value).toBe('Costs changed');
          break;
        }
        case 'price-card-meta-inline-terms': {
          expect([...component.element!.querySelectorAll('[data-meta-item]')].map((node) => node.textContent)).toEqual(['Model: Flat', 'Interval: Monthly']);
          break;
        }
          default:
            throw new Error(`Missing executable Vue assertion for ${scenario.id}`);
        }
      } finally {
        wrapper.unmount();
      }
    });
  }
});
