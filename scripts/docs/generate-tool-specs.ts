#!/usr/bin/env tsx
/** Generate the operator contract from the schemas selected by the live dispatcher. */
import fs from 'node:fs';
// @ts-expect-error -- shared naming table is native ESM.
import { advertisedName, toolReferences } from '../runtime/tool-names.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '../..');
export const TOOL_SPECS_PATH = 'docs/mcp/Tool-Specs.md';
const REGISTRY = 'packages/mcp-server/src/tools/registry.json';
const DISPATCH = 'packages/mcp-server/src/index.ts';
const LEDGER = 'packages/mcp-server/registry/tool-capability-ledger.v1.json';
const COMPONENTS = 'packages/component-contracts/registry/component-capability-ledger.v1.json';

export type Schema = {
  [keyword: string]: unknown;
  $ref?: string;
  title?: string;
  description?: string;
  type?: string | string[];
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  allOf?: Schema[];
  anyOf?: Schema[];
  oneOf?: Schema[];
  if?: Schema;
  then?: Schema;
  else?: Schema;
};
type ToolSchema = { input: string; output: string };
type Limit = { id: string; source: 'e2e' | 'limits-probe'; code?: string; retryable?: boolean; blocker: string; transportOutcome?: string; receipt: { path: string } };
type CertifiedReceipt = { path: string; kind: string; certifiedBy: number; sprint: number; node: string; outcome: string };
type LedgerRow = {
  name: string;
  registration: string;
  testImportLocation: string;
  certifiedReceipts: CertifiedReceipt[];
  portableOutcome?: { outcome: string; code?: string; receiptSha256: string };
  portableLimits: Limit[];
  caveats: Array<{ kind: string; reason: string; file: string; line: number; observed?: { probes: string[] } }>;
};
export type ToolSpecSources = {
  registry: { auto: string[]; onDemand: string[] };
  dispatch: Record<string, ToolSchema>;
  schemas: Record<string, Schema>;
  descriptions: Record<string, string>;
  references: Record<string, string>;
  ledger: {
    head: string;
    methodology: { testImportLocation: string; certifiedReceipts: string; caveats: string };
    portableExecution: { path: string; sha256: string; bundleHead: string; dirty: boolean; tools: number; pass: number; typed: number };
    limitsProbe?: { path: string; sha256: string; bundleHead: string; archiveSha256: string; probes: number };
    rows: LedgerRow[];
    retired: Array<{ name: string; reason: string; decisionIds: number[] }>;
  };
  components: { controllingObligationDenominator: number; approvedRuntimeCensus: unknown; rows: Array<{ id: string; surfaces: Record<string, { state: string }> }> };
  policies: Array<{ tool: string; allow: string[]; readOnly?: boolean; writes?: string[]; timeoutMs: number; ratePerMinute: number; concurrency: number }>;
  notes: Record<string, string>;
};

/** Read literal mappings without importing index.ts, which starts the MCP server. */
export function parseDispatchSchemas(source: string): Record<string, ToolSchema> {
  const file = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
  const result: Record<string, ToolSchema> = {};
  const nameOf = (node: ts.PropertyName): string => {
    if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
    throw new Error('Nonliteral dispatcher property cannot be documented');
  };
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'toolSpecs') continue;
      if (!declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) throw new Error('toolSpecs must be a literal object');
      for (const property of declaration.initializer.properties) {
        if (!ts.isPropertyAssignment(property) || !ts.isObjectLiteralExpression(property.initializer)) throw new Error('Nonliteral tool mapping');
        const values: Record<string, string> = {};
        for (const field of property.initializer.properties) {
          if (!ts.isPropertyAssignment(field) || !ts.isStringLiteral(field.initializer)) throw new Error('Nonliteral schema mapping');
          values[nameOf(field.name)] = field.initializer.text;
        }
        if (!values.inputSchema || !values.outputSchema) throw new Error('Missing dispatch schema pair');
        const tool = nameOf(property.name);
        if (result[tool]) throw new Error(`Duplicate dispatcher tool: ${tool}`);
        result[tool] = {
          input: path.posix.join('packages/mcp-server/src', values.inputSchema),
          output: path.posix.join('packages/mcp-server/src', values.outputSchema),
        };
      }
    }
  }
  if (!Object.keys(result).length) throw new Error('Missing toolSpecs dispatcher mapping');
  return result;
}

export function loadToolSpecSources(root = ROOT): ToolSpecSources {
  const read = <T>(relative: string): T => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8')) as T;
  const registry = read<ToolSpecSources['registry']>(REGISTRY);
  const dispatch = parseDispatchSchemas(fs.readFileSync(path.join(root, DISPATCH), 'utf8'));
  const schemas: Record<string, Schema> = {};
  // Local $refs can point to a different schema. Load the actual schema directory,
  // while the dispatcher alone selects each tool's root input and output schema.
  const directory = 'packages/mcp-server/src/schemas';
  for (const file of fs.readdirSync(path.join(root, directory)).filter(name => name.endsWith('.json')).sort()) {
    schemas[`${directory}/${file}`] = read<Schema>(`${directory}/${file}`);
  }
  const notes: Record<string, string> = {};
  const notesDirectory = path.join(root, 'docs/mcp/tool-notes');
  if (fs.existsSync(notesDirectory)) {
    for (const file of fs.readdirSync(notesDirectory).filter(name => name.endsWith('.md')).sort()) {
      const tool = file.slice(0, -3);
      if (![...registry.auto, ...registry.onDemand].includes(tool)) throw new Error(`Orphan tool note: ${file}`);
      notes[tool] = fs.readFileSync(path.join(notesDirectory, file), 'utf8').trim();
      if (/^### /m.test(notes[tool])) throw new Error(`Tool notes cannot add tool headings: ${file}`);
    }
  }
  return {
    registry, dispatch, schemas, notes,
    descriptions: read('packages/mcp-adapter/tool-descriptions.json'),
    references: toolReferences(root),
    ledger: read(LEDGER), components: read(COMPONENTS),
    policies: read<{ rules: ToolSpecSources['policies'] }>('packages/mcp-server/src/security/policy.json').rules,
  };
}

const cell = (value: string): string => value.replaceAll('|', '\\|').replace(/\r?\n/g, '<br>');
const json = (value: unknown): string => `\`${cell(JSON.stringify(value))}\``;
const link = (file: string): string => `[${file}](../../${file})`;
function typeOf(schema: Schema): string {
  if (schema.const !== undefined) return json(schema.const);
  if (Array.isArray(schema.enum)) return schema.enum.map(json).join(' or ');
  if (schema.$ref) return `ref ${json(schema.$ref)}`;
  if (schema.oneOf || schema.anyOf) return (schema.oneOf ?? schema.anyOf)!.map(typeOf).join(' or ');
  if (schema.type === 'array') return `array of ${schema.items ? typeOf(schema.items) : 'any'}`;
  return Array.isArray(schema.type) ? schema.type.join(' or ') : schema.type ?? 'any';
}

/** Render root/branch properties; never turn oneOf/anyOf requirements into unconditional ones. */
export function renderSchema(schema: Schema, file: string, sources: ToolSpecSources['schemas'], label: string, inheritedRequired: string[] = [], stack: string[] = []): string {
  const lines: string[] = [];
  if (schema.$ref) {
    const [relative, pointer = ''] = schema.$ref.split('#');
    const targetFile = relative ? path.posix.normalize(path.posix.join(path.posix.dirname(file), relative)) : file;
    const identity = `${targetFile}#${pointer}`;
    if (stack.includes(identity)) return `Reference: ${link(targetFile)} (${json(pointer)}; recursive).\n`;
    let target: unknown = sources[targetFile];
    for (const part of pointer.split('/').slice(1)) target = (target as Record<string, unknown>)?.[part.replaceAll('~1', '/').replaceAll('~0', '~')];
    if (!target || typeof target !== 'object') throw new Error(`Unresolved schema reference: ${identity}`);
    return `Reference: ${link(targetFile)} (${json(pointer)}).\n\n${renderSchema(target as Schema, targetFile, sources, label, inheritedRequired, [...stack, identity])}`;
  }
  if (schema.description) lines.push(schema.description, '');
  const required = new Set([...inheritedRequired, ...(schema.required ?? [])]);
  if (Object.keys(schema.properties ?? {}).length) {
    lines.push('| Parameter / field | Type | Required in this branch | Default | Description / constraints |', '|---|---|---|---|---|');
    for (const [name, property] of Object.entries(schema.properties!)) {
      const constraints = Object.entries(property).filter(([key]) => ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'minLength', 'maxLength', 'pattern', 'format', 'minItems', 'maxItems', 'uniqueItems', 'additionalProperties'].includes(key));
      const details = [property.description ? cell(property.description) : '', ...constraints.map(([key, value]) => `${key}: ${json(value)}`)].filter(Boolean).join('; ');
      lines.push(`| \`${cell(name)}\` | ${typeOf(property)} | ${required.has(name) ? 'Yes' : 'No'} | ${property.default === undefined ? '—' : json(property.default)} | ${details || '—'} |`);
    }
    lines.push('');
  } else if (schema.type === 'array' && schema.items) {
    lines.push('This response is a bare array. Item fields:', '', renderSchema(schema.items, file, sources, `${label} item`, [], stack));
  } else if (!schema.allOf && !schema.anyOf && !schema.oneOf && !schema.if) {
    lines.push(schema.type === 'object' ? 'No properties declared in this branch.' : `Shape: ${typeOf(schema)}.`, '');
  }
  if (schema.required?.length) lines.push(`Required keys in this branch: ${schema.required.map(json).join(', ')}.`, '');
  if (schema.additionalProperties !== undefined) lines.push(`Additional properties: ${json(schema.additionalProperties)}.`, '');
  if (schema.not) lines.push(`Must not match: ${json(schema.not)}.`, '');
  if (schema.if) {
    const action = schema.if.properties?.action?.const;
    lines.push(`##### ${label}${action === undefined ? ' condition' : ` action: ${json(action)}`}`, '', `If ${json(schema.if)}:`, '');
    if (schema.then) lines.push(renderSchema(schema.then, file, sources, `${label} then`, [...required], stack));
    if (schema.else) lines.push('Otherwise:', '', renderSchema(schema.else, file, sources, `${label} else`, [...required], stack));
  }
  for (const keyword of ['allOf', 'anyOf', 'oneOf'] as const) {
    const variants = schema[keyword];
    if (!variants?.length) continue;
    lines.push(`${keyword}: ${keyword === 'allOf' ? 'all branches must match' : keyword === 'anyOf' ? 'at least one branch must match' : 'exactly one branch must match'}.`, '');
    variants.forEach((branch, index) => {
      const branchLabel = `${label} ${keyword}[${index}]`;
      if (!branch.if) lines.push(`##### ${branchLabel}${branch.title ? ` — ${branch.title}` : ''}`, '');
      lines.push(renderSchema(branch, file, sources, branchLabel, [...required], stack));
    });
  }
  return lines.join('\n');
}

export function renderRetiredTools(retired: ToolSpecSources['ledger']['retired']): string {
  return ['| Tool | Reason | Decision IDs |', '|---|---|---|',
    ...retired.map(row => `| ${json(row.name)} | ${cell(row.reason.replace(/ in Sprint \d+\./g, '.'))} | ${row.decisionIds.join(', ')} |`),
  ].join('\n');
}

export function renderToolSpecs(sources: ToolSpecSources): string {
  const { registry, ledger, components } = sources;
  const names = [...registry.auto, ...registry.onDemand];
  if (new Set(names).size !== names.length) throw new Error('Duplicate registry tool');
  if (names.some(name => !sources.dispatch[name]) || Object.keys(sources.dispatch).some(name => !names.includes(name))) throw new Error('Dispatcher/registry tool mismatch');
  if (ledger.rows.length !== names.length || names.some(name => ledger.rows.filter(row => row.name === name).length !== 1)) throw new Error('Ledger/registry tool mismatch');
  const rootParameters = names.reduce((total, name) => total + Object.keys(sources.schemas[sources.dispatch[name].input]?.properties ?? {}).length, 0);
  const lines = [
    '# MCP Tool Specs (v1.0)', '',
    '<!-- Generated by scripts/docs/generate-tool-specs.ts. Do not edit; run pnpm run docs:tools. -->', '',
    'This operator contract is generated from the live dispatcher, registry, adapter descriptions, JSON schemas and capability ledgers. Optional policy and usage notes belong in `docs/mcp/tool-notes/<tool>.md`.', '',
    `The ${names.length} live tools declare ${rootParameters} root input parameters. Conditional action parameters and output union branches are expanded below. Required flags apply only within the displayed branch; alternatives do not make every key mandatory. Nested structures remain defined by the linked dispatch schemas.`, '',
    '## Registration + enablement', '',
    `Auto tools are registered by default (${registry.auto.length} at the time of writing). On-demand tools are only registered when enabled (${registry.onDemand.length} at the time of writing).`, '',
    '- Enable every on-demand tool: `MCP_TOOLSET=all`',
    '- Enable a subset: `MCP_EXTRA_TOOLS=a11y.scan`', '',
    `Registry: ${link(REGISTRY)}. Actual schema selection: ${link(DISPATCH)}. [Grouped API index](../api/README.md).`, '',
    'Bridge-exposed tools require both [agent policy](../../configs/agent/policy.json) and [server policy](../../packages/mcp-server/src/security/policy.json). Per-tool limits below come from the server policy.', '',
    '## Evidence and portable outcomes', '',
    `Tool ledger: ${link(LEDGER)}, recorded source head ${json(ledger.head)}.`, '',
    `Test imports: ${ledger.methodology.testImportLocation}`, '',
    `Certified receipts: ${ledger.methodology.certifiedReceipts}`, '',
    `Documented limits: ${ledger.methodology.caveats}`, '',
    `Recorded portable execution: ${ledger.portableExecution.pass} pass and ${ledger.portableExecution.typed} typed dependency outcomes across ${ledger.portableExecution.tools} tools for the exercised inputs. Receipt: ${link(ledger.portableExecution.path)}; SHA-256 ${json(ledger.portableExecution.sha256)}; bundle head ${json(ledger.portableExecution.bundleHead)}; dirty=${json(ledger.portableExecution.dirty)}. This records the builder's measured bundle, not a later clean release, and is not certified.`, '',
    ...(ledger.limitsProbe ? [`Runtime limits probe: ${ledger.limitsProbe.probes} calls against the same archive (SHA-256 ${json(ledger.limitsProbe.archiveSha256)}, bundle head ${json(ledger.limitsProbe.bundleHead)}). Receipt: ${link(ledger.limitsProbe.path)}; SHA-256 ${json(ledger.limitsProbe.sha256)}.`, ''] : []),
    '## Current component capability counts', '',
    `Generated from ${link(COMPONENTS)}: ${components.rows.length} component rows; controlling obligation denominator ${components.controllingObligationDenominator}; approvedRuntimeCensus=${json(components.approvedRuntimeCensus)}. Classifications remain proposals independently of measured surface availability.`, '',
    '| Surface | State | Component rows |', '|---|---|---|',
  ];
  const surfaces = new Set(components.rows.flatMap(row => Object.keys(row.surfaces)));
  for (const surface of [...surfaces].sort()) {
    const counts = new Map<string, number>();
    for (const row of components.rows) {
      const state = row.surfaces[surface]?.state ?? 'missing';
      counts.set(state, (counts.get(state) ?? 0) + 1);
    }
    for (const [state, count] of [...counts].sort()) lines.push(`| ${json(surface)} | ${json(state)} | ${count} |`);
  }
  lines.push('', '## Retired tools', '', 'This historical roster comes from the tool ledger. These entries are not registered.', '',
    '<!-- tool-retirements:start -->', renderRetiredTools(ledger.retired), '<!-- tool-retirements:end -->');
  for (const [registration, tools] of [['auto', registry.auto], ['on-demand', registry.onDemand]] as const) {
    lines.push('', `## ${registration === 'auto' ? 'Auto' : 'On-demand'} tool contracts (${tools.length} registry entries)`, '', `The ${tools.length} ${registration === 'auto' ? 'default' : 'on-demand'} entries come from \`${REGISTRY}\`.`, '');
    for (const name of tools) {
      const description = sources.descriptions[name];
      if (!description) throw new Error(`Missing adapter description: ${name}`);
      const row = ledger.rows.find(entry => entry.name === name)!;
      if (row.registration !== registration) throw new Error(`Ledger registration mismatch: ${name}`);
      const policy = sources.policies.find(entry => entry.tool === name);
      if (!policy) throw new Error(`Missing server policy: ${name}`);
      const spec = sources.dispatch[name];
      lines.push(`### \`${advertisedName(name)}\``, '', description, '', sources.references[name], '', `[Complete input/output reference](../api/${name.replaceAll('.', '-')}.md). The tables below follow the actual dispatch schema paths; those paths control when the legacy API page selects a different schema.`, '',
        `Test imports: ${json(row.testImportLocation)} (where a spec importing the handler lives; not an execution result). Portable outcome: ${row.portableOutcome ? json(row.portableOutcome.outcome) : 'not measured by the portable receipt'}${row.portableOutcome?.code ? ` (${json(row.portableOutcome.code)})` : ''}. ${certifiedSentence(row.certifiedReceipts)}`, '',
        `Server policy: roles ${policy.allow.map(json).join(', ')}; ${policy.readOnly ? 'read-only' : `writes ${(policy.writes ?? []).map(json).join(', ') || 'not declared'}`}; timeout ${policy.timeoutMs} ms; rate ${policy.ratePerMinute}/minute; concurrency ${policy.concurrency}.`, '');
      for (const limit of row.portableLimits) lines.push(limit.source === 'limits-probe'
        ? `Runtime limit ${json(limit.id)}: ${limit.blocker} Observed: ${link(limit.receipt.path)}.`
        : `Portable limit ${json(limit.id)}: ${limit.blocker} Code ${json(limit.code)}; retryable=${json(limit.retryable)}. ${limit.transportOutcome}.`, '');
      for (const caveat of row.caveats) lines.push(`Documented limit: ${caveat.reason} Source: ${link(caveat.file)}${caveat.observed ? `; observed on the packed runtime (${caveat.observed.probes.map(json).join(', ')})` : ''}.`, '');
      for (const direction of ['input', 'output'] as const) {
        const schemaFile = spec[direction];
        const schema = sources.schemas[schemaFile];
        if (!schema) throw new Error(`Missing dispatched ${direction} schema for ${name}: ${schemaFile}`);
        const label = direction === 'input' ? 'Input' : 'Output';
        lines.push(`#### ${label} contract`, '', `Dispatch schema: ${link(schemaFile)}.`, '', renderSchema(schema, schemaFile, sources.schemas, label));
      }
      if (sources.notes[name]) lines.push('#### Usage notes', '', sources.notes[name], '');
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

/** Which certified review recorded this tool's calls, on which runs; a tool no certified run called says so. */
function certifiedSentence(receipts: CertifiedReceipt[]): string {
  if (!receipts.length) return 'No certified run has called it.';
  const reviews = [...new Set(receipts.map(ref => `review #${ref.certifiedBy}`))];
  const runs = receipts.map(ref => `${ref.kind === 'archive-e2e' ? 'archive E2E' : 'npm first run'} on Node ${ref.node.replace(/^v/, '')}: ${ref.outcome}`);
  return `Certified: ${reviews.join(', ')} recorded ${runs.join('; ')}.`;
}

export function generateToolSpecs(root = ROOT, check = false): void {
  const output = renderToolSpecs(loadToolSpecSources(root));
  const destination = path.join(root, TOOL_SPECS_PATH);
  if (check) {
    if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== output) throw new Error(`${TOOL_SPECS_PATH} is stale; run pnpm run docs:tools`);
    console.log('Tool-Specs is fresh (dispatcher schemas, descriptions, ledgers and notes).');
  } else {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, output);
    console.log(`Generated ${TOOL_SPECS_PATH}.`);
  }
}

export function parseToolSpecsArgs(args: string[]): { root: string; check: boolean } {
  let root = ROOT;
  let check = false;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--') continue; // pnpm run forwards this separator.
    if (argument === '--check') check = true;
    else if (argument === '--root') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error('--root requires a repository path');
      root = path.resolve(value);
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  return { root, check };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseToolSpecsArgs(process.argv.slice(2));
  generateToolSpecs(options.root, options.check);
}
