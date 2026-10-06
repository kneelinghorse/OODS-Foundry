#!/usr/bin/env node
/**
 * Render the product's name from ONE source into everything that ships (s211-m03, #2296).
 *
 *   node scripts/product/render-name.mjs          # write
 *   node scripts/product/render-name.mjs --check  # exit 1 if a rendered file differs or a retired name ships
 *
 * Input: configs/product/name.json, the only place the product name, the npm package, the install key, the MCP
 * server name and the archive name are authored.
 * Outputs:
 *   - packages/mcp-adapter/product.json, which the adapter reads for its serverInfo name, the preview resource title
 *     and its own sentences;
 *   - every user-facing string in the shipped sources below, where a retired name ("OODS Forge", "OODS-Forge", or
 *     "Forge" as the product's name) becomes the product name.
 * Only user-facing text moves: string and template literals in code (never comments or identifiers), JSON string
 * values, YAML values and shipped prose. Internal names (package names, the repository, lowercase `forge` telemetry
 * and file names) and the record keep "Forge".
 */
import assert from 'node:assert/strict';
import { checkToolNames } from '../runtime/tool-name-guard.mjs';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const NAME_PATH = 'configs/product/name.json';
export const ADAPTER_PRODUCT_PATH = 'packages/mcp-adapter/product.json';
const RETIRED = /\bOODS[ -]Forge\b|\bForge\b/g;

export function loadName(root = ROOT) {
  const name = JSON.parse(fs.readFileSync(path.join(root, NAME_PATH), 'utf8'));
  for (const key of ['product', 'npmPackage', 'installKey', 'serverName', 'archiveBase']) assert(typeof name[key] === 'string' && name[key].trim(), `${NAME_PATH} is missing ${key}`);
  assert.notEqual(name.installKey, 'forge', 'the install key is never `forge` (#2296)');
  assert.match(name.npmPackage, /^@[a-z0-9-]+\/[a-z0-9-]+$/, 'npmPackage must be a scoped npm name');
  return name;
}

/** What the adapter reads at start: its server name, the preview resource title and the product's name. */
export function adapterProduct(name) {
  return { product: name.product, serverName: name.serverName, installKey: name.installKey, npmPackage: name.npmPackage, previewTitle: `${name.product} design preview` };
}

/** The shipped sources whose user-facing text names the product, by kind. */
function sources(root) {
  const walk = (dir, test) => {
    const out = [];
    const visit = (current) => {
      for (const entry of fs.readdirSync(path.join(root, current), { withFileTypes: true })) {
        const relative = path.posix.join(current, entry.name);
        if (entry.isDirectory()) { if (!['node_modules', 'dist', '__snapshots__', '__fixtures__', '__tests__', 'fixtures', 'test', 'tests'].includes(entry.name)) visit(relative); }
        else if (test(relative)) out.push(relative);
      }
    };
    if (fs.existsSync(path.join(root, dir))) visit(dir);
    return out.sort();
  };
  const code = (file) => /\.(ts|tsx|js|mjs)$/.test(file) && !/\.(test|spec)\.(ts|tsx|js|mjs)$/.test(file) && !/(^|\/)test-[^/]*\.js$/.test(file);
  return {
    code: [
      ...walk('packages/mcp-server/src', code),
      ...walk('packages/mcp-bridge/src', code),
      ...walk('packages/mcp-bridge/preview-app', code),
      ...['packages/mcp-adapter/index.js', 'packages/mcp-adapter/mcp-apps.js', 'packages/mcp-adapter/node-floor.js', 'packages/mcp-adapter/sanitize-schema.js'],
    ].filter(file => !file.endsWith('schemas/generated.ts')),
    json: [
      'packages/mcp-adapter/tool-descriptions.json',
      'configs/agent/policy.json',
      ...walk('packages/mcp-server/src', file => file.endsWith('.json')),
      ...walk('schemas', file => file.endsWith('.json')),
    ],
    yaml: ['objects', 'traits', 'domains'].flatMap(dir => walk(dir, file => /\.ya?ml$/.test(file))),
    // NOTICE is rendered by scripts/license/render-license.mjs; LICENSE names no product.
    prose: [...['objects', 'traits', 'domains'].flatMap(dir => walk(dir, file => file.endsWith('.md')))],
  };
}

let ts;
const typescript = () => ts ??= createRequire(path.join(ROOT, 'package.json'))('typescript');

/** The [start, end) spans of every string and template literal's text in a code file. */
function literalSpans(file, text) {
  const t = typescript();
  const source = t.createSourceFile(file, text, t.ScriptTarget.Latest, true, /\.tsx$/.test(file) ? t.ScriptKind.TSX : /\.m?js$/.test(file) ? t.ScriptKind.JS : t.ScriptKind.TS);
  const spans = [];
  const visit = (node) => {
    if (t.isStringLiteral(node) || t.isNoSubstitutionTemplateLiteral(node)) spans.push([node.getStart(source) + 1, node.getEnd() - 1]);
    else if (t.isTemplateExpression(node)) {
      spans.push([node.head.getStart(source) + 1, node.head.getEnd() - 2]);
      for (const part of node.templateSpans) spans.push([part.literal.getStart(source) + 1, part.literal.getEnd() - (t.isTemplateTail(part.literal) ? 1 : 2)]);
    } else if (t.isJsxText(node)) spans.push([node.getStart(source), node.getEnd()]);
    t.forEachChild(node, visit);
  };
  visit(source);
  return spans;
}

const replaceIn = (segment, product) => segment.replace(RETIRED, product);

/** The file with every retired name in its user-facing text replaced, and the retired names it carried. */
function renderSource(kind, file, text, product) {
  const found = [];
  const note = (segment, offset) => { for (const match of segment.matchAll(RETIRED)) found.push({ index: offset + match.index, name: match[0] }); };
  if (kind === 'code') {
    const spans = literalSpans(file, text).sort((a, b) => a[0] - b[0]);
    let output = '', cursor = 0;
    for (const [start, end] of spans) {
      if (start < cursor) continue;
      output += text.slice(cursor, start);
      const segment = text.slice(start, end);
      note(segment, start);
      output += replaceIn(segment, product);
      cursor = end;
    }
    return { output: output + text.slice(cursor), found };
  }
  if (kind === 'json') {
    // Only string values. Strings are read left to right so a key's closing quote is never taken for an opening one;
    // a string followed by a colon is a key and keeps its text. Keys are checked unchanged by re-parsing.
    let output = '', cursor = 0;
    for (let index = 0; index < text.length; index += 1) {
      if (text[index] !== '"') continue;
      let end = index + 1;
      while (text[end] !== '"') end += text[end] === '\\' ? 2 : 1;
      const isKey = /^\s*:/.test(text.slice(end + 1, end + 64));
      if (!isKey) {
        const inner = text.slice(index + 1, end);
        note(inner, index + 1);
        output += text.slice(cursor, index + 1) + replaceIn(inner, product);
        cursor = end;
      }
      index = end;
    }
    output += text.slice(cursor);
    const keys = (value) => value && typeof value === 'object' ? Object.entries(value).flatMap(([key, child]) => [key, ...keys(child)]) : [];
    assert.deepEqual(keys(JSON.parse(output)), keys(JSON.parse(text)), `${file}: rendering changed a key`);
    return { output, found };
  }
  // YAML and prose: every line but comments.
  let offset = 0;
  const output = text.split('\n').map(line => {
    const at = offset; offset += line.length + 1;
    if (kind === 'yaml' && /^\s*#/.test(line)) return line;
    note(line, at);
    return replaceIn(line, product);
  }).join('\n');
  return { output, found };
}

/** Every rendered output as { relativePath: contents }, and every retired name each source carried. */
export function renderAll(root = ROOT) {
  const name = loadName(root);
  const outputs = { [ADAPTER_PRODUCT_PATH]: JSON.stringify(adapterProduct(name), null, 2) + '\n' };
  const retired = [];
  for (const [kind, files] of Object.entries(sources(root))) for (const file of files) {
    if (!fs.existsSync(path.join(root, file))) continue;
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    const { output, found } = renderSource(kind, file, text, name.product);
    if (found.length) { outputs[file] = output; retired.push(...found.map(entry => ({ file, line: text.slice(0, entry.index).split('\n').length, name: entry.name }))); }
  }
  return { name, outputs, retired };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { outputs, retired } = renderAll();
  const check = process.argv.includes('--check');
  const stale = Object.entries(outputs).filter(([file, contents]) => !fs.existsSync(path.join(ROOT, file)) || fs.readFileSync(path.join(ROOT, file), 'utf8') !== contents).map(([file]) => file);
  if (check) {
    const tools = checkToolNames(path.join(ROOT, "packages/foundry"));
    if (tools.length) { console.error(JSON.stringify({ retiredToolNames: tools }, null, 2)); process.exit(1); }
    if (stale.length) {
      console.error(`Product name is not rendered in ${stale.length} file(s); run node scripts/product/render-name.mjs`);
      for (const entry of retired.slice(0, 40)) console.error(`  ${entry.file}:${entry.line} ${entry.name}`);
      process.exit(1);
    }
    console.log(`Product name rendered: ${Object.keys(outputs).length} output(s) fresh, no retired name in shipped user-facing text.`);
  } else {
    for (const file of stale) fs.writeFileSync(path.join(ROOT, file), outputs[file]);
    console.log(JSON.stringify({ written: stale.length, retiredNamesReplaced: retired.length, files: [...new Set(retired.map(entry => entry.file))] }, null, 2));
  }
}
