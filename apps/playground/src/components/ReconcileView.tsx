import { useCallback, useState } from "react";
import {
  runReviewChain,
  type PolicyBundle,
  type ReviewChainResult,
} from "../bridge-client";
import { ReviewQueuePanel } from "./ReviewQueuePanel";
import { ConflictDetailPanel } from "./ConflictDetailPanel";
import { ApplySummaryPanel } from "./ApplySummaryPanel";

// Fixture allow-list mirrors fidelity.preview's server-resident set. The
// demo trio called out in the s105-m04 success criteria leads.
const FIXTURES: ReadonlyArray<{ id: string; label: string; description: string }> = [
  {
    id: "subscription-low-confidence",
    label: "subscription-low-confidence",
    description: "Canonical low-confidence flagged case (1 defer entry under flag-below-0.5).",
  },
  {
    id: "article",
    label: "article",
    description: "All-high entity; exercises the default-action path.",
  },
  {
    id: "content-pack",
    label: "content-pack",
    description: "Three entities with mixed decisions across bundles.",
  },
  {
    id: "user",
    label: "user",
    description: "Single-entity canonical user manifest.",
  },
  {
    id: "product",
    label: "product",
    description: "Single-entity canonical product manifest.",
  },
  {
    id: "subscription",
    label: "subscription",
    description: "Single-entity canonical subscription manifest.",
  },
  {
    id: "billing-multi-entity",
    label: "billing-multi-entity",
    description: "Multi-entity billing manifest.",
  },
  {
    id: "author",
    label: "author",
    description: "Content/author canonical fixture.",
  },
  {
    id: "comment",
    label: "comment",
    description: "Content/comment canonical fixture.",
  },
];

// Bundle bodies are inlined so agents/humans reading the code can see exactly
// what they're toggling. Drawn verbatim from the s104-m04 Q3 e2e fixtures.
const FLAG_BELOW_05: PolicyBundle = {
  id: "flag-below-0.5",
  policies: [
    {
      id: "low-confidence-defer",
      when: { kind: "confidence_threshold", threshold: 0.5, matchUnknown: true },
      then: "defer",
      reason: "Score below 0.5 — defer to human review",
    },
  ],
};

const DISMISS_ALL: PolicyBundle = {
  id: "dismiss-all",
  policies: [
    {
      id: "catch-all-dismiss",
      when: { kind: "entity_urn_match", pattern: "*" },
      then: "dismiss",
      reason: "Catch-all dismiss",
    },
  ],
};

type BundleChoice = "flag-below-0.5" | "dismiss-all";

const BUNDLE_OPTIONS: ReadonlyArray<{
  value: BundleChoice;
  label: string;
  subtitle: string;
  bundle: PolicyBundle;
}> = [
  {
    value: "flag-below-0.5",
    label: "flag-below-0.5",
    subtitle: "Defer items with score < 0.5 (matchUnknown=true)",
    bundle: FLAG_BELOW_05,
  },
  {
    value: "dismiss-all",
    label: "dismiss-all",
    subtitle: "Catch-all → dismiss every item",
    bundle: DISMISS_ALL,
  },
];

type Step = 0 | 1 | 2 | 3;

const STEP_LABEL: Record<Step, string> = {
  0: "Ready",
  1: "Queue generated",
  2: "Policies resolved",
  3: "Apply summary ready",
};

export function ReconcileView() {
  const [fixture, setFixture] = useState<string>("subscription-low-confidence");
  const [bundleChoice, setBundleChoice] = useState<BundleChoice>("flag-below-0.5");
  const [chain, setChain] = useState<ReviewChainResult | null>(null);
  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedFixture = FIXTURES.find((f) => f.id === fixture) ?? FIXTURES[0];
  const selectedBundle =
    BUNDLE_OPTIONS.find((b) => b.value === bundleChoice) ?? BUNDLE_OPTIONS[0];

  const resetChain = useCallback(() => {
    setChain(null);
    setStep(0);
    setError(null);
  }, []);

  const ensureChain = useCallback(async (): Promise<ReviewChainResult | null> => {
    if (chain) return chain;
    setLoading(true);
    setError(null);
    const response = await runReviewChain({
      fixture,
      policies: selectedBundle.bundle,
    });
    setLoading(false);
    if ("error" in response && response.error) {
      setError(`[${response.error.code}] ${response.error.message}`);
      setChain(null);
      return null;
    }
    if ("ok" in response && response.ok && response.result) {
      setChain(response.result);
      return response.result;
    }
    setError("Bridge returned an unexpected response shape.");
    return null;
  }, [chain, fixture, selectedBundle.bundle]);

  const handleStep1 = useCallback(async () => {
    const result = await ensureChain();
    if (result) setStep(1);
  }, [ensureChain]);

  const handleStep2 = useCallback(async () => {
    const result = await ensureChain();
    if (result) setStep(2);
  }, [ensureChain]);

  const handleStep3 = useCallback(async () => {
    const result = await ensureChain();
    if (result) setStep(3);
  }, [ensureChain]);

  const onFixtureChange = useCallback(
    (next: string) => {
      setFixture(next);
      resetChain();
    },
    [resetChain],
  );

  const onBundleChange = useCallback(
    (next: BundleChoice) => {
      setBundleChoice(next);
      resetChain();
    },
    [resetChain],
  );

  return (
    <div className="flex-1 overflow-auto bg-[#0f1117]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
        <header className="rounded-2xl border border-indigo-500/25 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.18),_transparent_45%),linear-gradient(135deg,rgba(79,70,229,0.12),rgba(15,23,42,0.92))] p-5 shadow-[0_24px_80px_-32px_rgba(99,102,241,0.4)]">
          <div className="text-[11px] uppercase tracking-[0.24em] text-indigo-200/70">
            C5 Chain · Reconcile
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            Review queue → policy resolution → apply summary
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-indigo-50/80">
            Compose the three C5 agent-readable artifacts against a server-resident Object Catalog
            fixture. Each step reveals the artifact an orchestrating agent would receive at that
            point in the chain. The default policy bundle <code className="font-mono">flag-below-0.5</code>{" "}
            comes verbatim from the s104-m04 Q3 fixtures; toggle to <code className="font-mono">dismiss-all</code> to
            see how decision counts shift when every entity matches.
          </p>
          <p className="mt-3 text-[11px] leading-5 text-indigo-50/60">
            Honesty note: artifacts are returned from a single <code className="font-mono">review.chain</code>{" "}
            tool call; the step-through here is a presentation choice that mirrors how an
            orchestrating agent would invoke <code>review-queue → review.resolve → apply-summary</code>{" "}
            as discrete tool calls in production.
          </p>
        </header>

        <section className="rounded-2xl border border-gray-800 bg-gray-950/70 p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="text-[11px] uppercase tracking-[0.18em] text-gray-400">
                Source manifest (Q3 fixture allow-list)
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {FIXTURES.map((f) => {
                  const active = f.id === fixture;
                  return (
                    <button
                      key={f.id}
                      onClick={() => onFixtureChange(f.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? "border-indigo-400 bg-indigo-500 text-white"
                          : "border-white/10 bg-slate-900/60 text-indigo-50/70 hover:border-indigo-300/40 hover:text-white"
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[12px] leading-5 text-gray-400">
                {selectedFixture.description}
              </p>
            </div>

            <div>
              <h3 className="text-[11px] uppercase tracking-[0.18em] text-gray-400">
                Policy bundle (hard-wired; no editor)
              </h3>
              <div className="mt-3 grid gap-2">
                {BUNDLE_OPTIONS.map((opt) => {
                  const active = opt.value === bundleChoice;
                  return (
                    <label
                      key={opt.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                        active
                          ? "border-indigo-400 bg-indigo-500/10"
                          : "border-white/10 bg-slate-900/40 hover:border-indigo-300/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="policy-bundle"
                        value={opt.value}
                        checked={active}
                        onChange={() => onBundleChange(opt.value)}
                        className="mt-1 accent-indigo-500"
                      />
                      <div className="min-w-0">
                        <div className="font-mono text-[13px] text-white">{opt.label}</div>
                        <div className="mt-0.5 text-[12px] text-indigo-50/70">{opt.subtitle}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-800 bg-gray-950/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <StepIndicator current={step} loading={loading} />
              <span className="text-[12px] text-gray-400">{STEP_LABEL[step]}</span>
            </div>
            {chain ? (
              <button
                onClick={resetChain}
                className="rounded border border-gray-700 px-2.5 py-1 text-xs text-gray-400 transition-colors hover:border-gray-500 hover:text-white"
              >
                Reset chain
              </button>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <StepButton
              label="Step 1 · Generate Review Queue"
              onClick={handleStep1}
              enabled={step < 1 && !loading}
              active={step >= 1}
            />
            <StepButton
              label="Step 2 · Resolve via Policy Bundle"
              onClick={handleStep2}
              enabled={step === 1 && !loading}
              active={step >= 2}
            />
            <StepButton
              label="Step 3 · Generate Apply Summary"
              onClick={handleStep3}
              enabled={step === 2 && !loading}
              active={step >= 3}
            />
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          {chain && step > 0 ? (
            <div className="mt-4 grid gap-2 text-[11px] text-gray-500 lg:grid-cols-3">
              <span>
                <span className="text-gray-400">Fixture:</span>{" "}
                <span className="font-mono text-cyan-100/75">{chain.diagnostics.fixture}</span>
              </span>
              <span>
                <span className="text-gray-400">Entities:</span>{" "}
                <span className="font-mono text-cyan-100/75">{chain.diagnostics.entityCount}</span>
              </span>
              <span>
                <span className="text-gray-400">Flagged:</span>{" "}
                <span className="font-mono text-cyan-100/75">{chain.diagnostics.flaggedCount}</span>
              </span>
            </div>
          ) : null}
        </section>

        {chain && step >= 1 ? <ReviewQueuePanel queue={chain.queue} /> : null}
        {chain && step >= 2 ? <ConflictDetailPanel details={chain.conflictDetails} /> : null}
        {chain && step >= 3 ? <ApplySummaryPanel summary={chain.summary} /> : null}
      </div>
    </div>
  );
}

function StepButton({
  label,
  onClick,
  enabled,
  active,
}: {
  label: string;
  onClick: () => void;
  enabled: boolean;
  active: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!enabled}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
          : enabled
            ? "border-indigo-400 bg-indigo-500 text-white hover:bg-indigo-400"
            : "cursor-not-allowed border-gray-800 bg-gray-900/40 text-gray-500"
      }`}
    >
      {active ? "✓ " : ""}
      {label}
    </button>
  );
}

function StepIndicator({ current, loading }: { current: Step; loading: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3].map((n) => {
        const reached = current >= n;
        return (
          <span
            key={n}
            className={`h-2.5 w-2.5 rounded-full transition-colors ${
              loading && current === n - 1
                ? "animate-pulse bg-indigo-300"
                : reached
                  ? "bg-emerald-400"
                  : "bg-gray-700"
            }`}
          />
        );
      })}
    </div>
  );
}
