import type { HTMLAttributes } from 'react';
import type { NormalizedVizSpec, TraitBinding } from '../../viz/spec/normalized-viz-spec.js';

export interface AccessibleTableProps extends HTMLAttributes<HTMLDivElement> {
  readonly spec: NormalizedVizSpec;
}

const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

export function AccessibleTable({ spec, className, ...props }: AccessibleTableProps): JSX.Element {
  const tableConfig = spec.a11y.tableFallback;
  const rows = Array.isArray(spec.data.values) ? spec.data.values : [];

  const rootClassName = [
    'rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-card dark:border-slate-600 dark:bg-slate-900',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (tableConfig?.enabled === false) {
    return (
      <div className={rootClassName} role="note" {...props}>
        <p className="text-sm text-text-muted">Table fallback is disabled for this visualization.</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={rootClassName} role="note" {...props}>
        <p className="text-sm text-text-muted">
          Inline data values are required to generate an accessible table fallback. Provide `spec.data.values`
          when composing the viz spec.
        </p>
      </div>
    );
  }

  const columns = deriveColumns(spec, rows);
  const resolvedCaption = tableConfig?.caption ?? `Data table for ${spec.name ?? spec.id ?? 'bar chart'}`;

  return (
    <div className={rootClassName} {...props}>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Accessible data table</p>
      <div className="mt-3 overflow-auto">
        <table className="min-w-full border-collapse" aria-live="polite">
          <caption className="sr-only">{resolvedCaption}</caption>
          <thead className="bg-surface">
            <tr>
              {columns.map((column) => (
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
            {rows.map((row, index) => (
              <tr key={`row-${index}`} className="odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-800/70">
                {columns.map((column) => (
                  <td key={column.field} className="border-b border-slate-100 px-3 py-2 text-sm text-text">
                    {formatValue(row[column.field as keyof typeof row])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ColumnDescriptor {
  readonly field: string;
  readonly label: string;
}

function deriveColumns(spec: NormalizedVizSpec, rows: readonly Record<string, unknown>[]): ColumnDescriptor[] {
  const order = spec.portability?.tableColumnOrder ?? [];
  const discovered = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      discovered.add(key);
    }
  }

  const orderedFields: string[] = [];

  for (const field of order) {
    if (discovered.delete(field)) {
      orderedFields.push(field);
    }
  }

  for (const field of discovered) {
    orderedFields.push(field);
  }

  return orderedFields.map((field) => ({
    field,
    label: findColumnLabel(spec, field) ?? humanize(field),
  }));
}

function findColumnLabel(spec: NormalizedVizSpec, field: string): string | undefined {
  const encodingMaps = [spec.encoding, ...spec.marks.map((mark) => mark.encodings).filter(Boolean)];

  for (const encoding of encodingMaps) {
    if (!encoding) {
      continue;
    }

    for (const binding of Object.values(encoding)) {
      if (!binding) {
        continue;
      }

      const typedBinding = binding as TraitBinding;
      if (typedBinding.field === field) {
        if (typedBinding.title) {
          return typedBinding.title;
        }
        if (typedBinding.legend && typeof typedBinding.legend.title === 'string') {
          return typedBinding.legend.title;
        }
      }
    }
  }

  return undefined;
}

function humanize(value: string): string {
  const withSpaces = value
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return numberFormatter.format(value);
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}
