import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../../../", import.meta.url);
const outputSchema = JSON.parse(
  readFileSync(
    new URL(
      "packages/mcp-server/src/schemas/artifact.certify.output.json",
      root,
    ),
    "utf8",
  ),
) as {
  description: string;
  properties: Record<string, { description?: string }>;
};
const inputSchema = JSON.parse(
  readFileSync(
    new URL(
      "packages/mcp-server/src/schemas/artifact.certify.input.json",
      root,
    ),
    "utf8",
  ),
) as { description: string };
const adapterDescriptions = JSON.parse(
  readFileSync(
    new URL("packages/mcp-adapter/tool-descriptions.json", root),
    "utf8",
  ),
) as Record<string, string>;
const bridgePolicy = JSON.parse(
  readFileSync(new URL("configs/agent/policy.json", root), "utf8"),
) as { tools: Array<{ name: string; description?: string }> };

const policyDescription = bridgePolicy.tools.find(
  ({ name }) => name === "artifact.certify",
)?.description;

const reference = readFileSync(new URL("packages/foundry/TOOL-REFERENCE.md", root), "utf8").split("## artifact_certify\n")[1]!.split("\n## ")[0]!;

const advertised = [
  reference,
  JSON.stringify(inputSchema),
  JSON.stringify(outputSchema),
  adapterDescriptions["artifact.certify"],
  policyDescription,
].join("\n");

describe("artifact.certify advertised ECharts render truth (s179 m05)", () => {
  it.each([
    "never carries renderHash",
    "no ECharts response ever carries renderHash",
    "no render, no renderHash, ever",
    "never a rendered picture",
    "RECONSTRUCTION-GRADED",
    "reconstruction-graded",
    "parked render rung",
    "runtime force physics",
    "no baked seed",
    "option-vs-physics limit",
  ])(
    "retires the superseded phrase %j from every advertised surface",
    (phrase) => {
      expect(advertised).not.toContain(phrase);
    },
  );

  it("advertises both hashes and the certified runtime-matrix identity", () => {
    expect(outputSchema.properties.determinism.description).toContain(
      "contentHash identifies the retained projected option",
    );
    expect(outputSchema.properties.determinism.description).toContain(
      "renderHash is present whenever that projected option was rendered successfully",
    );
    expect(JSON.stringify(outputSchema)).toContain(
      "packages/viz-render/certified-matrix.json",
    );
  });

  it("describes scoped ECharts paints as the rendered projection while preserving geo exemptions", () => {
    expect(inputSchema.description).toContain(
      "data-backed ECharts paints come from the rendered projected option",
    );
    expect(inputSchema.description).toContain(
      "geo render evidence remains exempt with no canvas ratio",
    );
    expect(inputSchema.description).not.toContain(
      "colour hexes baked into the compiled spec",
    );
    expect(reference).toContain(
      "The three geo families retain the standing contrast exemption with their render evidence",
    );
    expect(outputSchema.properties.contrastNote.description).toContain(
      "no canvas ratio is graded",
    );
  });

  it("preserves detailed render-measured contrast in the linked reference and keeps the bridge aligned", () => {
    // A reconnect must not receive the retired spec-only or warn-first contract from the bridge.
    expect(policyDescription).toBe(adapterDescriptions["artifact.certify"]);
    expect(adapterDescriptions["artifact.certify"]).toContain("TOOL-REFERENCE.md");
    for (const description of [reference]) {
      expect(description).toContain(
        "Cartesian charts and ECharts calls with data grade actual rendered paints",
      );
      expect(description).toContain(
        "Spec-only ECharts calls retain the reconstructed palette grade and caveat",
      );
      expect(description).toContain("HC contrast returns exempt, measured:false");
      expect(description).toContain("The eight ECharts-primary types certify under the declared operand profile");
    }
  });
});
