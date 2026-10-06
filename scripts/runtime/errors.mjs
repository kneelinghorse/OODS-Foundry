#!/usr/bin/env node
/** Error glossary from the built modules shipped by the runtime (s225-m02). */
import { advertisedName } from './tool-names.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const ERRORS_FILE = 'packages/foundry/errors.json';
// Recognize new families too: extraction must not hide an unregistered code from the completeness gate.
const CODE = /\bOODS-(?:[A-Z]+\d{3}|[A-Z0-9]+(?:-[A-Z0-9]+)*-\d{2,3})\b/g;

/** Read executable literals, not comments or type annotations; shared by the source completeness proof. */
export function inspectModule(file) {
  const source = fs.readFileSync(file, 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const codes = new Set();
  const imports = new Set();
  let emitsEquivalence = false;
  function visit(node) {
    if (ts.isTypeNode(node)) return;
    if (ts.isStringLiteralLike(node)) {
      for (const match of node.text.matchAll(CODE)) codes.add(match[0]);
    }
    // Rule ids are turned into public codes at these template expressions in the tool emitters.
    if (ts.isTemplateExpression(node) && node.head.text === 'OODS-') emitsEquivalence = true;
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) imports.add(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require') && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) imports.add(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return { codes, imports, emitsEquivalence };
}

/** Source files that contribute code to the shipped server, visualization engine, preview host and adapter. */
export function sourceCodeFiles(root = ROOT) {
  const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', 'dist', '__tests__', '__fixtures__', 'test', 'tests'].includes(entry.name)) return [];
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : /\.(?:[cm]?js|tsx?)$/.test(entry.name) && !/(?:\.test\.|\.spec\.|\.d\.ts$|^test[-.])/.test(entry.name) ? [file] : [];
  });
  return ['packages/mcp-server/src', 'packages/viz-core/src', 'packages/mcp-bridge/src/preview', 'packages/mcp-adapter'].flatMap(dir => walk(path.join(root, dir)));
}

function packageEntry(root, specifier) {
  const [scope, name, ...subpath] = specifier.split('/');
  if (scope !== '@oods') return undefined;
  const directory = path.join(root, 'packages', name);
  const manifestPath = path.join(directory, 'package.json');
  if (!fs.existsSync(manifestPath)) return undefined;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  let target = manifest.exports?.[subpath.length ? `./${subpath.join('/')}` : '.'] ?? manifest.module ?? manifest.main;
  while (target && typeof target === 'object') target = target.import ?? target.default;
  return typeof target === 'string' ? path.resolve(directory, target) : undefined;
}

/** Walk local built module imports; the registry holds definitions, not emitter evidence. */
function moduleGraphCodes(root, entry, equivalenceCodes, cache) {
  const found = new Set();
  const visited = new Set();
  function walk(file) {
    if (visited.has(file)) return;
    visited.add(file);
    if (file === path.join(root, 'packages/mcp-server/dist/errors/registry.js')) return;
    assert(fs.existsSync(file), `Built module is missing: ${path.relative(root, file)}; build packages first`);
    if (!/\.[cm]?js$/.test(file)) return;
    if (!cache.has(file)) cache.set(file, inspectModule(file));
    const module = cache.get(file);
    for (const code of module.codes) found.add(code);
    if (module.emitsEquivalence) for (const code of equivalenceCodes) found.add(code);
    for (const specifier of module.imports) {
      const dependency = specifier.startsWith('.') ? path.resolve(path.dirname(file), specifier) : packageEntry(root, specifier);
      if (dependency) walk(dependency);
    }
  }
  walk(entry);
  return found;
}

export async function buildErrors(root = ROOT) {
  const built = path.join(root, 'packages/mcp-server/dist');
  const { allCodes, LEGACY_CODE_MAP, RESERVED_CODES } = await import(pathToFileURL(path.join(built, 'errors/registry.js')).href);
  const { VIZ_EQUIVALENCE_ERROR_DEFINITIONS } = await import(pathToFileURL(path.join(root, 'packages/viz-core/dist/index.js')).href);
  assert(RESERVED_CODES && VIZ_EQUIVALENCE_ERROR_DEFINITIONS, 'Build mcp-server and viz-core before generating errors.json');
  const registry = JSON.parse(fs.readFileSync(path.join(built, 'tools/registry.json'), 'utf8'));
  const tools = [...registry.auto, ...registry.onDemand].sort();
  const index = fs.readFileSync(path.join(built, 'index.js'), 'utf8');
  const modules = new Map([...index.matchAll(/(?:'([^']+)'|"([^"]+)"):\s*\{\s*modulePath:\s*['"]([^'"]+)['"]/g)].map(match => [match[1] ?? match[2], match[3]]));
  const definitions = [...allCodes(), ...VIZ_EQUIVALENCE_ERROR_DEFINITIONS.map(def => ({ ...def, category: 'validation', retryable: true }))];
  const byCode = new Map(definitions.map(def => [def.code, def]));
  assert.equal(byCode.size, definitions.length, 'Every error code has exactly one definition');
  const dispatch = new Set(Object.values(LEGACY_CODE_MAP));
  const cache = new Map();
  const toolCodes = new Map(tools.map(tool => {
    assert(modules.has(tool), `No built module registered for ${tool}`);
    return [tool, moduleGraphCodes(root, path.resolve(built, modules.get(tool)), VIZ_EQUIVALENCE_ERROR_DEFINITIONS.map(def => def.code), cache)];
  }));
  // N019 remains in historical ledger records, but cannot be emitted by the current preview route.
  for (const [tool, codes] of toolCodes) for (const code of codes) assert(byCode.has(code) || code in RESERVED_CODES, `${tool} has an unregistered literal ${code}`);
  const codes = [];
  for (const def of definitions.sort((a, b) => a.code.localeCompare(b.code, 'en'))) {
    assert(def.cause?.trim() && def.fix?.trim(), `${def.code} needs a cause and fix`);
    assert(['error', 'warning', 'error-or-warning'].includes(def.severity), `${def.code} needs a severity`);
    if (def.code in RESERVED_CODES) {
      assert(![...toolCodes.values()].some(found => found.has(def.code)), `${def.code} is marked reserved but a built module emits it`);
      continue;
    }
    const emitters = dispatch.has(def.code) ? tools : tools.filter(tool => toolCodes.get(tool).has(def.code));
    assert(emitters.length, `${def.code} has no reachable emitter; reserve it with a reason or connect its module`);
    codes.push({ code: def.code, ...(/^OODS-A11Y-R-\d{2}$/.test(def.code) ? { aliases: [def.code.replace('OODS-A11Y-', 'OODS-A11Y-A11Y-')] } : {}), family: def.code.match(/^OODS-([A-Z]+(?:11Y)?)/)[1], category: def.category, severity: def.severity, retryable: def.retryable, message: def.message, cause: def.cause, fix: def.fix, tools: emitters.map(tool => advertisedName(tool, root)) });
  }
  return {
    schema: 'oods-foundry-errors/v1',
    version: JSON.parse(fs.readFileSync(path.join(root, 'packages/foundry/package.json'), 'utf8')).version,
    codes,
    reserved: Object.entries(RESERVED_CODES).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([code, reason]) => ({ code, reason })),
    notes: [
      'Aliases list historical spellings for lookup and migration only; results emit the canonical code, never its aliases.',
      'Tools lists which tools can return a code, by static analysis of the shipped built module graph, including transitive tool calls; shared modules may make the list broader than an individual call path. It includes the on-demand a11y_scan tool.',
      'Message is the canonical registry message (or accessibility rule summary); the runtime adds request-specific details at the emitting call site.',
      'Severity is error-or-warning where a code has both outcomes, including dashboard panel omission and advisory code-generation profiles; accessibility rules retain their intrinsic evaluator severity, while their returned-code severity includes panel omission.',
      'Reserved codes have no current emitter. OODS-N019 is retired and occurs only in historical tool-ledger evidence.',
      'The optional HTTP bridge has its own transport codes outside this MCP glossary: POLICY_DENIED, RATE_LIMITED, TIMEOUT, VALIDATION_ERROR and RUN_ERROR; legacy bridge aliases are normalized to those codes.',
    ],
  };
}
export const renderErrors = document => `${JSON.stringify(document, null, 2)}\n`;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (!['--write', '--check'].includes(mode)) { process.stderr.write('usage: errors.mjs --write | --check\n'); process.exit(2); }
  const text = renderErrors(await buildErrors());
  const destination = path.join(ROOT, ERRORS_FILE);
  if (mode === '--write') { fs.writeFileSync(destination, text); process.stdout.write(`Wrote ${ERRORS_FILE}.\n`); }
  else if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== text) { process.stderr.write(`${ERRORS_FILE} is stale: run node scripts/runtime/errors.mjs --write.\n`); process.exitCode = 1; }
  else process.stdout.write(`${ERRORS_FILE} is fresh.\n`);
}
