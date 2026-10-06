import { createRequire } from 'node:module';

import { formatReadOnlyValue, sharedScenarios } from '@oods/component-contracts';
import * as ReactComponents from '@oods/components-react';
import * as VueComponents from '@oods/components-vue';
import { JSDOM } from 'jsdom';
import { createElement, type ComponentType } from 'react';
import { renderToString as renderReact } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { preflightTargetCapabilities } from '../../src/codegen/target-readiness.js';

/** A scalar select option's visible label, as both component packages write it (s215-m01, #2388); values stay raw. */
const readable = (value: string) => formatReadOnlyValue(value, 'string', true);
const optionValues = (root: Element, select: string) => [...root.querySelectorAll(`select[name="${select}"] > option`)].map((option) => option.getAttribute('value'));

const requireVue = createRequire(new URL('../../../components-vue/package.json', import.meta.url));
const { h } = requireVue('vue');
const { renderToString: renderVue } = requireVue('@vue/server-renderer');
// Grows by mission through Sprint 186; the delete-export bite runner selects this spec.
export const S186_COMPONENTS = [
  'ClassificationPanel', 'FilterPanel', 'PriceSummary',
  'AddressCollectionPanel', 'MembershipPanel', 'PreferencePanel', 'TagManager',
  'AddressSummaryBadge', 'MessageStatusBadge', 'PreferenceSummaryBadge', 'RoleBadgeList', 'TagPills',
  'AddressValidationTimeline', 'AuditEvent', 'MembershipAuditTimeline', 'MessageEventTimeline', 'PreferenceTimeline',
  'AddressEditor', 'PreferenceEditor', 'RoleAssignmentForm', 'StatusSelector', 'TagInput', 'TemplatePicker',
] as const;
const CELLS = (['react', 'vue'] as const).flatMap((framework) => (
  S186_COMPONENTS.map((component) => ({ framework, component, cell: `${framework}/${component}` }))
));

// Keep exactly one test per package/target cell. Namespace imports let a missing
// root export fail only its cell instead of aborting named-import collection for
// every test; each mutation rebuilds the selected package before this spec runs.
describe('Sprint 186 built package export cells', () => {
  it.each(CELLS)('$cell', async ({ framework, component }) => {
    const scenario = sharedScenarios.find((entry) => entry.oodsComponentId === component);
    expect(scenario, component).toBeDefined();
    const implementation = framework === 'react'
      ? (ReactComponents as Record<string, unknown>)[component]
      : (VueComponents as Record<string, unknown>)[component];
    expect(implementation, `${framework}/${component} built root export`).toBeDefined();
    const html: string = framework === 'react'
      ? renderReact(createElement(implementation as ComponentType, { ...scenario!.props }))
      : await renderVue(h(implementation, { ...scenario!.props }));
    const fragment = JSDOM.fragment(html);
    const root = fragment.querySelector(`[data-oods-component="${component}"]`);
    expect(root, `${framework}/${component} SSR marker`).not.toBeNull();
    expect(root!.textContent!.trim().length).toBeGreaterThan(0);
    if (component === 'ClassificationPanel') {
      expect(root!.getAttribute('data-panel-type')).toBe('classification');
      expect(root!.querySelector('[data-panel-header] > h2')?.textContent).toBe('Classification');
      expect(root!.querySelector('[data-panel-content] > [data-panel-summary]')?.textContent).toBe('Electronics > Mobile > Android');
    } else if (component === 'FilterPanel') {
      expect(root!.getAttribute('aria-label')).toBe('Filters');
      expect(root!.getAttribute('data-filter-mode')).toBe('batch');
      expect([...root!.querySelectorAll('legend')].map((legend) => legend.textContent)).toEqual(['Status', 'release_channel']);
      expect(root!.querySelector('[data-filter-count]')?.textContent).toBe('1 active');
      expect(root!.querySelector('button[data-filter-apply]')).not.toBeNull();
    } else if (component === 'AddressCollectionPanel' || component === 'MembershipPanel' || component === 'PreferencePanel') {
      const expected = { AddressCollectionPanel: ['address', 'Addresses'], MembershipPanel: ['membership', 'Membership'], PreferencePanel: ['preference', 'Preferences'] }[component];
      expect(root!.getAttribute('data-panel-type')).toBe(expected[0]);
      expect(root!.querySelector('[data-panel-header] > h2')?.textContent).toBe(expected[1]);
      expect(root!.querySelector('[data-panel-content] > [data-panel-summary]')?.textContent?.length).toBeGreaterThan(0);
    } else if (component === 'AddressSummaryBadge' || component === 'MessageStatusBadge' || component === 'PreferenceSummaryBadge') {
      const expected = { AddressSummaryBadge: ['Billing address', 'billing', 'address'], MessageStatusBadge: ['delivered', 'delivered', 'message'], PreferenceSummaryBadge: ['notifications', 'v3', 'preference'] }[component];
      expect(root!.querySelector('[data-oods-badge-label]')?.textContent).toBe(expected[0]);
      expect(root!.getAttribute('data-badge-status')).toBe(expected[1]);
      expect(root!.getAttribute('data-badge-variant')).toBe(expected[2]);
    } else if (component === 'RoleBadgeList') {
      expect([...root!.querySelectorAll('[data-role-badge]')].map((item) => item.textContent)).toEqual(['owner', 'billing-admin']);
      expect(root!.getAttribute('data-badge-variant')).toBe('session');
    } else if (component === 'TagPills') {
      expect([...root!.querySelectorAll('[data-tag-pill]')].map((item) => item.textContent)).toEqual(['alpha', 'beta', 'gamma']);
      expect(root!.querySelector('[data-tag-overflow]')?.textContent).toBe('+5');
    } else if (component === 'AddressValidationTimeline' || component === 'MembershipAuditTimeline' || component === 'MessageEventTimeline' || component === 'PreferenceTimeline') {
      const expected = {
        AddressValidationTimeline: ['address-validation', 'Address checks', 'Postal code verified'],
        MembershipAuditTimeline: ['membership', 'Membership history', null],
        MessageEventTimeline: ['message', 'Delivery', 'delivered'],
        PreferenceTimeline: ['preference', 'Preference changes', 'notifications.email'],
      }[component];
      expect(root!.getAttribute('role')).toBe('log');
      expect(root!.getAttribute('data-timeline-type')).toBe(expected[0]);
      expect(root!.querySelector('h2[data-timeline-title]')?.textContent).toBe(expected[1]);
      if (expected[2]) expect(root!.querySelector('[data-timeline-label]')?.textContent).toBe(expected[2]);
      else expect(root!.querySelector('[data-timeline-empty]')?.textContent).toBe('No events');
    } else if (component === 'AuditEvent') {
      expect(root!.getAttribute('data-event-type')).toBe('audit');
      expect(root!.querySelector('time[data-event-time]')?.getAttribute('datetime')).toBe('2026-09-05T12:00:00Z');
      expect(root!.querySelector('[data-event-label]')?.textContent).toBe('user.updated');
    } else if (component === 'AddressEditor') {
      expect(root!.tagName).toBe('FORM');
      expect(root!.getAttribute('data-form-type')).toBe('address-editor');
      expect(root!.querySelector('[data-form-header] > h2')?.textContent).toBe('Shipping address');
      expect(root!.querySelector('input[name="street"]')?.getAttribute('value')).toBe('1 Main St');
      expect(root!.querySelector('input[name="postalCode"]')?.getAttribute('value')).toBe('62701');
    } else if (component === 'PreferenceEditor') {
      expect(root!.tagName).toBe('FORM');
      expect(root!.getAttribute('data-form-type')).toBe('preference-editor');
      expect(root!.querySelector('[data-form-header] > h2')?.textContent).toBe('Preferences');
      expect([...root!.querySelectorAll('select[name="namespace"] > option')].map((option) => option.textContent)).toEqual(['notifications', 'billing'].map(readable));
      expect(optionValues(root!, 'namespace')).toEqual(['notifications', 'billing']);
      expect(root!.querySelector('select[name="namespace"] > option[selected]')?.textContent).toBe(readable('billing'));
      expect(root!.querySelector('textarea[name="preferenceDocument"]')?.textContent).toBe('{"email":true}');
    } else if (component === 'RoleAssignmentForm') {
      expect(root!.tagName).toBe('FORM');
      expect(root!.getAttribute('data-form-type')).toBe('role-assignment');
      expect(root!.querySelector('[data-form-header] > h2')?.textContent).toBe('Assign role');
      expect([...root!.querySelectorAll('select[name="role"] > option')].map((option) => option.textContent)).toEqual(['Owner', readable('viewer')]);
      expect(root!.querySelector('select[name="role"] > option[selected]')?.textContent).toBe(readable('viewer'));
      expect(root!.querySelector('input[name="assignee"]')?.getAttribute('value')).toBe('ada@example.test');
    } else if (component === 'StatusSelector') {
      expect(root!.getAttribute('data-summary-type')).toBe('status-selector');
      expect(root!.querySelector('label > span')?.textContent).toBe('Status');
      expect([...root!.querySelectorAll('select[name="status"] > option')].map((option) => option.textContent)).toEqual(['draft', 'active'].map(readable));
      expect(optionValues(root!, 'status')).toEqual(['draft', 'active']);
      expect(root!.querySelector('select[name="status"] > option[selected]')?.textContent).toBe(readable('active'));
    } else if (component === 'TagInput') {
      expect(root!.tagName).toBe('FIELDSET');
      expect(root!.getAttribute('data-form-type')).toBe('tag-input');
      expect(root!.querySelector('legend')?.textContent).toBe('Tags');
      expect(root!.querySelector('input[name="tag"]')?.getAttribute('placeholder')).toBe('Add a tag');
      expect(root!.querySelector('input[name="tag"]')?.getAttribute('value')).toBe('be');
      expect([...root!.querySelectorAll('[data-tag-item]')].map((item) => item.textContent)).toEqual(['alpha']);
    } else if (component === 'TemplatePicker') {
      expect(root!.tagName).toBe('FIELDSET');
      expect(root!.getAttribute('data-form-type')).toBe('template-picker');
      expect(root!.querySelector('legend')?.textContent).toBe('Notification template');
      expect(root!.querySelector('select[name="template"] > option[selected]')?.textContent).toBe('Welcome');
      expect([...root!.querySelectorAll('select[name="channel"] > option')].map((option) => option.textContent)).toEqual(['email', 'sms'].map(readable));
      expect(optionValues(root!, 'channel')).toEqual(['email', 'sms']);
      expect(root!.querySelector('select[name="channel"] > option[selected]')?.textContent).toBe(readable('sms'));
    } else if (component === 'TagManager') {
      expect(root!.tagName).toBe('FORM');
      expect(root!.getAttribute('data-form-type')).toBe('tag-manager');
      expect(root!.querySelector('[data-form-header] > h2')?.textContent).toBe('Tags');
      expect([...root!.querySelectorAll('[data-tag-item]')].map((item) => item.textContent)).toEqual(['alpha', 'beta']);
      expect(root!.querySelector('input[name="newTag"]')).not.toBeNull();
    } else {
      expect(root!.getAttribute('data-summary-type')).toBe('price');
      expect(root!.querySelector('h2[data-summary-title]')?.textContent).toBe('Price Summary');
      expect([...root!.querySelectorAll('[data-summary-item]')].map((item) => (
        [item.querySelector('dt')?.textContent, item.querySelector('dd')?.textContent]
      // s213-m01: Sprint 212 m02 (806ce6ded) made PriceSummary read stored minor units as currency and humanize its model
      // and interval codes (the contract's own words); this expectation still read the raw values (learning #723).
      ))).toEqual([['Amount', '$1,299.00'], ['Currency', 'USD'], ['Model', 'Recurring'], ['Interval', 'Month']]);
    }
    expect(preflightTargetCapabilities([
      { id: `export-${component}`, component, props: { ...scenario!.props } },
    ], framework)).toEqual([]);
  });
});
