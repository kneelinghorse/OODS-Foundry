import type {
  PolicyDecision,
  ReviewChainSummaryArtifact,
} from "../bridge-client";
import { JsonArtifactPanel } from "./JsonArtifactPanel";

type Props = {
  summary: ReviewChainSummaryArtifact;
};

const DECISION_TONE: Record<PolicyDecision, string> = {
  accept: "border-emerald-500/35 bg-emerald-500/10 text-emerald-100",
  patch: "border-cyan-500/35 bg-cyan-500/10 text-cyan-100",
  defer: "border-amber-400/35 bg-amber-400/10 text-amber-100",
  dismiss: "border-rose-500/30 bg-rose-500/10 text-rose-100",
};

export function ApplySummaryPanel({ summary }: Props) {
  const { entries, summary: aggregates } = summary;
  const c = aggregates.decisionCounts;

  return (
    <JsonArtifactPanel
      title="Step 3 · Apply Summary"
      subtitle="apply-summary emitter (s104-m04) · apply-summary.output.json"
      raw={summary}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DecisionCount label="accept" value={c.accept} tone="accept" />
        <DecisionCount label="patch" value={c.patch} tone="patch" />
        <DecisionCount label="defer" value={c.defer} tone="defer" />
        <DecisionCount label="dismiss" value={c.dismiss} tone="dismiss" />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">
            Default action used
          </div>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-white">
            {aggregates.defaultActionUsed}
          </div>
          <p className="mt-1 text-[11px] text-gray-500">
            Entries that fell through to the bundle's default action (no policy matched).
          </p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">
            Matched policy IDs
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {aggregates.matchedPolicyIds.length === 0 ? (
              <span className="text-[12px] text-gray-500">
                (none — every entry used the default action)
              </span>
            ) : (
              aggregates.matchedPolicyIds.map((id) => (
                <span
                  key={id}
                  className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-cyan-100/85"
                >
                  {id}
                </span>
              ))
            )}
          </div>
          {summary.auditTrail.policyBundleId ? (
            <p className="mt-2 text-[11px] text-gray-500">
              Bundle:{" "}
              <span className="font-mono text-cyan-100/70">{summary.auditTrail.policyBundleId}</span>
            </p>
          ) : null}
        </div>
      </div>

      <ul className="mt-5 space-y-2">
        {entries.map((entry) => (
          <li
            key={entry.urn}
            className="rounded-xl border border-gray-800 bg-gray-950/60 px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${DECISION_TONE[entry.decision]}`}
                  >
                    {entry.decision}
                  </span>
                  <span className="text-sm font-medium text-white">{entry.elementName}</span>
                  <span className="text-[11px] text-gray-500">{entry.elementType}</span>
                </div>
                <div className="mt-1 break-all font-mono text-[10px] text-gray-500">{entry.urn}</div>
              </div>
              <span className="font-mono text-[11px] text-cyan-100/75">
                {entry.policyId}
              </span>
            </div>
            {entry.reason ? (
              <div className="mt-2 text-[12px] leading-5 text-gray-300">{entry.reason}</div>
            ) : null}
          </li>
        ))}
      </ul>
    </JsonArtifactPanel>
  );
}

function DecisionCount({
  label,
  value,
  tone,
}: {
  label: PolicyDecision;
  value: number;
  tone: PolicyDecision;
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${DECISION_TONE[tone]}`}>
      <div className="text-[11px] uppercase tracking-[0.18em] opacity-80">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
