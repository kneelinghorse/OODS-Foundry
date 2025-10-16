import { spawn } from "child_process";
import { createHash } from "crypto";
import { Dirent, promises as fs } from "fs";
import os from "os";
import path from "path";
import { performance } from "perf_hooks";
import process from "process";
import { fileURLToPath } from "url";

type RunResult = {
  code: number;
  stdout: string;
  stderr: string;
  durationMs: number;
};

type BrandCoverage = {
  aaPassPct: number | null;
  aaPairsTotal: number;
  deltaGuardrails: {
    ok: boolean;
    maxDeltaL: number | null;
    maxDeltaC: number | null;
  };
  notes: string[];
};

type InventorySnapshot = {
  components: number;
  stories: number;
  brandAStories: number;
  brandADarkStories: number;
};

type ReviewKit = {
  changeSummary: string | null;
  storybookUrl: string | null;
  chromaticUrl: string | null;
  aaDeltaSummary: string | null;
};

type PackageReport = {
  name: string;
  version: string;
  reproducible: boolean;
  tarballSha256: string | null;
};

type PurityReport = {
  violations: number | null;
  status: "passed" | "failed" | "unknown";
  output: string;
};

type DiagnosticsPayload = {
  sprint: string;
  generatedAt: string;
  artDir: string;
  brandA: {
    aaPassPct: number | null;
    aaPairsTotal: number;
    deltaGuardrails: BrandCoverage["deltaGuardrails"];
    hcPngCount: number | null;
    notes: string[];
  };
  vrt: {
    totalStories: number | null;
    allowlistCount: number | null;
    brandADarkStories: number | null;
    runUrl: string | null;
    buildTimestamp: string | null;
    flakePct: number | null;
  };
  inventory: InventorySnapshot;
  tokens: {
    buildMs: number | null;
  };
  packages: PackageReport[];
  purity: PurityReport;
  reviewKit: ReviewKit;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..", "..");
const repoRoot = path.resolve(appRoot, "..");

async function main(): Promise<void> {
  const { out } = parseArgs();
  const env = await loadSprintEnv();
  const artDir = env["ART_DIR"];
  if (!artDir) {
    throw new Error("ART_DIR missing from .sprint09.env");
  }

  const absoluteArtDir = path.resolve(repoRoot, artDir);
  await fs.mkdir(absoluteArtDir, { recursive: true });

  const diagnosticsPath = out
    ? path.resolve(repoRoot, out)
    : path.join(absoluteArtDir, "diagnostics.json");

  const [brandCoverage, hcPngCount, inventory, reviewKit, vrt] = await Promise.all([
    collectBrandCoverage(),
    countHcPngs(),
    collectInventory(),
    collectReviewKit(),
    collectVrt()
  ]);

  const tokens = await measureTokensBuild();

  const packages = [];
  for (const entry of [
    { name: "@oods/tokens", relative: "packages/tokens" },
    { name: "@oods/tw-variants", relative: "packages/tw-variants" },
    { name: "@oods/a11y-tools", relative: "packages/a11y-tools" }
  ]) {
    packages.push(await verifyPackage(entry.name, entry.relative));
  }

  const purity = await runPurityAudit();

  const payload: DiagnosticsPayload = {
    sprint: "09",
    generatedAt: new Date().toISOString(),
    artDir,
    brandA: {
      aaPassPct: brandCoverage.aaPassPct,
      aaPairsTotal: brandCoverage.aaPairsTotal,
      deltaGuardrails: brandCoverage.deltaGuardrails,
      hcPngCount,
      notes: brandCoverage.notes
    },
    vrt: {
      totalStories: inventory.stories,
      allowlistCount: vrt.allowlistCount,
      brandADarkStories: inventory.brandADarkStories,
      runUrl: vrt.runUrl,
      buildTimestamp: vrt.buildTimestamp,
      flakePct: vrt.flakePct
    },
    inventory,
    tokens,
    packages,
    purity,
    reviewKit
  };

  await fs.writeFile(diagnosticsPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`Diagnostics written to ${path.relative(process.cwd(), diagnosticsPath)}`);
}

function parseArgs(): { out?: string } {
  const args = process.argv.slice(2);
  const result: { out?: string } = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--out") {
      result.out = args[i + 1];
      i += 1;
    } else if (arg.startsWith("--out=")) {
      result.out = arg.slice("--out=".length);
    }
  }
  return result;
}

async function loadSprintEnv(): Promise<Record<string, string>> {
  const envPath = path.join(repoRoot, ".sprint09.env");
  const contents = await fs.readFile(envPath, "utf8");
  const entries: Record<string, string> = {};
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, value] = trimmed.split("=", 2);
    if (key) {
      entries[key] = value ?? "";
    }
  }
  return entries;
}

async function collectBrandCoverage(): Promise<BrandCoverage> {
  const coveragePath = path.join(appRoot, "docs", "themes", "brand-a", "coverage.md");
  const contents = await fs.readFile(coveragePath, "utf8");
  const lines = contents.split("\n");
  let ratioCount = 0;
  let ratioPass = 0;
  let maxDeltaL: number | null = null;
  let maxDeltaC: number | null = null;
  const notes: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || trimmed.startsWith("| ---")) continue;
    const columns = trimmed
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (columns.length < 6) continue;

    const [theme, , contrast, deltaL, deltaC, note] = columns;
    if (note) {
      notes.push(`${theme}: ${note}`);
    }

    if (contrast.includes(":")) {
      const numeric = parseFloat(contrast.split(":")[0]);
      if (!Number.isNaN(numeric)) {
        ratioCount += 1;
        if (numeric >= 4.5) {
          ratioPass += 1;
        }
      }
    }

    const deltaLValue = parseDelta(deltaL);
    const deltaCValue = parseDelta(deltaC);
    if (deltaLValue !== null) {
      maxDeltaL = maxDeltaL === null ? deltaLValue : Math.max(maxDeltaL, deltaLValue);
    }
    if (deltaCValue !== null) {
      maxDeltaC = maxDeltaC === null ? deltaCValue : Math.max(maxDeltaC, deltaCValue);
    }
  }

  const aaPassPct = ratioCount > 0 ? Math.round((ratioPass / ratioCount) * 100) : null;
  const deltaGuardrailsOk =
    (maxDeltaL === null || maxDeltaL <= 0.12) && (maxDeltaC === null || maxDeltaC <= 0.02);

  return {
    aaPassPct,
    aaPairsTotal: ratioCount,
    deltaGuardrails: {
      ok: deltaGuardrailsOk,
      maxDeltaL,
      maxDeltaC
    },
    notes
  };
}

function parseDelta(raw: string): number | null {
  const normalized = raw.replace(/[^0-9.+-]/g, "");
  if (!normalized) return null;
  const value = Math.abs(parseFloat(normalized));
  return Number.isNaN(value) ? null : value;
}

async function countHcPngs(): Promise<number | null> {
  const vrtDir = path.join(repoRoot, "artifacts", "vrt");
  const targets: string[] = [];
  await walkDirectory(vrtDir, (filePath) => {
    if (filePath.endsWith(".png") && filePath.includes("brand-a")) {
      targets.push(filePath);
    }
  });

  if (targets.length > 0) {
    return targets.length;
  }

  const specPath = path.join(appRoot, "testkits", "vrt", "stories", "hc", "brand-a.spec.ts");
  try {
    const spec = await fs.readFile(specPath, "utf8");
    const matches = spec.match(/screenshot:\s*'[^']+'/g);
    return matches ? matches.length : null;
  } catch {
    return null;
  }
}

async function collectInventory(): Promise<InventorySnapshot> {
  const indexPath = path.join(appRoot, "storybook-static", "index.json");
  const payloadRaw = await fs.readFile(indexPath, "utf8");
  const payload = JSON.parse(payloadRaw) as {
    entries: Record<string, { type?: string; title?: string; name?: string; componentPath?: string }>;
  };

  const entries = Object.values(payload.entries ?? {});
  const stories = entries.filter((entry) => entry.type === "story");
  const components = new Set<string>();
  let brandAStories = 0;
  let brandADarkStories = 0;

  for (const story of stories) {
    if (story.componentPath) {
      components.add(story.componentPath);
    }
    if (story.title?.startsWith("BrandA/")) {
      brandAStories += 1;
      if (story.name && /dark/i.test(story.name)) {
        brandADarkStories += 1;
      }
    }
  }

  return {
    components: components.size,
    stories: stories.length,
    brandAStories,
    brandADarkStories
  };
}

async function collectReviewKit(): Promise<ReviewKit> {
  const kitPath = path.join(appRoot, "docs", "review-kits", "brand-a-roundtrip.md");
  const contents = await fs.readFile(kitPath, "utf8");

  const changeMatch = contents.match(/^- Change:\s*(.*)$/m);
  const storybookMatch = contents.match(/- Storybook:\s*(\S+)/);
  const chromaticMatch = contents.match(/- Chromatic:\s*(\S+)/);
  const aaDeltaMatch = contents.match(/- AA\/Δ summary:\s*(.*)$/m);

  return {
    changeSummary: changeMatch ? changeMatch[1].trim() : null,
    storybookUrl: storybookMatch ? storybookMatch[1] : null,
    chromaticUrl: chromaticMatch ? chromaticMatch[1] : null,
    aaDeltaSummary: aaDeltaMatch ? aaDeltaMatch[1].trim() : null
  };
}

async function collectVrt(): Promise<{
  allowlistCount: number | null;
  runUrl: string | null;
  buildTimestamp: string | null;
  flakePct: number | null;
}> {
  const allowlistPath = path.join(appRoot, "apps", "explorer", ".chromatic-allowlist.json");
  let allowlistCount: number | null = null;
  try {
    const allowlistRaw = await fs.readFile(allowlistPath, "utf8");
    const allowlistJson = JSON.parse(allowlistRaw) as { criticalStoryIds?: unknown[] };
    allowlistCount = Array.isArray(allowlistJson.criticalStoryIds)
      ? allowlistJson.criticalStoryIds.length
      : null;
  } catch {
    allowlistCount = null;
  }

  const chromaticLogPath = path.join(appRoot, "docs", "brand-a", "chromatic-diff.txt");
  let runUrl: string | null = null;
  let buildTimestamp: string | null = null;
  try {
    const diffLog = await fs.readFile(chromaticLogPath, "utf8");
    const urlMatch = diffLog.match(/https?:\/\/\S+/);
    if (urlMatch) {
      runUrl = urlMatch[0];
    }
    const timeMatch = diffLog.match(/Chromatic build\s+([0-9T:-]+Z)/);
    if (timeMatch) {
      buildTimestamp = timeMatch[1];
    }
  } catch {
    runUrl = null;
  }

  const flakePct = null;

  return {
    allowlistCount,
    runUrl,
    buildTimestamp,
    flakePct
  };
}

async function measureTokensBuild(): Promise<{ buildMs: number | null }> {
  const result = await runCommand("node", ["packages/tokens/scripts/build.mjs"], {
    cwd: appRoot,
    env: process.env
  });
  if (result.code !== 0) {
    console.warn("tokens build failed – buildMs will be null");
    return { buildMs: null };
  }
  return { buildMs: Math.round(result.durationMs) };
}

async function verifyPackage(name: string, relativeDir: string): Promise<PackageReport> {
  const packageDir = path.join(appRoot, relativeDir);
  const pkgPath = path.join(packageDir, "package.json");
  const packageJson = JSON.parse(await fs.readFile(pkgPath, "utf8")) as { version?: string };
  const version = packageJson.version ?? "0.0.0";

  // Ensure dist is fresh before packing.
  await runCommand("pnpm", ["run", "build"], { cwd: packageDir, env: process.env });

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "oods-pack-"));
  const run1 = path.join(tempDir, "run1");
  const run2 = path.join(tempDir, "run2");
  await fs.mkdir(run1);
  await fs.mkdir(run2);

  const tarballName = `${name.replace(/^@/, "").replace(/\//g, "-")}-${version}.tgz`;

  const env = {
    ...process.env,
    NPM_CONFIG_USERCONFIG: "/dev/null"
  };

  const packArgs = ["pack", "--silent", "--pack-destination"];
  await runCommand("npm", [...packArgs, run1], { cwd: packageDir, env });
  await runCommand("npm", [...packArgs, run2], { cwd: packageDir, env });

  const tarballOne = path.join(run1, tarballName);
  const tarballTwo = path.join(run2, tarballName);

  let reproducible = false;
  let sha256: string | null = null;
  try {
    const [buffer1, buffer2] = await Promise.all([
      fs.readFile(tarballOne),
      fs.readFile(tarballTwo)
    ]);
    reproducible = buffer1.equals(buffer2);
    sha256 = createHash("sha256").update(buffer1).digest("hex");
  } catch {
    reproducible = false;
    sha256 = null;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }

  return {
    name,
    version,
    reproducible,
    tarballSha256: sha256
  };
}

async function runPurityAudit(): Promise<PurityReport> {
  const result = await runCommand("node", ["scripts/purity/audit.js"], {
    cwd: appRoot,
    env: process.env
  });

  const combinedOutput = `${result.stdout}\n${result.stderr}`.trim();
  let violations: number | null = null;
  let status: PurityReport["status"];
  if (result.code === 0) {
    status = "passed";
    const match = combinedOutput.match(/(\d+)\s+violation/);
    violations = match ? Number.parseInt(match[1], 10) : 0;
  } else {
    status = "failed";
    const match = combinedOutput.match(/(\d+)\s+violation/);
    violations = match ? Number.parseInt(match[1], 10) : null;
  }

  return {
    violations,
    status,
    output: combinedOutput
  };
}

async function walkDirectory(rootDir: string, onFile: (filePath: string) => void): Promise<void> {
  async function walk(current: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        onFile(fullPath);
      }
    }
  }

  await walk(rootDir);
}

async function runCommand(
  command: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv }
): Promise<RunResult> {
  const start = performance.now();
  return new Promise<RunResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout?.on("data", (chunk) => stdoutChunks.push(Buffer.from(chunk)));
    child.stderr?.on("data", (chunk) => stderrChunks.push(Buffer.from(chunk)));

    child.on("error", reject);
    child.on("close", (code) => {
      const durationMs = performance.now() - start;
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        durationMs
      });
    });
  });
}

main().catch((error) => {
  console.error("Failed to collect Sprint 09 diagnostics:");
  console.error(error);
  process.exitCode = 1;
});
