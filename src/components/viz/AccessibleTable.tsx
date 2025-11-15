import type { HTMLAttributes, JSX } from 'react';
import type { NormalizedVizSpec } from '../../viz/spec/normalized-viz-spec.js';
import type { VizDataAnalysis } from '../../viz/a11y/data-analysis.js';
import { formatDimension, formatValue } from '../../viz/a11y/format.js';
import { generateAccessibleTable } from '../../viz/a11y/table-generator.js';

export interface AccessibleTableProps extends HTMLAttributes<HTMLDivElement> {
  readonly spec: NormalizedVizSpec;
  readonly enableKeyboardNavigation?: boolean;
}

export function AccessibleTable({
  spec,
  className,
  enableKeyboardNavigation = false,
  ...props
}: AccessibleTableProps): JSX.Element {
  const table = generateAccessibleTable(spec);
  const enableRows = enableKeyboardNavigation && table.status === 'ready';

  const rootClassName = [
    'rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-card dark:border-slate-600 dark:bg-slate-900',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (table.status !== 'ready') {
    return (
      <div className={rootClassName} role="note" {...props}>
        <p className="text-sm text-text-muted">{table.message}</p>
      </div>
    );
  }

  return (
    <div className={rootClassName} {...props}>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Accessible data table</p>
      <div className="mt-3 overflow-auto">
        <table className="min-w-full border-collapse" aria-live="polite">
          <caption className="sr-only">{table.caption}</caption>
          <thead className="bg-surface">
            <tr>
              {table.columns.map((column) => (
                <th
                  key={column.field}
                  scope="col"
                  className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => {
              const raw = table.analysis.rows[index];
              return (
                <tr
                  key={row.key}
                  className="odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-800/70"
                  tabIndex={enableRows ? 0 : undefined}
                  aria-label={enableRows ? describeRow(raw, table.analysis) : undefined}
                >
                  {row.cells.map((cell) => (
                    <td key={`${row.key}:${cell.field}`} className="border-b border-slate-100 px-3 py-2 text-sm text-text">
                      {cell.text}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function describeRow(row: Record<string, unknown> | undefined, analysis: VizDataAnalysis): string | undefined {
  if (!row) {
    return undefined;
  }

  const parts: string[] = [];

  if (analysis.dimensionField) {
    parts.push(`${analysis.dimensionField}: ${formatDimension(row[analysis.dimensionField]) ?? '—'}`);
  }

  if (analysis.measureField) {
    parts.push(`${analysis.measureField}: ${formatValue(row[analysis.measureField])}`);
  }

  if (analysis.sizeField && analysis.sizeField !== analysis.measureField) {
    parts.push(`${analysis.sizeField}: ${formatValue(row[analysis.sizeField])}`);
  }

  if (analysis.colorField) {
    parts.push(`${analysis.colorField}: ${formatDimension(row[analysis.colorField]) ?? '—'}`);
  }

  if (parts.length === 0) {
    return undefined;
  }

  return parts.join(', ');
}
