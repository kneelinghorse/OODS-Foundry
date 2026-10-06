import { useState } from "react";
import type {
  ReviewChainConflictDetailArtifact,
  ReviewChainGap,
} from "../bridge-client";
import { JsonArtifactPanel } from "./JsonArtifactPanel";

type Props = {
  details: Array<{ urn: string; detail: ReviewChainConflictDetailArtifact }>;
};

function fmt(score: number | null): string {
  if (score === null) return "—";
  return score.toFixed(2);
}

function gapLabel(gap: ReviewChainGap): string {
  switch (gap.source) {
    case "signal":
      return `${gap.name} · ${gap.score.toFixed(2)} < ${gap.threshold.toFixed(2)}`;
    case "evidence_refs":
      return `evidence_refs · ${gap.detail}`;
    case "confidence_decomposition":
      return `confidence_decomposition · ${gap.detail}`;
  }
}

function GapSourceChip({ source }: { source: ReviewChainGap["source"] }) {
  const label =
    source === "signal"
      ? "signal"
      : source === "evidence_refs"
        ? "evidence_refs"
        : "decomposition";
  const tone =
    source === "signal"
      ? "border-rose-400/35 bg-rose-400/10 text-rose-100"
      : source === "evidence_refs"
        ? "border-amber-400/35 bg-amber-400/10 text-amber-100"
        : "border-cyan-400/35 bg-cyan-400/10 text-cyan-100";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${tone}`}
    >
      {label}
    </span>
  );
}

function DetailCard({
  detail,
  defaultExpanded,
}: {
  detail: ReviewChainConflictDetailArtifact;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <article className="rounded-xl border border-rose-400/30 bg-[linear-gradient(135deg,rgba(244,63,94,0.08),rgba(15,23,42,0.96))] px-4 py-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-rose-100">{fmt(detail.score)}</span>
            <span className="text-sm font-semibold text-white">{detail.element.name}</span>
            <span className="text-[11px] text-gray-500">{detail.element.type}</span>
            <span className="rounded-full border border-rose-300/35 bg-rose-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-100">
              {detail.tier}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-rose-50/80">
              {detail.gaps.length} gap{detail.gaps.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-1 break-all font-mono text-[10px] text-gray-500">{detail.urn}</div>
        </div>
        <span className="shrink-0 font-mono text-[11px] text-rose-100/70">{expanded ? "▼" : "▶"}</span>
      </button>

      {expanded ? (
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div>
            <h5 className="text-[11px] uppercase tracking-[0.18em] text-gray-400">Signals</h5>
            {detail.signals.length === 0 ? (
              <div className="mt-2 rounded-lg border border-dashed border-gray-800 px-3 py-3 text-[12px] text-gray-500">
                No confidence_decomposition emitted.
              </div>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {detail.signals.map((s) => (
                  <li
                    key={`${detail.urn}-${s.name}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] text-white">{s.name}</div>
                      {s.hint ? (
                        <div className="mt-0.5 text-[11px] text-gray-400">{s.hint}</div>
                      ) : null}
                    </div>
                    <span className="font-mono text-[11px] text-cyan-100/85">{s.score.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h5 className="text-[11px] uppercase tracking-[0.18em] text-gray-400">Evidence gaps</h5>
            {detail.gaps.length === 0 ? (
              <div className="mt-2 rounded-lg border border-dashed border-gray-800 px-3 py-3 text-[12px] text-gray-500">
                No gaps detected.
              </div>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {detail.gaps.map((g, idx) => (
                  <li
                    key={`${detail.urn}-gap-${idx}`}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-rose-50/85"
                  >
                    <GapSourceChip source={g.source} />
                    <span className="font-mono text-[11px]">{gapLabel(g)}</span>
                  </li>
                ))}
              </ul>
            )}

            {detail.context ? (
              <div className="mt-4 rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2 text-[12px] text-gray-300">
                <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Context</div>
                <ul className="mt-1.5 space-y-1">
                  {detail.context.projectionVariants ? (
                    <li>
                      <span className="text-gray-500">projection_variants:</span>{" "}
                      {detail.context.projectionVariants.join(", ")}
                    </li>
                  ) : null}
                  {detail.context.brandOverlay ? (
                    <li>
                      <span className="text-gray-500">brand_overlay:</span>{" "}
                      {detail.context.brandOverlay}
                    </li>
                  ) : null}
                  {detail.context.schemaorg ? (
                    <li>
                      <span className="text-gray-500">schema.org:</span>{" "}
                      <a
                        href={detail.context.schemaorg}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-300 underline-offset-2 hover:underline"
                      >
                        {detail.context.schemaorg}
                      </a>
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function ConflictDetailPanel({ details }: Props) {
  if (details.length === 0) {
    return (
      <JsonArtifactPanel
        title="Conflict Details (per flagged entry)"
        subtitle="conflict-detail emitter (s104-m03) · conflict-detail.output.json"
        raw={details}
      >
        <div className="rounded-xl border border-dashed border-gray-800 px-4 py-6 text-sm text-gray-500">
          No entries were flagged for review at the current threshold — nothing to drill into.
        </div>
      </JsonArtifactPanel>
    );
  }

  return (
    <JsonArtifactPanel
      title={`Conflict Details · ${details.length} flagged entr${details.length === 1 ? "y" : "ies"}`}
      subtitle="conflict-detail emitter (s104-m03) · conflict-detail.output.json"
      raw={details}
    >
      <div className="space-y-3">
        {details.map((d, idx) => (
          <DetailCard key={d.urn} detail={d.detail} defaultExpanded={idx === 0} />
        ))}
      </div>
    </JsonArtifactPanel>
  );
}
