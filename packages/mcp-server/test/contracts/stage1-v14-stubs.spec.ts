import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAjv } from "../../src/lib/ajv.js";
import mapApplyInputSchema from "../../src/schemas/map.apply.input.json" assert { type: "json" };
import componentMappingSchema from "../../src/schemas/component-mapping.schema.json" assert { type: "json" };
import stage1DisambiguationDecisionSchema from "../../src/schemas/stage1-disambiguation-decision.json" assert { type: "json" };
import stage1PreferredTermEntitySchema from "../../src/schemas/stage1-preferred-term-entity.json" assert { type: "json" };
import stage1CapabilityEntitySchema from "../../src/schemas/stage1-capability-entity.json" assert { type: "json" };
import stage1ProjectionVariantSchema from "../../src/schemas/stage1-projection-variant.json" assert { type: "json" };
import type {
  MapApplyInput,
  Stage1CapabilityEntity,
  Stage1DisambiguationDecision,
  Stage1PreferredTermEntity,
  Stage1ProjectionVariant,
  Stage1ReconciliationReport,
} from "../../src/public-types.js";
import type { ComponentMapping } from "../../src/tools/map.shared.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../../");
const DEFAULT_MAPPINGS_PATH = path.join(
  REPO_ROOT,
  "artifacts",
  "structured-data",
  "component-mappings.json",
);
const MAPPINGS_PATH_ENV = "MCP_MAPPINGS_PATH";
const FIXTURE_PATH = path.join(
  REPO_ROOT,
  "packages",
  "mcp-server",
  "test",
  "fixtures",
  "reconciliation-report-v1.1.0.json",
);

const ajv = getAjv();
const validateMapApplyInput = ajv.compile(mapApplyInputSchema);
const validateComponentMappings = ajv.compile(componentMappingSchema);
const validateDisambiguationDecision = ajv.compile(
  stage1DisambiguationDecisionSchema,
);
const validatePreferredTermEntity = ajv.compile(
  stage1PreferredTermEntitySchema,
);
const validateCapabilityEntity = ajv.compile(stage1CapabilityEntitySchema);
const validateProjectionVariant = ajv.compile(stage1ProjectionVariantSchema);

let originalMappings: string | null = null;
let originalMappingsPathEnv: string | undefined;
let mappingsTmpDir: string | null = null;

function loadFixture(): Stage1ReconciliationReport {
  return JSON.parse(
    fs.readFileSync(FIXTURE_PATH, "utf8"),
  ) as Stage1ReconciliationReport;
}

function currentMappingsPath(): string {
  return process.env[MAPPINGS_PATH_ENV] || DEFAULT_MAPPINGS_PATH;
}

function writeMappings(mappings: ComponentMapping[]): void {
  const mappingsPath = currentMappingsPath();
  fs.mkdirSync(path.dirname(mappingsPath), { recursive: true });
  fs.writeFileSync(
    mappingsPath,
    JSON.stringify(
      {
        $schema:
          "../../packages/mcp-server/src/schemas/component-mapping.schema.json",
        generatedAt: "2026-04-16T00:00:00.000Z",
        version: "2026-04-16",
        stats: {
          mappingCount: mappings.length,
          systemCount: new Set(
            mappings.map((mapping) => mapping.externalSystem),
          ).size,
        },
        mappings,
      },
      null,
      2,
    ) + "\n",
  );
}

async function loadHandle(): Promise<
  (
    input: MapApplyInput,
  ) => Promise<
    Awaited<
      ReturnType<(typeof import("../../src/tools/map.apply.js"))["handle"]>
    >
  >
> {
  const mod = await import("../../src/tools/map.apply.js");
  return mod.handle;
}

function buildDecision(): Stage1DisambiguationDecision {
  return {
    decision_id: "decision-issue-row-name",
    decision_type: "preferred_name",
    scope: "run",
    status: "accepted",
    target_kind: "candidate_object",
    target_id: "obj-issue-row",
    selected_value: "Issue Row",
    rationale:
      "Human review confirmed the canonical label should stay concise.",
    alternatives: [
      {
        value: "Issue Table Row",
        score: 0.79,
        reasoning: "Longer label remains understandable but is less canonical.",
      },
    ],
    decided_by: "human",
    decided_at: "2026-04-16T20:12:00.000Z",
  };
}

beforeAll(() => {
  originalMappingsPathEnv = process.env[MAPPINGS_PATH_ENV];
  const originalPath = currentMappingsPath();
  originalMappings = fs.existsSync(originalPath)
    ? fs.readFileSync(originalPath, "utf8")
    : null;

  mappingsTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oods-stage1-v14-stubs-"));
  process.env[MAPPINGS_PATH_ENV] = path.join(
    mappingsTmpDir,
    "component-mappings.json",
  );
});

afterAll(() => {
  if (originalMappingsPathEnv === undefined) {
    delete process.env[MAPPINGS_PATH_ENV];
  } else {
    process.env[MAPPINGS_PATH_ENV] = originalMappingsPathEnv;
  }

  const restoredMappingsPath = currentMappingsPath();
  if (originalMappings === null) {
    fs.rmSync(restoredMappingsPath, { force: true });
  } else {
    fs.mkdirSync(path.dirname(restoredMappingsPath), { recursive: true });
    fs.writeFileSync(restoredMappingsPath, originalMappings);
  }

  if (mappingsTmpDir) {
    fs.rmSync(mappingsTmpDir, { recursive: true, force: true });
    mappingsTmpDir = null;
  }
});

beforeEach(() => {
  writeMappings([
    {
      id: "linear-issue-row",
      externalSystem: "linear",
      externalComponent: "Issue Row",
      oodsTraits: ["Listable"],
      confidence: "manual",
      metadata: {
        createdAt: "2026-03-01T00:00:00.000Z",
        notes: "Imported from sprint-52 fixture",
      },
    },
    {
      id: "linear-billing-plan-card",
      externalSystem: "linear",
      externalComponent: "Billing Plan Card",
      oodsTraits: ["Priceable", "Stateful"],
      confidence: "manual",
      metadata: {
        createdAt: "2026-03-01T00:00:00.000Z",
      },
    },
    {
      id: "linear-workspace-switcher",
      externalSystem: "linear",
      externalComponent: "Workspace Switcher",
      oodsTraits: ["Stateful"],
      confidence: "manual",
      metadata: {
        createdAt: "2026-03-01T00:00:00.000Z",
      },
    },
  ]);
});

describe("Stage1 v1.4.0 schema stubs", () => {
  it("validates the standalone disambiguation, preferred_term, capability, and projection_variant schemas", () => {
    const decision = buildDecision();
    const preferredTerm: Stage1PreferredTermEntity = {
      entity_type: "preferred_term",
      id: "preferred-term-issue-row",
      slug: "issue-row",
      label: "Issue Row",
      aliases: ["Issue Table Row", "Issue List Row"],
      scope: "registry",
      source_decision_ids: [decision.decision_id],
    };
    const projectionVariant: Stage1ProjectionVariant = {
      id: "issue-row-mobile",
      surface: "mobile",
      external_component: "Issue Row Compact",
      capability_id: "capability-edit-issue",
      selector: '[data-testid="issue-row-compact"]',
      confidence: 0.84,
      evidence_chain: [
        {
          pass: "dom.components",
          artifact: "component_clusters.json",
          selector: '[data-testid="issue-row-compact"]',
        },
      ],
    };
    const capability: Stage1CapabilityEntity = {
      entity_type: "capability",
      id: "capability-edit-issue",
      slug: "edit-issue",
      name: "Edit Issue",
      canonical_verb: "edit",
      aliases: ["update", "modify"],
      oods_traits: ["Editable"],
      projection_variant_ids: [projectionVariant.id],
      preconditions: [
        {
          type: "auth",
          description: "Requires authenticated workspace session.",
          confidence: 0.83,
          evidence_chain: [
            { pass: "dom.components", artifact: "component_clusters.json" },
          ],
        },
      ],
    };

    expect(validateDisambiguationDecision(decision)).toBe(true);
    expect(validatePreferredTermEntity(preferredTerm)).toBe(true);
    expect(validateCapabilityEntity(capability)).toBe(true);
    expect(validateProjectionVariant(projectionVariant)).toBe(true);
  });

  it("accepts the new stubs as opt-in additions while preserving the v1.1.0 report shape unchanged", () => {
    const baselineReport = loadFixture();
    expect(validateMapApplyInput({ report: baselineReport })).toBe(true);

    const extendedReport: Stage1ReconciliationReport = {
      ...baselineReport,
      disambiguation_decisions: [buildDecision()],
    };

    expect(validateMapApplyInput({ report: extendedReport })).toBe(true);
  });

  it("accepts dormant projection_variants on component mappings", () => {
    const projectionVariant: Stage1ProjectionVariant = {
      id: "workspace-switcher-modal",
      surface: "modal",
      capability_id: "capability-switch-workspace",
      selector: '[data-testid="workspace-switcher"]',
      confidence: 0.76,
    };

    const doc = {
      $schema:
        "../../packages/mcp-server/src/schemas/component-mapping.schema.json",
      generatedAt: "2026-04-16T00:00:00.000Z",
      version: "2026-04-16",
      stats: {
        mappingCount: 1,
        systemCount: 1,
      },
      mappings: [
        {
          id: "linear-workspace-switcher",
          externalSystem: "linear",
          externalComponent: "Workspace Switcher",
          oodsTraits: ["Stateful"],
          confidence: "manual",
          projection_variants: [projectionVariant],
        },
      ],
    };

    expect(validateComponentMappings(doc)).toBe(true);
  });

  it("does not change map.apply routing when disambiguation stubs are present", async () => {
    const handle = await loadHandle();
    const baseline = await handle({
      report: loadFixture(),
      minConfidence: 0.75,
    });

    const withStubs = await handle({
      report: {
        ...loadFixture(),
        disambiguation_decisions: [buildDecision()],
      },
      minConfidence: 0.75,
    });

    expect(withStubs.applied).toHaveLength(baseline.applied.length);
    expect(withStubs.skipped).toHaveLength(baseline.skipped.length);
    expect(withStubs.queued).toHaveLength(baseline.queued.length);
    expect(withStubs.conflicted).toHaveLength(baseline.conflicted.length);
    expect(withStubs.errors).toEqual([]);
    expect(withStubs.diff).toEqual(baseline.diff);
  });
});
