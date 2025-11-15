import type { HTMLAttributes, JSX } from 'react';
import type { NormalizedVizSpec } from '../../viz/spec/normalized-viz-spec.js';
import { generateNarrativeSummary } from '../../viz/a11y/narrative-generator.js';

export interface ChartDescriptionProps extends HTMLAttributes<HTMLDivElement> {
  readonly spec: NormalizedVizSpec;
  readonly heading?: string;
}

export function ChartDescription({ spec, heading = 'Narrative description', className, ...props }: ChartDescriptionProps): JSX.Element {
  const narrative = generateNarrativeSummary(spec);
  const summary = narrative.summary ?? spec.a11y.description;
  const findings = narrative.keyFindings ?? [];

  const rootClassName = [
    'rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-card dark:border-slate-600 dark:bg-slate-900',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClassName} {...props}>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{heading}</p>
      {summary ? <p className="mt-2 text-sm text-text">{summary}</p> : null}
      {findings.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-text">
          {findings.map((finding, index) => (
            <li key={`${finding}-${index}`}>{finding}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 text-sm text-text-muted">{spec.a11y.description}</p>
    </div>
  );
}
