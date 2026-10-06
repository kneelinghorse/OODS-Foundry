#!/usr/bin/env node
// s178 m04 — published `viz` namespace inventory.
//
// Rung 1 removes source-compatible forwarding modules without permission to change
// the installable package's `viz` namespace. Comparing declaration bytes would make
// the internal rewire itself look like a public change, so this control asks the
// TypeScript checker which symbol names the freshly built dist/pkg entry exports.
//
// Usage:
//   pnpm run pkg:build
//   node scripts/quality/viz-dts-inventory.mjs --check
//   node scripts/quality/viz-dts-inventory.mjs --print

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const fixtureRelativePath = "configs/quality/viz-public-surface-4e999de.json";
const fixturePath = path.join(repoRoot, fixtureRelativePath);
const expectedMetadata = {
  schemaVersion: 1,
  baseSha: "4e999de557cdeba940fbfa02affeec8ead954cf3",
  buildCommand: "pnpm run pkg:build",
  entry: "dist/pkg/index.d.ts",
  namespace: "viz",
};

function fail(message) {
  throw new Error(message);
}

function readFixture() {
  if (!existsSync(fixturePath)) {
    fail(`missing tracked fixture ${fixtureRelativePath}`);
  }

  let fixture;
  try {
    fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  } catch (error) {
    fail(
      `cannot parse ${fixtureRelativePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!fixture || typeof fixture !== "object" || Array.isArray(fixture)) {
    fail(`${fixtureRelativePath} must contain a JSON object`);
  }

  for (const [field, expected] of Object.entries(expectedMetadata)) {
    if (fixture[field] !== expected) {
      fail(
        `${fixtureRelativePath} field ${JSON.stringify(field)} must be ${JSON.stringify(
          expected,
        )}; received ${JSON.stringify(fixture[field])}`,
      );
    }
  }

  if (!Array.isArray(fixture.symbols) || fixture.symbols.length === 0) {
    fail(`${fixtureRelativePath} must contain a non-empty symbols array`);
  }
  if (
    fixture.symbols.some(
      (symbol) => typeof symbol !== "string" || symbol.length === 0,
    )
  ) {
    fail(`${fixtureRelativePath} symbols must all be non-empty strings`);
  }

  const uniqueSymbols = new Set(fixture.symbols);
  if (uniqueSymbols.size !== fixture.symbols.length) {
    fail(`${fixtureRelativePath} symbols must be unique`);
  }

  const sortedSymbols = [...fixture.symbols].sort();
  if (
    !fixture.symbols.every((symbol, index) => symbol === sortedSymbols[index])
  ) {
    fail(`${fixtureRelativePath} symbols must be sorted by code point`);
  }

  if (
    !Number.isInteger(fixture.symbolCount) ||
    fixture.symbolCount !== fixture.symbols.length
  ) {
    fail(
      `${fixtureRelativePath} symbolCount must equal symbols.length (${fixture.symbols.length})`,
    );
  }

  return fixture;
}

function formatDiagnostics(diagnostics) {
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => repoRoot,
    getNewLine: () => "\n",
  });
}

function resolveAlias(checker, initialSymbol) {
  let symbol = initialSymbol;
  const seen = new Set();

  while ((symbol.flags & ts.SymbolFlags.Alias) !== 0) {
    if (seen.has(symbol)) {
      fail(
        `TypeScript reported an alias cycle while resolving ${initialSymbol.getName()}`,
      );
    }
    seen.add(symbol);
    symbol = checker.getAliasedSymbol(symbol);
  }

  return symbol;
}

function extractNamespaceSymbols(fixture) {
  const entryPath = path.resolve(repoRoot, fixture.entry);
  if (!existsSync(entryPath)) {
    fail(
      `missing ${fixture.entry}; run ${JSON.stringify(fixture.buildCommand)} before this control`,
    );
  }

  const program = ts.createProgram([entryPath], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
  });
  const sourceFile = program.getSourceFile(entryPath);
  if (!sourceFile) {
    fail(`TypeScript did not load ${fixture.entry}`);
  }

  const syntaxDiagnostics = program.getSyntacticDiagnostics(sourceFile);
  if (syntaxDiagnostics.length > 0) {
    fail(
      `${fixture.entry} has syntax diagnostics:\n${formatDiagnostics(syntaxDiagnostics)}`,
    );
  }

  const checker = program.getTypeChecker();
  const rootSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!rootSymbol) {
    fail(`TypeScript could not resolve the module symbol for ${fixture.entry}`);
  }

  const namespaceExport = checker
    .getExportsOfModule(rootSymbol)
    .find((symbol) => symbol.getName() === fixture.namespace);
  if (!namespaceExport) {
    fail(
      `${fixture.entry} does not export the root namespace ${JSON.stringify(fixture.namespace)}`,
    );
  }

  const namespaceSymbol = resolveAlias(checker, namespaceExport);
  const symbols = checker
    .getExportsOfModule(namespaceSymbol)
    .map((symbol) => symbol.getName())
    .sort();

  if (symbols.length === 0) {
    fail(
      `TypeScript resolved ${JSON.stringify(fixture.namespace)} from ${fixture.entry} with zero exports`,
    );
  }
  if (new Set(symbols).size !== symbols.length) {
    fail(
      `TypeScript returned duplicate names for ${JSON.stringify(fixture.namespace)}`,
    );
  }

  return symbols;
}

function diffSymbols(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  return {
    removed: expected.filter((symbol) => !actualSet.has(symbol)),
    added: actual.filter((symbol) => !expectedSet.has(symbol)),
  };
}

function printDiff(label, symbols) {
  if (symbols.length === 0) return;
  console.error(`${label} (${symbols.length}):`);
  for (const symbol of symbols) {
    console.error(`  ${label === "Removed" ? "-" : "+"} ${symbol}`);
  }
}

function parseMode(argv) {
  const args = argv.slice(2);
  if (args.includes("--help")) {
    console.log(
      "Usage: node scripts/quality/viz-dts-inventory.mjs [--check | --print]\n" +
        "  --check  Compare the fresh dist/pkg viz symbols with the locked baseline (default).\n" +
        "  --print  Print the measured sorted inventory and its baseline diff as JSON.",
    );
    return "help";
  }

  const unknown = args.filter((arg) => arg !== "--check" && arg !== "--print");
  if (unknown.length > 0) {
    fail(`unknown argument(s): ${unknown.join(", ")}`);
  }
  if (args.includes("--check") && args.includes("--print")) {
    fail("--check and --print are mutually exclusive");
  }
  return args.includes("--print") ? "print" : "check";
}

function main() {
  const mode = parseMode(process.argv);
  if (mode === "help") return;

  const fixture = readFixture();
  const symbols = extractNamespaceSymbols(fixture);
  const { removed, added } = diffSymbols(fixture.symbols, symbols);

  if (mode === "print") {
    console.log(
      `${JSON.stringify(
        {
          entry: fixture.entry,
          namespace: fixture.namespace,
          baselineFixture: fixtureRelativePath,
          matchesBaseline: removed.length === 0 && added.length === 0,
          symbolCount: symbols.length,
          removed,
          added,
          symbols,
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  if (removed.length > 0 || added.length > 0) {
    console.error(
      `viz d.ts inventory differs from ${fixtureRelativePath} after resolving ` +
        `${fixture.namespace} in ${fixture.entry}.`,
    );
    printDiff("Removed", removed);
    printDiff("Added", added);
    console.error(
      "The rung-1 rewire must preserve the published symbol set; do not update the locked baseline.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `viz d.ts inventory matches ${fixtureRelativePath}: ${symbols.length} sorted symbols`,
  );
}

try {
  main();
} catch (error) {
  console.error(
    `viz d.ts inventory: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
