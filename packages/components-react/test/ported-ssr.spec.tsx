/* @vitest-environment node */

import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { relativeTimestampEmptyScenario } from '@oods/component-contracts';

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

describe('@oods/components-react ported server rendering', () => {
  it('server-renders every ported component without browser globals', () => {
    const components: Array<[string, React.ReactElement]> = [
      ['AuditTimeline', <AuditTimeline events={[]} />],
      ['CancellationSummary', <CancellationSummary cancelAtPeriodEnd />],
      ['PaginationBar', <PaginationBar page={1} totalPages={2} totalItems={40} />],
      ['PriceBadge', <PriceBadge amountCents={1299} currency="USD" />],
      [
        'RelativeTimestamp',
        <RelativeTimestamp
          datetime="2026-09-04T12:00:00Z"
          now="2026-09-05T12:00:00Z"
        />,
      ],
      ['SearchInput', <SearchInput id="ssr-search" />],
      ['StatusBadge', <StatusBadge status="active" />],
      ['StatusTimeline', <StatusTimeline status="active" stateHistory={[]} />],
    ];

    for (const [componentId, component] of components) {
      const html = renderToString(component);
      expect(html).toContain(`data-oods-component="${componentId}"`);
      expect(html.length).toBeGreaterThan(30);
    }
  });
});

// Storage factors are currency-specific; an explicit declared factor wins.
it.each([{ currency: 'JPY', amountCents: 1000, minorUnits: 1000, expected: '¥1</span>' }, { currency: 'JPY', amountCents: 1200, expected: '1,200' }, { currency: 'BHD', amountCents: 1234, expected: '1.234' }, { currency: 'BHD', amountCents: 1234, minorUnits: 100, expected: '12.340' }, { currency: 'JPY', amount: 1200, expected: '1,200' }])('PriceBadge respects $currency storage units ($minorUnits)', ({ expected, ...props }) => {
  expect(renderToString(<PriceBadge {...props} />)).toContain(expected);
});

it('omits an empty projected timestamp without suppressing valid dates or default placeholders', () => {
  for (const datetime of [undefined, '', 'invalid']) expect(renderToString(<RelativeTimestamp datetime={datetime} hideWhenEmpty />)).toBe('');
  expect(renderToString(<RelativeTimestamp datetime="2026-09-25T12:00:00Z" hideWhenEmpty />)).toContain('<time');
  expect(renderToString(<RelativeTimestamp />)).toContain('RelativeTimestamp');
});

// s222-m03 (#2502 ruling 16): an empty value reads the same in React, Vue and HTML, and an empty datetime is no
// machine-readable time, so React no longer emits datetime="".
it('renders the shared empty-value scenario as "Unknown time" without a datetime', () => {
  const html = renderToString(<RelativeTimestamp {...relativeTimestampEmptyScenario.props} />);
  expect(html).toContain('>Unknown time</time>');
  expect(html).not.toMatch(/\sdatetime=/i);
});
