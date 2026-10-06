#!/usr/bin/env node
/**
 * Byte-compare two complete light/dark storycap runs.
 *
 * The exclusion carrier is an attribution boundary, not a capture filter: all 152 PNGs must
 * exist on both sides. Known unchanged-tree flickers are reported separately, while any byte
 * difference in the remaining stable set makes the CLI fail so it must be attributed or
 * stopped-on before work continues.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const modulePath = fileURLToPath(import.meta.url);
const moduleDir = path.dirname(modulePath);

export const EXPECTED_LIGHTDARK_CORPUS_SIZE = 152;
export const EXPECTED_LIGHTDARK_MODE_SIZE = 76;
export const DEFAULT_LIGHTDARK_EXCLUSIONS_PATH = path.join(
  moduleDir,
  "storycap.lightdark.exclusions.json",
);

function validateExclusionPath(value) {
  if (
    typeof value !== "string" ||
    !value.endsWith(".png") ||
    value.includes("\\") ||
    path.isAbsolute(value) ||
    value
      .split("/")
      .some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`Invalid light/dark exclusion path: ${String(value)}`);
  }
}

export function loadLightDarkControl(
  controlPath = DEFAULT_LIGHTDARK_EXCLUSIONS_PATH,
) {
  const parsed = JSON.parse(fs.readFileSync(controlPath, "utf8"));
  if (parsed?.expectedCorpusSize !== EXPECTED_LIGHTDARK_CORPUS_SIZE) {
    throw new Error(
      `Light/dark corpus pin must be ${EXPECTED_LIGHTDARK_CORPUS_SIZE}; ` +
        `received ${String(parsed?.expectedCorpusSize)} in ${controlPath}`,
    );
  }
  if (parsed?.expectedPerMode !== EXPECTED_LIGHTDARK_MODE_SIZE) {
    throw new Error(
      `Light/dark per-mode pin must be ${EXPECTED_LIGHTDARK_MODE_SIZE}; ` +
        `received ${String(parsed?.expectedPerMode)} in ${controlPath}`,
    );
  }
  if (!Array.isArray(parsed.exclusions)) {
    throw new Error(
      `Light/dark exclusion carrier has no exclusions array: ${controlPath}`,
    );
  }

  const seen = new Set();
  for (const record of parsed.exclusions) {
    validateExclusionPath(record?.path);
    if (seen.has(record.path)) {
      throw new Error(`Duplicate light/dark exclusion path: ${record.path}`);
    }
    if (
      typeof record.decision !== "string" ||
      typeof record.reason !== "string" ||
      !record.reason.trim()
    ) {
      throw new Error(
        `Light/dark exclusion lacks a decision/reason record: ${record.path}`,
      );
    }
    seen.add(record.path);
  }

  return parsed;
}

function pngInventory(root) {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(
      `Capture directory does not exist or is not a directory: ${root}`,
    );
  }

  const files = [];
  const visit = (absoluteDir, relativeDir) => {
    const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = relativeDir
        ? `${relativeDir}/${entry.name}`
        : entry.name;
      const absolutePath = path.join(absoluteDir, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath, relativePath);
      } else if (entry.isFile() && entry.name.endsWith(".png")) {
        files.push(relativePath);
      }
    }
  };

  visit(path.resolve(root), "");
  return files.sort();
}

function assertInventories(leftFiles, rightFiles) {
  const leftSet = new Set(leftFiles);
  const rightSet = new Set(rightFiles);
  const missingFromRight = leftFiles.filter((file) => !rightSet.has(file));
  const missingFromLeft = rightFiles.filter((file) => !leftSet.has(file));

  if (missingFromRight.length || missingFromLeft.length) {
    throw new Error(
      "Light/dark capture inventories differ." +
        (missingFromRight.length
          ? ` Missing from right: ${missingFromRight.join(", ")}.`
          : "") +
        (missingFromLeft.length
          ? ` Missing from left: ${missingFromLeft.join(", ")}.`
          : ""),
    );
  }

  if (
    leftFiles.length !== EXPECTED_LIGHTDARK_CORPUS_SIZE ||
    rightFiles.length !== EXPECTED_LIGHTDARK_CORPUS_SIZE
  ) {
    throw new Error(
      `Light/dark corpus pin failed: expected ${EXPECTED_LIGHTDARK_CORPUS_SIZE} PNGs per run; ` +
        `found left=${leftFiles.length}, right=${rightFiles.length}.`,
    );
  }

  const countModes = (files) => ({
    light: files.filter((file) => file.startsWith("light/")).length,
    dark: files.filter((file) => file.startsWith("dark/")).length,
  });
  const leftModes = countModes(leftFiles);
  const rightModes = countModes(rightFiles);
  if (
    leftModes.light !== EXPECTED_LIGHTDARK_MODE_SIZE ||
    leftModes.dark !== EXPECTED_LIGHTDARK_MODE_SIZE ||
    rightModes.light !== EXPECTED_LIGHTDARK_MODE_SIZE ||
    rightModes.dark !== EXPECTED_LIGHTDARK_MODE_SIZE
  ) {
    throw new Error(
      `Light/dark mode pin failed: expected ${EXPECTED_LIGHTDARK_MODE_SIZE} light and ` +
        `${EXPECTED_LIGHTDARK_MODE_SIZE} dark PNGs per run; found ` +
        `left=${leftModes.light}/${leftModes.dark}, right=${rightModes.light}/${rightModes.dark}.`,
    );
  }

  return leftModes;
}

function fileAt(root, relativePath) {
  return path.join(path.resolve(root), ...relativePath.split("/"));
}

export function compareLightDarkCaptures(leftRoot, rightRoot, options = {}) {
  const control = options.control ?? loadLightDarkControl();
  if (
    control.expectedCorpusSize !== EXPECTED_LIGHTDARK_CORPUS_SIZE ||
    control.expectedPerMode !== EXPECTED_LIGHTDARK_MODE_SIZE ||
    !Array.isArray(control.exclusions)
  ) {
    throw new Error("Invalid in-memory light/dark comparison control.");
  }

  const leftFiles = pngInventory(leftRoot);
  const rightFiles = pngInventory(rightRoot);
  const modeCounts = assertInventories(leftFiles, rightFiles);

  const inventory = new Set(leftFiles);
  const exclusionPaths = control.exclusions.map((record) => record.path);
  for (const excludedPath of exclusionPaths) {
    validateExclusionPath(excludedPath);
    if (!inventory.has(excludedPath)) {
      throw new Error(
        `Light/dark exclusion path is absent from the capture inventory: ${excludedPath}`,
      );
    }
  }

  const excluded = new Set(exclusionPaths);
  const result = {
    expectedCorpusSize: EXPECTED_LIGHTDARK_CORPUS_SIZE,
    corpusSize: leftFiles.length,
    modeCounts,
    stableMatches: [],
    stableDiffs: [],
    excludedMatches: [],
    excludedDiffs: [],
  };

  for (const relativePath of leftFiles) {
    const identical = fs
      .readFileSync(fileAt(leftRoot, relativePath))
      .equals(fs.readFileSync(fileAt(rightRoot, relativePath)));
    if (excluded.has(relativePath)) {
      result[identical ? "excludedMatches" : "excludedDiffs"].push(
        relativePath,
      );
    } else {
      result[identical ? "stableMatches" : "stableDiffs"].push(relativePath);
    }
  }

  return result;
}

function main() {
  const [leftRoot, rightRoot, ...extra] = process.argv.slice(2);
  if (!leftRoot || !rightRoot || extra.length) {
    throw new Error(
      "Usage: node testkits/vrt/storycap.lightdark.compare.mjs <left-run-dir> <right-run-dir>",
    );
  }

  const result = compareLightDarkCaptures(leftRoot, rightRoot);
  console.log(JSON.stringify(result, null, 2));
  if (result.stableDiffs.length) {
    console.error(
      `[ld-storycap-compare] ${result.stableDiffs.length} stable-set image(s) differ: ` +
        result.stableDiffs.join(", "),
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  try {
    main();
  } catch (error) {
    console.error(
      "[ld-storycap-compare] ERROR:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  }
}
