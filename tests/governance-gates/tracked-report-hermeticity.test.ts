/**
 * s177 m02 — ordinary checks must not rewrite source-controlled reports with clocks,
 * durations, counters, or ephemeral ports. Baseline/record operations remain explicit.
 */
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { persistReportForCommand } from "../../tools/a11y/index.mjs";
import { shouldRecordDiagnostics } from "../../scripts/pkg-compat.mjs";

const execFileAsync = promisify(execFile);
const REPO_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));

function sha256(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

async function runNode(
  scriptPath: string,
  cwd: string,
  args: string[] = [],
  env = process.env,
) {
  return execFileAsync(process.execPath, [scriptPath, ...args], {
    cwd,
    env,
    encoding: "utf8",
  });
}

let scratchRoot: string;

beforeEach(() => {
  scratchRoot = mkdtempSync(join(tmpdir(), "s177-report-hermeticity-"));
});

afterEach(() => {
  rmSync(scratchRoot, { recursive: true, force: true });
});

describe("a11y tracked-report policy", () => {
  it("leaves existing report bytes unchanged across repeated check and diff payloads", async () => {
    const reportPath = join(scratchRoot, "reports", "a11y-report.json");
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, '{"tracked":"baseline-evidence"}\n', "utf8");
    const before = sha256(reportPath);

    for (const [command, generatedAt, durationMs, port] of [
      ["check", "2026-08-25T01:00:00.000Z", 37, 43111],
      ["check", "2026-08-25T01:00:01.000Z", 81, 43112],
      ["diff", "2026-08-25T01:00:02.000Z", 19, 43113],
      ["diff", "2026-08-25T01:00:03.000Z", 55, 43114],
    ] as const) {
      const wrote = await persistReportForCommand(
        command,
        {
          generatedAt,
          results: [
            { details: { durationMs, url: `http://127.0.0.1:${port}/story` } },
          ],
        },
        reportPath,
      );
      expect(wrote).toBe(false);
      expect(sha256(reportPath)).toBe(before);
    }
  });

  it("allows only the explicit baseline command to refresh the tracked report", async () => {
    const reportPath = join(scratchRoot, "reports", "a11y-report.json");
    const report = {
      generatedAt: "2026-08-25T02:00:00.000Z",
      results: [{ pass: false, details: { durationMs: 42 } }],
    };

    expect(await persistReportForCommand("baseline", report, reportPath)).toBe(
      true,
    );
    expect(readFileSync(reportPath, "utf8")).toBe(
      `${JSON.stringify(report, null, 2)}\n`,
    );
  });
});

describe("diagnostics.json check-mode policy", () => {
  it("makes pkg:compat recording opt-in", () => {
    expect(shouldRecordDiagnostics([])).toBe(false);
    expect(shouldRecordDiagnostics(["--record-diagnostics"])).toBe(true);
  });

  it.skipIf(process.platform === "win32")(
    "runs pkg:compat twice without moving diagnostics; explicit recording still works",
    async () => {
      const scriptPath = join(scratchRoot, "scripts", "pkg-compat.mjs");
      mkdirSync(dirname(scriptPath), { recursive: true });
      copyFileSync(join(REPO_ROOT, "scripts", "pkg-compat.mjs"), scriptPath);

      const fakeBin = join(scratchRoot, "bin");
      const fakePnpm = join(fakeBin, "pnpm");
      mkdirSync(fakeBin, { recursive: true });
      writeFileSync(
        fakePnpm,
        "#!/usr/bin/env node\nprocess.exit(Number(process.env.FAKE_PNPM_EXIT ?? 0));\n",
        "utf8",
      );
      chmodSync(fakePnpm, 0o755);

      const diagnosticsPath = join(scratchRoot, "diagnostics.json");
      writeFileSync(diagnosticsPath, '{"sentinel":"tracked"}\n', "utf8");
      const before = sha256(diagnosticsPath);
      const env = {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
      };

      await runNode(scriptPath, scratchRoot, [], env);
      await runNode(scriptPath, scratchRoot, [], env);
      expect(sha256(diagnosticsPath)).toBe(before);

      await expect(
        runNode(scriptPath, scratchRoot, [], { ...env, FAKE_PNPM_EXIT: "7" }),
      ).rejects.toMatchObject({ code: 7 });
      expect(sha256(diagnosticsPath)).toBe(before);

      await runNode(scriptPath, scratchRoot, ["--record-diagnostics"], env);
      const recorded = JSON.parse(readFileSync(diagnosticsPath, "utf8"));
      expect(recorded.sentinel).toBe("tracked");
      expect(recorded.helpers.pkgCompat.lastRun.status).toBe("passed");
      expect(recorded.helpers.pkgCompat.totals).toEqual({
        runs: 1,
        pass: 1,
        fail: 0,
      });
    },
  );

  it("runs governance enforcement twice without moving diagnostics.json", async () => {
    const scriptPath = join(scratchRoot, "scripts", "gov", "enforce.mjs");
    mkdirSync(dirname(scriptPath), { recursive: true });
    copyFileSync(join(REPO_ROOT, "scripts", "gov", "enforce.mjs"), scriptPath);

    const policyPath = join(
      scratchRoot,
      "configs",
      "policies",
      "token-namespaces.json",
    );
    mkdirSync(dirname(policyPath), { recursive: true });
    writeFileSync(policyPath, '{"protected":{"namespaces":[]}}\n', "utf8");

    const tokensPath = join(scratchRoot, "artifacts", "state", "tokens.json");
    mkdirSync(dirname(tokensPath), { recursive: true });
    writeFileSync(tokensPath, '{"purityViolations":[]}\n', "utf8");

    const reportsDir = join(scratchRoot, "artifacts", "state", "governance");
    mkdirSync(reportsDir, { recursive: true });
    for (const brand of ["A", "B"]) {
      writeFileSync(
        join(reportsDir, `brand-${brand}.json`),
        `${JSON.stringify({ brand, summary: { highRisk: 0 }, requiresBreakingLabel: false })}\n`,
        "utf8",
      );
    }

    const diagnosticsPath = join(scratchRoot, "diagnostics.json");
    writeFileSync(diagnosticsPath, '{"sentinel":"tracked"}\n', "utf8");
    const before = sha256(diagnosticsPath);

    for (let run = 0; run < 2; run += 1) {
      const result = await runNode(scriptPath, scratchRoot);
      expect(result.stdout).toContain("Token governance enforcement passed.");
      expect(sha256(diagnosticsPath)).toBe(before);
    }
  });
});
