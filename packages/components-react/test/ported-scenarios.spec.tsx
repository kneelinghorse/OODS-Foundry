/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('@oods/components-react ported scenarios', () => {
  it('audit-timeline-transitions renders transition evidence from the shared timeline primitive', () => {
    render(
      <AuditTimeline
        events={[{
          id: 'audit-1',
          from: 'trialing',
          to: 'active',
          timestamp: '2026-09-05T12:00:00.000Z',
          actor_id: 'user-7',
          reason: 'Payment cleared',
        }]}
      />
    );
    const timeline = screen.getByRole('log', { name: 'Audit Timeline' });
    expect(timeline.getAttribute('data-oods-component')).toBe('AuditTimeline');
    // s191-m03 A2: transition titles are human-readable; stored state codes stay unchanged.
    expect(timeline.textContent).toContain('Trialing → Active');
    expect(timeline.textContent).toContain('Actor: user-7');
    expect(timeline.textContent).toContain('Payment cleared');
  });

  it('cancellation-summary-boolean renders a boolean child under its declared label', () => {
    render(<CancellationSummary label="Ends after this billing period">{false}</CancellationSummary>);
    const summary = document.querySelector('[data-oods-component="CancellationSummary"]');
    expect(summary?.textContent).toContain('Ends after this billing period');
    expect(summary?.querySelector('dt')?.textContent).toBe('Ends after this billing period');
    expect(summary?.querySelector('dd')?.textContent).toBe('No');
  });

  it('renders the cancellation field as a named value rather than the literal boolean', () => {
    render(<CancellationSummary label="Cancellation schedule" cancelAtPeriodEnd />);
    const summary = document.querySelector('[data-oods-component="CancellationSummary"]');
    expect(summary?.querySelector('h2')?.textContent).toBe('Cancellation schedule');
    expect(summary?.querySelector('dt')?.textContent).toBe('Cancel at period end');
    expect(summary?.querySelector('dd')?.textContent).toBe('Yes');
    expect(summary?.innerHTML).not.toContain('<dd>true</dd>');
  });

  it('pagination-bar-navigation reconciles totals and emits page changes', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();
    render(
      <PaginationBar
        page={2}
        pageSize={25}
        totalItems={120}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        showPageSizeSelector
      />
    );
    expect(screen.getByText('Showing 26–50 of 120')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Page 2' }).getAttribute('aria-current')).toBe('page');
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Items per page' }), '50');
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it('price-badge-currency formats minor units and preserves the price marker', () => {
    const { container } = render(<PriceBadge amountCents={1299} currency="usd" />);
    const badge = container.querySelector('[data-oods-component="PriceBadge"]');
    expect(badge?.getAttribute('data-price')).toBe('true');
    expect(badge?.getAttribute('data-currency')).toBe('USD');
    expect(badge?.textContent).toMatch(/\$12\.99|US\$12\.99/);
    expect(badge?.getAttribute('data-badge-variant')).toBe('price');
  });

  it('relative-timestamp-fixed renders deterministic relative and machine-readable time', () => {
    const { container } = render(
      <RelativeTimestamp
        now="2026-09-05T12:00:00.000Z"
      >
        2026-09-04T12:00:00.000Z
      </RelativeTimestamp>
    );
    const timestamp = container.querySelector('time');
    expect(timestamp?.getAttribute('data-oods-component')).toBe('RelativeTimestamp');
    expect(timestamp?.getAttribute('datetime')).toBe('2026-09-04T12:00:00.000Z');
    expect(timestamp?.textContent).toBe('yesterday');
  });

  it('search-input-clear supports immediate updates, Escape, and clear button', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<SearchInput defaultValue="renewal" onUpdate={onUpdate} />);
    const input = screen.getByRole('searchbox', { name: 'Search' });
    expect(input.closest('[data-oods-component="SearchInput"]')).not.toBeNull();
    input.focus();
    await user.keyboard('{Escape}');
    expect(onUpdate).toHaveBeenLastCalledWith('');
    await user.type(input, 'plan');
    expect(onUpdate).toHaveBeenLastCalledWith('plan');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onUpdate).toHaveBeenLastCalledWith('');
  });

  it('status-badge-mapped reuses status presentation title, tone, and icon semantics', () => {
    const { container } = render(<StatusBadge status="active" domain="subscription" />);
    const badge = container.querySelector('[data-oods-component="StatusBadge"]');
    expect(badge?.textContent).toContain('Active');
    expect(badge?.getAttribute('data-tone')).toBe('success');
    expect(badge?.getAttribute('title')).toBeTruthy();
    expect(badge?.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(badge?.getAttribute('aria-label')).toBe('Status: Active');
  });

  it('status-timeline-history renders current status and transition count', () => {
    render(
      <StatusTimeline
        status="active"
        allowedTransitions={['paused', 'canceled']}
        stateHistory={[{ from: 'trialing', to: 'active', timestamp: '2026-09-05T12:00:00Z' }]}
      />
    );
    const timeline = screen.getByRole('log', { name: 'Status Timeline' });
    expect(timeline.getAttribute('data-oods-component')).toBe('StatusTimeline');
    expect(timeline.textContent).toContain('Current status: Active');
    expect(timeline.textContent).toContain('Allowed transitions: paused, canceled');
    // s191-m03 A2: transition titles are human-readable; stored state codes stay unchanged.
    expect(timeline.textContent).toContain('Trialing → Active');
  });

  it('search-input-clear honors debounce and minimum query length', () => {
    vi.useFakeTimers();
    const onValueChange = vi.fn();
    render(<SearchInput debounceMs={50} minQueryLength={2} onValueChange={onValueChange} />);
    const input = screen.getByRole('searchbox', { name: 'Search' });
    fireEvent.change(input, { target: { value: 'a' } });
    vi.advanceTimersByTime(50);
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'ab' } });
    vi.advanceTimersByTime(50);
    expect(onValueChange).toHaveBeenCalledWith('ab');
  });
});
