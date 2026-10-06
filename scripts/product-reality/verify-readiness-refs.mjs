#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";
import { NUCLEUS_COMPONENT_IDS } from "../../packages/component-contracts/dist/index.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_REPOSITORY_ROOT = path.resolve(scriptDirectory, "../..");
export const EXPECTED_REFERENCE_TOTALS = Object.freeze({
  // Six refs per row/target, plus ten historical Vue scenario refs.
  references: NUCLEUS_COMPONENT_IDS.length * 12 + 10,
  classA: NUCLEUS_COMPONENT_IDS.length * 10 + 10,
  classB: NUCLEUS_COMPONENT_IDS.length * 2,
});

export const READINESS_DOCUMENTS = Object.freeze({
  react: "packages/components-react/evidence/react-readiness.v1.json",
  vue: "packages/components-vue/evidence/vue-readiness.v1.json",
});

const EVIDENCE_CLASSES = Object.freeze([
  "versionedContract",
  "targetImplementation",
  "packageExport",
  "publicDeclaration",
  "dependencyClosure",
  "frameworkScenario",
]);

const SYMBOL_EVIDENCE_CLASSES = new Set([
  "versionedContract",
  "targetImplementation",
  "packageExport",
  "publicDeclaration",
]);

function compareCodePoint(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseArguments(argv) {
  const result = { repositoryRoot: DEFAULT_REPOSITORY_ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--repository-root" || argument === "--output" || argument === "--mission-id") {
      const value = argv[index + 1];
      if (!value) throw new Error(`Missing value for ${argument}.`);
      if (argument === "--mission-id") result.missionId = value;
      else result[argument === "--output" ? "output" : "repositoryRoot"] = path.resolve(value);
      index += 1;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      result.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return result;
}

function splitReference(ref) {
  const separator = ref.lastIndexOf("#");
  if (separator <= 0 || separator === ref.length - 1) return null;
  const relativePath = ref.slice(0, separator);
  const symbol = ref.slice(separator + 1);
  if (
    path.isAbsolute(relativePath)
    || relativePath.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    return null;
  }
  return { relativePath, symbol };
}

function unwrapExpression(node) {
  let current = node;
  while (
    ts.isParenthesizedExpression(current)
    || ts.isAsExpression(current)
    || ts.isTypeAssertionExpression(current)
    || ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  return null;
}

function hasExportModifier(node) {
  return Boolean(node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function collectBindingNames(name, names) {
  if (ts.isIdentifier(name)) {
    names.add(name.text);
    return;
  }
  for (const element of name.elements) {
    if (!ts.isOmittedExpression(element)) collectBindingNames(element.name, names);
  }
}

function exportedNames(sourceFile) {
  const names = new Set();
  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) names.add(element.name.text);
      continue;
    }
    if (!hasExportModifier(statement)) continue;
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        collectBindingNames(declaration.name, names);
      }
    } else if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement))
      && statement.name
    ) {
      names.add(statement.name.text);
    }
  }
  return names;
}

function versionedContractNames(sourceFile) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement) || !hasExportModifier(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "componentContracts") continue;
      if (!declaration.initializer) return new Set();
      let initializer = unwrapExpression(declaration.initializer);
      // s192 composes executable semantics onto the authored object without
      // changing its keys. Follow that specific projection to the physical keys;
      // do not credit a type assertion or an arbitrary computed object as proof.
      if (initializer.getText(sourceFile).replace(/\s/g, '').startsWith('Object.fromEntries(Object.entries(authoredContracts).map(')) {
        const authored = sourceFile.statements.filter(ts.isVariableStatement)
          .flatMap(statement => [...statement.declarationList.declarations])
          .find(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === 'authoredContracts');
        if (!authored?.initializer) return new Set();
        initializer = unwrapExpression(authored.initializer);
      }
      if (!ts.isObjectLiteralExpression(initializer)) return new Set();
      return new Set(
        initializer.properties
          .map((property) => propertyName(property.name))
          .filter((name) => name !== null),
      );
    }
  }
  return new Set();
}

function sourceFileFor(filePath, source, cache) {
  if (!cache.has(filePath)) {
    const scriptKind = filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    cache.set(
      filePath,
      ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKind),
    );
  }
  return cache.get(filePath);
}

function resolveSymbol(evidenceClass, symbol, sourceFile) {
  return evidenceClass === "versionedContract"
    ? versionedContractNames(sourceFile).has(symbol)
    : exportedNames(sourceFile).has(symbol);
}

/**
 * Independent repository oracle for the readiness documents. Every ref
 * occurrence is counted; repeated scenario refs are evidence, not deduplicated.
 */
export function verifyReadinessRefs(repositoryRoot = DEFAULT_REPOSITORY_ROOT, missionId = "s185-m03") {
  const root = path.resolve(repositoryRoot);
  const failures = [];
  const references = [];
  const sourceFileCache = new Map();
  const sourceTextCache = new Map();
  const targetTotals = {};
  const evidenceTotals = Object.fromEntries(
    EVIDENCE_CLASSES.map((evidenceClass) => [evidenceClass, 0]),
  );

  for (const [target, documentPath] of Object.entries(READINESS_DOCUMENTS)) {
    const document = JSON.parse(fs.readFileSync(path.join(root, documentPath), "utf8"));
    const totals = { rows: document.rows.length, references: 0, classA: 0, classB: 0, resolved: 0 };

    for (const row of document.rows) {
      for (const evidenceClass of EVIDENCE_CLASSES) {
        const evidence = row.evidence && Object.hasOwn(row.evidence, evidenceClass)
          ? row.evidence[evidenceClass]
          : undefined;
        if (evidence?.status !== "passed" || !Array.isArray(evidence.refs) || evidence.refs.length === 0) {
          failures.push({
            target,
            componentId: row.componentId,
            evidenceClass,
            ref: null,
            reason: "evidence-missing",
          });
          continue;
        }

        for (const ref of evidence.refs) {
          const referenceClass = evidenceClass === "publicDeclaration" ? "B" : "A";
          const record = { target, componentId: row.componentId, evidenceClass, referenceClass, ref };
          references.push(record);
          totals.references += 1;
          totals[referenceClass === "A" ? "classA" : "classB"] += 1;
          evidenceTotals[evidenceClass] += 1;

          if (typeof ref !== "string") {
            failures.push({ ...record, reason: "invalid-reference" });
            continue;
          }
          const split = splitReference(ref);
          if (!split) {
            failures.push({ ...record, reason: "invalid-reference" });
            continue;
          }
          const absolutePath = path.resolve(root, split.relativePath);
          const relative = path.relative(root, absolutePath);
          if (relative.startsWith("..") || path.isAbsolute(relative)) {
            failures.push({ ...record, reason: "invalid-reference" });
            continue;
          }
          if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
            failures.push({ ...record, reason: "file-unavailable" });
            continue;
          }
          if (SYMBOL_EVIDENCE_CLASSES.has(evidenceClass)) {
            let source = sourceTextCache.get(absolutePath);
            if (source === undefined) {
              source = fs.readFileSync(absolutePath, "utf8");
              sourceTextCache.set(absolutePath, source);
            }
            const sourceFile = sourceFileFor(absolutePath, source, sourceFileCache);
            if (!resolveSymbol(evidenceClass, split.symbol, sourceFile)) {
              failures.push({ ...record, reason: "symbol-unavailable" });
              continue;
            }
          }
          totals.resolved += 1;
        }
      }
    }
    targetTotals[target] = totals;
  }

  const totals = {
    references: references.length,
    classA: references.filter(({ referenceClass }) => referenceClass === "A").length,
    classB: references.filter(({ referenceClass }) => referenceClass === "B").length,
    resolved: references.length - failures.filter(({ ref }) => ref !== null).length,
  };
  const countMatches = Object.entries(EXPECTED_REFERENCE_TOTALS).every(
    ([key, expected]) => totals[key] === expected,
  );
  failures.sort((left, right) => compareCodePoint(
    `${left.target}:${left.componentId}:${left.evidenceClass}:${left.ref ?? ""}`,
    `${right.target}:${right.componentId}:${right.evidenceClass}:${right.ref ?? ""}`,
  ));

  return {
    schemaVersion: "1.0.0",
    missionId,
    kind: "readiness-reference-verification",
    classification: {
      classA: "repository source, package export, dependency closure, or framework scenario",
      classB: "built public declaration",
    },
    expected: EXPECTED_REFERENCE_TOTALS,
    totals,
    targets: targetTotals,
    evidenceClasses: evidenceTotals,
    failures,
    status: countMatches && failures.length === 0 ? "passed" : "failed",
  };
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;

if (invokedPath === import.meta.url) {
  const args = parseArguments(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      "Usage: node scripts/product-reality/verify-readiness-refs.mjs "
      + "[--repository-root <directory>] [--output <file>] [--mission-id <id>]\n",
    );
  } else {
    const report = verifyReadinessRefs(args.repositoryRoot, args.missionId);
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    if (args.output) {
      fs.mkdirSync(path.dirname(args.output), { recursive: true });
      fs.writeFileSync(args.output, serialized);
    }
    process.stdout.write(serialized);
    if (report.status !== "passed") process.exitCode = 1;
  }
}
