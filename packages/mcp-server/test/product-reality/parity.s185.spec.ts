import { createRequire } from 'node:module';

import { formatReadOnlyValue, sharedScenarios } from '@oods/component-contracts';
import * as ReactComponents from '@oods/components-react';
import * as VueComponents from '@oods/components-vue';
import { JSDOM } from 'jsdom';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { renderToString as renderReact } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { renderMappedComponent } from '../../src/render/component-map.js';

const requireVue = createRequire(new URL('../../../components-vue/package.json', import.meta.url));
const { h } = requireVue('vue');
const { renderToString: renderVue } = requireVue('@vue/server-renderer');

const COMPONENTS = [
  'ArchiveSummary', 'ArchivePill', 'CancellationBadge', 'CancellationForm', 'PriceCardMeta',
  'OwnerBadge', 'OwnershipSummary', 'OwnershipMeta', 'TagSummary',
  'LabelCell', 'InlineLabel', 'FormLabelGroup', 'ClassificationBadge', 'ClassificationEditor',
  'DetailHeader', 'CardHeader', 'ColorSwatch', 'ColorizedBadge', 'VizAreaPreview',
  // Sprint 186 wave 2 extends the same computed comparison.
  'ClassificationPanel', 'FilterPanel', 'PriceSummary',
  'AddressCollectionPanel', 'MembershipPanel', 'PreferencePanel', 'TagManager',
  'AddressSummaryBadge', 'MessageStatusBadge', 'PreferenceSummaryBadge', 'RoleBadgeList', 'TagPills',
  'AddressValidationTimeline', 'AuditEvent', 'MembershipAuditTimeline', 'MessageEventTimeline', 'PreferenceTimeline',
  'AddressEditor', 'PreferenceEditor', 'RoleAssignmentForm', 'StatusSelector', 'TagInput', 'TemplatePicker',
] as const;
type Component = (typeof COMPONENTS)[number];
/** A scalar select option's visible label, as both component packages write it (s215-m01, #2388). */
const readable = (value: string) => formatReadOnlyValue(value, 'string', true);
type Observation = {
  markers: string[];
  headings: Array<{ level: string; text: string }>;
  visibleText: string;
  placeholderText: string | null;
  badgeStyles: Record<string, string> | null;
};

// Parity is a computed comparison. Any future exception needs a written reason
// and a companion test; this wave has no declared framework differences.
const DECLARED_DIFFERENCES: ReadonlyArray<{
  component: Component;
  field: keyof Observation;
  reason: string;
  companionTest: string;
}> = [];

function observe(html: string): Observation {
  const fragment = JSDOM.fragment(html);
  const text = (value: string | null) => (value ?? '').replace(/\s+/g, ' ').trim();
  const badge = fragment.querySelector<HTMLElement>('[data-oods-component="ColorizedBadge"]');
  return {
    markers: [...fragment.querySelectorAll('[data-oods-component]')]
      .map((element) => element.getAttribute('data-oods-component')!),
    headings: [...fragment.querySelectorAll('h1,h2,h3,h4,h5,h6')]
      .map((element) => ({ level: element.tagName.toLowerCase(), text: text(element.textContent) })),
    visibleText: text(fragment.textContent),
    placeholderText: fragment.querySelector('[data-viz-preview-placeholder]')
      ? text(fragment.querySelector('[data-viz-preview-placeholder]')!.textContent)
      : null,
    badgeStyles: badge ? Object.fromEntries([
      '--cmp-badge-background', '--cmp-badge-border', '--cmp-badge-text',
    ].map((property) => [property, badge.style.getPropertyValue(property)])) : null,
  };
}

function differences(react: Observation, vue: Observation): Array<keyof Observation> {
  return (Object.keys(react) as Array<keyof Observation>)
    .filter((field) => JSON.stringify(react[field]) !== JSON.stringify(vue[field]));
}

async function renderPair(
  component: Component,
  props: Record<string, unknown>,
  reactContent?: ReactNode,
  vueContent?: unknown,
): Promise<{ react: Observation; vue: Observation }> {
  const reactComponent = (ReactComponents as unknown as Record<string, ComponentType>)[component];
  const vueComponent = (VueComponents as Record<string, unknown>)[component];
  expect(reactComponent, `react/${component} root export`).toBeDefined();
  expect(vueComponent, `vue/${component} root export`).toBeDefined();
  const reactHtml = renderReact(createElement(reactComponent!, props, reactContent));
  const vueHtml: string = await renderVue(h(
    vueComponent, props, vueContent === undefined ? undefined : { default: () => vueContent },
  ));
  return { react: observe(reactHtml), vue: observe(vueHtml) };
}

const CASES = COMPONENTS.map((component) => ({ component, omitSlot: false }))
  .concat([{ component: 'VizAreaPreview', omitSlot: true }]);

describe('Sprint 185 computed React/Vue SSR parity', () => {
  it('computes HTML/React/Vue parity for static area pixels, names and raw SVG without exceptions', async () => {
    const svg = '<svg><defs><clipPath id="clip-1"><rect width="10" height="10"/></clipPath></defs><g role="graphics-object" aria-label="Amounts" clip-path="url(#clip-1)"><path d="M0,0L10,10"/></g></svg>';
    const props = { svg, title: 'Payment amounts', description: 'Sample payments', 'aria-label': 'Sample payment chart' };
    const react = renderReact(createElement(ReactComponents.VizAreaPreview, props));
    const vue = await renderVue(h(VueComponents.VizAreaPreview, props));
    const html = renderMappedComponent({ id: 'chart', component: 'VizAreaPreview', props });
    const inspect = (source: string) => {
      const figure = JSDOM.fragment(source).querySelector('figure')!;
      return { role: figure.getAttribute('role'), name: figure.getAttribute('aria-label'), caption: figure.querySelector('figcaption')?.textContent, description: figure.querySelector('[data-viz-description]')?.textContent, svg: figure.querySelector('[data-viz-svg]')?.innerHTML };
    };
    expect(DECLARED_DIFFERENCES).toEqual([]);
    expect(inspect(react)).toEqual(inspect(html));
    expect(inspect(vue)).toEqual(inspect(html));
    expect(inspect(html).name).toBe('Sample payment chart');
    for (const source of [html, react, vue]) expect(source).toContain(svg);
  });
  it('starts with an empty declared-difference allowlist', () => {
    expect(DECLARED_DIFFERENCES).toEqual([]);
  });

  it.each(CASES)('compares $component SSR with omitSlot=$omitSlot', async ({ component, omitSlot }) => {
    const scenario = sharedScenarios.find((entry) => entry.oodsComponentId === component);
    expect(scenario, component).toBeDefined();
    const content = omitSlot ? undefined : scenario!.slots.default;
    const { react, vue } = await renderPair(component, { ...scenario!.props },
      content === undefined ? undefined : String(content),
      content === undefined ? undefined : String(content));
    const diff = differences(react, vue);

    expect(diff, JSON.stringify({ component, react, vue }, null, 2)).toEqual([]);
    expect(react.markers).toContain(component);
    expect(react.visibleText.length).toBeGreaterThan(0);
    if (component === 'DetailHeader') {
      expect(react.headings).toEqual([{ level: 'h1', text: 'Subscription details' }]);
      expect(react.visibleText).toContain('Pro plan');
      expect(react.visibleText).toContain('Renews monthly');
    } else if (component === 'CardHeader') {
      expect(react.headings).toEqual([{ level: 'h2', text: 'Account summary' }]);
      expect(react.visibleText).toContain('Current subscription');
    } else if (component === 'ColorSwatch') {
      expect(react.visibleText).toContain('Ocean blue');
    } else if (component === 'ColorizedBadge') {
      expect(react.visibleText).toContain('Approved');
    } else if (component === 'ClassificationPanel') {
      expect(react.headings).toEqual([{ level: 'h2', text: 'Classification' }]);
      expect(react.visibleText).toContain('Taxonomy and tags');
      expect(react.visibleText).toContain('Electronics > Mobile > Android');
    } else if (component === 'FilterPanel') {
      expect(react.headings).toEqual([]);
      for (const text of ['1 active', 'Clear all', 'Status', 'release_channel', 'Apply']) expect(react.visibleText).toContain(text);
    } else if (component === 'AddressCollectionPanel' || component === 'MembershipPanel' || component === 'PreferencePanel') {
      const expected = {
        AddressCollectionPanel: ['Addresses', 'Billing and shipping', '2 addresses on file'],
        MembershipPanel: ['Membership', 'Roles and permissions', 'Owner of 2 workspaces'],
        PreferencePanel: ['Preferences', 'Namespace: notifications', 'No preferences saved'],
      }[component];
      expect(react.headings).toEqual([{ level: 'h2', text: expected[0] }]);
      for (const text of expected.slice(1)) expect(react.visibleText).toContain(text);
    } else if (component === 'AddressSummaryBadge' || component === 'MessageStatusBadge' || component === 'PreferenceSummaryBadge') {
      expect(react.headings).toEqual([]);
      expect(react.markers).toEqual([component]);
      expect(react.visibleText).toBe({ AddressSummaryBadge: 'Billing address', MessageStatusBadge: 'delivered', PreferenceSummaryBadge: 'notifications' }[component]);
    } else if (component === 'RoleBadgeList') {
      // Adjacent items carry no whitespace, exactly as the HTML renderer concatenates them.
      expect(react.visibleText).toBe('ownerbilling-admin');
    } else if (component === 'TagPills') {
      expect(react.visibleText).toBe('alphabetagamma+5');
    } else if (component === 'AddressValidationTimeline' || component === 'MembershipAuditTimeline' || component === 'MessageEventTimeline' || component === 'PreferenceTimeline') {
      const expected = {
        AddressValidationTimeline: ['Address checks', ['Postal code verified', '2026-09-05T12:00:00Z', 'Matched carrier database', 'Geocoded']],
        MembershipAuditTimeline: ['Membership history', ['No events']],
        MessageEventTimeline: ['Delivery', ['delivered', '2026-09-02T09:00:00Z']],
        PreferenceTimeline: ['Preference changes', ['notifications.email', '2026-09-03T08:00:00Z', 'Enabled']],
      }[component] as [string, string[]];
      expect(react.headings).toEqual([{ level: 'h2', text: expected[0] }]);
      for (const text of expected[1]) expect(react.visibleText).toContain(text);
    } else if (component === 'AuditEvent') {
      expect(react.headings).toEqual([]);
      for (const text of ['2026-09-05T12:00:00Z', 'user.updated', 'Display name changed']) expect(react.visibleText).toContain(text);
    } else if (component === 'AddressEditor' || component === 'PreferenceEditor' || component === 'RoleAssignmentForm') {
      const expected = {
        AddressEditor: ['Shipping address', ['Street', 'City', 'Region', 'Postal Code']],
        // s221-m01: a scalar option reads like the badges (s215-m01 #2388, 25d727945); an authored label ('Owner') still wins.
        PreferenceEditor: ['Preferences', ['Namespace', ...['notifications', 'billing'].map(readable), 'Preference Document', '{"email":true}']],
        RoleAssignmentForm: ['Assign role', ['Role', 'Owner', readable('viewer'), 'Assignee']],
      }[component] as [string, string[]];
      expect(react.headings).toEqual([{ level: 'h2', text: expected[0] }]);
      for (const text of expected[1]) expect(react.visibleText).toContain(text);
    } else if (component === 'StatusSelector' || component === 'TagInput' || component === 'TemplatePicker') {
      // Legends and labels are visible text, never headings.
      const expected = {
        StatusSelector: ['Status', readable('draft'), readable('active')],
        TagInput: ['Tags', 'Tag', 'alpha'],
        TemplatePicker: ['Notification template', 'Template', 'Welcome', 'Channel', readable('email'), readable('sms')],
      }[component];
      expect(react.headings).toEqual([]);
      for (const text of expected) expect(react.visibleText).toContain(text);
    } else if (component === 'TagManager') {
      expect(react.headings).toEqual([{ level: 'h2', text: 'Tags' }]);
      for (const text of ['alpha', 'beta', 'Add Tag']) expect(react.visibleText).toContain(text);
    } else if (component === 'LabelCell' || component === 'InlineLabel' || component === 'FormLabelGroup' || component === 'ClassificationBadge' || component === 'ClassificationEditor') {
      expect(react.markers).toContain(component);
    } else if (['OwnerBadge', 'OwnershipSummary', 'OwnershipMeta', 'TagSummary'].includes(component)) {
      expect(react.markers).toContain(component);
    } else if (['ArchiveSummary', 'ArchivePill', 'CancellationBadge', 'CancellationForm', 'PriceCardMeta'].includes(component)) {
      expect(react.markers).toContain(component);
    } else if (component === 'PriceSummary') {
      expect(react.headings).toEqual([{ level: 'h2', text: 'Price Summary' }]);
      // s213-m01: Sprint 212 m02 (806ce6ded) formats stored minor units as currency and humanizes model and interval codes.
      for (const text of ['Amount', '$1,299.00', 'Currency', 'USD', 'Model', 'Recurring', 'Interval', 'Month']) expect(react.visibleText).toContain(text);
    } else {
      expect(react.placeholderText).toBe(omitSlot ? 'Area preview (640 x 360)' : null);
      expect(react.visibleText).toBe(omitSlot
        ? 'Area preview (640 x 360)'
        : 'Authored area preview content');
    }
  });

  it.each(['OwnerBadge', 'ClassificationBadge', 'AddressSummaryBadge', 'MessageStatusBadge', 'PreferenceSummaryBadge'] as const)(
    '%s keeps the HTML text-only badge semantics even for a known active status', async (component) => {
      const { react, vue } = await renderPair(component, { label: 'Principal', status: 'active' });
      expect(differences(react, vue), JSON.stringify({ react, vue })).toEqual([]);
      expect(react.visibleText).toBe('Principal');
    },
  );

  it.each(['DetailHeader', 'CardHeader'] as const)('preserves scalar whitespace separators in %s headings', async (component) => {
    const { react, vue } = await renderPair(component, {}, ['Alpha', ' ', 'Beta'], ['Alpha', ' ', 'Beta']);
    expect(differences(react, vue), JSON.stringify({ react, vue })).toEqual([]);
    expect(react.headings).toEqual([{ level: 'h2', text: 'Alpha Beta' }]);
  });

  it.each(['DetailHeader', 'CardHeader', 'VizAreaPreview'] as const)(
    'preserves spaces between authored span children in %s',
    async (component) => {
      const { react, vue } = await renderPair(component, {}, [
        createElement('span', { key: 'alpha' }, 'Alpha'), ' ', createElement('span', { key: 'beta' }, 'Beta'),
      ], [h('span', 'Alpha'), ' ', h('span', 'Beta')]);
      expect(differences(react, vue), JSON.stringify({ react, vue })).toEqual([]);
      expect(react.visibleText).toBe('Alpha Beta');
      expect(react.headings).toEqual([]);
      expect(react.placeholderText).toBeNull();
    },
  );

  it.each(['subtle', 'solid'])('uses explicit warning tone over active status for both %s badge token surfaces', async (emphasis) => {
    const { react, vue } = await renderPair('ColorizedBadge', {
      label: 'Active with warning', status: 'active', tone: 'warning', emphasis,
    });
    expect(differences(react, vue), JSON.stringify({ react, vue })).toEqual([]);
    expect(react.badgeStyles).toEqual({
      '--cmp-badge-background': 'var(--sys-status-warning-surface)',
      '--cmp-badge-border': 'var(--sys-status-warning-border)',
      '--cmp-badge-text': 'var(--sys-status-warning-text)',
    });
  });

  it('detects drift in markers, heading levels, and visible text independently', () => {
    const control = observe('<header data-oods-component="DetailHeader"><h2>Plan</h2></header>');
    for (const [field, changed] of [
      ['markers', { ...control, markers: ['CardHeader'] }],
      ['headings', { ...control, headings: [{ level: 'h3', text: 'Plan' }] }],
      ['visibleText', { ...control, visibleText: 'Changed plan' }],
    ] as const) {
      expect(differences(control, changed)).toEqual([field]);
    }
  });
});
