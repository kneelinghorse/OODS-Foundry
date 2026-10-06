/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it } from 'vitest';

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

afterEach(cleanup);

describe('@oods/components-react ported accessibility', () => {
  it('uses labels, landmarks, logs, time, and current-page semantics', () => {
    const { container } = render(
      <main>
        <StatusBadge status="active" />
        <PriceBadge amountCents={5000} currency="USD" />
        <StatusTimeline status="active" />
        <AuditTimeline events={[]} />
        <CancellationSummary cancelAtPeriodEnd reason="Customer request" />
        <SearchInput id="ported-search" label="Search subscriptions" />
        <PaginationBar page={1} totalPages={3} totalItems={60} />
        <RelativeTimestamp datetime="2026-09-05T12:00:00Z" relative="today" />
      </main>
    );

    expect(container.querySelectorAll('[role="log"]')).toHaveLength(2);
    expect(container.querySelector('label[for="ported-search"]')?.textContent).toContain(
      'Search subscriptions'
    );
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe('1');
    expect(container.querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-09-05T12:00:00.000Z'
    );
  });

  it('passes automated axe for all eight ported roots', async () => {
    const { container } = render(
      <main>
        <StatusBadge status="active" />
        <PriceBadge amountCents={1299} currency="USD" />
        <StatusTimeline status="active" stateHistory={[]} />
        <AuditTimeline events={[]} />
        <CancellationSummary cancelAtPeriodEnd={false} />
        <SearchInput id="axe-ported-search" label="Search subscriptions" />
        <PaginationBar page={1} totalPages={3} totalItems={60} />
        <RelativeTimestamp datetime="2026-09-05T12:00:00Z" relative="today" />
      </main>
    );
    const result = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(result.violations).toEqual([]);
  });
});
