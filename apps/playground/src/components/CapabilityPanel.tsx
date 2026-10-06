import { useMemo, useState } from "react";
import type {
  NormalizedCapability,
  NormalizedPresentation,
  NormalizedProjectionVariant,
  RollupBundle,
} from "../fixtures/stage1-rollups";
import { normalizeCapabilities } from "../fixtures/stage1-rollups";

type Props = {
  label: string;
  targetUrl: string;
  runId: string;
  runPath: string;
  bundle: RollupBundle;
};

function formatConfidence(value: number): string {
  return value.toFixed(2);
}

function EvidencePill({ refEntry }: { refEntry: { artifact_ref: string; json_pointer: string; run_id?: string; source_surface?: string; observation_type?: string } }) {
  const [copied, setCopied] = useState(false);
  const pointerLabel = `${refEntry.artifact_ref}${refEntry.json_pointer}`;

  const onClick = () => {
    navigator.clipboard
      .writeText(pointerLabel)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      })
      .catch(() => {});
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title="Click to copy evidence pointer"
      className="group inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-slate-900/60 px-2 py-1 text-left font-mono text-[11px] text-cyan-100/80 transition-colors hover:border-cyan-400/40 hover:text-white"
    >
      <span className="truncate max-w-[240px]">{pointerLabel}</span>
      {refEntry.source_surface ? (
        <span className="rounded bg-cyan-400/10 px-1 py-0.5 text-[9px] uppercase tracking-wider text-cyan-200/80">
          {refEntry.source_surface}
        </span>
      ) : null}
      {refEntry.observation_type ? (
        <span className="rounded bg-white/5 px-1 py-0.5 text-[9px] uppercase tracking-wider text-white/60">
          {refEntry.observation_type}
        </span>
      ) : null}
      <span className="text-[9px] uppercase tracking-wider text-gray-500 opacity-0 transition-opacity group-hover:opacity-100">
        {copied ? "copied" : "copy"}
      </span>
    </button>
  );
}

function VariantLine({ variant }: { variant: NormalizedProjectionVariant }) {
  return (
    <li className="rounded-md border border-white/10 bg-slate-950/70 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-200">
            {variant.surface}
          </span>
          <span className="font-mono text-[11px] text-white/85">{variant.id}</span>
          {variant.object_canonical_label ? (
            <span className="rounded-full border border-indigo-300/25 bg-indigo-300/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-indigo-100/80">
              object: {variant.object_canonical_label}
            </span>
          ) : null}
        </div>
        {typeof variant.confidence === "number" ? (
          <span className="rounded-full border border-white/10 bg-slate-900/70 px-2 py-0.5 font-mono text-[11px] text-white/80">
            {formatConfidence(variant.confidence)}
          </span>
        ) : null}
      </div>
      {variant.selector ? (
        <div className="mt-1.5 font-mono text-[10px] text-cyan-100/55">
          <span className="text-gray-500">selector:</span> {variant.selector}
        </div>
      ) : null}
      <div className="mt-1.5 font-mono text-[10px] text-indigo-200/75">
        <span className="text-gray-500">capability_id threaded via presentation</span>
      </div>
    </li>
  );
}

function PresentationBlock({ presentation }: { presentation: NormalizedPresentation }) {
  const variantCount = presentation.projection_variants.length;
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-100">
            surface: {presentation.surface}
          </span>
          {presentation.label ? (
            <span className="text-sm text-white">{presentation.label}</span>
          ) : null}
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${
            variantCount > 0
              ? "border border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
              : "border border-white/10 bg-white/5 text-white/55"
          }`}
        >
          {variantCount} derived variant{variantCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-2 font-mono text-[10px] text-indigo-200/75">
        <span className="text-gray-500">capability_id:</span> {presentation.capability_id}
      </div>

      {presentation.member_instances.length > 0 ? (
        <div className="mt-2.5 space-y-1">
          <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500">
            Member instances ({presentation.member_instances.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {presentation.member_instances.map((ref, idx) => (
              <EvidencePill
                key={`${ref.artifact_ref}-${ref.json_pointer}-${idx}`}
                refEntry={ref}
              />
            ))}
          </div>
        </div>
      ) : null}

      {variantCount > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {presentation.projection_variants.map((variant) => (
            <VariantLine key={variant.id} variant={variant} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CapabilityCard({ capability }: { capability: NormalizedCapability }) {
  const autoExpand = capability.presentations.length > 1;
  const [expanded, setExpanded] = useState(autoExpand);
  const totalVariants = capability.presentations.reduce(
    (sum, p) => sum + p.projection_variants.length,
    0,
  );

  return (
    <article className="rounded-xl border border-white/10 bg-[linear-gradient(135deg,rgba(99,102,241,0.08),rgba(15,23,42,0.96))] px-4 py-4 shadow-[0_14px_40px_-32px_rgba(99,102,241,0.55)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-indigo-200/70">
            capability
          </div>
          <h4 className="mt-1 text-base font-semibold text-white">
            {capability.display_label ?? capability.canonical_id}
          </h4>
          <div className="mt-1 break-all font-mono text-[11px] text-indigo-100/60">
            {capability.canonical_id}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {capability.resolution_strategy ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white/70">
              {capability.resolution_strategy}
            </span>
          ) : null}
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${
              capability.presentations.length > 1
                ? "border border-cyan-300/45 bg-cyan-300/15 text-cyan-100"
                : "border border-white/10 bg-white/5 text-white/70"
            }`}
          >
            ⬢ {capability.presentations.length} presentation
            {capability.presentations.length === 1 ? "" : "s"}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-[0.14em] ${
              totalVariants > 0
                ? "border border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
                : "border border-white/10 bg-white/5 text-white/55"
            }`}
          >
            {totalVariants} variant{totalVariants === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {capability.identity_node ? (
        <div className="mt-3 rounded-lg border border-indigo-300/25 bg-indigo-300/5 px-3 py-2 text-[11px] text-indigo-100/85">
          <div className="text-[10px] uppercase tracking-[0.18em] text-indigo-200/65">
            identity_graph node
          </div>
          <div className="mt-1 text-white">
            {capability.identity_node.canonical_label ?? capability.identity_node.canonical_id}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-indigo-200/70">
            class: {capability.identity_node.identity_class}
          </div>
        </div>
      ) : null}

      {capability.conflicts.length > 0 ? (
        <div className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-[11px] text-rose-100">
          {capability.conflicts.length} conflict
          {capability.conflicts.length === 1 ? "" : "s"} from capability or matched objects
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="mt-4 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-indigo-200/85 transition-colors hover:text-white"
        aria-expanded={expanded}
      >
        <span>{expanded ? "▼" : "▶"}</span>
        <span>Presentations ({capability.presentations.length})</span>
      </button>

      {expanded ? (
        <div className="mt-3 space-y-2.5">
          {capability.presentations.map((presentation) => (
            <PresentationBlock
              key={`${presentation.capability_id}-${presentation.surface}-${presentation.label ?? ""}`}
              presentation={presentation}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function CapabilityPanel({ label, targetUrl, runId, runPath, bundle }: Props) {
  const normalized = useMemo(() => normalizeCapabilities(bundle), [bundle]);

  const totalPresentations = normalized.reduce(
    (sum, c) => sum + c.presentations.length,
    0,
  );
  const totalVariants = normalized.reduce(
    (sum, c) => sum + c.presentations.reduce((m, p) => m + p.projection_variants.length, 0),
    0,
  );

  return (
    <div className="flex-1 overflow-auto bg-[#0f1117]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
        <section className="rounded-2xl border border-indigo-500/25 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.22),_transparent_45%),linear-gradient(135deg,rgba(49,46,129,0.25),rgba(15,23,42,0.92))] p-5 shadow-[0_24px_80px_-32px_rgba(99,102,241,0.55)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="text-[11px] uppercase tracking-[0.24em] text-indigo-200/70">
                Stage1 v1.5.0 Rollup Consumer
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                Capability view — {label}
              </h2>
              <p className="mt-3 text-sm leading-6 text-indigo-50/80">
                First-class capability rendering from Stage1's v1.5.0 rollup
                artifacts (<code>identity_graph</code>, <code>capability_rollup</code>,{" "}
                <code>object_rollup</code>). Normalized client-side via the same
                pure transform that{" "}
                <code>packages/mcp-server/src/stage1/capability-normalizer.ts</code>{" "}
                exposes to tools — <code>capability_id</code> is threaded onto every
                presentation, and projection_variants are derived from{" "}
                <code>object_rollup</code> wherever a member_instance evidence ref
                overlaps a variant's evidence_chain.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 text-sm text-indigo-50/80 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-indigo-200/65">
                Target
              </div>
              <div className="mt-2 font-medium text-white">{targetUrl}</div>
              <div className="mt-1 break-all font-mono text-[11px] text-indigo-100/60">
                {runId}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-indigo-200/65">
                Source artifacts
              </div>
              <div className="mt-2 break-all font-mono text-[11px] text-indigo-100/70">
                {runPath}
              </div>
              <div className="mt-1 text-[11px] text-indigo-100/60">
                Sampled: {bundle.sourceCounts.capabilities} capabilities, {bundle.objectRollup.objects.length}/{bundle.sourceCounts.objects} objects, {bundle.identityGraph.nodes.length}/{bundle.sourceCounts.nodes} nodes
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-indigo-200/65">
                Normalizer output
              </div>
              <div className="mt-2 text-white">
                {normalized.length} capabilities, {totalPresentations} presentations
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-indigo-100/60">
                <span>{totalVariants} derived projection_variants</span>
                <span className="rounded-full border border-indigo-300/40 bg-indigo-300/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-indigo-100">
                  byte-identical
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4">
          {normalized.map((capability) => (
            <CapabilityCard
              key={capability.canonical_id}
              capability={capability}
            />
          ))}
        </section>
      </div>
    </div>
  );
}
