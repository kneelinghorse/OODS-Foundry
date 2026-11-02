#!/usr/bin/env node
/**
 * Directory readiness: check an MCP tools/list result against the rules the directories we submit to enforce.
 * Sources for each rule are in RULES[].source. Usage:
 *   node scripts/release/directory-readiness.mjs --json <file>            (a saved initialize/tools result or JSON-RPC envelope)
 *   node scripts/release/directory-readiness.mjs --url https://oods-foundry.com/mcp
 *   node scripts/release/directory-readiness.mjs --adapter packages/mcp-adapter/index.js [--toolset all]
 * Add --hosted for a public connector and --openai for OpenAI's plugin directory (one listing for ChatGPT and Codex).
 * With --url, --openai also checks the endpoint from outside: transport, the Origin ChatGPT sends, the domain token.
 *   node scripts/release/directory-readiness.mjs --openai-package <folder or .zip> [--url <endpoint>]
 * checks an OpenAI plugin package, its listing URLs online, and with --url that its test cases name served tools.
 * Exits 1 when any error-level rule fails.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { schemaBytes } from './schema-size.mjs';
import { spawn, execFileSync } from 'node:child_process';

export const RULES = {
  'schema-size': { level: 'warn', source: 'Codex json_schema/compaction.rs: DEFAULT_COMPACT_TOOL_SCHEMA_BYTES = 5000.' },
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
  // OpenAI's plugin directory (--openai, --openai-package). Read at the source on 2026-11-01.
  'openai-unauthenticated-write': { level: 'error', source: 'https://developers.openai.com/plugins/guides/submit-claude-plugin ("Use OAuth 2.1 when the server accesses private user data or takes actions for a user"); a hosted endpoint that answers without credentials must only read' },
  'openai-open-world': { level: 'error', source: 'https://developers.openai.com/plugins/plugin-guidelines (openWorldHint: "Use true for public or open-ended entities, including read-only web search and arbitrary destinations"); an input that takes an address can reach one' },
  'openai-transport': { level: 'error', source: 'https://developers.openai.com/plugins/guides/submit-claude-plugin ("Submit a stable, public HTTPS endpoint that uses Streamable HTTP"); https://developers.openai.com/plugins/deploy/app-review ("You are not using a local or testing endpoint")' },
  'openai-client-origin': { level: 'error', source: 'https://developers.openai.com/plugins/deploy/app-review (the common rejection: "We\'re unable to connect to your MCP server"); ChatGPT\'s connector sends Origin https://chatgpt.com, and an MCP server answers an Origin it does not allow with 403' },
  'openai-domain-challenge': { level: 'warn', source: 'https://developers.openai.com/plugins/deploy/submission#domain-verification ("host the exact challenge token as plain text at https://<challenge-base-host>/.well-known/openai-apps-challenge"); it shows a warning until the site serves the portal\'s token' },
  'openai-manifest': { level: 'error', source: 'https://developers.openai.com/plugins/deploy/submission (Package identity: name at most 64 lowercase letters, numbers and single hyphens; a semantic version; description at most 4000; author.name at most 120 and an HTTPS author.url)' },
  'openai-listing': { level: 'error', source: 'https://developers.openai.com/plugins/deploy/submission (Listing metadata: displayName and shortDescription at most 30, longDescription at most 4000, developerName at most 80, a category, at most 20 capabilities of 120, at most three unique defaultPrompt of 128 without @mentions); https://developers.openai.com/plugins/plugin-guidelines ("Do not append MCP, MCP Server, or Plugin" to the name)' },
  'openai-listing-urls': { level: 'error', source: 'https://developers.openai.com/plugins/deploy/submission ("all four listing URLs are required": websiteURL, supportURL, privacyPolicyURL, termsOfServiceURL, HTTPS without credentials; "Public URLs must be accessible")' },
  'openai-icons': { level: 'error', source: 'https://developers.openai.com/plugins/deploy/submission (Icons and screenshots: logo and composerIcon, PNG, JPEG, WebP or SVG, at most 5 MiB, square, at least 48 and at most 4096 pixels)' },
  'openai-mcp-config': { level: 'error', source: 'https://developers.openai.com/plugins/build/plugins (root mcp.json, one "streamable-http" server with its HTTPS url); https://developers.openai.com/plugins/deploy/submission ("public submission rejects nonempty server headers")' },
  'openai-forbidden': { level: 'error', source: 'https://developers.openai.com/plugins/deploy/submission ("Plugin ZIP packages containing app references (apps / .app.json) or lifecycle hooks cannot currently be submitted"; "ZIP metadata rejects test_credentials and reviewer_instructions"); https://developers.openai.com/plugins/guides/submit-claude-plugin (userConfig is not run)' },
  'openai-review-cases': { level: 'error', source: 'https://developers.openai.com/plugins/deploy/submission ("Initial MCP app review requires exactly five positive and three negative cases"; positive cases need tools_triggered and expected_behavior, naming tools the server serves)' },
  'openai-demo-recording': { level: 'warn', source: 'https://developers.openai.com/plugins/deploy/submission (review.demo_recording_url: "Optional in ZIP; required for MCP review"; it can be entered in Review details instead)' },
  'openai-skill': { level: 'error', source: 'https://developers.openai.com/plugins/build/skills (SKILL.md starts with a name and a description); https://developers.openai.com/plugins/guides/submit-claude-plugin ("Replace Claude-specific references in the skill instructions with provider-neutral language")' },
  'never-say': { level: 'error', source: 'OODS Foundry\'s submissions checklist, "What never to say": official, verified, production-ready, AI-powered' },
};

// An input that names or formats an address can reach the open web, so it needs openWorldHint true for OpenAI.
const ADDRESS_INPUT = /^(?:url|uri|href|link|endpoint|webhook|callback)$|(?:Url|Uri|URL|URI|Href|Endpoint|Webhook)$/;
function addressInputs(schema) {
  const out = [];
  const visit = (node, at) => {
    if (!isObj(node)) return;
    for (const [name, sub] of Object.entries(isObj(node.properties) ? node.properties : {})) {
      if (ADDRESS_INPUT.test(name) || ['uri', 'url', 'iri', 'uri-reference'].includes(sub?.format)) out.push(`${at}.properties.${name}`);
      visit(sub, `${at}.properties.${name}`);
    }
    for (const key of ['items', 'additionalProperties']) visit(node[key], `${at}.${key}`);
    for (const key of ['anyOf', 'oneOf', 'allOf']) if (Array.isArray(node[key])) node[key].forEach((sub, i) => visit(sub, `${at}.${key}[${i}]`));
    for (const key of ['$defs', 'definitions']) if (isObj(node[key])) for (const [name, sub] of Object.entries(node[key])) visit(sub, `${at}.${key}.${name}`);
  };
  visit(schema, 'inputSchema');
  return out;
}

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

export function checkTools(tools, { serverName = 'oods-foundry', serverInfo, instructions, hosted = false, openai = false } = {}) {
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
      if (openai && hosted && a.readOnlyHint !== true) add(name, 'openai-unauthenticated-write', 'annotations.readOnlyHint', 'a write tool on an endpoint that answers without credentials');
      if (openai && a.openWorldHint !== true) for (const at of addressInputs(tool.inputSchema)) add(name, 'openai-open-world', at, 'takes an address, so openWorldHint must be true');
    }
    if (typeof tool.description !== 'string' || tool.description.trim().length < 20) add(name, 'description', 'description', 'missing or shorter than 20 characters');
    const schema = tool.inputSchema;
    const bytes = schemaBytes(schema);
    if (bytes > 5000) add(name, 'schema-size', 'inputSchema', `${bytes} normalized UTF-8 bytes exceeds 5000`);
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

const PUBLIC_HOST = /^(?:localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|\[?::1\]?$)|\.(?:local|internal|localhost)$/i;

/** OpenAI's checks of a live endpoint, from outside: public HTTPS over Streamable HTTP with no credentials, the Origin
 * that ChatGPT and the portal send, and the domain token. */
export async function checkOpenAiEndpoint(url) {
  const findings = [];
  const add = (rule, at, detail) => findings.push({ tool: '(endpoint)', rule, level: RULES[rule].level, path: at, detail });
  const target = new URL(url);
  if (target.protocol !== 'https:') add('openai-transport', 'url', `${target.protocol} is not https:`);
  if (PUBLIC_HOST.test(target.hostname)) add('openai-transport', 'url', `${target.hostname} is not a public host`);
  const initialize = async (origin) => {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(origin ? { Origin: origin } : {}) },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'directory-readiness', version: '1' } } }), signal: AbortSignal.timeout(60000) });
    await response.arrayBuffer();
    return { status: response.status, type: response.headers.get('content-type') ?? '' };
  };
  const plain = await initialize();
  if (plain.status !== 200 || !/application\/json|text\/event-stream/.test(plain.type)) add('openai-transport', 'initialize', `POST answered ${plain.status} ${plain.type || 'with no content type'} without credentials`);
  for (const origin of ['https://chatgpt.com', 'https://platform.openai.com']) {
    const { status } = await initialize(origin);
    if (status !== 200) add('openai-client-origin', `Origin: ${origin}`, `initialize answered ${status}`);
  }
  const challenge = await fetch(new URL('/.well-known/openai-apps-challenge', target.origin), { signal: AbortSignal.timeout(30000) });
  const token = (await challenge.text()).trim();
  if (challenge.status !== 200 || !token || /\s|^[{[]/.test(token)) add('openai-domain-challenge', '/.well-known/openai-apps-challenge', `answered ${challenge.status}${challenge.status === 200 ? ' without one plain-text token' : ''}`);
  return findings;
}

const NEVER_SAY = /\bofficial\b|\bverified\b|production[- ]ready|\bAI[- ]powered\b/i;
const PROVIDER = /\bClaude\b|claude\.ai|CLAUDE\.md|\bAnthropic\b/;

/** Check an OpenAI plugin package, a folder or a ZIP: manifest, listing, icons, MCP configuration, review cases and
 * skills, and (online) that its listing URLs answer. tools: the names the endpoint serves, to match the test cases against. */
export async function checkOpenAiPackage(input, { tools, url, online = true } = {}) {
  let dir = input;
  if (input.endsWith('.zip')) { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openai-package-')); execFileSync('unzip', ['-q', input, '-d', dir]); }
  const findings = [];
  const add = (rule, at, detail) => findings.push({ tool: '(package)', rule, level: RULES[rule].level, path: at, detail });
  const files = [];
  const collect = (rel) => { for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) { const member = path.posix.join(rel, entry.name); if (entry.isDirectory()) collect(member); else files.push(member); } };
  collect('');
  const json = (rel) => { try { return JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8')); } catch { return undefined; } };
  const manifest = json('plugin.json');
  if (!isObj(manifest)) { add('openai-manifest', 'plugin.json', 'missing at the package root, or not JSON'); return findings; }
  const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
  if (manifest.$schema !== 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json') add('openai-manifest', '$schema', 'not the Agent Plugins 1.0.0 schema');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.name ?? '') || manifest.name.length > 64) add('openai-manifest', 'name', 'not lowercase letters, numbers and single hyphens within 64');
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version ?? '')) add('openai-manifest', 'version', 'not a semantic version');
  if (!text(manifest.description, 4000)) add('openai-manifest', 'description', 'missing or over 4000 characters');
  if (manifest.author !== undefined && (!text(manifest.author.name, 120) || (manifest.author.url !== undefined && !/^https:\/\//.test(manifest.author.url)))) add('openai-manifest', 'author', 'needs a name within 120 and an HTTPS url');
  const openai = manifest.extensions?.['com.openai'] ?? {};
  const ui = openai.interface ?? {};
  for (const [field, max] of [['displayName', 30], ['shortDescription', 30], ['longDescription', 4000], ['developerName', 80], ['category', 120]]) if (!text(ui[field], max)) add('openai-listing', `interface.${field}`, `missing or over ${max} characters`);
  if (/\b(?:MCP(?: Server)?|Plugin)\s*$/i.test(ui.displayName ?? '')) add('openai-listing', 'interface.displayName', 'ends with MCP, MCP Server or Plugin');
  if (ui.capabilities !== undefined && (!Array.isArray(ui.capabilities) || ui.capabilities.length > 20 || ui.capabilities.some((entry) => !text(entry, 120)))) add('openai-listing', 'interface.capabilities', 'at most 20 labels of 120 characters');
  const prompts = [].concat(ui.defaultPrompt ?? []);
  if (prompts.length > 3 || new Set(prompts).size !== prompts.length || prompts.some((prompt) => !text(prompt, 128) || prompt.includes('@'))) add('openai-listing', 'interface.defaultPrompt', 'at most three unique prompts of 128 characters, without @mentions');
  const listingUrls = ['websiteURL', 'supportURL', 'privacyPolicyURL', 'termsOfServiceURL'];
  for (const field of listingUrls) {
    let link;
    try { link = new URL(ui[field]); } catch { add('openai-listing-urls', `interface.${field}`, 'missing'); continue; }
    if (link.protocol !== 'https:' || link.username || link.password || ui[field].length > 1024) { add('openai-listing-urls', `interface.${field}`, 'not an HTTPS URL without credentials within 1024'); continue; }
    if (!online) continue;
    const response = await fetch(link, { redirect: 'follow', signal: AbortSignal.timeout(30000) }).catch((error) => ({ status: error.message }));
    if (response.status !== 200) add('openai-listing-urls', `interface.${field}`, `${ui[field]} answered ${response.status}`);
    await response.arrayBuffer?.();
  }
  for (const field of ['logo', 'composerIcon']) {
    const icon = ui[field];
    const file = typeof icon === 'string' && icon.startsWith('./') ? path.join(dir, icon.slice(2)) : undefined;
    if (!file || !fs.existsSync(file)) { add('openai-icons', `interface.${field}`, 'missing, or not a ./ path to a file in the package'); continue; }
    const bytes = fs.readFileSync(file);
    if (!/\.(?:png|jpe?g|webp|svg)$/i.test(file) || bytes.length > 5 * 1024 * 1024) add('openai-icons', `interface.${field}`, 'not a PNG, JPEG, WebP or SVG within 5 MiB');
    else if (/\.png$/i.test(file)) {
      const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
      if (width !== height || width < 48 || width > 4096) add('openai-icons', `interface.${field}`, `${width}x${height} is not square within 48 to 4096 pixels`);
    }
  }
  const mcp = json('mcp.json');
  const servers = Object.entries(isObj(mcp?.mcpServers) ? mcp.mcpServers : {});
  if (mcp?.$schema !== 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json' || servers.length !== 1) add('openai-mcp-config', 'mcp.json', 'needs the Agent Plugins MCP schema and exactly one server');
  for (const [name, server] of servers) {
    if (server.type !== 'streamable-http' || !/^https:\/\//.test(server.url ?? '')) add('openai-mcp-config', `mcpServers.${name}`, 'not a streamable-http server with an HTTPS url');
    if (url && server.url !== url) add('openai-mcp-config', `mcpServers.${name}.url`, `${server.url} is not the checked endpoint ${url}`);
    if (isObj(server.headers) && Object.keys(server.headers).length) add('openai-forbidden', `mcpServers.${name}.headers`, 'nonempty server headers');
  }
  for (const member of files) if (/(?:^|\/)hooks(?:\/|\.json$)|\.app\.json$/.test(member)) add('openai-forbidden', member, 'lifecycle hooks or app references');
  if (openai.hooks !== undefined || openai.apps !== undefined) add('openai-forbidden', 'extensions.com.openai', 'declares hooks or apps');
  const raw = fs.readFileSync(path.join(dir, 'plugin.json'), 'utf8');
  for (const key of ['test_credentials', 'reviewer_instructions', 'userConfig']) if (raw.includes(`"${key}"`)) add('openai-forbidden', 'plugin.json', `declares ${key}`);
  const cases = openai.review?.test_cases ?? {};
  const positive = cases.positive ?? [], negative = cases.negative ?? [];
  if (positive.length !== 5 || negative.length !== 3) add('openai-review-cases', 'review.test_cases', `${positive.length} positive and ${negative.length} negative`);
  positive.forEach((entry, i) => {
    if (!['description', 'prompt', 'tools_triggered', 'expected_behavior'].every((field) => text(entry?.[field], 4000))) add('openai-review-cases', `review.test_cases.positive[${i}]`, 'needs description, prompt, tools_triggered and expected_behavior');
    for (const tool of String(entry?.tools_triggered ?? '').split(/[\s,]+/).filter(Boolean)) if (tools && !tools.includes(tool)) add('openai-review-cases', `review.test_cases.positive[${i}].tools_triggered`, `${tool} is not served`);
  });
  negative.forEach((entry, i) => { if (!text(entry?.description, 4000) || !text(entry?.prompt, 4000)) add('openai-review-cases', `review.test_cases.negative[${i}]`, 'needs description and prompt'); });
  if (!openai.review?.demo_recording_url) add('openai-demo-recording', 'review.demo_recording_url', 'not in the package yet');
  const skills = files.filter((member) => /^skills\/[^/]+\/SKILL\.md$/.test(member));
  for (const member of skills) {
    const front = fs.readFileSync(path.join(dir, member), 'utf8').match(/^---\n([\s\S]*?)\n---\n/);
    if (!front || !/^name:\s*\S/m.test(front[1]) || !/^description:\s*\S/m.test(front[1])) add('openai-skill', member, 'needs a name and a description in its front matter');
  }
  for (const member of files.filter((name) => /\.(?:json|md|ya?ml|txt)$/i.test(name))) {
    const content = fs.readFileSync(path.join(dir, member), 'utf8');
    if (member.startsWith('skills/') && PROVIDER.test(content)) add('openai-skill', member, `refers to "${content.match(PROVIDER)[0]}"`);
    if (NEVER_SAY.test(content)) add('never-say', member, `"${content.match(NEVER_SAY)[0]}"`);
  }
  return findings;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const args = process.argv.slice(2);
  const get = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const source = get('--json') ? unwrap(JSON.parse(fs.readFileSync(get('--json'), 'utf8')))
    : get('--url') ? await fromUrl(get('--url'))
    : get('--adapter') ? await fromAdapter(get('--adapter'), get('--toolset')) : null;
  if (!source && !get('--openai-package')) { console.error('Pass --json <file>, --url <endpoint>, --adapter <path> or --openai-package <folder or .zip>'); process.exit(2); }
  const openai = args.includes('--openai') || Boolean(get('--openai-package'));
  const findings = source ? checkTools(source.tools, { serverInfo: source.serverInfo, instructions: source.instructions, hosted: args.includes('--hosted'), openai }) : [];
  if (openai && get('--url')) findings.push(...await checkOpenAiEndpoint(get('--url')));
  if (get('--openai-package')) findings.push(...await checkOpenAiPackage(get('--openai-package'), { tools: source?.tools.map((tool) => tool.name), url: get('--url') }));
  const errors = findings.filter((f) => f.level === 'error');
  const byRule = {}; for (const f of findings) byRule[f.rule] = (byRule[f.rule] ?? 0) + 1;
  const report = { tools: source?.tools.length ?? 0, errors: errors.length, warnings: findings.length - errors.length, byRule, findings };
  if (get('--out')) fs.writeFileSync(get('--out'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ tools: report.tools, errors: report.errors, warnings: report.warnings, byRule }));
  process.exitCode = errors.length ? 1 : 0;
}
