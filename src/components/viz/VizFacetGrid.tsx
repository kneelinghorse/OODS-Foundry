import { useEffect, useMemo, useRef, useState, createRef, forwardRef } from 'react';
import type { HTMLAttributes, JSX, KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import { loadVegaEmbed } from '../../viz/runtime/vega-embed-loader.js';
import type { EmbedOptions, EmbedResult, VisualizationSpec } from '../../viz/runtime/vega-embed-loader.js';
import type { NormalizedVizSpec } from '../../viz/spec/normalized-viz-spec.js';
import type { VegaLiteAdapterSpec } from '../../viz/adapters/vega-lite-adapter.js';
import { toVegaLiteSpec } from '../../viz/adapters/vega-lite-adapter.js';
import { VizContainer } from './VizContainer.js';
import { ChartDescription } from './ChartDescription.js';
import { SharedLegend } from './SharedLegend.js';
import { generateFacetTables, type FacetTableResult, type FacetTableGroup } from '../../viz/a11y/facet-table-generator.js';
import type { AccessibleTableColumn } from '../../viz/a11y/table-generator.js';
import { handleGridNavigationEvent } from '../../viz/layout/keyboard-nav.js';

export interface VizFacetGridProps extends HTMLAttributes<HTMLElement> {
  readonly spec: NormalizedVizSpec;
  readonly renderer?: 'svg' | 'canvas';
  readonly minHeight?: number;
  readonly showDescription?: boolean;
  readonly showLegend?: boolean;
  readonly showTables?: boolean;
  readonly enableKeyboardNavigation?: boolean;
}

type ChartStatus = 'idle' | 'loading' | 'ready' | 'error';

const DEFAULT_MIN_HEIGHT = 360;
const FULL_RENDER_THRESHOLD = 8;
const DEFAULT_EXPANDED_PANELS = 4;

export function VizFacetGrid({
  spec,
  renderer = 'svg',
  minHeight = DEFAULT_MIN_HEIGHT,
  showDescription = true,
  showLegend = true,
  showTables = true,
  enableKeyboardNavigation = true,
  className,
  ...props
}: VizFacetGridProps): JSX.Element {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const embedHandle = useRef<EmbedResult | null>(null);
  const [status, setStatus] = useState<ChartStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const vegaSpec = useMemo<VegaLiteAdapterSpec>(() => toVegaLiteSpec(spec), [spec]);
  const embedOptions = useMemo<EmbedOptions>(() => ({ actions: false, renderer }), [renderer]);
  const facetTables = useMemo<FacetTableResult>(() => generateFacetTables(spec), [spec]);
  const panelRefs = useMemo<RefObject<HTMLDivElement>[]>(() => {
    if (facetTables.status !== 'ready') {
      return [];
    }
    return facetTables.groups.map(() => createRef<HTMLDivElement>()) as RefObject<HTMLDivElement>[];
  }, [facetTables]);

  useEffect(() => {
    const target = chartRef.current;
    if (!target) {
      return undefined;
    }

    let cancelled = false;
    setStatus('loading');
    setErrorMessage(null);

    void (async () => {
      try {
        const embed = await loadVegaEmbed();
        const result = await embed(target, vegaSpec as unknown as VisualizationSpec, embedOptions);
        if (cancelled) {
          result.view?.finalize();
          return;
        }
        embedHandle.current = result;
        setStatus('ready');
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Unable to render facet grid');
      }
    })();

    return () => {
      cancelled = true;
      if (embedHandle.current) {
        embedHandle.current.view?.finalize();
        embedHandle.current = null;
      }
      if (chartRef.current) {
        chartRef.current.innerHTML = '';
      }
    };
  }, [embedOptions, vegaSpec]);

  return (
    <VizContainer
      spec={spec}
      className={className}
      chart={
        <div className="relative min-h-[320px]" style={{ minHeight: `${minHeight}px` }} data-testid="viz-facet-grid-renderer">
          <div ref={chartRef} className={status === 'error' ? 'hidden' : 'h-full w-full'} aria-hidden="true" />
          {status === 'error' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-center text-sm text-text">
              <p className="font-semibold">Unable to render facet grid</p>
              <p className="mt-2 text-text-muted">{errorMessage ?? 'Check the layout settings and try again.'}</p>
            </div>
          ) : null}
        </div>
      }
      description={
        <>
          {showLegend ? <SharedLegend spec={spec} /> : null}
          {showDescription ? <ChartDescription spec={spec} heading="Facet summary" /> : null}
        </>
      }
      fallback={
        showTables ? (
          <FacetTableFallback
            result={facetTables}
            enableKeyboardNavigation={enableKeyboardNavigation}
            refs={panelRefs}
          />
        ) : undefined
      }
      {...props}
    />
  );
}

interface FacetTableFallbackProps {
  readonly result: FacetTableResult;
  readonly enableKeyboardNavigation: boolean;
  readonly refs: readonly RefObject<HTMLDivElement>[];
}

function FacetTableFallback({ result, enableKeyboardNavigation, refs }: FacetTableFallbackProps): JSX.Element {
  if (result.status !== 'ready') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-text-muted">
        <p>{result.message}</p>
      </div>
    );
  }

  const { columns, groups, layout } = result;
  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-text-muted">
        <p>No facet panels were derived from the underlying data.</p>
      </div>
    );
  }

  const [expandedPanels, setExpandedPanels] = useState<Set<number>>(() => buildInitialExpandedSet(groups.length));

  useEffect(() => {
    setExpandedPanels(buildInitialExpandedSet(groups.length));
  }, [groups.length]);

  const isExpanded = (index: number): boolean => expandedPanels.has(index);
  const toggleExpanded = (index: number): void => {
    setExpandedPanels((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4" data-testid="facet-table-fallback">
      {groups.map((group, index) => {
        const ref = refs[index];
        const tableId = `facet-panel-table-${group.key}`;
        return (
          <FacetPanel
            key={group.key}
            ref={ref}
            group={group}
            columns={columns}
            panelIndex={index}
            columnCount={layout.columnCount}
            enableKeyboardNavigation={enableKeyboardNavigation}
            totalPanels={layout.panelCount}
            focusRefs={refs}
            expanded={isExpanded(index)}
            onToggle={() => toggleExpanded(index)}
            tableId={tableId}
            rowCount={group.rows.length}
          />
        );
      })}
    </div>
  );
}

function buildInitialExpandedSet(panelCount: number): Set<number> {
  const limit = panelCount <= FULL_RENDER_THRESHOLD ? panelCount : DEFAULT_EXPANDED_PANELS;
  const initial = new Set<number>();
  for (let index = 0; index < limit; index += 1) {
    initial.add(index);
  }
  return initial;
}

interface FacetPanelProps {
  readonly group: FacetTableGroup;
  readonly columns: readonly AccessibleTableColumn[];
  readonly panelIndex: number;
  readonly columnCount: number;
  readonly totalPanels: number;
  readonly enableKeyboardNavigation: boolean;
  readonly focusRefs: readonly RefObject<HTMLDivElement>[];
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly tableId: string;
  readonly rowCount: number;
}

const FacetPanel = forwardRef<HTMLDivElement, FacetPanelProps>(function FacetPanelInner(
  { group, columns, panelIndex, columnCount, totalPanels, enableKeyboardNavigation, focusRefs, expanded, onToggle, tableId, rowCount },
  ref
): JSX.Element {
  const className =
    'rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--sys-focus-ring]';

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (!enableKeyboardNavigation) {
      return;
    }
    handleGridNavigationEvent(event.nativeEvent ?? event, panelIndex, {
      columns: columnCount,
      totalItems: totalPanels,
      focusAt: (index) => focusRefs[index]?.current?.focus(),
    });
  }

  return (
    <div
      ref={ref}
      tabIndex={enableKeyboardNavigation ? 0 : undefined}
      aria-label={group.ariaLabel}
      className={className}
      onKeyDown={handleKeyDown}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text">{group.title}</p>
          <p className="text-xs text-text-muted">
            Panel {panelIndex + 1} of {totalPanels}
          </p>
        </div>
        <button
          type="button"
          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-text hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--sys-focus-ring]"
          aria-expanded={expanded}
          aria-controls={tableId}
          aria-label={`${expanded ? 'Hide' : 'Show'} table for panel ${panelIndex + 1}`}
          onClick={onToggle}
        >
          {expanded ? 'Hide table' : 'Show table'}
        </button>
      </div>
      {expanded ? (
        group.empty ? (
          <p className="mt-3 text-sm text-text-muted">No data available for this facet.</p>
        ) : (
          <div className="mt-3 overflow-auto" id={tableId}>
            <table className="min-w-full border-collapse" aria-label={group.title}>
              <thead className="bg-slate-50">
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
                {group.rows.map((row) => (
                  <tr key={row.key} className="odd:bg-white even:bg-slate-50">
                    {row.cells.map((cell) => (
                      <td key={`${row.key}:${cell.field}`} className="border-b border-slate-100 px-3 py-2 text-sm text-text">
                        {cell.text}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <p className="mt-3 text-sm text-text-muted" id={tableId}>
          {group.empty
            ? 'No data available for this facet.'
            : `${rowCount} rows available. Select “Show table” to render the accessible fallback.`}
        </p>
      )}
    </div>
  );
});
