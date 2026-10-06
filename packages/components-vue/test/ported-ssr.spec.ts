import { PORTED_COMPONENT_IDS, portedScenarios, relativeTimestampEmptyScenario } from '@oods/component-contracts';
import { renderToString } from '@vue/server-renderer';
import { defineComponent, h, type Component } from 'vue';
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

const ServerShowcase = defineComponent({
  name: 'PortedServerShowcase',
  setup() {
    return () => h('main', portedScenarios.map((scenario) => h(
      implementations[scenario.oodsComponentId],
      { key: scenario.id, ...scenario.props },
    )));
  },
});

describe('@oods/components-vue ported server rendering', () => {
  it('SSR-renders all eight ported components from the shared nondegenerate scenarios', async () => {
    const html = await renderToString(h(ServerShowcase));
    for (const componentId of PORTED_COMPONENT_IDS) {
      expect(html, componentId).toContain(`data-oods-component="${componentId}"`);
    }
    expect(html).toContain('role="log"');
    expect(html).toContain('role="search"');
    expect(html).toContain('aria-label="Pagination"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('datetime="2026-09-05T12:00:00Z"');
    expect(html).not.toContain('<dd>true</dd>');
  });
});

it.each([{ currency: 'JPY', amountCents: 1000, minorUnits: 1000, expected: '¥1</span>' }, { currency: 'JPY', amountCents: 1200, expected: '1,200' }, { currency: 'BHD', amountCents: 1234, expected: '1.234' }, { currency: 'BHD', amountCents: 1234, minorUnits: 100, expected: '12.340' }, { currency: 'JPY', amount: 1200, expected: '1,200' }])('PriceBadge respects $currency storage units ($minorUnits)', async ({ expected, ...props }) => {
  expect(await renderToString(h(PriceBadge, props))).toContain(expected);
});

it('omits an empty projected timestamp without suppressing valid dates or default placeholders', async () => {
  for (const datetime of [undefined, '', 'invalid']) expect(await renderToString(h(RelativeTimestamp, { datetime, hideWhenEmpty: true }))).not.toContain('RelativeTimestamp');
  expect(await renderToString(h(RelativeTimestamp, { datetime: '2026-09-25T12:00:00Z', hideWhenEmpty: true }))).toContain('<time');
  expect(await renderToString(h(RelativeTimestamp))).toContain('RelativeTimestamp');
});

// s222-m03 (#2502 ruling 16): an empty value reads the same in React, Vue and HTML; Vue used to render an empty element.
it('renders the shared empty-value scenario as "Unknown time" without a datetime', async () => {
  const html = await renderToString(h(RelativeTimestamp, { ...relativeTimestampEmptyScenario.props }));
  expect(html).toContain('>Unknown time</time>');
  expect(html).not.toMatch(/\sdatetime=/i);
});
