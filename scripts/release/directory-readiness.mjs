#!/usr/bin/env node
/**
 * Directory readiness: check an MCP tools/list result against the rules the directories we submit to enforce.
 * Sources for each rule are in RULES[].source. Usage:
 *   node scripts/release/directory-readiness.mjs --json <file>            (a saved initialize/tools result or JSON-RPC envelope)
 *   node scripts/release/directory-readiness.mjs --url https://oods-foundry.com/mcp
 *   node scripts/release/directory-readiness.mjs --adapter packages/mcp-adapter/index.js [--toolset all]
 * Exits 1 when any error-level rule fails.
 */
import fs from 'node:fs';
import { schemaBytes } from './schema-size.mjs';
import { spawn } from 'node:child_process';

export const RULES = {
  'schema-size': { level: 'warn', source: 'Codex json_schema/compaction.rs: DEFAULT_COMPACT_TOOL_SCHEMA_BYTES = 5000; viz_render is the documented exception.' },
  'tool-name': { level: 'error', source: 'https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use (name ^[a-zA-Z0-9_-]{1,64}$)' },
  'tool-name-prefixed': { level: 'error', source: 'Claude Code exposes MCP tools as mcp__<server>__<tool>; the API name limit (64) applies to the prefixed name' },
  'title': { level: 'error', source: 'https://modelcontextprotocol.io/specification/2025-06-18/server/tools (Tool.title)' },
  'annotations-title': { level: 'error', source: 'Anthropic connector portal: "Missing title annotation. Add annotations.title"; https://claude.com/docs/connectors/building/submission' },
  'annotations-hints': { level: 'error', source: 'https://claude.com/docs/connectors/building/submission ("Every tool has a title and a readOnlyHint or destructiveHint annotation")' },
  'hint-consistency': { level: 'error', source: 'MCP ToolAnnotations: destructiveHint and idempotentHint are meaningful only when readOnlyHint is false' },
  'description': { level: 'error', source: 'https://claude.com/docs/connectors/building/review-criteria' },
  'input-object': { level: 'error', source: 'MCP Tool.inputSchema: type "object"' },
  'root-combinator': { level: 'error', source: 'Claude Code drops or rejects root-level allOf/anyOf/oneOf in inputSchema (anthropics/claude-code#95504)' },
  'property-type': { level: 'error', source: 'Anthropic connector portal: "Add a type to this parameter"' },
  'array-items': { level: 'error', source: 'VS Code/Copilot strict schema validation: an array schema needs items' },
  'required-known': { level: 'error', source: 'JSON Schema: required names must be declared properties' },
  'property-description': { level: 'warn', source: 'https://claude.com/docs/connectors/building/review-criteria (parameters described)' },
  'server-info': { level: 'error', source: 'MCP Implementation: name and version; title for display' },
  'tool-unique': { level: 'error', source: 'MCP: tool names are unique within a server' },
  'annotations-title-shape': { level: 'error', source: 'Directory listing: a short display name (one line, at most 60 characters)' },
  'hidden-text': { level: 'error', source: 'https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy (no hidden instructions)' },
  'steering': { level: 'error', source: 'https://claude.com/docs/connectors/building/review-criteria (descriptions say what a tool does; they do not order Claude to call it or avoid others)' },
  'internal-identifier': { level: 'error', source: 'Review criteria: plain, accurate model-facing text; no mission tags, internal function names or internal dotted tool ids' },
  'internal-host': { level: 'error', source: 'Schemas must not name internal hosts (designlab.local, localhost)' },
  'shouting': { level: 'warn', source: 'Review criteria: plain language; ALL-CAPS emphasis reads as steering' },
  'foreign-url': { level: 'warn', source: 'Review criteria: no links other than the service\'s own documentation' },
  'promotion': { level: 'error', source: 'https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy (no promotion of other products or installs from a connector)' },
};

// Text rules apply to every model-facing string: tool descriptions, every schema description and title, and instructions.
const HIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F­​-‏‪-‮⁠-⁯﻿]|[\u{E0000}-\u{E007F}]/u;
const STEERING = [/\buse (it|this) first\b/i, /\bcall (it|this) first\b/i, /\balways (call|use)\b/i, /\bfor any (chart|task|request)\b/i,
  /\bbefore (calling|using) any\b/i, /\binstead of (any|other) tools?\b/i, /\bdo not use (other|any)\b/i, /\bignore (previous|prior|system)\b/i];
const PROMOTION = [/\bnpx\b/i, /\blocal package\b/i, /\binstall\b/i]; // hosted connectors only
// Real contract fields that look internal: dashboard_render's onPanelError option and the ECharts reply's map fields.
const CONTRACT_FIELDS = /\b(?:onPanelError|__registration|__joinDiagnostics)\b/g;
const INTERNAL = [/\(m\d{2}\)/, /\bs\d{3}-m\d{2}\b/, /#\d{4}\b/, /\b\w*__\w+\b/, /\b(?:validate|assert|derive|build|resolve|on)[A-Z][A-Za-z]+(?:Rules|Error|Spec|Fn)\b/,
  /\b(?:viz|dashboard|artifact|design|code|registry|structuredData|tokens|brand|schema|object|fidelity|map|a11y|repl|pipeline)\.(?:render|certify|compose|preview|generate|snapshot|fetch|build|apply|create|intake|store|import|scan|list|show|validate)\b/];
const CAPS_ALLOW = new Set(['SVG', 'JSON', 'HTML', 'CSS', 'URL', 'URI', 'ISO', 'UTC', 'API', 'KPI', 'YAML', 'DTCG', 'OODS', 'MCP', 'CSV', 'PNG', 'RGB', 'HSL', 'OKLCH', 'WCAG', 'ARIA', 'DOM', 'SQL', 'GBP', 'USD', 'EUR', 'ETAG', 'UUID', 'ID', 'IDS', 'RFC', 'HTTP', 'HTTPS', 'NPM', 'APCA', 'CLI', 'SSR', 'UI', 'UX', 'TSX', 'JSX', 'SFC', 'AA', 'AAA', 'OK', 'SHA', 'POSIX', 'UTF', 'DSL', 'CTA', 'XML', 'SDL', 'TTL', 'DDL', 'ACME', 'FAOSTAT', 'ESM', 'CVD', 'YYYY', 'URN', 'GIS', 'BCP', 'IETF', 'GUID', 'CMYK', 'EOF', 'CRLF', 'CJK']);

function texts(tool) {
  const out = [{ at: 'description', text: tool.description ?? '' }];
  const visit = (node, at) => {
    if (Array.isArray(node)) return node.forEach((child, i) => visit(child, `${at}[${i}]`));
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if ((key === 'description' || key === 'title') && typeof value === 'string') out.push({ at: `${at}.${key}`, text: value });
      else if (key === '$id' && typeof value === 'string') out.push({ at: `${at}.$id`, text: value, id: true });
      else if (typeof value === 'object') visit(value, `${at}.${key}`);
    }
  };
  visit(tool.inputSchema, 'inputSchema');
  if (tool.outputSchema) visit(tool.outputSchema, 'outputSchema');
  return out;
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Walk every subschema reachable through properties/items/combinators and report missing types. */
function walk(schema, path, out, { property = false } = {}) {
  if (!isObj(schema)) return;
  if (property) {
    const typed = schema.type !== undefined;
    const combos = ['anyOf', 'oneOf', 'allOf'].filter((k) => Array.isArray(schema[k]));
    if (!typed && !schema.$ref) out.push({ rule: 'property-type', path, detail: combos.length ? `no type (uses ${combos.join(', ')})` : (schema.enum ? 'enum without type' : 'no type') });
    if (!schema.description) out.push({ rule: 'property-description', path, detail: 'no description' });
  }
  const types = [].concat(schema.type ?? []);
  if (types.includes('array') && schema.items === undefined && schema.prefixItems === undefined) out.push({ rule: 'array-items', path, detail: 'array without items' });
  if (isObj(schema.properties)) {
    for (const [name, sub] of Object.entries(schema.properties)) walk(sub, `${path}.properties.${name}`, out, { property: true });
    for (const name of [].concat(schema.required ?? [])) if (!(name in schema.properties)) out.push({ rule: 'required-known', path: `${path}.required`, detail: `"${name}" is not a property` });
  }
  if (isObj(schema.items)) walk(schema.items, `${path}.items`, out, { property: true });
  if (isObj(schema.additionalProperties)) walk(schema.additionalProperties, `${path}.additionalProperties`, out, { property: true });
  for (const key of ['anyOf', 'oneOf', 'allOf']) if (Array.isArray(schema[key])) schema[key].forEach((sub, i) => walk(sub, `${path}.${key}[${i}]`, out));
  for (const key of ['$defs', 'definitions']) if (isObj(schema[key])) for (const [name, sub] of Object.entries(schema[key])) walk(sub, `${path}.${key}.${name}`, out);
}

export function checkTools(tools, { serverName = 'oods-foundry', serverInfo, instructions, hosted = false } = {}) {
  const findings = [];
  const add = (tool, rule, path, detail) => findings.push({ tool, rule, level: RULES[rule].level, path, detail });
  if (serverInfo !== undefined) {
    for (const key of ['name', 'version', 'title']) if (!serverInfo?.[key]) add('(server)', 'server-info', `serverInfo.${key}`, 'missing');
  }
  const seen = new Set();
  const checkText = (owner, at, text, { id = false } = {}) => {
    if (id) { if (/\.local\b|localhost/i.test(text)) add(owner, 'internal-host', at, text); return; }
    if (HIDDEN.test(text)) add(owner, 'hidden-text', at, 'invisible or control character');
    for (const pattern of STEERING) if (pattern.test(text)) add(owner, 'steering', at, `"${text.match(pattern)[0]}"`);
    if (hosted) for (const pattern of PROMOTION) if (pattern.test(text)) add(owner, 'promotion', at, `"${text.match(pattern)[0]}"`);
    const plain = text.replace(CONTRACT_FIELDS, '');
    for (const pattern of INTERNAL) if (pattern.test(plain)) add(owner, 'internal-identifier', at, `"${plain.match(pattern)[0]}"`);
    if (/\.local\b|localhost/i.test(text)) add(owner, 'internal-host', at, `"${text.match(/\S*(?:\.local\b|localhost)\S*/i)[0]}"`);
    const caps = (text.match(/\b[A-Z]{3,}\b/g) ?? []).filter((word) => !CAPS_ALLOW.has(word) && !/^OODS-/.test(word));
    if (caps.length) add(owner, 'shouting', at, [...new Set(caps)].slice(0, 6).join(', '));
    for (const url of text.match(/https?:\/\/[^\s)"'`]+/g) ?? []) if (!/^https:\/\/(?:[\w-]+\.)?oods-foundry\.com\b/.test(url)) add(owner, 'foreign-url', at, url);
  };
  if (typeof instructions === 'string') checkText('(server)', 'instructions', instructions);
  for (const tool of tools) {
    const name = tool.name ?? '(unnamed)';
    if (seen.has(name)) add(name, 'tool-unique', 'name', 'duplicate tool name');
    seen.add(name);
    if (typeof tool.annotations?.title === 'string' && (tool.annotations.title.length > 60 || /\n/.test(tool.annotations.title))) add(name, 'annotations-title-shape', 'annotations.title', 'longer than 60 characters or multi-line');
    for (const entry of texts(tool)) checkText(name, entry.at, entry.text, { id: entry.id });
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(name)) add(name, 'tool-name', 'name', 'must match ^[a-zA-Z0-9_-]{1,64}$');
    if (`mcp__${serverName}__${name}`.length > 64) add(name, 'tool-name-prefixed', 'name', `mcp__${serverName}__${name} is longer than 64`);
    if (typeof tool.title !== 'string' || !tool.title.trim()) add(name, 'title', 'title', 'missing');
    const a = tool.annotations;
    if (!isObj(a)) add(name, 'annotations-hints', 'annotations', 'missing');
    else {
      if (typeof a.title !== 'string' || !a.title.trim()) add(name, 'annotations-title', 'annotations.title', 'missing');
      else if (tool.title && a.title !== tool.title) add(name, 'annotations-title', 'annotations.title', `"${a.title}" differs from title "${tool.title}"`);
      for (const hint of ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint']) if (typeof a[hint] !== 'boolean') add(name, 'annotations-hints', `annotations.${hint}`, 'missing or not boolean');
      if (a.readOnlyHint === true && a.destructiveHint === true) add(name, 'hint-consistency', 'annotations', 'readOnlyHint and destructiveHint are both true');
    }
    if (typeof tool.description !== 'string' || tool.description.trim().length < 20) add(name, 'description', 'description', 'missing or shorter than 20 characters');
    const schema = tool.inputSchema;
    const bytes = schemaBytes(schema);
    if (bytes > 5000) add(name, 'schema-size', 'inputSchema', `${bytes} normalized UTF-8 bytes exceeds 5000${name === 'viz_render' ? '; known exception preserves chart parameter descriptions' : ''}`);
    if (!isObj(schema) || schema.type !== 'object') add(name, 'input-object', 'inputSchema.type', `is ${JSON.stringify(schema?.type)}`);
    else {
      for (const key of ['allOf', 'anyOf', 'oneOf', 'not']) if (schema[key] !== undefined) add(name, 'root-combinator', `inputSchema.${key}`, 'root-level combinator');
      const out = []; walk(schema, 'inputSchema', out);
      for (const f of out) add(name, f.rule, f.path, f.detail);
    }
  }
  return findings;
}

function unwrap(value) {
  // Accept {tools}, {result:{tools}}, {initialize, tools}, or an SSE "data: " line already stripped.
  const result = value.result ?? value;
  return { tools: result.tools ?? value.tools ?? [], serverInfo: value.initialize?.serverInfo ?? value.serverInfo, instructions: value.initialize?.instructions };
}

export async function fromUrl(url) {
  const post = async (body) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
    const text = await r.text();
    return JSON.parse(text.replace(/^data: /m, '').split('\n').find((l) => l.trim().startsWith('{')) ?? text);
  };
  const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'directory-readiness', version: '1' } } });
  const list = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  return { tools: list.result.tools, serverInfo: init.result.serverInfo, instructions: init.result.instructions };
}

export function fromAdapter(adapterPath, toolset) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env }; for (const k of Object.keys(env)) if (/^(OODS|MCP|FORGE)_/.test(k)) delete env[k];
    if (toolset) env.MCP_TOOLSET = toolset;
    const child = spawn(process.execPath, [adapterPath], { stdio: ['pipe', 'pipe', 'ignore'], env });
    let buf = ''; let serverInfo; let instructions;
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('adapter did not answer within 120 s')); }, 120000);
    child.stdout.on('data', (c) => { buf += c; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); let m; try { m = JSON.parse(line); } catch { continue; }
      if (m.id === 1) { serverInfo = m.result.serverInfo; instructions = m.result.instructions; child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n'); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n'); }
      else if (m.id === 2) { clearTimeout(timer); child.kill(); resolve({ tools: m.result.tools, serverInfo, instructions }); } } });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'directory-readiness', version: '1' } } }) + '\n');
  });
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const args = process.argv.slice(2);
  const get = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const source = get('--json') ? unwrap(JSON.parse(fs.readFileSync(get('--json'), 'utf8')))
    : get('--url') ? await fromUrl(get('--url'))
    : get('--adapter') ? await fromAdapter(get('--adapter'), get('--toolset')) : null;
  if (!source) { console.error('Pass --json <file>, --url <endpoint> or --adapter <path>'); process.exit(2); }
  const findings = checkTools(source.tools, { serverInfo: source.serverInfo, instructions: source.instructions, hosted: args.includes('--hosted') });
  const errors = findings.filter((f) => f.level === 'error');
  const byRule = {}; for (const f of findings) byRule[f.rule] = (byRule[f.rule] ?? 0) + 1;
  const report = { tools: source.tools.length, errors: errors.length, warnings: findings.length - errors.length, byRule, findings };
  if (get('--out')) fs.writeFileSync(get('--out'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ tools: report.tools, errors: report.errors, warnings: report.warnings, byRule }));
  process.exitCode = errors.length ? 1 : 0;
}
