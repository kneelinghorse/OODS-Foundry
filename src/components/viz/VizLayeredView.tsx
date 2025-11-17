import { createRef, useEffect, useMemo, useRef, useState } from 'react';
import type { HTMLAttributes, JSX, KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import { loadVegaEmbed } from '../../viz/runtime/vega-embed-loader.js';
import type { EmbedOptions, EmbedResult, VisualizationSpec } from '../../viz/runtime/vega-embed-loader.js';
import type { NormalizedVizSpec, TraitBinding } from '../../viz/spec/normalized-viz-spec.js';
import { toVegaLiteSpec, type VegaLiteAdapterSpec } from '../../viz/adapters/vega-lite-adapter.js';
import { VizContainer } from './VizContainer.js';
import { ChartDescription } from './ChartDescription.js';
import { SharedLegend } from './SharedLegend.js';
import { AccessibleTable } from './AccessibleTable.js';
import { handleGridNavigationEvent } from '../../viz/layout/keyboard-nav.js';

export interface VizLayeredViewProps extends HTMLAttributes<HTMLElement> {
  readonly spec: NormalizedVizSpec;
  readonly renderer?: 'svg' | 'canvas';
  readonly minHeight?: number;
  readonly showDescription?: boolean;
  readonly showLegend?: boolean;
  readonly showTable?: boolean;
  readonly enableKeyboardNavigation?: boolean;
}

type ChartStatus = 'idle' | 'loading' | 'ready' | 'error';

const DEFAULT_MIN_HEIGHT = 360;

export function VizLayeredView({
  spec,
  renderer = 'svg',
  minHeight = DEFAULT_MIN_HEIGHT,
  showDescription = true,
  showLegend = true,
  showTable = true,
  enableKeyboardNavigation = true,
  className,
  ...props
}: VizLayeredViewProps): JSX.Element {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const embedHandle = useRef<EmbedResult | null>(null);
  const [status, setStatus] = useState<ChartStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const vegaSpec = useMemo<VegaLiteAdapterSpec>(() => toVegaLiteSpec(spec), [spec]);
  const embedOptions = useMemo<EmbedOptions>(() => ({ actions: false, renderer }), [renderer]);
  const layerSummaries = useMemo<readonly LayerSummary[]>(() => deriveLayerSummaries(spec.marks), [spec]);
  const summaryRefs = useMemo<RefObject<HTMLDivElement>[]>(() => {
    return layerSummaries.map(() => createRef<HTMLDivElement>()) as RefObject<HTMLDivElement>[];
  }, [layerSummaries]);

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
        setErrorMessage(error instanceof Error ? error.message : 'Unable to render layered view');
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
        <div className="relative min-h-[320px]" style={{ minHeight: `${minHeight}px` }} data-testid="viz-layered-view-renderer">
          <div ref={chartRef} className={status === 'error' ? 'hidden' : 'h-full w-full'} aria-hidden="true" />
          {status === 'error' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-center text-sm text-text">
              <p className="font-semibold">Unable to render layered chart</p>
              <p className="mt-2 text-text-muted">{errorMessage ?? 'Check the layer definitions and try again.'}</p>
            </div>
          ) : null}
        </div>
      }
      description={
        <>
          {showLegend ? <SharedLegend spec={spec} /> : null}
          {showDescription ? <ChartDescription spec={spec} heading="Layered view summary" /> : null}
        </>
      }
      fallback={
        <div className="space-y-4">
          {showTable ? <AccessibleTable spec={spec} enableKeyboardNavigation={enableKeyboardNavigation} /> : null}
          <LayerSummaryList
            spec={spec}
            summaries={layerSummaries}
            enableKeyboardNavigation={enableKeyboardNavigation}
            refs={summaryRefs}
          />
        </div>
      }
      {...props}
    />
  );
}

type LayeredMark = NormalizedVizSpec['marks'][number];

interface LayerSummary {
  readonly key: string;
  readonly title: string;
  readonly trait: string;
  readonly details: string[];
}

function deriveLayerSummaries(marks: readonly LayeredMark[]): LayerSummary[] {
  return marks.map((mark, index) => {
    const optionTitle = typeof mark.options?.title === 'string' ? mark.options.title : undefined;
    const optionId = typeof mark.options?.id === 'string' ? mark.options.id : undefined;
    const title = optionTitle ?? humanizeTrait(mark.trait) ?? `Layer ${index + 1}`;
    const key = `${optionId ?? mark.trait ?? 'layer'}:${index}`;
    const details: string[] = [];
    appendEncodingDetail(details, 'X', mark.encodings?.x);
    appendEncodingDetail(details, 'Y', mark.encodings?.y);
    appendEncodingDetail(details, 'Color', mark.encodings?.color);
    appendEncodingDetail(details, 'Size', mark.encodings?.size);
    appendEncodingDetail(details, 'Shape', mark.encodings?.shape);

    return {
      key,
      title,
      trait: mark.trait,
      details: details.length > 0 ? details : ['No explicit encodings declared'],
    };
  });
}

function appendEncodingDetail(buffer: string[], label: string, binding: TraitBinding | undefined): void {
  if (!binding?.field) {
    return;
  }
  const title = binding.title ?? binding.field;
  buffer.push(`${label} • ${title}`);
}

function humanizeTrait(trait?: string): string | undefined {
  if (!trait) {
    return undefined;
  }
  const withoutPrefix = trait.startsWith('Mark') ? trait.slice(4) : trait;
  return withoutPrefix.replace(/([a-z])([A-Z])/g, '$1 $2').trim();
}

interface LayerSummaryListProps {
  readonly spec: NormalizedVizSpec;
  readonly summaries: readonly LayerSummary[];
  readonly enableKeyboardNavigation: boolean;
  readonly refs: readonly RefObject<HTMLDivElement>[];
}

function LayerSummaryList({ spec, summaries, enableKeyboardNavigation, refs }: LayerSummaryListProps): JSX.Element {
  if (summaries.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-text-muted">
        <p>No layer metadata available.</p>
      </div>
    );
  }

  const columnCount = Math.min(2, Math.max(1, summaries.length));
  const hasLayerLayout = spec.layout?.trait === 'LayoutLayer';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Layer details</p>
        {!hasLayerLayout ? (
          <p className="text-xs text-[color:var(--sys-status-warning-fg)]">
            Spec does not declare LayoutLayer metadata; fallback summaries shown.
          </p>
        ) : null}
      </header>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {summaries.map((summary, index) => (
          <div
            key={summary.key}
            ref={refs[index]}
            tabIndex={enableKeyboardNavigation ? 0 : undefined}
            className="rounded-xl border border-slate-100 bg-surface p-3 shadow-inner focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--sys-focus-ring]"
            aria-label={`${summary.title}, layer ${index + 1} of ${summaries.length}`}
            onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
              if (!enableKeyboardNavigation) {
                return;
              }
              handleGridNavigationEvent(event.nativeEvent ?? event, index, {
                columns: columnCount,
                totalItems: summaries.length,
                focusAt: (target) => refs[target]?.current?.focus(),
              });
            }}
          >
            <p className="text-sm font-semibold text-text">{summary.title}</p>
            <p className="text-xs uppercase tracking-wide text-text-muted">{summary.trait}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text">
              {summary.details.map((detail, detailIndex) => (
                <li key={`${summary.key}:${detailIndex}`}>{detail}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
