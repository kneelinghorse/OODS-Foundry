import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuditSummaryCard, SortIndicator, TimelineEntryLabel, InlineLabel } from '../src/index.js';
afterEach(cleanup);
describe('the last three retained component obligations', () => {
  it('announces audit summary terms and the latest real actor/time, with honest absence', () => {
    const { rerender } = render(<AuditSummaryCard auditLog={[{ transitioned_at: '2026-09-06T12:00:00Z', actor_id: 'last', to_state: 'paused' }, { transitioned_at: '2026-09-05T12:00:00Z', actor_id: 'first' }]} />);
    expect(screen.getByRole('region').textContent).toContain('Transitions2Last actorlastLast transitionSep 6, 2026, 12:00 PM');
    expect(document.querySelector('time')?.dateTime).toBe('2026-09-06T12:00:00Z');
    rerender(<AuditSummaryCard showLastActor={false} />); expect(screen.queryByText('Last actor')).toBeNull(); expect(screen.getByText('Not recorded')).toBeTruthy();
  });
  it('cycles aria-sort using Enter, Space and pointer and emits exactly one state per activation', async () => {
    const changed = vi.fn(); const user = userEvent.setup(); const { rerender } = render(<SortIndicator sortField="name" onChange={changed} data-oods-action="sortRows" />);
    expect(document.querySelectorAll('[data-oods-action]')).toHaveLength(1); expect(document.querySelector('[data-oods-action="sortRows"]')?.tagName).toBe('BUTTON');
    const button = screen.getByRole('button'); await user.tab(); expect(document.activeElement).toBe(button);
    expect(screen.getByRole('columnheader').getAttribute('aria-sort')).toBe('none');
    await user.keyboard('{Enter}'); expect(screen.getByRole('columnheader').getAttribute('aria-sort')).toBe('ascending');
    await user.keyboard(' '); expect(screen.getByRole('columnheader').getAttribute('aria-sort')).toBe('descending');
    await user.click(button); expect(screen.getByRole('columnheader').getAttribute('aria-sort')).toBe('none');
    expect(changed.mock.calls.map(([value]) => value)).toEqual([{ field: 'name', direction: 'asc', active: true }, { field: 'name', direction: 'desc', active: true }, { field: 'name', direction: 'asc', active: false }]);
    rerender(<SortIndicator sortField="price" sortActive sortDirection="desc" triStateSort={false} />); await user.click(screen.getByRole('button')); expect(screen.getByRole('columnheader').getAttribute('aria-sort')).toBe('ascending');
  });
  it.each([undefined, 8, 0, 'invalid'] as const)('matches InlineLabel truncation for maxLength=%s', maxLength => {
    const label = 'A sufficiently long timeline label which needs compact truncation';
    const { container } = render(<><InlineLabel label={label} maxLength={maxLength ?? 40} /><TimelineEntryLabel label={label} maxLength={maxLength} /></>);
    const [inline, timeline] = container.children; expect(timeline.textContent).toBe(inline.textContent); expect(timeline.getAttribute('data-oods-component')).toBe('TimelineEntryLabel');
  });
  it('keeps full labels outside compact mode and honors authored child content', () => {
    const { container, rerender } = render(<TimelineEntryLabel compact={false} label={'x'.repeat(80)} />); expect(container.textContent).toHaveLength(80);
    rerender(<TimelineEntryLabel label="ignored"><strong>Authored label</strong></TimelineEntryLabel>); expect(container.querySelector('strong')?.textContent).toBe('Authored label');
  });
});
