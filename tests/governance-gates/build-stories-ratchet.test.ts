/**
 * s178 m01 — the exact-pin ratchet must distinguish compiler truth from an empty parse.
 *
 * A normal TypeScript error run exits nonzero, so the gate cannot reject status 2 outright.
 * It must count real diagnostics in both directions, while refusing the dangerous pin-0 case
 * where the subprocess failed and emitted no `error TS...` lines at all.
 */

import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const REPO_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const SOURCE_SCRIPT = join(
  REPO_ROOT,
  "scripts",
  "quality",
  "build-stories-ratchet.mjs",
);

let scratchRoot = "";

afterEach(() => {
  if (scratchRoot) rmSync(scratchRoot, { recursive: true, force: true });
  scratchRoot = "";
});

function runRatchet(pin: number, diagnostics: string[], compilerStatus = 2) {
  scratchRoot = mkdtempSync(join(tmpdir(), "build-stories-ratchet-"));
  const script = join(
    scratchRoot,
    "scripts",
    "quality",
    "build-stories-ratchet.mjs",
  );
  const pinPath = join(
    scratchRoot,
    "configs",
    "quality",
    "build-stories-error-pin.json",
  );
  const fakePnpm = join(scratchRoot, "bin", "pnpm");

  mkdirSync(dirname(script), { recursive: true });
  mkdirSync(dirname(pinPath), { recursive: true });
  mkdirSync(dirname(fakePnpm), { recursive: true });
  copyFileSync(SOURCE_SCRIPT, script);
  writeFileSync(
    pinPath,
    `${JSON.stringify({ errors: pin }, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    fakePnpm,
    '#!/bin/sh\nprintf "%s" "$BUILD_STORIES_FAKE_OUTPUT"\nexit "$BUILD_STORIES_FAKE_STATUS"\n',
    "utf8",
  );
  chmodSync(fakePnpm, 0o755);

  return spawnSync(process.execPath, [script], {
    cwd: scratchRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${dirname(fakePnpm)}${delimiter}${process.env.PATH ?? ""}`,
      BUILD_STORIES_FAKE_OUTPUT:
        diagnostics.join("\n") + (diagnostics.length ? "\n" : ""),
      BUILD_STORIES_FAKE_STATUS: String(compilerStatus),
    },
  });
}

const diagnostic = (index: number) =>
  `stories/Fixture${index}.tsx(1,1): error TS9999: fixture ${index}`;

describe("build:stories exact-pin ratchet", () => {
  it("accepts an exact diagnostic count even though tsc reports a nonzero status", () => {
    const result = runRatchet(2, [diagnostic(1), diagnostic(2)]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "build:stories holds at the pin: 2 type errors.",
    );
  });

  it("rejects a count above the pin as a regression", () => {
    const result = runRatchet(1, [diagnostic(1), diagnostic(2)]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "build:stories REGRESSED: 2 type errors, pin is 1",
    );
  });

  it("rejects a count below the pin so headroom cannot accumulate", () => {
    const result = runRatchet(3, [diagnostic(1), diagnostic(2)]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Lower the pin to 2");
  });

  it("never treats a failed compiler with no parsed diagnostics as zero errors", () => {
    const result = runRatchet(0, ["tsc failed before type checking"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "produced no parseable TypeScript diagnostics",
    );
    expect(result.stdout).not.toContain("holds at the pin");
  });
});
