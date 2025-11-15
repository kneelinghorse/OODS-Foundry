import { useId } from 'react';
import type { JSX, ReactNode } from 'react';
import type { NormalizedVizSpec } from '../../viz/spec/normalized-viz-spec.js';

export interface VizContainerProps extends React.HTMLAttributes<HTMLElement> {
  readonly spec: NormalizedVizSpec;
  readonly chart: ReactNode;
  readonly fallback?: ReactNode;
  readonly description?: ReactNode;
  readonly heading?: ReactNode;
}

function mergeClassNames(...classes: Array<string | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function VizContainer({
  spec,
  chart,
  fallback,
  description,
  heading,
  className,
  ...props
}: VizContainerProps): JSX.Element {
  const headingId = useId();
  const descriptionId = description ? `${headingId}-description` : undefined;
  const fallbackId = fallback ? `${headingId}-fallback` : undefined;
  const describedBy = [descriptionId, fallbackId].filter(Boolean).join(' ') || undefined;

  const resolvedTitle = heading ?? spec.name ?? spec.a11y.ariaLabel ?? spec.id ?? 'Visualization';
  const themeLabel = spec.config?.theme ? `Theme: ${spec.config.theme}` : undefined;

  return (
    <section
      role="group"
      aria-label={spec.a11y.ariaLabel}
      aria-labelledby={spec.a11y.ariaLabel ? undefined : headingId}
      aria-describedby={describedBy}
      data-viz-spec={spec.id ?? undefined}
      className={mergeClassNames(
        'flex flex-col gap-6 rounded-2xl border border-slate-200 bg-surface-raised px-6 py-6 shadow-card dark:border-slate-700 dark:bg-slate-900/60',
        className
      )}
      {...props}
    >
      <header className="flex flex-col gap-1">
        <p id={headingId} className="text-base font-semibold text-text">
          {resolvedTitle}
        </p>
        {themeLabel ? <p className="text-xs uppercase tracking-wide text-text-muted">{themeLabel}</p> : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-900" aria-hidden="true">
          {chart}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {description ? (
            <div id={descriptionId} className="space-y-3">
              {description}
            </div>
          ) : null}
          {fallback ? (
            <div id={fallbackId} className="space-y-3">
              {fallback}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
