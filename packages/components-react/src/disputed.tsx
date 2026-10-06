import * as React from 'react';
import { auditSummary, initialSort, nextSort, ariaSort, type AuditSummaryValues, type SortIndicatorValues, type SortState } from '@oods/component-contracts';
import { InlineLabel } from './breadth.js';
import type { InlineLabelProps } from './types.js';

export interface AuditSummaryCardProps extends AuditSummaryValues { id?: string; title?: string }
export function AuditSummaryCard({ id, title = 'Audit summary', showTransitionCount = true, showLastTransitionTime = true, showLastActor = true, ...values }: AuditSummaryCardProps) {
  const summary = auditSummary(values);
  return <section id={id} className="oods-audit-summary" data-oods-component="AuditSummaryCard" aria-label={title}>
    <h2>{title}</h2><dl>
      {showTransitionCount && <><dt>Transitions</dt><dd>{summary.count}</dd></>}
      {showLastActor && <><dt>Last actor</dt><dd>{summary.actor}</dd></>}
      {showLastTransitionTime && <><dt>Last transition</dt><dd>{summary.at ? <time dateTime={summary.at}>{summary.timestamp}</time> : summary.timestamp}</dd></>}
    </dl>{summary.recent.length > 0 && <ol aria-label="Recent transitions">{summary.recent.map((entry, index) => <li key={index}>{String(entry.to_state ?? 'Transition')}</li>)}</ol>}
  </section>;
}

export interface SortIndicatorProps extends SortIndicatorValues { id?: string; label?: string; 'data-oods-action'?: string; onChange?: (state: SortState) => void }
export function SortIndicator({ id, label = 'Sort', onChange, 'data-oods-action': action, ...values }: SortIndicatorProps) {
  const [state, setState] = React.useState(() => initialSort(values));
  React.useEffect(() => setState(initialSort(values)), [values.sortField, values.sortDirection, values.sortActive, values.defaultSortField, values.defaultSortDirection]);
  const sort = ariaSort(state);
  return <table id={id} className="oods-sort-indicator" data-oods-component="SortIndicator" aria-label={label}><thead><tr><th scope="col" aria-sort={sort}>
    <button type="button" data-oods-action={action} aria-label={`${label} ${state.field}`} onClick={() => { const next = nextSort(state, values.triStateSort); setState(next); onChange?.(next); }}>{`${state.field}: ${sort}`}</button>
  </th></tr></thead></table>;
}

export interface TimelineEntryLabelProps extends InlineLabelProps { compact?: boolean }
export const TimelineEntryLabel = React.forwardRef<HTMLSpanElement, TimelineEntryLabelProps>(({ compact = true, maxLength, ...props }, ref) =>
  <InlineLabel {...props} ref={ref} maxLength={maxLength ?? (compact ? 40 : undefined)} data-oods-component="TimelineEntryLabel" data-timeline-label="true" data-compact={compact} />);
TimelineEntryLabel.displayName = 'OODS.TimelineEntryLabel';
