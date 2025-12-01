/**
 * AccessibleMapFallback
 *
 * Provides a semantic table and narrative summary as an alternative to visual maps.
 */

import { useMemo, useState, type JSX } from 'react';
import type { Feature } from 'geojson';
import type { DataRecord } from '../../../viz/adapters/spatial/geo-data-joiner.js';
import { useOptionalSpatialContext } from './SpatialContext.js';

interface TableColumn {
  field: string;
  label: string;
  format?: (value: unknown) => string;
}

export interface AccessibleMapFallbackProps {
  data?: DataRecord[];
  features?: Feature[];
  joinedData?: Map<string, DataRecord>;
  table?: {
    caption: string;
    columns: TableColumn[];
    sortDefault?: string;
    sortOrder?: 'asc' | 'desc';
  };
  narrative?: {
    summary: string;
    keyFindings: string[];
  };
  alwaysVisible?: boolean;
  triggerLabel?: string;
}

interface TableRow {
  id: string;
  featureLabel: string;
  values: Record<string, unknown>;
}

function getFeatureLabel(feature: Feature, fallback: string): string {
  const name = feature.properties?.name;
  if (typeof name === 'string' && name.trim()) {
    return name;
  }
  return fallback;
}

function normalizeJoinedData(joinedData: Map<string, DataRecord> | undefined): Map<string, DataRecord> {
  if (!joinedData) {
    return new Map<string, DataRecord>();
  }
  const normalized = new Map<string, DataRecord>();
  for (const [key, value] of joinedData.entries()) {
    if (Array.isArray(value)) {
      normalized.set(key, value[0] as DataRecord);
    } else {
      normalized.set(key, value);
    }
  }
  return normalized;
}

function deriveColumns(data: DataRecord[]): TableColumn[] {
  if (data.length === 0) {
    return [];
  }
  return Object.keys(data[0]).map((field) => ({
    field,
    label: field,
  }));
}

function formatCell(value: unknown, column: TableColumn): string {
  if (column.format) {
    return column.format(value);
  }
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString();
  }
  return String(value);
}

export function AccessibleMapFallback({
  data,
  features,
  joinedData,
  table,
  narrative,
  alwaysVisible = false,
  triggerLabel = 'Show accessible table',
}: AccessibleMapFallbackProps): JSX.Element {
  const context = useOptionalSpatialContext();
  const [visible, setVisible] = useState<boolean>(alwaysVisible);

  const resolvedFeatures = features ?? context?.features ?? [];
  const resolvedJoinedData = useMemo(
    () => normalizeJoinedData(joinedData ?? context?.joinedData),
    [context?.joinedData, joinedData]
  );
  const caption = table?.caption ?? context?.a11y?.tableFallback?.caption ?? 'Spatial data';

  const resolvedData = useMemo(() => {
    if (data) {
      return data;
    }
    if (resolvedJoinedData.size > 0) {
      return Array.from(resolvedJoinedData.values());
    }
    return [];
  }, [data, resolvedJoinedData]);

  const columns = useMemo(() => {
    if (table?.columns && table.columns.length > 0) {
      return table.columns;
    }
    return deriveColumns(resolvedData);
  }, [resolvedData, table?.columns]);

  const initialSortField = table?.sortDefault ?? (columns.length > 0 ? columns[0].field : undefined);
  const [sortField, setSortField] = useState<string | undefined>(initialSortField);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(table?.sortOrder ?? 'asc');

  const rows: TableRow[] = useMemo(() => {
    return resolvedFeatures.map((feature, index) => {
      const featureId = feature.id !== undefined ? String(feature.id) : `feature-${index}`;
      const label = getFeatureLabel(feature, featureId);
      const datum = resolvedJoinedData.get(featureId);
      return {
        id: featureId,
        featureLabel: label,
        values: datum ?? {},
      };
    });
  }, [resolvedFeatures, resolvedJoinedData]);

  const sortedRows = useMemo(() => {
    if (!sortField) {
      return rows;
    }
    return [...rows].sort((a, b) => {
      const aValue = a.values[sortField];
      const bValue = b.values[sortField];
      if (aValue === bValue) return 0;
      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }
      return sortOrder === 'asc'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
  }, [rows, sortField, sortOrder]);

  const toggleSort = (field: string): void => {
    if (field === sortField) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="w-full">
      {!alwaysVisible && (
        <button
          type="button"
          className="mb-3 rounded border border-[--sys-border-subtle] bg-[--sys-surface] px-3 py-2 text-sm font-medium hover:border-[--sys-border-strong] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[--sys-focus-ring]"
          onClick={() => setVisible((current) => !current)}
          aria-expanded={visible}
          aria-controls="accessible-map-fallback"
        >
          {visible ? 'Hide accessible table' : triggerLabel}
        </button>
      )}

      {(visible || alwaysVisible) && (
        <div id="accessible-map-fallback" className="space-y-4">
          <table className="w-full border-collapse rounded-md border border-[--sys-border-subtle] text-sm">
            {caption && <caption className="text-left font-semibold">{caption}</caption>}
            <thead className="bg-[--sys-surface-alt]">
              <tr>
                <th scope="col" className="border border-[--sys-border-subtle] px-3 py-2 text-left">
                  Feature
                </th>
                {columns.map((column) => (
                  <th
                    key={column.field}
                    scope="col"
                    className="cursor-pointer border border-[--sys-border-subtle] px-3 py-2 text-left"
                    onClick={() => toggleSort(column.field)}
                    aria-sort={
                      sortField === column.field ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'
                    }
                  >
                    <span className="flex items-center gap-1">
                      {column.label}
                      {sortField === column.field && <span aria-hidden="true">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.id} className="even:bg-[--sys-surface-subtle]">
                  <th scope="row" className="border border-[--sys-border-subtle] px-3 py-2 text-left font-semibold">
                    {row.featureLabel}
                  </th>
                  {columns.map((column) => (
                    <td key={column.field} className="border border-[--sys-border-subtle] px-3 py-2">
                      {formatCell(row.values[column.field], column)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {narrative && (
            <section aria-label="Narrative summary" className="space-y-2">
              <h3 className="text-base font-semibold">Narrative</h3>
              <p className="text-sm text-[--sys-text]">{narrative.summary}</p>
              {narrative.keyFindings?.length > 0 && (
                <ul className="list-disc space-y-1 pl-5">
                  {narrative.keyFindings.map((finding, index) => (
                    <li key={index} className="text-sm text-[--sys-text]">
                      {finding}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
