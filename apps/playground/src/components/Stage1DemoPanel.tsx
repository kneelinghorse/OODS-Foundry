import { useState } from "react";
import type { MapApplyResult } from "../bridge-client";

export type Stage1ProjectionVariantSample = {
  id: string;
  surface: string;
  external_component?: string;
  capability_id?: string;
  selector?: string;
  confidence?: number;
  evidence_chain?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
};

export type Stage1BridgeMappingSample = {
  externalSystem: string;
  externalComponent: string;
  oodsTraits: string[];
  confidence?: number;
  projection_variants: Stage1ProjectionVariantSample[];
};

export type Stage1FixtureSchemaVersion = "v1.1.0" | "v1.5.0" | "v1.6.0";

export type Stage1FixtureKind = "reconciliation" | "rollups";

export type Stage1FixtureMeta = {
  id:
    | "linear"
    | "stripe"
    | "linear-v15"
    | "stripe-v15"
    | "linear-v16-rollups"
    | "stripe-v16-rollups";
  label: string;
  schemaVersion: Stage1FixtureSchemaVersion;
  /**
   * "reconciliation" fixtures drive map.apply dry-runs + bridge mapping cards
   * (s91-m03 + s92-m04). "rollups" fixtures drive the capability view rendered
   * from identity_graph/capability_rollup/object_rollup (s93-m04).
   */
  kind?: Stage1FixtureKind;
  reportPath: string;
  targetUrl: string;
  targetId: string;
  candidateObjects: number;
  candidateActions: number;
  verdictCounts: {
    create: number;
    patch: number;
    skip: number;
    conflict: number;
  };
  lowConfidenceConflictAnnotations: number;
  /**
   * Bridge-side mapping samples for v1.5.0 fixtures. Pulled verbatim from
   * Stage1 bridge.json so the card surface demonstrates real projection_variants[]
   * shapes. Empty for v1.1.0 fixtures.
   */
  bridgeMappingSamples?: Stage1BridgeMappingSample[];
  bridgeMappingStats?: {
    total: number;
    variantBearing: number;
    multiVariant: number;
  };
};

type Props = {
  fixture: Stage1FixtureMeta;
  fixtures: Stage1FixtureMeta[];
  onFixtureChange: (next: Stage1FixtureMeta["id"]) => void;
  result: MapApplyResult | null;
  syntheticPatchResult: MapApplyResult | null;
  loading: boolean;
};

function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "good" | "warn" | "danger";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : tone === "warn"
        ? "border-amber-400/40 bg-amber-400/10 text-amber-100"
        : tone === "danger"
          ? "border-rose-500/30 bg-rose-500/10 text-rose-100"
          : "border-gray-800 bg-gray-900/70 text-gray-100";

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
      <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function SectionTitle({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h3 className="text-sm font-semibold tracking-tight text-white">
        {title}
      </h3>
      {detail ? (
        <span className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
          {detail}
        </span>
      ) : null}
    </div>
  );
}

function formatConfidence(confidence: number): string {
  return confidence.toFixed(2);
}

function VariantRow({
  variant,
  mappingExternalComponent,
}: {
  variant: Stage1ProjectionVariantSample;
  mappingExternalComponent: string;
}) {
  const displayComponent = variant.external_component ?? mappingExternalComponent;
  return (
    <li className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-200">
            {variant.surface}
          </span>
          <span className="text-sm text-white">{displayComponent}</span>
          {variant.external_component &&
          variant.external_component !== mappingExternalComponent ? (
            <span className="rounded border border-amber-300/25 bg-amber-300/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-amber-100/80">
              variant label
            </span>
          ) : null}
        </div>
        {typeof variant.confidence === "number" ? (
          <span className="rounded-full border border-white/10 bg-slate-900/60 px-2 py-0.5 font-mono text-[11px] text-white/80">
            {formatConfidence(variant.confidence)}
          </span>
        ) : null}
      </div>
      {variant.selector ? (
        <div className="mt-2 font-mono text-[11px] text-cyan-100/60">
          <span className="text-gray-500">selector:</span> {variant.selector}
        </div>
      ) : null}
      {variant.capability_id ? (
        <div className="mt-1 font-mono text-[11px] text-indigo-200/80">
          <span className="text-gray-500">capability_id:</span>{" "}
          {variant.capability_id}
        </div>
      ) : null}
      {variant.evidence_chain && variant.evidence_chain.length > 0 ? (
        <div className="mt-1 text-[11px] text-gray-500">
          {variant.evidence_chain.length} evidence{" "}
          {variant.evidence_chain.length === 1 ? "entry" : "entries"}
        </div>
      ) : null}
    </li>
  );
}

function BridgeMappingCard({
  mapping,
}: {
  mapping: Stage1BridgeMappingSample;
}) {
  const [expanded, setExpanded] = useState(mapping.projection_variants.length > 1);
  const variantCount = mapping.projection_variants.length;
  const isMulti = variantCount > 1;

  return (
    <article
      className={`relative overflow-hidden rounded-xl border px-4 py-4 shadow-[0_14px_40px_-28px_rgba(56,189,248,0.35)] ${
        isMulti
          ? "border-cyan-400/35 bg-[linear-gradient(135deg,rgba(34,211,238,0.12),rgba(15,23,42,0.96))]"
          : "border-white/10 bg-slate-950/60"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/65">
            {mapping.externalSystem}
          </div>
          <h4 className="mt-1 text-base font-semibold text-white">
            {mapping.externalComponent}
          </h4>
        </div>
        <div className="flex items-center gap-2">
          {isMulti ? (
            <span className="rounded-full border border-cyan-300/45 bg-cyan-300/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
              ⬢ {variantCount} variants
            </span>
          ) : (
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-white/70">
              {variantCount} variant
            </span>
          )}
          {typeof mapping.confidence === "number" ? (
            <span className="rounded-full border border-white/10 bg-slate-900/70 px-2.5 py-0.5 font-mono text-[11px] text-white/80">
              {formatConfidence(mapping.confidence)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {mapping.oodsTraits.map((trait) => (
          <span
            key={`${mapping.externalComponent}-${trait}`}
            className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-cyan-50/75"
          >
            {trait}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="mt-4 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-200/85 transition-colors hover:text-white"
        aria-expanded={expanded}
      >
        <span>{expanded ? "▼" : "▶"}</span>
        <span>Variants ({variantCount})</span>
      </button>

      {expanded ? (
        <ul className="mt-3 space-y-2">
          {mapping.projection_variants.map((variant) => (
            <VariantRow
              key={variant.id}
              variant={variant}
              mappingExternalComponent={mapping.externalComponent}
            />
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function BridgeVariantsSection({
  fixture,
}: {
  fixture: Stage1FixtureMeta;
}) {
  if (fixture.schemaVersion !== "v1.5.0") return null;
  if (!fixture.bridgeMappingSamples || fixture.bridgeMappingSamples.length === 0) {
    return null;
  }

  const stats = fixture.bridgeMappingStats;

  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.08),rgba(15,23,42,0.92))] p-5">
      <SectionTitle
        title="v1.5.0 Projection Variants"
        detail="bridge.json → map.create"
      />
      <p className="mt-2 text-sm leading-6 text-cyan-50/75">
        Stage1 v1.5.0 ships per-mapping{" "}
        <code className="font-mono text-cyan-100/90">projection_variants[]</code>{" "}
        on bridge payloads. Sprint-92 activated the{" "}
        <code className="font-mono text-cyan-100/90">map.create</code> write path
        so these variants round-trip through the OODS mapping registry. The cards
        below are verbatim samples from Stage1's live emission.
      </p>
      {stats ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MetricCard label="Total mappings" value={stats.total} />
          <MetricCard
            label="Carrying variants"
            value={stats.variantBearing}
            tone="good"
          />
          <MetricCard
            label="Multi-variant"
            value={stats.multiVariant}
            tone={stats.multiVariant > 0 ? "warn" : "neutral"}
          />
        </div>
      ) : null}
      <div className="mt-4 grid gap-3">
        {fixture.bridgeMappingSamples.map((mapping) => (
          <BridgeMappingCard
            key={`${mapping.externalSystem}-${mapping.externalComponent}`}
            mapping={mapping}
          />
        ))}
      </div>
    </div>
  );
}

export function Stage1DemoPanel({
  fixture,
  fixtures,
  onFixtureChange,
  result,
  syntheticPatchResult,
  loading,
}: Props) {
  const patchPreview = syntheticPatchResult?.applied.find(
    (entry) => entry.action === "patch" && entry.diff,
  );

  return (
    <div className="flex-1 overflow-auto bg-[#0f1117]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
        <section className="rounded-2xl border border-cyan-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_42%),linear-gradient(135deg,rgba(7,89,133,0.2),rgba(15,23,42,0.92))] p-5 shadow-[0_24px_80px_-32px_rgba(34,211,238,0.45)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/70">
                Stage1 Consumer
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                Reconciliation dry-run against live Stage1 captures
              </h2>
              <p className="mt-3 text-sm leading-6 text-cyan-50/80">
                This mode loads the real on-disk reconciliation reports through{" "}
                <code>map_apply</code> dry-run, then contrasts Stage1’s emitted
                verdict counts with OODS routing at the default confidence
                threshold.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-full border border-white/10 bg-slate-950/40 p-1">
              {fixtures.map((candidate) => {
                const active = candidate.id === fixture.id;
                return (
                  <button
                    key={candidate.id}
                    onClick={() => onFixtureChange(candidate.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "bg-cyan-400 text-slate-950"
                        : "text-cyan-50/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {candidate.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 grid gap-3 text-sm text-cyan-50/75 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-slate-950/30 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/60">
                Target
              </div>
              <div className="mt-2 font-medium text-white">
                {fixture.targetUrl}
              </div>
              <div className="mt-1 break-all font-mono text-[11px] text-cyan-100/60">
                {fixture.targetId}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/30 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/60">
                Fixture Path
              </div>
              <div className="mt-2 break-all font-mono text-[11px] text-cyan-100/70">
                {fixture.reportPath}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/30 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/60">
                Evidence Shape
              </div>
              <div className="mt-2 text-white">
                {fixture.candidateObjects} objects, {fixture.candidateActions}{" "}
                actions
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-cyan-100/60">
                <span>Schema {fixture.schemaVersion} live report</span>
                {fixture.schemaVersion === "v1.5.0" ? (
                  <span className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-100">
                    projection_variants
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-5">
              <SectionTitle
                title="Stage1 Verdicts"
                detail="reconciliation_summary.verdict_counts"
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Create"
                  value={fixture.verdictCounts.create}
                  tone="good"
                />
                <MetricCard label="Patch" value={fixture.verdictCounts.patch} />
                <MetricCard label="Skip" value={fixture.verdictCounts.skip} />
                <MetricCard
                  label="Conflict"
                  value={fixture.verdictCounts.conflict}
                  tone="danger"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-5">
              <SectionTitle
                title="OODS Dry-Run Routing"
                detail="map.apply @ minConfidence 0.75"
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Applied"
                  value={result?.applied.length ?? 0}
                  tone="good"
                />
                <MetricCard
                  label="Skipped"
                  value={result?.skipped.length ?? 0}
                />
                <MetricCard
                  label="Queued"
                  value={result?.queued.length ?? 0}
                  tone="warn"
                />
                <MetricCard
                  label="Conflicted"
                  value={result?.conflicted.length ?? 0}
                  tone="danger"
                />
              </div>
              <div className="mt-4 rounded-xl border border-amber-400/35 bg-amber-300/8 px-4 py-3 text-sm text-amber-50 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.08)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-amber-200/70">
                      Low-confidence annotations
                    </div>
                    <div className="mt-1 text-sm text-amber-50">
                      {fixture.lowConfidenceConflictAnnotations} action-level{" "}
                      <code>low_confidence</code> entries were emitted by Stage1
                      for this report.
                    </div>
                  </div>
                  <div className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-100">
                    Overlay
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-amber-100/80">
                  These annotations are surfaced separately from the queued
                  object bucket. OODS queues object candidates by{" "}
                  <code>candidate_objects[].confidence &lt; 0.75</code>, which
                  is why queued totals can exceed the annotation count.
                </p>
              </div>
              {result?.conflictArtifactPath ? (
                <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900/80 px-4 py-3 text-[11px] text-gray-400">
                  Dry-run artifact preview path:
                  <div className="mt-2 break-all font-mono text-cyan-200">
                    {result.conflictArtifactPath}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-5">
              <SectionTitle
                title="Review Queue"
                detail="queued object candidates"
              />
              {!result?.queued.length && !loading ? (
                <div className="mt-4 rounded-xl border border-dashed border-gray-800 px-4 py-6 text-sm text-gray-500">
                  No queued candidates at the current threshold.
                </div>
              ) : null}
              <div className="mt-4 grid gap-3">
                {result?.queued.map((entry) => (
                  <article
                    key={entry.objectId}
                    className="relative overflow-hidden rounded-xl border border-amber-400/30 bg-[linear-gradient(135deg,rgba(251,191,36,0.08),rgba(15,23,42,0.96))] px-4 py-4 shadow-[0_14px_40px_-28px_rgba(251,191,36,0.55)]"
                  >
                    <div className="absolute right-4 top-4 rounded-full border border-amber-300/35 bg-amber-300/12 px-2 py-1 font-mono text-[11px] text-amber-100">
                      {formatConfidence(entry.confidence)}
                    </div>
                    <div className="pr-16">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-amber-200/65">
                        {entry.action}
                      </div>
                      <h4 className="mt-2 text-base font-semibold text-white">
                        {entry.name}
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-amber-50/85">
                        {entry.reason}
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {entry.recommendedOodsTraits.map((trait) => (
                        <span
                          key={`${entry.objectId}-${trait}`}
                          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-amber-50/80"
                        >
                          {trait}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-5">
              <SectionTitle
                title="Synthetic Patch Diff Preview"
                detail="packages/mcp-server/test/fixtures/reconciliation-report-v1.1.0.json"
              />
              {patchPreview?.diff ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/8 px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/70">
                      {patchPreview.action}
                    </div>
                    <h4 className="mt-2 text-base font-semibold text-white">
                      {patchPreview.name}
                    </h4>
                    <p className="mt-2 text-sm leading-6 text-cyan-50/80">
                      {patchPreview.reason}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <MetricCard
                      label="Patch"
                      value={syntheticPatchResult?.diff.patch ?? 0}
                    />
                    <MetricCard
                      label="Changed Fields"
                      value={patchPreview.diff.changed_fields.length}
                      tone="warn"
                    />
                    <MetricCard
                      label="Added Traits"
                      value={patchPreview.diff.added_traits.length}
                      tone="good"
                    />
                  </div>

                  <div className="rounded-xl border border-gray-800 bg-gray-900/85 px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
                      Changed fields
                    </div>
                    <div className="mt-3 space-y-2">
                      {patchPreview.diff.changed_fields.map((field) => (
                        <div
                          key={field.field}
                          className="rounded-lg border border-gray-800 bg-gray-950/80 px-3 py-3 text-sm text-gray-300"
                        >
                          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-300/80">
                            {field.field}
                          </div>
                          <div className="mt-2 grid gap-2 text-xs text-gray-400">
                            <div>
                              <span className="text-gray-500">From:</span>{" "}
                              {JSON.stringify(field.from)}
                            </div>
                            <div>
                              <span className="text-gray-500">To:</span>{" "}
                              {JSON.stringify(field.to)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {patchPreview.diff.added_traits.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {patchPreview.diff.added_traits.map((trait) => (
                          <span
                            key={trait}
                            className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-emerald-100"
                          >
                            +{trait}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-gray-800 px-4 py-6 text-sm text-gray-500">
                  Synthetic diff preview unavailable.
                </div>
              )}
            </div>

            <BridgeVariantsSection fixture={fixture} />

            <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-5">
              <SectionTitle title="Why this view exists" />
              <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-300">
                <li>
                  Real fixtures prove the write-side bucket math against
                  production-shaped data without mutating the mapping registry.
                </li>
                <li>
                  The highlighted annotation callout makes the distinction
                  between Stage1 telemetry and OODS queue routing explicit.
                </li>
                <li>
                  The synthetic patch card keeps a visible diff surface in the
                  demo even though the real fixtures are all-create reports
                  today.
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
