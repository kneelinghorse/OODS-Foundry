import type { ReviewChainQueueArtifact, ConfidenceTier } from "../bridge-client";
import { JsonArtifactPanel } from "./JsonArtifactPanel";

type Props = {
  queue: ReviewChainQueueArtifact;
};

const TIER_TONE: Record<ConfidenceTier, string> = {
  high: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  medium: "border-amber-400/35 bg-amber-400/10 text-amber-100",
  low: "border-rose-500/30 bg-rose-500/10 text-rose-100",
  unknown: "border-gray-700 bg-gray-800/40 text-gray-200",
};

function fmt(score: number | null): string {
  if (score === null) return "—";
  return score.toFixed(2);
}

export function ReviewQueuePanel({ queue }: Props) {
  const { summary, entries } = queue;
  return (
    <JsonArtifactPanel
      title="Step 1 · Review Queue"
      subtitle="review-queue emitter (s104-m02) · review-queue.output.json"
      raw={queue}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Entities total" value={summary.entitiesTotal} />
        <Metric label="Flagged" value={summary.flaggedCount} tone="warn" />
        <Metric
          label={`High / Medium / Low`}
          inline={`${summary.tierCounts.high} / ${summary.tierCounts.medium} / ${summary.tierCounts.low}`}
        />
        <Metric label="Unknown tier" value={summary.tierCounts.unknown} />
      </div>

      <p className="mt-3 text-[11px] text-gray-500">
        Threshold {summary.reviewThreshold.toFixed(2)} · top-{summary.lowestSignalsN} lowest
        signals per entry · sorted ascending by score (null-first)
      </p>

      <ul className="mt-4 space-y-2">
        {entries.map((entry) => (
          <li
            key={entry.urn}
            className={`rounded-xl border px-4 py-3 ${entry.flaggedForReview ? "border-amber-400/35 bg-amber-400/5" : "border-gray-800 bg-gray-950/60"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${TIER_TONE[entry.tier]}`}
                  >
                    {entry.tier}
                  </span>
                  <span className="font-mono text-[11px] text-cyan-100/80">{fmt(entry.score)}</span>
                  <span className="text-sm font-medium text-white">{entry.elementName}</span>
                  <span className="text-[11px] text-gray-500">{entry.elementType}</span>
                  {entry.flaggedForReview ? (
                    <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100">
                      flagged
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 break-all font-mono text-[10px] text-gray-500">{entry.urn}</div>
              </div>
            </div>
            {entry.lowestSignals.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {entry.lowestSignals.map((s) => (
                  <span
                    key={`${entry.urn}-${s.name}`}
                    className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-cyan-50/80"
                    title={s.hint ?? undefined}
                  >
                    {s.name} · {s.score.toFixed(2)}
                  </span>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </JsonArtifactPanel>
  );
}

function Metric({
  label,
  value,
  inline,
  tone,
}: {
  label: string;
  value?: number;
  inline?: string;
  tone?: "warn";
}) {
  const toneClass =
    tone === "warn"
      ? "border-amber-400/35 bg-amber-400/10 text-amber-100"
      : "border-gray-800 bg-gray-900/70 text-gray-100";
  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
      <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">
        {inline !== undefined ? inline : value}
      </div>
    </div>
  );
}
