import { useState, type ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  raw: unknown;
  children: ReactNode;
};

/**
 * Shared chrome for the three C5 JSON-artifact panels. Each panel renders a
 * structured view (children) by default with a "Show raw JSON" toggle that
 * swaps to a pretty-printed code block. Per the s105-m04 mission-start audit
 * axis (a): structured panels with raw-JSON toggle help an orchestrating
 * agent reason about artifact shape while keeping full fidelity available.
 */
export function JsonArtifactPanel({ title, subtitle, raw, children }: Props) {
  const [rawMode, setRawMode] = useState(false);

  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-950/70 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-white">{title}</h3>
          {subtitle ? (
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-gray-500">
              {subtitle}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setRawMode((v) => !v)}
          className="rounded border border-gray-700 px-2.5 py-1 text-xs font-medium text-gray-300 transition-colors hover:border-indigo-400 hover:text-white"
        >
          {rawMode ? "Hide raw JSON" : "Show raw JSON"}
        </button>
      </header>

      <div className="mt-4">
        {rawMode ? (
          <pre className="max-h-[480px] overflow-auto rounded-xl border border-gray-800 bg-[#0b0d12] px-4 py-3 font-mono text-[11px] leading-5 text-cyan-100/85">
            {JSON.stringify(raw, null, 2)}
          </pre>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
