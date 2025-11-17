import { useEffect, useMemo, useRef, useState } from 'react';
import type { HTMLAttributes, JSX } from 'react';
import { loadVegaEmbed } from '../../viz/runtime/vega-embed-loader.js';
import type { EmbedOptions, EmbedResult, VisualizationSpec } from '../../viz/runtime/vega-embed-loader.js';
import type { NormalizedVizSpec } from '../../viz/spec/normalized-viz-spec.js';
import { toVegaLiteSpec } from '../../viz/adapters/vega-lite-adapter.js';
import type { VegaLiteAdapterSpec } from '../../viz/adapters/vega-lite-adapter.js';
import { VizContainer } from './VizContainer.js';
import { AccessibleTable } from './AccessibleTable.js';
import { ChartDescription } from './ChartDescription.js';

export interface BarChartProps extends HTMLAttributes<HTMLElement> {
  readonly spec: NormalizedVizSpec;
  readonly renderer?: 'svg' | 'canvas';
  readonly showTable?: boolean;
  readonly showDescription?: boolean;
}

type ChartStatus = 'idle' | 'loading' | 'ready' | 'error';

export function BarChart({
  spec,
  renderer = 'svg',
  showTable = true,
  showDescription = true,
  className,
  ...props
}: BarChartProps): JSX.Element {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const embedHandle = useRef<EmbedResult | null>(null);
  const [status, setStatus] = useState<ChartStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const vegaSpec = useMemo<VegaLiteAdapterSpec>(() => toVegaLiteSpec(spec), [spec]);
  const embedOptions = useMemo<EmbedOptions>(() => ({ actions: false, renderer }), [renderer]);

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
        const message = error instanceof Error ? error.message : 'Unable to render chart';
        setErrorMessage(message);
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console -- surfaced only for local debugging
          console.error('BarChart failed to render via Vega-Lite adapter', error);
        }
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
        <div className="relative min-h-[320px]" data-testid="bar-chart-renderer">
          <div ref={chartRef} className={status === 'error' ? 'hidden' : 'h-full w-full'} aria-hidden="true" />
          {status === 'error' ? (
            <div
              role="alert"
              className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-surface-raised/80 text-center text-sm text-text"
            >
              <p className="font-semibold">Unable to render chart</p>
              <p className="mt-2 text-text-muted">{errorMessage ?? 'Check the viz spec and try again.'}</p>
            </div>
          ) : null}
        </div>
      }
      description={showDescription ? <ChartDescription spec={spec} /> : undefined}
      fallback={showTable ? <AccessibleTable spec={spec} /> : undefined}
      {...props}
    />
  );
}
