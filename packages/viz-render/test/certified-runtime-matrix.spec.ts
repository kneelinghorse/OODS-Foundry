import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ECHARTS_FORCE_SEED_VERSION,
  ECHARTS_SSR_DIMENSIONS,
  normalizeEChartsSvg,
} from "@oods/viz-render";

interface CertifiedRuntimeMatrix {
  readonly formatVersion: number;
  readonly scope: string;
  readonly resolvedDependencies: {
    readonly echarts: string;
    readonly zrender: string;
  };
  readonly rendererNormalizerContractVersion: string;
  readonly tokenVersion: {
    readonly package: string;
    readonly version: string;
  };
  readonly dimensions: {
    readonly width: number;
    readonly height: number;
  };
  readonly snapshotPolicy: {
    readonly renderer: string;
    readonly ssr: boolean;
    readonly useViewBox: boolean;
    readonly rootAnimation: boolean;
    readonly forceLayoutAnimation: boolean;
    readonly forceSeedVersion: string;
  };
  readonly normalizedSvgHashes: Readonly<Record<string, string>>;
  readonly renderHashEpoch: string;
}

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(packageRoot, "../..");
const matrixPath = join(packageRoot, "certified-matrix.json");
const lockfilePath = join(workspaceRoot, "pnpm-lock.yaml");
const runtimePath = join(packageRoot, "src/echarts-worker-runtime.ts");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readMatrix(): CertifiedRuntimeMatrix {
  return readJson<CertifiedRuntimeMatrix>(matrixPath);
}

function importerDependencyVersion(
  lockfile: string,
  dependency: string,
): string {
  const importer = lockfile.match(
    /^  packages\/viz-render:\n(?<body>(?: {4,}.*\n|\s*\n)*)/m,
  )?.groups?.body;
  const escaped = dependency.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const version = importer?.match(
    new RegExp(
      `^      ${escaped}:\\n(?: {8,}.*\\n)*?        version: (\\S+)$`,
      "m",
    ),
  )?.[1];
  if (!version) {
    throw new Error(
      `pnpm-lock.yaml has no resolved ${dependency} version for packages/viz-render`,
    );
  }
  return version;
}

function echartsZrenderVersion(
  lockfile: string,
  echartsVersion: string,
): string {
  const escaped = echartsVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const snapshot = lockfile.match(
    new RegExp(
      `^  echarts@${escaped}:\\n(?<body>(?: {4,}.*\\n|\\s*\\n)*)`,
      "gm",
    ),
  );
  const body = snapshot
    ?.at(-1)
    ?.match(/^  echarts@[^:]+:\n(?<body>(?: {4,}.*\n|\s*\n)*)/m)?.groups?.body;
  const version = body?.match(/^      zrender: (\S+)$/m)?.[1];
  if (!version) {
    throw new Error(
      `pnpm-lock.yaml has no zrender edge for echarts@${echartsVersion}`,
    );
  }
  return version;
}

function epochPayload(matrix: CertifiedRuntimeMatrix): string {
  return [
    `echarts=${matrix.resolvedDependencies.echarts}`,
    `zrender=${matrix.resolvedDependencies.zrender}`,
    `rendererNormalizerContractVersion=${matrix.rendererNormalizerContractVersion}`,
    `tokenVersion=${matrix.tokenVersion.package}@${matrix.tokenVersion.version}`,
    `dimensions=${matrix.dimensions.width}x${matrix.dimensions.height}`,
    `snapshot.renderer=${matrix.snapshotPolicy.renderer}`,
    `snapshot.ssr=${String(matrix.snapshotPolicy.ssr)}`,
    `snapshot.useViewBox=${String(matrix.snapshotPolicy.useViewBox)}`,
    `snapshot.rootAnimation=${String(matrix.snapshotPolicy.rootAnimation)}`,
    `snapshot.forceLayoutAnimation=${String(matrix.snapshotPolicy.forceLayoutAnimation)}`,
    `snapshot.forceSeedVersion=${matrix.snapshotPolicy.forceSeedVersion}`,
    ...Object.entries(matrix.normalizedSvgHashes)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([family, hash]) => `normalizedSvg.${family}=${hash}`),
  ].join("\n");
}

function expectedEpoch(matrix: CertifiedRuntimeMatrix): string {
  return `sha256:${createHash("sha256").update(epochPayload(matrix)).digest("hex")}`;
}

describe("certified ECharts runtime matrix", () => {
  it("pins exact ECharts and zrender versions to the lockfile and installed graph", () => {
    const matrix = readMatrix();
    const lockfile = readFileSync(lockfilePath, "utf8");
    const lockECharts = importerDependencyVersion(lockfile, "echarts");
    const lockZrender = echartsZrenderVersion(lockfile, lockECharts);
    const require = createRequire(join(packageRoot, "package.json"));
    const echartsPackagePath = require.resolve("echarts/package.json");
    const echartsPackage = readJson<{
      readonly version: string;
      readonly dependencies: { readonly zrender: string };
    }>(echartsPackagePath);
    const zrenderPackage = readJson<{ readonly version: string }>(
      join(dirname(dirname(echartsPackagePath)), "zrender/package.json"),
    );

    expect(matrix.resolvedDependencies).toEqual({
      echarts: lockECharts,
      zrender: lockZrender,
    });
    expect(echartsPackage.version).toBe(lockECharts);
    expect(echartsPackage.dependencies.zrender).toBe(lockZrender);
    expect(zrenderPackage.version).toBe(lockZrender);
  });

  it("pins the renderer/normalizer, token, viewport, and snapshot contracts", () => {
    const matrix = readMatrix();
    const tokenPackage = readJson<{
      readonly name: string;
      readonly version: string;
    }>(join(workspaceRoot, "packages/tokens/package.json"));
    const runtimeSource = readFileSync(runtimePath, "utf8");
    const normalizerCarrier =
      '<svg><defs><clipPath id="zr7-c4" /></defs><path clip-path="url(#zr7-c4)" /></svg>';

    expect(matrix).toMatchObject({
      formatVersion: 1,
      scope: "echarts-normalized-svg",
      rendererNormalizerContractVersion: "oods-echarts-ssr-svg-v1",
      tokenVersion: {
        package: tokenPackage.name,
        version: tokenPackage.version,
      },
      dimensions: ECHARTS_SSR_DIMENSIONS,
      snapshotPolicy: {
        renderer: "svg",
        ssr: true,
        useViewBox: true,
        rootAnimation: false,
        forceLayoutAnimation: false,
        forceSeedVersion: ECHARTS_FORCE_SEED_VERSION,
      },
    });
    expect(runtimeSource).toContain('renderer: "svg"');
    expect(runtimeSource).toContain("ssr: true");
    expect(runtimeSource).toContain(
      "chart.renderToSVGString({ useViewBox: true })",
    );
    expect(runtimeSource).toContain("option.animation = false");
    expect(runtimeSource).toContain("layoutAnimation: false");
    expect(normalizeEChartsSvg(normalizerCarrier)).toBe(
      '<svg><defs><clipPath id="oods-zr-0" /></defs><path clip-path="url(#oods-zr-0)" /></svg>',
    );
    expect(Object.keys(matrix.normalizedSvgHashes).sort()).toEqual([
      "bubble_map",
      "chord",
      "choropleth",
      "flow_map",
      "force_graph",
      "sankey",
      "sunburst",
      "treemap",
    ]);
    for (const hash of Object.values(matrix.normalizedSvgHashes)) {
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("binds every local render axis to the render-hash epoch", () => {
    const matrix = readMatrix();

    expect(matrix.renderHashEpoch).toBe(expectedEpoch(matrix));
  });

  it("keeps CI-resolved Node, V8, OS, and architecture evidence out of the local record", () => {
    const matrix = readMatrix() as CertifiedRuntimeMatrix &
      Record<string, unknown>;

    expect(matrix).not.toHaveProperty("node");
    expect(matrix).not.toHaveProperty("v8");
    expect(matrix).not.toHaveProperty("os");
    expect(matrix).not.toHaveProperty("architecture");
  });
});
