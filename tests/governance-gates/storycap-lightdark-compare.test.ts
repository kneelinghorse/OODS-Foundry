/**
 * s178 m01 — known unchanged-tree flicker must never be attributed to a source edit.
 *
 * The fixture is a complete 152-image corpus. All three #1469 files differ byte-for-byte
 * while every comparable image agrees. Removing one carrier entry therefore makes that exact
 * unchanged-tree flicker re-enter `stableDiffs`: the permanent Rule 9 / M11 bite.
 */

import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// @ts-ignore -- repository-owned ESM build utility; no declaration file is warranted.
import {
  compareLightDarkCaptures,
  loadLightDarkControl,
} from "../../testkits/vrt/storycap.lightdark.compare.mjs";

const REPO_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const COMPARE_SCRIPT = join(
  REPO_ROOT,
  "testkits",
  "vrt",
  "storycap.lightdark.compare.mjs",
);
const EXCLUDED_PATHS = [
  "dark/brand-showcase--dark.png",
  "dark/brand-showcase--light.png",
  "dark/contexts-domain-context-gallery--gallery.png",
] as const;

let scratchRoot = "";
let leftRoot = "";
let rightRoot = "";

function writeCapture(root: string, relativePath: string, bytes: string) {
  const target = join(root, ...relativePath.split("/"));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes, "utf8");
}

beforeEach(() => {
  scratchRoot = mkdtempSync(join(tmpdir(), "storycap-lightdark-compare-"));
  leftRoot = join(scratchRoot, "left");
  rightRoot = join(scratchRoot, "right");

  for (let index = 0; index < 76; index += 1) {
    const relativePath = `light/synthetic-${String(index).padStart(3, "0")}.png`;
    writeCapture(leftRoot, relativePath, `stable-${index}`);
    writeCapture(rightRoot, relativePath, `stable-${index}`);
  }
  for (let index = 0; index < 73; index += 1) {
    const relativePath = `dark/synthetic-${String(index).padStart(3, "0")}.png`;
    writeCapture(leftRoot, relativePath, `stable-dark-${index}`);
    writeCapture(rightRoot, relativePath, `stable-dark-${index}`);
  }
  for (const relativePath of EXCLUDED_PATHS) {
    writeCapture(leftRoot, relativePath, `left-${relativePath}`);
    writeCapture(rightRoot, relativePath, `right-${relativePath}`);
  }
});

afterEach(() => {
  if (scratchRoot) rmSync(scratchRoot, { recursive: true, force: true });
  scratchRoot = "";
});

describe("light/dark capture byte comparator", () => {
  it("keeps the exact three #1469 flickers out of the 149-image stable set", () => {
    const control = loadLightDarkControl();
    expect(
      control.exclusions.map((record: { path: string }) => record.path),
    ).toEqual(EXCLUDED_PATHS);

    const result = compareLightDarkCaptures(leftRoot, rightRoot, { control });
    expect(result.corpusSize).toBe(152);
    expect(result.modeCounts).toEqual({ light: 76, dark: 76 });
    expect(result.stableMatches).toHaveLength(149);
    expect(result.stableDiffs).toEqual([]);
    expect(result.excludedDiffs).toEqual(EXCLUDED_PATHS);
  });

  it("BITE: removing one carrier entry makes that unchanged-tree flicker attributable again", () => {
    const control = loadLightDarkControl();
    const droppedPath = control.exclusions[0].path;
    const bittenControl = {
      ...control,
      exclusions: control.exclusions.slice(1),
    };

    const result = compareLightDarkCaptures(leftRoot, rightRoot, {
      control: bittenControl,
    });
    expect(result.stableDiffs).toEqual([droppedPath]);
    expect(result.excludedDiffs).toEqual(EXCLUDED_PATHS.slice(1));
  });

  it("fails before comparison when the two PNG inventories differ", () => {
    unlinkSync(join(rightRoot, "light", "synthetic-000.png"));

    expect(() => compareLightDarkCaptures(leftRoot, rightRoot)).toThrow(
      /capture inventories differ/i,
    );
  });

  it("pins 152 images even when two undersized inventories agree", () => {
    unlinkSync(join(leftRoot, "light", "synthetic-000.png"));
    unlinkSync(join(rightRoot, "light", "synthetic-000.png"));

    expect(() => compareLightDarkCaptures(leftRoot, rightRoot)).toThrow(
      /expected 152 PNGs per run/i,
    );
  });

  it("pins 76 images per mode even when the total corpus still equals 152", () => {
    unlinkSync(join(leftRoot, "dark", "synthetic-000.png"));
    unlinkSync(join(rightRoot, "dark", "synthetic-000.png"));
    writeCapture(leftRoot, "light/mode-skew.png", "same");
    writeCapture(rightRoot, "light/mode-skew.png", "same");

    expect(() => compareLightDarkCaptures(leftRoot, rightRoot)).toThrow(
      /expected 76 light and 76 dark PNGs per run/i,
    );
  });

  it("fails loudly when a carrier path is stale or absent", () => {
    const control = loadLightDarkControl();
    const staleControl = {
      ...control,
      exclusions: [
        ...control.exclusions,
        {
          path: "dark/renamed-story.png",
          decision: "#test",
          reason: "fixture",
        },
      ],
    };

    expect(() =>
      compareLightDarkCaptures(leftRoot, rightRoot, { control: staleControl }),
    ).toThrow(/exclusion path is absent/i);
  });

  it("makes the CLI nonzero for a stable-set byte difference", () => {
    writeCapture(
      rightRoot,
      "light/synthetic-000.png",
      "declared-or-stop-on-me",
    );

    const result = spawnSync(
      process.execPath,
      [COMPARE_SCRIPT, leftRoot, rightRoot],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("1 stable-set image(s) differ");
    expect(JSON.parse(result.stdout).stableDiffs).toEqual([
      "light/synthetic-000.png",
    ]);
  });
});
