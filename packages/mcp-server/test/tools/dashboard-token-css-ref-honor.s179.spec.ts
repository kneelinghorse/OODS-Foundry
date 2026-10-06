import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { DashboardRenderInput } from "../../src/schemas/generated.js";
import { handle } from "../../src/tools/dashboard.render.js";

const CUSTOM_TOKEN_REF = "artifact://brand-a/light/tokens.css";

function input(
  extra: Partial<DashboardRenderInput> = {},
): DashboardRenderInput {
  return {
    schemaVersion: "v0.1",
    datasets: [{ id: "metrics", rows: [{ revenue: 42 }] }],
    panels: [
      {
        id: "revenue",
        kind: "kpi",
        title: "Revenue",
        datasetId: "metrics",
        field: "revenue",
        aggregate: "sum",
      },
    ],
    a11y: { description: "Token reference honor fixture." },
    ...extra,
  } as DashboardRenderInput;
}

describe("dashboard.render tokenCssRef honor contract (s179 r2)", () => {
  it("returns the exact caller-supplied reference in compact output", async () => {
    const out = await handle(input({ tokenCssRef: CUSTOM_TOKEN_REF }));
    expect(out.tokenCssRef).toBe(CUSTOM_TOKEN_REF);
  });

  it("retains the default reference when the caller omits tokenCssRef", async () => {
    const out = await handle(input());
    expect(out.tokenCssRef).toBe("tokens.build");
  });

  it("advertises that a supplied reference is honored, not merely accepted", () => {
    const schema = JSON.parse(
      readFileSync(
        new URL(
          "../../src/schemas/dashboard.render.input.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as { properties: { tokenCssRef: { description: string } } };
    expect(schema.properties.tokenCssRef.description).toContain(
      "When supplied, this exact reference is returned in compact output.",
    );
  });
});
