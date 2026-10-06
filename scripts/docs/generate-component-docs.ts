#!/usr/bin/env tsx
/** Governed component references; authored historical guides live outside this output directory. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { ComponentContract, SharedScenario } from '../../packages/component-contracts/src/types.js';
import { GOVERNED_DEFINITION } from '../../packages/component-contracts/src/governed.js';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const OUTPUT_DIRECTORY = 'docs/components';
export const LEDGER_PATH = 'packages/component-contracts/registry/component-capability-ledger.v1.json';
export const CONTRACTS_PATH = 'packages/component-contracts/src/contracts.ts';
export const SCENARIOS_PATH = 'packages/component-contracts/src/scenarios.ts';
export const MANIFEST_PATH = 'artifacts/structured-data/manifest.json';
export const SURFACES = ['contract', 'metadata', 'html', 'react', 'vue', 'generatedConsumer', 'accessibility', 'theme', 'interaction'] as const;

type Surface = { state: string; evidence: string[]; reason?: string };
export type CapabilityRow = {
  id: string;
  proposedClassification: string;
  reconciliationState: string;
  surfaces: Record<(typeof SURFACES)[number], Surface>;
};
export type CatalogComponent = {
  id: string;
  displayName: string;
  description?: string;
  categories: string[];
  tags: string[];
  contexts: string[];
  regions: string[];
  sourceFiles: string[];
  traitUsages: Array<{
    trait: string; traitCategory: string; context: string; position: string | null;
    priority: number | null; props: Record<string, unknown>; source: string;
  }>;
};
export type ComponentDocInputs = {
  ledger: { rows: CapabilityRow[] };
  contracts: Readonly<Record<string, ComponentContract>>;
  scenarios: readonly SharedScenario[];
  catalog: { components: CatalogComponent[] };
  catalogPath: string;
};

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const json = <T>(root: string, file: string): T => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')) as T;

export async function readComponentDocInputs(root = ROOT): Promise<ComponentDocInputs> {
  const manifest = json<{ artifacts: Array<{ name: string; path: string }> }>(root, MANIFEST_PATH);
  const catalogs = manifest.artifacts.filter(artifact => artifact.name === 'components');
  if (catalogs.length !== 1) throw new Error('Structured-data manifest must select exactly one components catalog.');
  const catalogPath = catalogs[0]!.path;
  assertRepositoryPath(catalogPath);
  // Import public source values: the authored literals omit behavior-injected fields and scenarios.
  const [{ componentContracts }, { sharedScenarios }] = await Promise.all([
    import(pathToFileURL(path.join(root, CONTRACTS_PATH)).href),
    import(pathToFileURL(path.join(root, SCENARIOS_PATH)).href),
  ]);
  return {
    ledger: json(root, LEDGER_PATH),
    contracts: componentContracts,
    scenarios: sharedScenarios,
    catalog: json(root, catalogPath),
    catalogPath,
  };
}

function assertRepositoryPath(reference: string): void {
  const file = reference.split('#')[0]!;
  if (!file || path.isAbsolute(file) || file.split(/[\\/]/).includes('..') || file.includes('\\') || /^[a-z]+:/i.test(file)) {
    throw new Error(`Component source reference must be repository-relative: ${reference}`);
  }
}

function uniqueIds(ids: string[], source: string): string[] {
  if (new Set(ids).size !== ids.length) throw new Error(`${source} contains duplicate IDs.`);
  return [...ids].sort(compare);
}

function sameIds(expected: string[], actual: string[], source: string): void {
  const missing = expected.filter(id => !actual.includes(id));
  const extra = actual.filter(id => !expected.includes(id));
  if (missing.length || extra.length) throw new Error(`${source} differs from the component ledger: missing [${missing.join(', ')}]; extra [${extra.join(', ')}].`);
}

export function validateComponentDocInputs(inputs: ComponentDocInputs): string[] {
  const ids = uniqueIds(inputs.ledger.rows.map(row => row.id), 'Component ledger');
  if (!ids.length || ids.some(id => !/^[A-Z][A-Za-z0-9]*$/.test(id))) throw new Error('Component ledger must contain safe, nonempty component IDs.');
  sameIds(ids, Object.keys(inputs.contracts).sort(compare), 'Contracts');
  for (const [id, contract] of Object.entries(inputs.contracts)) {
    if (contract.id !== id) throw new Error(`Contract key ${id} differs from its ID ${contract.id}.`);
  }
  sameIds(ids, uniqueIds(inputs.catalog.components.map(component => component.id), 'Catalog'), 'Catalog');
  uniqueIds(inputs.scenarios.map(scenario => scenario.id), 'Shared scenarios');
  sameIds(ids, [...new Set(inputs.scenarios.map(scenario => scenario.oodsComponentId))].sort(compare), 'Shared scenarios');
  for (const row of inputs.ledger.rows) {
    const actual = Object.keys(row.surfaces).sort(compare);
    if (JSON.stringify(actual) !== JSON.stringify([...SURFACES].sort(compare))) throw new Error(`${row.id} must declare all nine capability surfaces, without extras.`);
    for (const surface of SURFACES) {
      const value = row.surfaces[surface];
      if (!value.state || !Array.isArray(value.evidence)) throw new Error(`${row.id}/${surface} lacks a state or evidence list.`);
      value.evidence.forEach(assertRepositoryPath);
    }
  }
  assertRepositoryPath(inputs.catalogPath);
  for (const component of inputs.catalog.components) {
    component.sourceFiles.forEach(assertRepositoryPath);
    component.traitUsages.forEach(usage => assertRepositoryPath(usage.source));
  }
  return ids;
}

const text = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
const code = (value: string) => `\`${text(value).replace(/`/g, '&#96;')}\``;
const names = (values: readonly string[]) => values.length ? values.map(code).join(', ') : 'None declared';
const prose = (values: readonly string[]) => values.length ? values.map(value => `- ${text(value)}`).join('\n') : 'None declared.';

function sourceLink(reference: string): string {
  // Symbol names and JSON pointers are provenance labels, not Markdown heading anchors.
  const file = reference.split('#')[0]!;
  // s211-m03: a citation with no directory (the generator's bare file name, a decision named in words) is shipped
  // provenance, not a repository path, so it is printed rather than linked.
  if (!file.includes('/')) return code(reference);
  return `[${text(reference)}](../../${encodeURI(file).replace(/\(/g, '%28').replace(/\)/g, '%29')})`;
}

const generated = '<!-- Generated by scripts/docs/generate-component-docs.ts. Do not edit; run pnpm exec tsx scripts/docs/generate-component-docs.ts. -->';

function renderComponent(row: CapabilityRow, inputs: ComponentDocInputs): string {
  const contract = inputs.contracts[row.id]!;
  const component = inputs.catalog.components.find(value => value.id === row.id)!;
  const scenarios = inputs.scenarios.filter(value => value.oodsComponentId === row.id).sort((a, b) => compare(a.id, b.id));
  const lines = [
    `# ${row.id}`, '', generated, '', '[All governed components](./README.md)', '',
    `Display name: ${text(component.displayName)}. Contract version: ${code(contract.version)}.`, '',
    ...(component.description ? [text(component.description), ''] : []),
    '## Contract', '',
    `Source: ${sourceLink(`${CONTRACTS_PATH}#${row.id}`)}. Names below describe the declared surface; types and defaults are not inferred.`, '',
    '| Field | Declared names |', '| --- | --- |',
    `| ${code('props')} | ${names(contract.props)} |`,
    // s221-m02 (#2482 ruling 5): the saved-schema names a contract reads are directives, listed apart from its props.
    ...(contract.directives?.length ? [`| ${code('directives')} | ${names(contract.directives)} |`] : []),
    ...(['slots', 'events', 'states', 'tokenRoles'] as const).map(field => `| ${code(field)} | ${names(contract[field])} |`), '',
    '### Accessibility and behavior', '', prose(contract.accessibility), '',
    `Role: ${contract.role ? code(contract.role) : 'Not declared'}.`, '',
    `Accessible name: ${contract.name ? `${code(contract.name.strategy)} strategy targeting ${code(contract.name.target)}` : 'Not declared'}.`, '',
    '| Keyboard input | Declared outcome |', '| --- | --- |',
    ...(Object.keys(contract.keyboard ?? {}).length
      ? Object.entries(contract.keyboard!).map(([key, outcome]) => `| ${code(key)} | ${text(outcome)} |`)
      : ['| None declared | No component-owned keyboard behavior is declared. |']), '',
    '### Compatibility', '', text(contract.compatibility), '',
    '## Capability evidence', '',
    `Proposed classification: ${code(row.proposedClassification)}. Reconciliation state: ${code(row.reconciliationState)}.`, '',
    'Classification remains a proposal where the ledger says so. These surface records retain their own evidence scope; they do not imply a newly approved runtime census.', '',
    `Source: ${sourceLink(LEDGER_PATH)}. Evidence links open the source file; labels retain its symbol or JSON-pointer reference.`, '',
    '| Surface | State | Evidence | Reason |', '| --- | --- | --- | --- |',
    ...SURFACES.map(surface => {
      const value = row.surfaces[surface];
      return `| ${code(surface)} | ${code(value.state)} | ${value.evidence.length ? value.evidence.map(sourceLink).join('<br>') : 'None recorded'} | ${value.reason ? text(value.reason) : '—'} |`;
    }), '',
    '## Catalog metadata', '', `Source: ${sourceLink(inputs.catalogPath)}.`, '',
    '| Field | Values |', '| --- | --- |',
    ...(['categories', 'tags', 'contexts', 'regions'] as const).map(field => `| ${code(field)} | ${names(component[field])} |`), '',
    '### Trait usages', '',
    '| Trait | Category | Context | Position | Priority | Props | Source |', '| --- | --- | --- | --- | --- | --- | --- |',
    ...(component.traitUsages.length ? component.traitUsages.map(usage => `| ${code(usage.trait)} | ${code(usage.traitCategory)} | ${code(usage.context)} | ${usage.position === null ? 'Not recorded' : code(usage.position)} | ${usage.priority ?? 'Not recorded'} | ${code(JSON.stringify(usage.props))} | ${sourceLink(usage.source)} |`)
      : ['| None recorded | — | — | — | — | — | — |']), '',
    'Source files:', '', ...component.sourceFiles.map(file => `- ${sourceLink(file)}`), '',
    `## Shared scenarios (${scenarios.length})`, '',
    `Source: ${sourceLink(SCENARIOS_PATH)}. This count describes authored scenarios, not executed passes; execution claims remain in the evidence above.`, '',
  ];
  for (const scenario of scenarios) {
    lines.push(`### ${code(scenario.id)}`, '',
      `Interaction: ${code(scenario.interaction)}.${scenario.interactionReason ? ` ${text(scenario.interactionReason)}` : ''}`, '',
      `Expectation ${code(scenario.renderExpectation.name)}: ${text(scenario.renderExpectation.trigger)} → ${text(scenario.renderExpectation.expected)}.`, '',
      prose(scenario.assertions), '',
      '| Trigger | Target | Input | Expected effect |', '| --- | --- | --- | --- |');
    // s223-m02: a trigger's preceding keys (a combobox's ArrowDown before Enter) read in order before its own key.
    lines.push(...(scenario.event.length ? scenario.event.map(event => `| ${code(event.trigger)} | ${code(event.target)} | ${code([...(event.keys ?? []), event.key ?? event.action ?? ''].join(' then '))}${event.value === undefined ? '' : `: ${code(event.value)}`} | ${code(JSON.stringify(event.effect))} |`)
      : ['| None declared | — | — | — |']), '');
  }
  return lines.join('\n');
}

function renderIndex(inputs: ComponentDocInputs, ids: string[]): string {
  const rows = ids.map(id => inputs.ledger.rows.find(row => row.id === id)!);
  const lines = [
    '# Governed components', '', generated, '',
    `${ids.length} component pages join the capability ledger, exported contracts, manifest-selected catalog and ${inputs.scenarios.length} shared scenarios.`, '',
    // s213-m02: the index says what "governed" means, from the predicate the claims generator counts with.
    `A governed component has ${GOVERNED_DEFINITION} in the capability ledger. Whether a generated app places it is measured separately, by the runtime sweep.`, '',
    `Sources: ${[LEDGER_PATH, CONTRACTS_PATH, SCENARIOS_PATH, inputs.catalogPath].map(sourceLink).join(', ')}.`, '',
    'The classification column is the recorded proposal; each page preserves reconciliation state and evidence for all nine surfaces. Scenario counts are authored coverage, not execution claims.', '',
    '[Historical Foundry component guides](../history/components/) are retained reference material outside this governed census.', '',
    '## Components', '', '| Component | Proposed classification | React | Vue | Shared scenarios |', '| --- | --- | --- | --- | --- |',
    ...rows.map(row => `| [${row.id}](./${row.id}.md) | ${code(row.proposedClassification)} | ${code(row.surfaces.react.state)} | ${code(row.surfaces.vue.state)} | ${inputs.scenarios.filter(scenario => scenario.oodsComponentId === row.id).length} |`), '',
    '## Recorded surface counts', '', '| Surface | State | Components |', '| --- | --- | --- |',
  ];
  for (const surface of SURFACES) {
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.surfaces[surface].state, (counts.get(row.surfaces[surface].state) ?? 0) + 1);
    for (const [state, count] of [...counts.entries()].sort(([a], [b]) => compare(a, b))) lines.push(`| ${code(surface)} | ${code(state)} | ${count} |`);
  }
  lines.push('', 'Regenerate with `pnpm exec tsx scripts/docs/generate-component-docs.ts`; append `--check` to reject stale, missing or orphan pages without writing files.', '');
  return lines.join('\n');
}

export function renderComponentDocs(inputs: ComponentDocInputs): Map<string, string> {
  const ids = validateComponentDocInputs(inputs);
  const files = new Map<string, string>([[`${OUTPUT_DIRECTORY}/README.md`, renderIndex(inputs, ids)]]);
  for (const id of ids) files.set(`${OUTPUT_DIRECTORY}/${id}.md`, renderComponent(inputs.ledger.rows.find(row => row.id === id)!, inputs));
  return files;
}

function markdownFiles(root: string, directory: string): string[] {
  if (!fs.existsSync(path.join(root, directory))) return [];
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const relative = `${directory}/${entry.name}`;
    return entry.isDirectory() ? markdownFiles(root, relative) : entry.name.endsWith('.md') ? [relative] : [];
  }).sort(compare);
}

export async function generateComponentDocs({ root = ROOT, check = false, inputs }: { root?: string; check?: boolean; inputs?: ComponentDocInputs } = {}) {
  const source = inputs ?? await readComponentDocInputs(root);
  const files = renderComponentDocs(source);
  // A published evidence link must resolve, even when its label carries an opaque source symbol.
  for (const content of files.values()) for (const match of content.matchAll(/\]\(\.\.\/\.\.\/([^\n)]+)\)/g)) {
    const target = decodeURI(match[1]!);
    if (!fs.existsSync(path.join(root, target))) throw new Error(`Component documentation source is missing: ${target}`);
  }
  const stale = [...files.entries()].filter(([file, content]) => !fs.existsSync(path.join(root, file)) || fs.readFileSync(path.join(root, file), 'utf8') !== content).map(([file]) => file);
  const orphans = markdownFiles(root, OUTPUT_DIRECTORY).filter(file => !files.has(file));
  if (!check) {
    fs.mkdirSync(path.join(root, OUTPUT_DIRECTORY), { recursive: true });
    for (const [file, content] of files) fs.writeFileSync(path.join(root, file), content);
    for (const file of orphans) fs.unlinkSync(path.join(root, file));
  }
  return { ok: !check || (!stale.length && !orphans.length), files: [...files.keys()], stale, orphans };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let root = ROOT;
  let check = false;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--') continue;
    if (args[index] === '--check') check = true;
    else if (args[index] === '--root' && args[index + 1]) root = path.resolve(args[++index]!);
    else throw new Error(`Unknown or incomplete option: ${args[index]}`);
  }
  generateComponentDocs({ root, check }).then(result => {
    if (!result.ok) {
      console.error(`Component docs are stale or missing:\n${result.stale.join('\n')}\nOrphan pages:\n${result.orphans.join('\n')}`);
      process.exitCode = 1;
    } else console.log(`Component docs ${check ? 'check passed' : 'generated'}: ${result.files.length - 1} pages + index.`);
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
