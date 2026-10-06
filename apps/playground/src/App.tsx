import { useCallback, useEffect, useMemo, useState } from "react";
import {
  healthCheck,
  runFidelityPreview,
  runMapApply,
  runPipeline,
  runTool,
  type BridgeResponse,
  type FidelityKind,
  type FidelityPreviewResult,
  type MapApplyResult,
  type PipelineResult,
} from "./bridge-client";
import { useDebounce } from "./hooks";
import { IntentInput } from "./components/IntentInput";
import { Selectors, type Fidelity } from "./components/Selectors";
import { PreviewPanel } from "./components/PreviewPanel";
import { CodePanel } from "./components/CodePanel";
import { StatusBar } from "./components/StatusBar";
import { StarterPrompts } from "./components/StarterPrompts";
import {
  Stage1DemoPanel,
  type Stage1FixtureMeta,
} from "./components/Stage1DemoPanel";
import { CapabilityPanel } from "./components/CapabilityPanel";
import { FixturePicker } from "./components/FixturePicker";
import { ReconcileView } from "./components/ReconcileView";
import {
  LINEAR_V16_ROLLUPS,
  STRIPE_V16_ROLLUPS,
  type RollupBundle,
} from "./fixtures/stage1-rollups";

type Framework = "react" | "vue" | "html";
type Styling = "inline" | "tokens" | "tailwind";
type Brand = string;
type ViewMode = "compose" | "stage1" | "reconcile";

function brandToOverlay(brand: Brand): string | undefined {
  return brand === "default" ? undefined : brand;
}

const STAGE1_FIXTURES: Record<Stage1FixtureMeta["id"], Stage1FixtureMeta> = {
  linear: {
    id: "linear",
    label: "Linear (v1.1.0)",
    schemaVersion: "v1.1.0",
    reportPath:
      "../Stage1/out/stage1/linear-reconciliation-s43-validation/82201fef-efed-4bcf-8b39-192a09555745/artifacts/reconciliation_report.json",
    targetUrl: "https://linear.app/",
    targetId: "82201fef-efed-4bcf-8b39-192a09555745",
    candidateObjects: 93,
    candidateActions: 9,
    verdictCounts: {
      create: 93,
      patch: 0,
      skip: 0,
      conflict: 0,
    },
    lowConfidenceConflictAnnotations: 4,
  },
  stripe: {
    id: "stripe",
    label: "Stripe (v1.1.0)",
    schemaVersion: "v1.1.0",
    reportPath:
      "../Stage1/out/stage1/stripe-reconciliation-s43-validation/da66f1d2-0d23-43c1-ba29-5c0ec7be631e/artifacts/reconciliation_report.json",
    targetUrl: "https://stripe.com/",
    targetId: "da66f1d2-0d23-43c1-ba29-5c0ec7be631e",
    candidateObjects: 195,
    candidateActions: 33,
    verdictCounts: {
      create: 195,
      patch: 0,
      skip: 0,
      conflict: 0,
    },
    lowConfidenceConflictAnnotations: 11,
  },
  "linear-v15": {
    id: "linear-v15",
    label: "Linear (v1.5.0)",
    schemaVersion: "v1.5.0",
    reportPath:
      "../Stage1/out/sprint-45-live-rerun/stage1/linear-app-s45-m06-rerun/dc1cfabb-f07a-47dc-8a23-ba160e5b45b9/artifacts/reconciliation_report.json",
    targetUrl: "https://linear.app/",
    targetId: "dc1cfabb-f07a-47dc-8a23-ba160e5b45b9",
    candidateObjects: 73,
    candidateActions: 0,
    verdictCounts: {
      create: 73,
      patch: 0,
      skip: 0,
      conflict: 0,
    },
    lowConfidenceConflictAnnotations: 5,
    bridgeMappingStats: {
      total: 73,
      variantBearing: 73,
      multiVariant: 2,
    },
    bridgeMappingSamples: [
      {
        externalSystem: "stage1-orca/general",
        externalComponent: "Header Button Item Crtcc",
        oodsTraits: ["actionable", "color", "interactive", "typography"],
        confidence: 0.95,
        projection_variants: [
          {
            id: "header-button-item-crtcc-desktop",
            surface: "desktop",
            selector: "cluster:cluster-41",
            confidence: 0.95,
            evidence_chain: [
              {
                artifact_ref: "component_clusters.json",
                json_pointer: "/clusters/35",
                source_surface: "dom",
                observation_type: "component_cluster",
              },
            ],
            metadata: {
              source_surface: "dom",
              candidate_type: "component_cluster",
            },
          },
          {
            id: "header-button-item-crtcc-mobile",
            surface: "mobile",
            selector: "cluster-41",
            confidence: 0.95,
            evidence_chain: [
              {
                artifact_ref: "orca_candidates.json",
                json_pointer: "/objects/33",
                source_surface: "dom",
                observation_type: "orca_object",
              },
            ],
            metadata: {
              source_surface: "dom",
              candidate_type: "orca_object",
            },
          },
        ],
      },
      {
        externalSystem: "stage1-orca/general",
        externalComponent: "Hero New Feature Link Pht6b",
        oodsTraits: [
          "border",
          "color",
          "interactive",
          "spacing",
          "typography",
          "visual",
        ],
        confidence: 0.85,
        projection_variants: [
          {
            id: "hero-new-feature-link-pht6b-desktop",
            surface: "desktop",
            selector: "cluster:cluster-10",
            confidence: 0.95,
            evidence_chain: [
              {
                artifact_ref: "component_clusters.json",
                json_pointer: "/clusters/7",
                source_surface: "dom",
                observation_type: "component_cluster",
              },
            ],
            metadata: {
              source_surface: "dom",
              candidate_type: "component_cluster",
            },
          },
          {
            id: "hero-new-feature-link-pht6b-mobile",
            surface: "mobile",
            selector: "cluster-10",
            confidence: 0.95,
            evidence_chain: [
              {
                artifact_ref: "orca_candidates.json",
                json_pointer: "/objects/7",
                source_surface: "dom",
                observation_type: "orca_object",
              },
            ],
            metadata: {
              source_surface: "dom",
              candidate_type: "orca_object",
            },
          },
        ],
      },
      {
        externalSystem: "stage1-orca/general",
        externalComponent: "Agent List Card Euuz1",
        oodsTraits: ["border", "color", "composable", "spacing", "visual"],
        confidence: 0.95,
        projection_variants: [
          {
            id: "agent-list-card-euuz1-desktop",
            surface: "desktop",
            selector: "cluster-67",
            confidence: 0.95,
            evidence_chain: [
              {
                artifact_ref: "orca_candidates.json",
                json_pointer: "/objects/26",
                source_surface: "dom",
                observation_type: "orca_object",
              },
              {
                artifact_ref: "component_clusters.json",
                json_pointer: "/clusters/27",
                source_surface: "dom",
                observation_type: "component_cluster",
              },
            ],
            metadata: {
              source_surface: "dom",
              candidate_type: "component_cluster",
            },
          },
        ],
      },
    ],
  },
  "linear-v16-rollups": {
    id: "linear-v16-rollups",
    label: "Linear (v1.6.0 rollups)",
    schemaVersion: "v1.6.0",
    kind: "rollups",
    reportPath:
      "../Stage1/out/sprint-46-live-rerun/stage1/linear-app-s46-m06-rerun/a0300dc0-c10f-4821-b648-48556da43ef7/artifacts",
    targetUrl: "https://linear.app/",
    targetId: "a0300dc0-c10f-4821-b648-48556da43ef7",
    candidateObjects: 0,
    candidateActions: 0,
    verdictCounts: { create: 0, patch: 0, skip: 0, conflict: 0 },
    lowConfidenceConflictAnnotations: 0,
  },
  "stripe-v16-rollups": {
    id: "stripe-v16-rollups",
    label: "Stripe (v1.6.0 rollups)",
    schemaVersion: "v1.6.0",
    kind: "rollups",
    reportPath:
      "../Stage1/out/sprint-46-live-rerun/stage1/stripe-com-s46-m06-rerun/7adc1d79-426b-4c8e-a217-e6d5a129b182/artifacts",
    targetUrl: "https://stripe.com/",
    targetId: "7adc1d79-426b-4c8e-a217-e6d5a129b182",
    candidateObjects: 0,
    candidateActions: 0,
    verdictCounts: { create: 0, patch: 0, skip: 0, conflict: 0 },
    lowConfidenceConflictAnnotations: 0,
  },
  "stripe-v15": {
    id: "stripe-v15",
    label: "Stripe (v1.5.0)",
    schemaVersion: "v1.5.0",
    reportPath:
      "../Stage1/out/sprint-45-live-rerun/stage1/stripe-com-s45-m06-rerun/07776e70-ec86-449a-b570-3978161793ac/artifacts/reconciliation_report.json",
    targetUrl: "https://stripe.com/",
    targetId: "07776e70-ec86-449a-b570-3978161793ac",
    candidateObjects: 129,
    candidateActions: 0,
    verdictCounts: {
      create: 129,
      patch: 0,
      skip: 0,
      conflict: 0,
    },
    lowConfidenceConflictAnnotations: 9,
    bridgeMappingStats: {
      total: 129,
      variantBearing: 128,
      multiVariant: 0,
    },
    bridgeMappingSamples: [
      {
        externalSystem: "stage1-orca/general",
        externalComponent: "AnnualUpdatSvgPrimitive1",
        oodsTraits: ["border", "color", "spacing", "typography", "visual"],
        confidence: 0.8,
        projection_variants: [
          {
            id: "annualupdatsvgprimitive-desktop",
            surface: "desktop",
            external_component: "G",
            selector: "cluster-11",
            confidence: 0.95,
            evidence_chain: [
              {
                artifact_ref: "orca_candidates.json",
                json_pointer: "/objects/13",
                source_surface: "dom",
                observation_type: "orca_object",
              },
              {
                artifact_ref: "component_clusters.json",
                json_pointer: "/clusters/14",
                source_surface: "dom",
                observation_type: "component_cluster",
              },
            ],
            metadata: {
              source_surface: "dom",
              candidate_type: "component_cluster",
            },
          },
        ],
      },
    ],
  },
};

const SYNTHETIC_PATCH_FIXTURE_PATH =
  "packages/mcp-server/test/fixtures/reconciliation-report-v1.1.0.json";

const ROLLUP_BUNDLES: Record<Stage1FixtureMeta["id"], RollupBundle | null> = {
  linear: null,
  stripe: null,
  "linear-v15": null,
  "stripe-v15": null,
  "linear-v16-rollups": LINEAR_V16_ROLLUPS,
  "stripe-v16-rollups": STRIPE_V16_ROLLUPS,
};

function rollupBundleFor(id: Stage1FixtureMeta["id"]): RollupBundle {
  const bundle = ROLLUP_BUNDLES[id];
  if (!bundle) {
    throw new Error(`Rollup bundle not available for fixture "${id}"`);
  }
  return bundle;
}

function getInitialView(): ViewMode {
  if (window.location.hash === "#stage1") return "stage1";
  if (window.location.hash === "#reconcile") return "reconcile";
  return "compose";
}

function setViewHash(next: ViewMode): void {
  if (next === "stage1") {
    window.location.hash = "stage1";
    return;
  }
  if (next === "reconcile") {
    window.location.hash = "reconcile";
    return;
  }
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}`,
  );
}

function buildStage1CodeSnippet(
  fixture: Stage1FixtureMeta,
  framework: Framework,
  styling: Styling,
): string {
  const header = `// Stage1 reconciliation consumer (${fixture.label})\n// Dry-run via the playground bridge, then hand off to code.generate (${framework}, ${styling}).\n`;

  if (framework === "vue") {
    return `${header}
<script setup lang="ts">
import { onMounted, ref } from 'vue';

type MapApplyResult = {
  applied: Array<{ name: string }>;
  queued: Array<{ name: string; confidence: number }>;
  conflicted: Array<{ name: string }>;
};

const routing = ref<MapApplyResult | null>(null);

onMounted(async () => {
  const response = await fetch('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tool: 'map_apply',
      input: {
        reportPath: '${fixture.reportPath}',
        minConfidence: 0.75,
      },
    }),
  });

  const payload = await response.json();
  routing.value = payload.result;

  // Example downstream hand-off:
  // await client.callTool('code_generate', {
  //   schemaRef,
  //   framework: '${framework}',
  //   options: { styling: '${styling}', typescript: true },
  // });
});
</script>

<template>
  <section v-if="routing">
    <h2>${fixture.label} reconciliation</h2>
    <p>{{ routing.applied.length }} applied / {{ routing.queued.length }} queued</p>
  </section>
</template>
`;
  }

  if (framework === "html") {
    return `${header}
<script type="module">
  async function boot() {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'map_apply',
        input: {
          reportPath: '${fixture.reportPath}',
          minConfidence: 0.75,
        },
      }),
    });

    const payload = await response.json();
    const summary = document.querySelector('[data-stage1-summary]');
    if (!summary) return;
    summary.textContent = \`\${payload.result.applied.length} applied / \${payload.result.queued.length} queued\`;
  }

  boot();

  // Example downstream hand-off:
  // code_generate({ schemaRef, framework: '${framework}', options: { styling: '${styling}' } })
</script>

<section class="stage1-reconciliation">
  <h2>${fixture.label} reconciliation</h2>
  <p data-stage1-summary>Loading…</p>
</section>
`;
  }

  return `${header}
import { useEffect, useState } from 'react';

type MapApplyResult = {
  applied: Array<{ name: string }>;
  queued: Array<{ name: string; confidence: number }>;
  conflicted: Array<{ name: string }>;
};

export function Stage1ReconciliationConsumer() {
  const [routing, setRouting] = useState<MapApplyResult | null>(null);

  useEffect(() => {
    fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'map_apply',
        input: {
          reportPath: '${fixture.reportPath}',
          minConfidence: 0.75,
        },
      }),
    })
      .then((response) => response.json())
      .then((payload) => setRouting(payload.result));
  }, []);

  // Example downstream hand-off:
  // await client.callTool('code_generate', {
  //   schemaRef,
  //   framework: '${framework}',
  //   options: { styling: '${styling}', typescript: true },
  // });

  if (!routing) return <div>Loading reconciliation preview…</div>;

  return (
    <section>
      <h2>${fixture.label} reconciliation</h2>
      <p>{routing.applied.length} applied / {routing.queued.length} queued</p>
    </section>
  );
}
`;
}

function resolveToolResult<T>(response: BridgeResponse<T>): T {
  if ("error" in response && response.error) {
    throw new Error(response.error.message);
  }
  if ("ok" in response && response.ok && response.result) {
    return response.result;
  }
  throw new Error("Bridge returned an unexpected response shape.");
}

export default function App() {
  const [view, setView] = useState<ViewMode>(getInitialView);
  const [intent, setIntent] = useState("");
  const [fidelity, setFidelity] = useState<Fidelity>("production");
  const [fidelityFixture, setFidelityFixture] = useState<string>("user");
  const [framework, setFramework] = useState<Framework>("react");
  const [styling, setStyling] = useState<Styling>("tokens");
  const [brands, setBrands] = useState<string[]>([]);
  const [brand, setBrand] = useState<Brand>("default");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [stage1FixtureId, setStage1FixtureId] =
    useState<Stage1FixtureMeta["id"]>("linear");

  const [composeLoading, setComposeLoading] = useState(false);
  const [composeResult, setComposeResult] = useState<PipelineResult | null>(
    null,
  );
  const [composeError, setComposeError] = useState<string | null>(null);

  const [fidelityResult, setFidelityResult] =
    useState<FidelityPreviewResult | null>(null);
  const [fidelityLoading, setFidelityLoading] = useState(false);
  const [fidelityError, setFidelityError] = useState<string | null>(null);

  const [stage1Loading, setStage1Loading] = useState(false);
  const [stage1Result, setStage1Result] = useState<MapApplyResult | null>(null);
  const [syntheticPatchResult, setSyntheticPatchResult] =
    useState<MapApplyResult | null>(null);
  const [stage1Error, setStage1Error] = useState<string | null>(null);

  const [bridgeOk, setBridgeOk] = useState<boolean | null>(null);

  const debouncedIntent = useDebounce(intent, 400);
  const activeFixture = STAGE1_FIXTURES[stage1FixtureId];

  useEffect(() => {
    healthCheck().then((health) => setBridgeOk(health.ok));
    runTool<{ tokens?: { registry?: { brands: string[] } } }>("health", {}).then(response => {
      if (response.ok) setBrands(response.result.tokens?.registry?.brands ?? []);
    });
  }, []);

  useEffect(() => {
    const onHashChange = () => setView(getInitialView());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const handleViewChange = useCallback((next: ViewMode) => {
    setViewHash(next);
    setView(next);
  }, []);

  const runComposePipeline = useCallback(async () => {
    if (view !== "compose" || !debouncedIntent.trim()) return;
    setComposeLoading(true);
    setComposeError(null);

    const response: BridgeResponse<PipelineResult> = await runPipeline({
      intent: debouncedIntent,
      framework,
      styling,
      options: {
        compact: false,
        showConfidence: true,
        confidenceThreshold: 0.5,
      },
    });

    setComposeLoading(false);

    if ("error" in response && response.error) {
      setComposeError(response.error.message);
      setComposeResult(null);
      return;
    }

    if ("ok" in response && response.ok && response.result) {
      if (response.result.error) {
        setComposeError(
          `[${response.result.error.step}] ${response.result.error.message}`,
        );
      }
      setComposeResult(response.result);
    }
  }, [debouncedIntent, framework, styling, view]);

  useEffect(() => {
    if (
      view === "compose" &&
      fidelity === "production" &&
      debouncedIntent.trim()
    ) {
      runComposePipeline();
    }
  }, [debouncedIntent, runComposePipeline, view, fidelity]);

  const runFidelityPath = useCallback(async () => {
    if (view !== "compose" || fidelity === "production") return;
    setFidelityLoading(true);
    setFidelityError(null);

    const response = await runFidelityPreview({
      fidelityKind: fidelity as FidelityKind,
      fixture: fidelityFixture,
      options: {
        ...(fidelity === "branded-mockup"
          ? { brandOverlay: brandToOverlay(brand) }
          : {}),
      },
    });

    setFidelityLoading(false);

    if ("error" in response && response.error) {
      setFidelityError(response.error.message);
      setFidelityResult(null);
      return;
    }
    if ("ok" in response && response.ok && response.result) {
      const result = response.result;
      setFidelityResult(result);
      if (result.status === "error" && result.errors.length > 0) {
        setFidelityError(
          `[${result.errors[0].code}] ${result.errors[0].message}`,
        );
      }
    }
  }, [view, fidelity, fidelityFixture, brand]);

  useEffect(() => {
    if (view === "compose" && fidelity !== "production") {
      runFidelityPath();
    }
  }, [view, fidelity, fidelityFixture, brand, runFidelityPath]);

  const loadStage1Demo = useCallback(async () => {
    if (view !== "stage1") return;
    // Rollup fixtures render a pure client-side capability view; no map.apply
    // dry-run is required and running one would fail (runPath is an artifacts
    // dir, not a reconciliation_report path).
    if (activeFixture.kind === "rollups") {
      setStage1Result(null);
      setSyntheticPatchResult(null);
      setStage1Error(null);
      setStage1Loading(false);
      return;
    }
    setStage1Loading(true);
    setStage1Error(null);

    try {
      const [realFixture, syntheticFixture] = await Promise.all([
        runMapApply(activeFixture.reportPath, 0.75),
        runMapApply(SYNTHETIC_PATCH_FIXTURE_PATH, 0.75),
      ]);

      setStage1Result(resolveToolResult(realFixture));
      setSyntheticPatchResult(resolveToolResult(syntheticFixture));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load Stage1 playground data.";
      setStage1Error(message);
      setStage1Result(null);
    } finally {
      setStage1Loading(false);
    }
  }, [activeFixture.kind, activeFixture.reportPath, view]);

  useEffect(() => {
    if (view === "stage1") {
      loadStage1Demo();
    }
  }, [loadStage1Demo, view]);

  const handleStarterSelect = useCallback(
    (starterIntent: string) => {
      setIntent(starterIntent);
      handleViewChange("compose");
    },
    [handleViewChange],
  );

  const handleSaveSchema = useCallback(async () => {
    if (!composeResult?.schemaRef) return;
    const name = `playground-${Date.now()}`;
    const response = await runTool("schema_save", {
      name,
      schemaRef: composeResult.schemaRef,
    });
    if ("ok" in response && response.ok) {
      setComposeError(null);
    } else if ("error" in response && response.error) {
      setComposeError(response.error.message);
    }
  }, [composeResult?.schemaRef]);

  const handleDownloadHtml = useCallback(() => {
    const html = composeResult?.render?.html;
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "oods-preview.html";
    link.click();
    URL.revokeObjectURL(url);
  }, [composeResult?.render?.html]);

  const stage1CodeSnippet = useMemo(
    () => buildStage1CodeSnippet(activeFixture, framework, styling),
    [activeFixture, framework, styling],
  );

  const inFidelityMode = view === "compose" && fidelity !== "production";
  const activeLoading = inFidelityMode
    ? fidelityLoading
    : view === "compose"
      ? composeLoading
      : view === "stage1"
        ? stage1Loading
        : false;
  const activeError = inFidelityMode
    ? fidelityError
    : view === "compose"
      ? composeError
      : view === "stage1"
        ? stage1Error
        : null;
  const activeSummary = inFidelityMode
    ? fidelityResult
      ? `${fidelity} · ${fidelityFixture} · ${fidelityResult.meta.entityCount} entit${fidelityResult.meta.entityCount === 1 ? "y" : "ies"}${fidelityResult.warnings.length > 0 ? ` · ${fidelityResult.warnings.length} warning${fidelityResult.warnings.length === 1 ? "" : "s"}` : ""}`
      : null
    : view === "compose"
      ? (composeResult?.summary ?? null)
      : view === "stage1"
        ? stage1Result
          ? `${activeFixture.label}: ${stage1Result.applied.length} applied, ${stage1Result.queued.length} queued at minConfidence 0.75`
          : "Load a live reconciliation fixture through map_apply dry-run."
        : "C5 chain · select a fixture and a policy bundle, then step through queue → resolve → summary.";

  return (
    <div className="flex h-screen flex-col bg-[#0f1117] text-gray-200">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-800 px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-white">
            OODS Playground
          </h1>
          <div className="flex overflow-hidden rounded-full border border-gray-700 bg-gray-950">
            <button
              onClick={() => handleViewChange("compose")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "compose"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:bg-gray-900 hover:text-gray-100"
              }`}
            >
              Compose
            </button>
            <button
              onClick={() => handleViewChange("stage1")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "stage1"
                  ? "bg-cyan-500 text-slate-950"
                  : "text-gray-400 hover:bg-gray-900 hover:text-gray-100"
              }`}
            >
              Stage1
            </button>
            <button
              onClick={() => handleViewChange("reconcile")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "reconcile"
                  ? "bg-indigo-500 text-white"
                  : "text-gray-400 hover:bg-gray-900 hover:text-gray-100"
              }`}
            >
              Reconcile
            </button>
          </div>
          <span className="font-mono text-xs text-gray-500">
            {view === "stage1"
              ? "#stage1"
              : view === "reconcile"
                ? "#reconcile"
                : "v0.1"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {view === "compose" && composeResult?.render?.html ? (
            <button
              onClick={handleDownloadHtml}
              className="rounded border border-gray-700 px-2.5 py-1 text-xs text-gray-400 transition-colors hover:border-gray-500 hover:text-white"
            >
              Download HTML
            </button>
          ) : null}
          {view === "compose" && composeResult?.schemaRef ? (
            <button
              onClick={handleSaveSchema}
              className="rounded border border-indigo-600 px-2.5 py-1 text-xs text-indigo-300 transition-colors hover:bg-indigo-600/20"
            >
              Save Schema
            </button>
          ) : null}
          <Selectors
            fidelity={fidelity}
            framework={framework}
            styling={styling}
            brand={brand}
            brands={brands}
            theme={theme}
            onFidelityChange={setFidelity}
            onFrameworkChange={setFramework}
            onStylingChange={setStyling}
            onBrandChange={setBrand}
            onThemeChange={setTheme}
            showBrandTheme={view === "compose"}
          />
        </div>
      </header>

      {view === "compose" ? (
        <>
          <div className="shrink-0 space-y-2 border-b border-gray-800 px-5 py-3">
            {fidelity === "production" ? (
              <>
                <IntentInput
                  value={intent}
                  onChange={setIntent}
                  loading={composeLoading}
                />
                <StarterPrompts onSelect={handleStarterSelect} />
              </>
            ) : (
              <FixturePicker
                value={fidelityFixture}
                onChange={setFidelityFixture}
              />
            )}
          </div>

          <div className="flex min-h-0 flex-1">
            <PreviewPanel
              html={
                fidelity === "production"
                  ? (composeResult?.render?.html ?? null)
                  : (fidelityResult?.html ?? null)
              }
              theme={theme}
              loading={
                fidelity === "production" ? composeLoading : fidelityLoading
              }
            />
            <CodePanel
              code={
                fidelity === "production"
                  ? (composeResult?.code?.output ?? null)
                  : (fidelityResult?.html ?? null)
              }
              framework={
                fidelity === "production"
                  ? (composeResult?.code?.framework ?? framework)
                  : fidelity
              }
              loading={
                fidelity === "production" ? composeLoading : fidelityLoading
              }
            />
          </div>
        </>
      ) : view === "reconcile" ? (
        <ReconcileView />
      ) : activeFixture.kind === "rollups" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-800 bg-slate-950/40 px-5 py-2">
            <span className="text-[11px] uppercase tracking-[0.18em] text-indigo-200/70">
              Fixture
            </span>
            {Object.values(STAGE1_FIXTURES).map((candidate) => {
              const active = candidate.id === activeFixture.id;
              return (
                <button
                  key={candidate.id}
                  onClick={() => setStage1FixtureId(candidate.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "border-indigo-400 bg-indigo-500 text-white"
                      : "border-white/10 bg-slate-900/60 text-indigo-50/70 hover:border-indigo-300/40 hover:text-white"
                  }`}
                >
                  {candidate.label}
                </button>
              );
            })}
          </div>
          <CapabilityPanel
            label={activeFixture.label}
            targetUrl={activeFixture.targetUrl}
            runId={activeFixture.targetId}
            runPath={activeFixture.reportPath}
            bundle={rollupBundleFor(activeFixture.id)}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <Stage1DemoPanel
            fixture={activeFixture}
            fixtures={Object.values(STAGE1_FIXTURES)}
            onFixtureChange={setStage1FixtureId}
            result={stage1Result}
            syntheticPatchResult={syntheticPatchResult}
            loading={stage1Loading}
          />
          <CodePanel
            code={stage1CodeSnippet}
            framework={framework}
            loading={false}
          />
        </div>
      )}

      <StatusBar
        bridgeOk={bridgeOk}
        loading={activeLoading}
        error={activeError}
        metrics={view === "compose" ? (composeResult?.metrics ?? null) : null}
        pipeline={view === "compose" ? (composeResult?.pipeline ?? null) : null}
        summary={activeSummary}
      />
    </div>
  );
}
