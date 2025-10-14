#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const RULE_FORBIDDEN_VARS = "forbidden-vars";
const RULE_COLOR_LITERALS = "color-literals";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..", "..");
const allowlistPath = path.join(__dirname, "allowlist.json");

const scanTargets = [
  path.join(appRoot, "src", "components"),
  path.join(appRoot, "src", "styles")
];

const defaultExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".cts",
  ".mts",
  ".css",
  ".scss",
  ".mdx"
]);

const ignoredDirectories = new Set([
  ".git",
  "dist",
  "node_modules",
  "storybook-static",
  "coverage",
  "artifacts",
  "__snapshots__",
  "__mocks__",
  "tmp"
]);

function escapeRegex(char) {
  return char.replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&");
}

function globToRegExp(globPattern) {
  let regex = "";
  for (let i = 0; i < globPattern.length; i += 1) {
    const char = globPattern[i];
    const next = globPattern[i + 1];

    if (char === "*") {
      if (next === "*") {
        regex += ".*";
        i += 1;
      } else {
        regex += "[^/]*";
      }
    } else if (char === "?") {
      regex += "[^/]";
    } else {
      regex += escapeRegex(char);
    }
  }

  return new RegExp(`^${regex}$`);
}

async function loadAllowlist() {
  try {
    const contents = await fs.readFile(allowlistPath, "utf8");
    const payload = JSON.parse(contents);
    const entries = Array.isArray(payload.entries) ? payload.entries : [];

    return entries
      .filter((entry) => typeof entry.pattern === "string")
      .map((entry) => ({
        pattern: entry.pattern,
        regex: globToRegExp(entry.pattern),
        skip: new Set(Array.isArray(entry.skip) ? entry.skip : []),
        reason: typeof entry.reason === "string" ? entry.reason : ""
      }));
  } catch (error) {
    console.warn(
      `⚠️  Purity audit allowlist missing or unreadable at ${path.relative(
        appRoot,
        allowlistPath
      )}. Defaulting to empty allowlist.`
    );
    return [];
  }
}

async function collectFiles(targetDir) {
  const files = [];

  async function walk(currentDir) {
    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch (error) {
      return;
    }

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) {
          await walk(entryPath);
        }
      } else if (entry.isFile()) {
        const extension = path.extname(entry.name).toLowerCase();
        if (defaultExtensions.has(extension)) {
          files.push(entryPath);
        }
      }
    }
  }

  await walk(targetDir);
  return files;
}

function buildLineIndex(text) {
  const offsets = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") {
      offsets.push(index + 1);
    }
  }

  return offsets;
}

function locatePosition(lineOffsets, absoluteIndex) {
  let low = 0;
  let high = lineOffsets.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineOffsets[mid] <= absoluteIndex) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const line = Math.max(high, 0);
  const column = absoluteIndex - lineOffsets[line] + 1;
  return { line: line + 1, column };
}

function asPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function summariseMatch(text) {
  return text.length > 40 ? `${text.slice(0, 37)}...` : text;
}

async function detectViolations(filePath, allowlistEntries) {
  const content = await fs.readFile(filePath, "utf8");
  const relative = asPosix(path.relative(appRoot, filePath));
  const lineOffsets = buildLineIndex(content);
  const matches = [];
  const recorded = new Set();

  const addViolation = (violation) => {
    const key = `${violation.rule}:${violation.line}:${violation.column}:${violation.snippet}`;
    if (!recorded.has(key)) {
      recorded.add(key);
      matches.push(violation);
    }
  };

  const matchingEntries = allowlistEntries.filter((entry) =>
    entry.regex.test(relative)
  );
  const skipRules = new Set();
  for (const entry of matchingEntries) {
    for (const value of entry.skip) {
      skipRules.add(value);
    }
  }

  if (!skipRules.has(RULE_FORBIDDEN_VARS)) {
    const forbiddenVarRegex = /var\(\s*(--(?:ref|theme)-[a-z0-9_-]+)/gi;
    let result;
    while ((result = forbiddenVarRegex.exec(content)) !== null) {
      const index = result.index + result[0].indexOf(result[1]);
      const { line, column } = locatePosition(lineOffsets, index);
      addViolation({
        rule: RULE_FORBIDDEN_VARS,
        file: relative,
        line,
        column,
        snippet: result[1]
      });
    }

    const bareVarRegex = /(--(?:ref|theme)-[a-z0-9_-]+)/gi;
    let bare;
    while ((bare = bareVarRegex.exec(content)) !== null) {
      const match = bare[1];
      const contextIndex = bare.index;
      const surrounding = content
        .slice(Math.max(0, contextIndex - 20), contextIndex)
        .toLowerCase();
      const isDefinition = /\bvar\s*\($/.test(surrounding.trimEnd());
      if (isDefinition) {
        continue;
      }

      const { line, column } = locatePosition(lineOffsets, contextIndex);
      addViolation({
        rule: RULE_FORBIDDEN_VARS,
        file: relative,
        line,
        column,
        snippet: match
      });
    }
  }

  if (!skipRules.has(RULE_COLOR_LITERALS)) {
    const colorPatterns = [
      {
        regex: /#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/gi,
        label: "Hex color literal"
      },
      { regex: /\brgba?\(/gi, label: "rgb() color literal" },
      { regex: /\bhsla?\(/gi, label: "hsl() color literal" },
      { regex: /\boklch\(/gi, label: "oklch() color literal" }
    ];

    for (const { regex, label } of colorPatterns) {
      let match;
      while ((match = regex.exec(content)) !== null) {
        const { line, column } = locatePosition(lineOffsets, match.index);
        addViolation({
          rule: RULE_COLOR_LITERALS,
          file: relative,
          line,
          column,
          snippet: summariseMatch(match[0]),
          label
        });
      }
    }
  }

  return matches;
}

function formatViolations(violations) {
  const sorted = [...violations].sort((a, b) => {
    if (a.file === b.file) {
      if (a.line === b.line) {
        return a.column - b.column;
      }
      return a.line - b.line;
    }
    return a.file.localeCompare(b.file);
  });

  const lines = [];
  for (const violation of sorted) {
    const ruleLabel =
      violation.rule === RULE_FORBIDDEN_VARS
        ? "forbidden var"
        : "color literal";
    const descriptor =
      violation.label ?? (violation.rule === RULE_FORBIDDEN_VARS
        ? "Forbidden CSS variable usage"
        : "Forbidden color literal");
    lines.push(
      `${violation.file}:${violation.line}:${violation.column}  [${ruleLabel}] ${descriptor}: ${violation.snippet}`
    );
  }
  return lines.join("\n");
}

async function run() {
  const allowlist = await loadAllowlist();
  const allTargets = [];

  for (const target of scanTargets) {
    try {
      const stats = await fs.stat(target);
      if (stats.isDirectory()) {
        const files = await collectFiles(target);
        allTargets.push(...files);
      }
    } catch {
      continue;
    }
  }

  const violations = [];
  for (const filePath of allTargets) {
    const fileViolations = await detectViolations(filePath, allowlist);
    violations.push(...fileViolations);
  }

  if (violations.length === 0) {
    console.log("✅ Purity audit passed: 0 violations detected.");
    return;
  }

  console.error(
    `⛔ Purity audit failed: ${violations.length} violation${
      violations.length === 1 ? "" : "s"
    } detected.\n`
  );
  console.error(formatViolations(violations));
  process.exitCode = 1;
}

run().catch((error) => {
  console.error("Unexpected error running purity audit:");
  console.error(error);
  process.exitCode = 1;
});
