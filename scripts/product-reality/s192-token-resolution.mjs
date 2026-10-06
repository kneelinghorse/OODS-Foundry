import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import postcss from 'postcss';
import { cssVariablesByScope } from '@oods/tokens';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// s222-m02: components.css imports components-overlay.css (Switch and Dialog), so the census reads it too.
// s223-m02 (#2527 ruling 11): and components-combobox.css, which it imports after the overlay sheet.
// s223-m02 (#2527 ruling 10): and components-segmented-control.css, which it imports after that.
export const STYLE_FILES = ['components.css', 'components-ported.css', 'components-overlay.css', 'components-combobox.css', 'components-segmented-control.css'].map(name => `packages/component-styles/src/${name}`);
export const UNGUARDED_BASE_NAMES = ['--radius-md', '--space-2', '--space-3', '--sys-focus-ring', '--sys-surface-default', '--sys-text-subtle'];
const systemColour = /\b(?:AccentColor|AccentColorText|ActiveText|ButtonBorder|ButtonFace|ButtonText|Canvas|CanvasText|Field|FieldText|GrayText|Highlight|HighlightText|LinkText|Mark|MarkText|SelectedItem|SelectedItemText|VisitedText)\b/gi;
const colourProperty = /^(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?(?:-color)?|outline(?:-color)?|box-shadow|text-shadow|text-decoration(?:-color)?|fill|stroke|accent-color|caret-color)$/;
const colourName = /(?:background|surface|(?:^|-)text(?:$|-)|(?:^|-)color(?:$|-)|border|focus|shadow|placeholder|hint|legend|icon|marker|swatch|accent|fill)/;
const geometryName = /(?:width|height|radius|padding|gap|spacing|font|weight|size|scale|line-height)/;
const unique = values => [...new Set(values)].sort();

/** Return outer calls; recursive descent through fallback values retains inner calls. */
export function parseVars(value) {
  const result = [];
  let quote;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '\\') { i++; continue; }
    if (quote) { if (value[i] === quote) quote = undefined; continue; }
    if (value[i] === '"' || value[i] === "'") { quote = value[i]; continue; }
    if (!value.startsWith('var(', i)) continue;
    const match = /^var\(\s*(--[\w-]+)\s*/.exec(value.slice(i));
    if (!match) throw new Error(`Invalid CSS var(): ${value.slice(i)}`);
    let end = i + 4, depth = 1, innerQuote;
    for (; end < value.length && depth; end++) {
      if (value[end] === '\\') { end++; continue; }
      if (innerQuote) { if (value[end] === innerQuote) innerQuote = undefined; continue; }
      if (value[end] === '"' || value[end] === "'") { innerQuote = value[end]; continue; }
      if (value[end] === '(') depth++;
      else if (value[end] === ')') depth--;
    }
    if (depth) throw new Error(`Unclosed CSS var(): ${value.slice(i)}`);
    const tail = value.slice(i + match[0].length, end - 1).trim();
    if (tail && !tail.startsWith(',')) throw new Error(`Invalid CSS fallback: ${tail}`);
    result.push({ name: match[1], fallback: tail ? tail.slice(1).trim() : null, start: i, end });
    i = end - 1;
  }
  return result;
}
const allVars = value => parseVars(value).flatMap(call => [call, ...(call.fallback === null ? [] : allVars(call.fallback))]);

/** Resolve only the selected branch. Tokens are already scope-resolved; system
 * colours deliberately supplied by HC tokens are not accidental fallback literals. */
export function resolveValue(value, tokens, locals = {}, visited = new Set(), inFallback = false) {
  let output = '', cursor = 0;
  const missing = [], systemFallbacks = [], trace = [];
  const literal = text => { if (inFallback) systemFallbacks.push(...(text.match(systemColour) ?? [])); return text; };
  for (const call of parseVars(value)) {
    output += literal(value.slice(cursor, call.start)); cursor = call.end;
    let result;
    const local = Object.hasOwn(locals, call.name);
    if (!visited.has(call.name) && (local || Object.hasOwn(tokens, call.name))) {
      result = local
        ? resolveValue(locals[call.name], tokens, locals, new Set([...visited, call.name]), false)
        : { value: tokens[call.name], missing: [], systemFallbacks: [], trace: [] };
      trace.push({ name: call.name, branch: local ? 'local' : 'token' });
    }
    if (!result || result.missing.length) {
      if (call.fallback !== null) {
        result = resolveValue(call.fallback, tokens, locals, visited, true);
        trace.push({ name: call.name, branch: 'fallback' });
      } else {
        result ??= { value: '', missing: [call.name], systemFallbacks: [], trace: [] };
        trace.push({ name: call.name, branch: visited.has(call.name) ? 'cycle' : 'missing' });
      }
    }
    output += result.value; missing.push(...result.missing); systemFallbacks.push(...result.systemFallbacks); trace.push(...result.trace);
  }
  output += literal(value.slice(cursor));
  return { value: output, missing: unique(missing), systemFallbacks: unique(systemFallbacks), trace };
}

export function census({ root = ROOT, sources, scopes = cssVariablesByScope } = {}) {
  sources ??= STYLE_FILES.map(file => ({ file, css: fs.readFileSync(path.join(root, file), 'utf8') }));
  const declarations = [], definitions = new Set(), globals = {}, rules = new Map();
  for (const { file, css } of sources) postcss.parse(css, { from: file }).walkDecls(declaration => {
    const parents = []; for (let parent = declaration.parent; parent; parent = parent.parent) parents.push(parent);
    const rule = parents.find(parent => parent.type === 'rule');
    const forced = parents.some(parent => parent.type === 'atrule' && parent.name === 'media' && /\(\s*forced-colors\s*:\s*active\s*\)/.test(parent.params));
    const selector = rule?.selector ?? ':root';
    const calls = allVars(declaration.value);
    declarations.push({ file, line: declaration.source.start.line, selector, forced, property: declaration.prop, value: declaration.value, calls });
    if (declaration.prop.startsWith('--')) {
      definitions.add(declaration.prop);
      if (!forced) {
        if (selector === ':root') globals[declaration.prop] = declaration.value;
        const key = `${file}\n${selector}`;
        if (!rules.has(key)) rules.set(key, {});
        rules.get(key)[declaration.prop] = declaration.value;
      }
    }
  });
  const names = unique(declarations.flatMap(declaration => declaration.calls.map(call => call.name)));
  const rows = [];
  for (const [brand, themes] of Object.entries(scopes)) for (const [theme, exported] of Object.entries(themes)) {
    const tokens = Object.fromEntries(Object.entries(exported).map(([name, value]) => [name.replace(/^--oods-(?=(?:ref|theme|sys|cmp)-)/, '--'), value]));
    const inventory = names.map(name => ({ name, classification: Object.hasOwn(tokens, name) ? 'token-defined' : definitions.has(name) ? 'local' : 'unresolved' }));
    const evaluations = declarations.filter(declaration => !declaration.forced && declaration.calls.length).map(declaration => {
      const locals = { ...globals, ...rules.get(`${declaration.file}\n${declaration.selector}`) };
      const result = resolveValue(declaration.value, tokens, locals);
      const isColour = colourProperty.test(declaration.property) || (declaration.property.startsWith('--') && colourName.test(declaration.property) && !geometryName.test(declaration.property));
      return { ...declaration, isColour, ...result, value: declaration.value, resolvedValue: result.value };
    });
    const unresolvedColour = evaluations.filter(row => row.isColour && row.missing.length);
    const systemFallbacks = evaluations.filter(row => row.systemFallbacks.length);
    const nonColourUnresolved = inventory.filter(row => row.classification === 'unresolved' && (!colourName.test(row.name) || geometryName.test(row.name))).map(row => row.name);
    rows.push({ brand, theme, inventory,
      counts: { referenced: names.length, tokenDefined: inventory.filter(row => row.classification === 'token-defined').length,
        local: inventory.filter(row => row.classification === 'local').length, unresolved: inventory.filter(row => row.classification === 'unresolved').length,
        unresolvedColourRoles: unique(unresolvedColour.flatMap(row => row.missing)).length,
        reachableSystemColourFallbacks: unique(systemFallbacks.flatMap(row => row.trace.filter(step => step.branch === 'fallback').map(step => step.name))).length,
        nonColourUnresolved: nonColourUnresolved.length },
      unguardedDefinitions: Object.fromEntries(UNGUARDED_BASE_NAMES.map(name => [name, Object.hasOwn(tokens, name) || Object.hasOwn(globals, name)])),
      nonColourUnresolved, unresolvedColour, systemFallbacks, evaluations });
  }
  return { version: 1, sources: sources.map(({ file, css }) => ({ file, sha256: crypto.createHash('sha256').update(css).digest('hex') })),
    definition: 'For each scope, evaluate every var-bearing declaration outside forced-colors:active. Tokens use cssVariablesByScope; local declarations use :root plus declarations with the exact rule selector. No unrelated selector is assumed to apply. Walk only selected fallback branches. Count distinct variable names whose selected fallback path reaches a literal CSS system colour. HC system colours supplied by a defined semantic token are intentional token values, not missing-token fallbacks. Unresolved colour roles count missing names in evaluated colour declarations, not optional names whose fallback resolves. Selector inheritance and pixels are separately checked in the browser.', rows };
}

export function contractFailures(report, nonColourCeiling) {
  return report.rows.flatMap(row => [
    ...row.unresolvedColour.map(item => `${row.brand}/${row.theme}: unresolved colour ${item.missing.join(', ')} at ${item.file}:${item.line} ${item.selector}`),
    ...row.systemFallbacks.map(item => `${row.brand}/${row.theme}: system-colour fallback ${item.systemFallbacks.join(', ')} at ${item.file}:${item.line} ${item.selector}: ${item.value}`),
    ...Object.entries(row.unguardedDefinitions).filter(([, defined]) => !defined).map(([name]) => `${row.brand}/${row.theme}: unguarded ${name} is undefined`),
    ...(row.counts.nonColourUnresolved > nonColourCeiling ? [`${row.brand}/${row.theme}: non-colour unresolved ${row.counts.nonColourUnresolved} exceeds ${nonColourCeiling}`] : []),
  ]);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = { observedAt: new Date().toISOString(), head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(), ...census() };
  const output = process.argv.indexOf('--output');
  if (output >= 0) fs.writeFileSync(path.resolve(process.argv[output + 1]), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report.rows.map(({ brand, theme, counts, unguardedDefinitions }) => ({ brand, theme, ...counts, unguardedDefinitions })), null, 2));
  if (process.argv.includes('--check')) {
    const failures = contractFailures(report, 14);
    if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
  }
}
