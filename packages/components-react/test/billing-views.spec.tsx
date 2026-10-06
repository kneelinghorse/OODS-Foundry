import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ArchivedRowOverlay, BillingCardMeta, CycleProgressCard, PaymentEventTimeline, PaymentTimeline } from '../src/index.js';

afterEach(cleanup);
const period = { periodStart: '2026-01-01T00:00:00Z', periodEnd: '2026-01-31T00:00:00Z', now: '2026-01-13T00:00:00Z' };
describe('Billable and Archivable presentation intent', () => {
  it.each([
    [{ ...period, progress: 0.4 }, 40, '18 days'],
    [{ ...period, now: '2026-01-16T00:00:00Z' }, 50, '15 days'],
    [{ ...period, progress: 0.4, now: '2026-02-01T00:00:00Z' }, 100, '0 days'],
  ] as const)('announces the actual cycle and lets an ended period override stale progress', (props, percent, days) => {
    render(<CycleProgressCard {...props} />);
    const progress = screen.getByRole('progressbar') as HTMLProgressElement;
    expect(progress.value).toBe(percent);
    expect(progress.getAttribute('aria-label')).toBe(`${percent}% complete · ${days} remaining`);
  });
  it.each([PaymentTimeline, PaymentEventTimeline])('keeps payment dates chronological and names a missing next payment', (Component) => {
    const { container, rerender } = render(<Component lastPayment="2026-02-01T00:00:00Z" nextPayment="2026-01-01T00:00:00Z" amount={0} currency="usd" paymentStatus="failed" />);
    expect([...container.querySelectorAll('time')].map((time) => time.dateTime)).toEqual(['2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z']);
    expect(container.textContent).toContain('$0.00 USD · failed');
    rerender(<Component lastPayment="2026-01-01T00:00:00Z" amount={1999} currency="jpy" minorUnits={1} />);
    expect(container.textContent).toContain('No payment scheduled');
    expect(container.textContent).toContain('¥1,999 JPY');
    expect(container.textContent).not.toContain('undefined');
  });
  it('preserves minor units in the card phrase', () => {
    const { container } = render(<BillingCardMeta amount={1999} currency="usd" minorUnits={100} interval="yearly" />);
    expect(container.textContent).toBe('$19.99 · yearly');
  });
  it('keeps active children untouched and archived children accessible with the trait label', () => {
    const { container, rerender } = render(<ArchivedRowOverlay><button>Team</button></ArchivedRowOverlay>);
    expect(container.textContent).toBe('Team');
    expect(container.querySelector('[data-archived]')).toBeNull();
    expect(container.querySelector('[role="group"]')).toBeNull();
    rerender(<ArchivedRowOverlay isArchived label="Team" tabLabel="Past subscriptions"><button>Team</button></ArchivedRowOverlay>);
    const row = screen.getByRole('group', { name: 'Past subscriptions: Team' });
    expect(row.getAttribute('aria-hidden')).toBe('false');
    expect(row.getAttribute('data-archive-tab')).toBe('Past subscriptions');
    expect(screen.getByRole('button', { name: 'Team' })).toBeTruthy();
    rerender(<ArchivedRowOverlay isArchived showBadge={false} separateTab={false}><button>Team</button></ArchivedRowOverlay>);
    expect(container.textContent).toBe('Team');
    expect(container.querySelector('[data-archive-tab]')).toBeNull();
  });
});
