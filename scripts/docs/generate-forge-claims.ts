#!/usr/bin/env tsx
/** Generate the marked narrative claims and package READMEs from live sources. */
import fs from 'node:fs';
// @ts-expect-error -- shared naming table is native ESM.
import { advertisedName } from '../runtime/tool-names.mjs';
import { RELEASE_EVIDENCE_LIMIT } from '../../packages/mcp-server/src/codegen/validation-profile.js';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { load as parseYaml, dump as yaml } from 'js-yaml';
import { BRAND_CONTRAST_PAIRS, brandContrastRules, DEFAULT_CONTRAST_RULES } from '../../packages/a11y-tools/src/index.js';
import { ACCURACY_RULES } from '../../packages/viz-core/src/accuracy/index.js';
import { ECHARTS_ACCURACY_RULES } from '../../packages/viz-core/src/accuracy/echarts-index.js';
import { componentContracts } from '../../packages/component-contracts/src/contracts.js';
import { GOVERNED_DEFINITION, isGovernedComponent } from '../../packages/component-contracts/src/governed.js';
// @ts-expect-error -- the tool-truth census is native ESM.
import { componentPlacement } from '../product-reality/s193-tool-truth.mjs';
import { checkCapabilityClaims } from './capability-claims.js';
import { sharedScenarios } from '../../packages/component-contracts/src/scenarios.js';
import { REGION_ORDER } from '../../src/types/regions.js';
import { composeObject } from '../../packages/mcp-server/src/objects/trait-composer.js';
import { loadObject } from '../../packages/mcp-server/src/objects/object-loader.js';
import { handle as composeScreen } from '../../packages/mcp-server/src/tools/design.compose.js';
import type { ObjectDefinition, TraitDefinition } from '../../packages/mcp-server/src/objects/types.js';

export const ROOT = path.resolve(import.meta.dirname, '../..');
export const TEMPLATE_PATH = 'scripts/docs/forge-claims.templates.json';
export type Facts = Record<string, string | number>;
export type Templates = Record<string, Record<string, string>>;
type Schema = { properties: Record<string, { enum?: string[]; default?: unknown; properties?: Schema['properties'] }>; $defs: Record<string, Schema> };
type ComponentRow = { id: string; proposedClassification: string; surfaces: Record<string, { state: string }> };
type ToolRow = { name: string; testImportLocation: string; caveats: unknown[]; portableLimits?: unknown[]; certifiedReceipts: Array<{ sprint: number; certifiedBy: number }>; portableOutcome?: { outcome: string; code?: string } | null };
const read = (name: string) => fs.readFileSync(path.join(ROOT, name), 'utf8');
const json = <T>(name: string): T => JSON.parse(read(name)) as T;
const html = (value: unknown) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const prose = (values: readonly string[]) => values.length < 2 ? values.join('') : `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`;
const words = (n: number) => ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen'][n] ?? String(n);
const capital = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const unique = <T>(items: readonly T[]) => [...new Set(items)];

function inventory<T>(directory: string, suffix: string): Array<{ file: string; definition: T }> {
  return fs.readdirSync(path.join(ROOT, directory), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const file = `${directory}/${entry.name}`;
    return entry.isDirectory() ? inventory<T>(file, suffix) : entry.name.endsWith(suffix)
      ? [{ file, definition: parseYaml(read(file)) as T }] : [];
  });
}

function leaves(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  if ('$value' in value) return 1;
  return Object.values(value).reduce<number>((sum, child) => sum + leaves(child), 0);
}

function sourceNumber(file: string, pattern: RegExp): number {
  const match = read(file).match(pattern);
  if (!match) throw new Error(`Source pin no longer resolves: ${file} ${pattern}`);
  return Number(match[1].replaceAll('_', ''));
}

export async function collectFacts(): Promise<Facts> {
  const registry = json<{ auto: string[]; onDemand: string[] }>('packages/mcp-server/src/tools/registry.json');
  const tools = json<{ rows: ToolRow[]; portableExecution: { tools: number; pass: number; typed: number; bundleHead: string }; retired: Array<{ name: string }> }>('packages/mcp-server/registry/tool-capability-ledger.v1.json');
  const schema = (tool: string) => json<Schema>(`packages/mcp-server/src/schemas/${tool}.input.json`);
  // Match the adapter's documented generic-schema fallback for on-demand tools.
  const action = (tool: string) => {
    const values = (fs.existsSync(path.join(ROOT, `packages/mcp-server/src/schemas/${tool}.input.json`)) ? schema(tool) : schema('generic')).properties.action?.enum ?? [];
    // Keep the narrative's lifecycle order; membership still comes only from the schema.
    return tool === 'map' ? [...values.filter(value => value !== 'apply'), ...values.filter(value => value === 'apply')] : values;
  };
  const actionTools = registry.auto.filter(tool => action(tool).length > 0);
  const displayTool = (tool: string, markdown = false) => markdown
    ? `\`${advertisedName(tool)}\`${action(tool).length ? ` (${action(tool).map(value => `\`${value}\``).join('/')})` : ''}`
    : `${advertisedName(tool)}${action(tool).length ? ` (${action(tool).join(', ')})` : ''}`;
  if (JSON.stringify([...registry.auto, ...registry.onDemand]) !== JSON.stringify(tools.rows.map(row => row.name))) throw new Error('Tool ledger roster differs from registry; regenerate the ledger first.');
  const toolRow = (tool: string, label: string) => {
    const row = tools.rows.find(entry => entry.name === tool)!;
    const outcome = row.portableOutcome ? row.portableOutcome.outcome === 'pass' ? 'pass' : `typed (${row.portableOutcome.code})` : 'not in the E2E';
    return `| ${label} | ${outcome} | ${row.caveats.length + (row.portableLimits?.length ?? 0)} |`;
  };
  const portable = tools.rows.filter(row => row.portableOutcome);
  const passed = portable.filter(row => row.portableOutcome?.outcome === 'pass');
  const typed = portable.filter(row => row.portableOutcome?.outcome === 'typed');
  if (portable.length !== tools.portableExecution.tools || passed.length !== tools.portableExecution.pass || typed.length !== tools.portableExecution.typed) throw new Error('Portable outcome rows disagree with the retained execution summary.');
  const traits = [...inventory<TraitDefinition>('traits', '.trait.yaml'), ...inventory<TraitDefinition>('domains', '.trait.yaml')];
  const objects = [...inventory<ObjectDefinition>('objects', '.object.yaml'), ...inventory<ObjectDefinition>('domains', '.object.yaml')];
  const product = composeObject(loadObject('Product'));
  if (product.traits.length !== loadObject('Product').traits.length) throw new Error('Product composition omitted a trait.');
  // Transient (s211-m01): a --check that composed durably wrote a composition into the store of whichever checkout ran it.
  const screen = await composeScreen({ intent: 'product detail page', options: { transient: true } });
  if (screen.status !== 'ok' || !screen.meta || !screen.selections) throw new Error('The published Product example failed to compose.');
  const intents = new Set<string>(); const tabPanels: Array<{ id: string; props?: { label?: string } }> = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const element = node as { component?: string; meta?: { intent?: string }; children?: Array<{ id: string; props?: { label?: string } }> };
    if (typeof element.meta?.intent === 'string') intents.add(element.meta.intent);
    if (element.component === 'Tabs') tabPanels.push(...(element.children ?? []));
    for (const value of Object.values(node)) if (value && typeof value === 'object') visit(value);
  };
  visit(screen.schema);
  const onScreen = screen.selections.filter(row => intents.has(`slot:${row.slotName}`)).map(row => row.slotName);
  const subscription = loadObject('Subscription');
  const stateNames = (definition: ObjectDefinition) => definition.traits.find(trait => trait.name.endsWith('/Stateful'))?.parameters?.states as string[];
  const ledger = json<{ rows: ComponentRow[] }>('packages/component-contracts/registry/component-capability-ledger.v1.json');
  const historical = json<{ rows: ComponentRow[]; foundationCells: Array<{ componentId: string; target: string; evaluation: { candidate: boolean } }> }>('packages/component-contracts/registry/component-capability-closeout.s182.v1.json');
  const promoted = json<{ foundationCells: Array<{ componentId: string; target: string; evaluation: { foundationV1: boolean } }> }>('packages/component-contracts/registry/component-capability-foundation-v1.s182.v1.json');
  const count = (surface: string, state: string) => ledger.rows.filter(row => row.surfaces[surface]?.state === state).length;
  const classification = (rows: ComponentRow[], kind: string) => rows.filter(row => row.proposedClassification === kind).length;
  const taxonomy = json<{ summary: { types: number; patterns: number; retiredPatterns: number; families: number; classified: number } }>('packages/viz-core/src/registry/viz-taxonomy.v1.json').summary;
  const recipes = json<Array<{ chartType: string; specEngine: string; themes: { hc: boolean } }>>('packages/viz-core/src/registry/viz-recipes.v1.json');
  const viz = schema('viz.render');
  const cartesian = recipes.filter(row => row.specEngine === 'vega-lite').map(row => row.chartType);
  const primary = recipes.filter(row => row.specEngine === 'echarts').map(row => row.chartType);
  const dashboardTypes = schema('dashboard.render').$defs.ChartPanel.properties.chartType.enum!;
  const tokenConfig = createRequire(import.meta.url)(path.join(ROOT, 'packages/tokens/style-dictionary.config.cjs')) as { platforms: Record<string, { buildPath: string; files: Array<{ destination: string }> }> };
  for (const platform of Object.values(tokenConfig.platforms)) for (const file of platform.files) {
    if (!fs.existsSync(path.join(ROOT, 'packages/tokens', platform.buildPath, file.destination))) throw new Error(`Missing built token output: ${platform.buildPath}${file.destination}`);
  }
  // s213-m04: the brands are the brand registry's (the brands folder), not a schema enum.
  const brands = [...(createRequire(import.meta.url)(path.join(ROOT, 'packages/tokens/scripts/brand-registry.cjs')) as { readBrandRegistry: () => readonly string[] }).readBrandRegistry()];
  const themes = viz.properties.theme.enum!;
  const baseLeaves = brands.map(brand => leaves(json(`packages/tokens/src/tokens/brands/${brand}/base.json`)));
  if (unique(baseLeaves).length !== 1) throw new Error('Brand base counts differ; revise the per-brand claim.');
  const presets = fs.readdirSync(path.join(ROOT, 'packages/tokens/src/presets')).filter(name => name.endsWith('.json')).map(name => name.slice(0, -5)).sort();
  const release = json<{ bundleHead: string; rows: Array<{ object: string; context: string; framework: string; status: string; hashEqualToHost: boolean }> }>('packages/mcp-server/registry/release-cells.v1.json');
  const uiSchema = json<Schema>('packages/mcp-server/src/schemas/repl.ui.schema.json');
  const contexts = (read('src/contexts/index.ts').match(/export type ContextKind =([\s\S]*?);/)![1].match(/'([^']+)'/g) ?? []).map(value => value.slice(1, -1));
  const traitSections = unique(traits.flatMap(row => Object.keys(row.definition))).filter(key => key !== 'trait').sort();
  const statusTextRules = DEFAULT_CONTRAST_RULES.filter(rule => /^status-.*-text$/.test(rule.ruleId));
  const statusIconRules = DEFAULT_CONTRAST_RULES.filter(rule => /^status-.*-icon$/.test(rule.ruleId));
  const roles = json<{ roles: string[] }>('packages/mcp-server/src/security/policy.json').roles;
  const stateful = traits.find(row => row.definition.trait.name === 'Stateful')!.definition;
  const productDefinition = loadObject('Product');
  const productExampleTraits = productDefinition.traits.filter(trait => ['content/Labelled', 'lifecycle/Stateful', 'financial/Priceable'].includes(trait.name));
  const sourceExcerpt = (value: unknown) => html(yaml(value, { lineWidth: 100, noRefs: true }).trimEnd());
  const css = read('packages/tokens/dist/css/tokens.css');
  const tokenExample = ['--ref-color-neutral-1', '--theme-surface-canvas', '--sys-surface-canvas', '--cmp-text-placeholder-color', '--sys-breakpoint-md'].map(name => {
    const value = css.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1];
    if (!value) throw new Error(`Missing example CSS variable: ${name}`);
    return `${name}: ${value};`;
  }).join('\n');
  const toolGroups = [
    ['Registry', ['catalog.list', 'object', 'object.import', 'structuredData.fetch', 'registry.snapshot', 'health']],
    ['Generate &amp; review', ['design.compose', 'design.preview', 'repl', 'code.generate', 'pipeline', 'schema', 'fidelity.preview', 'map']],
    ['Charts', ['viz.render', 'dashboard.render', 'artifact.certify']],
    ['Tokens &amp; brand', ['tokens.build', 'brand.apply', 'brand.intake']],
  ] as const;
  const grouped = toolGroups.flatMap(([, names]) => [...names]);
  if (JSON.stringify([...grouped].sort()) !== JSON.stringify([...registry.auto].sort())) throw new Error('Tool grouping must cover the live auto roster exactly.');
  const traitGroups = unique(traits.map(row => row.file.startsWith('domains/') ? 'SaaS-billing pack' : row.file.split('/')[1]));
  // docs:check rejects drift between the advertised claims and both ledger limits.
  const releaseRows = json<{ rows: Array<{ name: string; caveats: Array<{ file: string; reason: string }> }> }>('packages/mcp-server/registry/tool-capability-ledger.v1.json');
  for (const name of ['code.generate', 'pipeline']) {
    const limit = releaseRows.rows.find(row => row.name === name)?.caveats.find(row => row.file.endsWith('/validation-profile.ts'));
    if (!read('packages/foundry/TOOL-REFERENCE.md').includes(RELEASE_EVIDENCE_LIMIT) || limit?.reason !== RELEASE_EVIDENCE_LIMIT) throw new Error(`${name}: release evidence limit differs from the runtime disclosure`);
  }
  const facts: Facts = {
    releaseEvidenceLimit: RELEASE_EVIDENCE_LIMIT,
    auto: registry.auto.length, onDemand: registry.onDemand.length, tools: registry.auto.length + registry.onDemand.length,
    actionFamilyCount: words(actionTools.length), actionFamilies: actionTools.map(tool => `\`${tool}\``).join(', '),
    toolRowsHtml: [...toolGroups.map(([group, names]) => `<tr><td>${group}</td><td>${names.map(tool => displayTool(tool)).join(' · ')}</td></tr>`), `<tr><td>On demand</td><td>${registry.onDemand.join(' · ')}</td></tr>`].join('\n      '),
    // s213-m02: the table shows the recorded outcome from the packed runtime and how many limits are recorded, never
    // where a test file lives (the census's test-import location, which used to be shown as a "product-reality" tier).
    toolRowsMarkdown: registry.auto.map(tool => toolRow(tool, displayTool(tool, true))).join('\n'),
    onDemandRowsMarkdown: registry.onDemand.map(tool => toolRow(tool, displayTool(tool, true))).join('\n'),
    portableBundleHead: tools.portableExecution.bundleHead.slice(0, 9),
    certifiedReview: prose(unique(tools.rows.flatMap(row => row.certifiedReceipts.map(ref => `review #${ref.certifiedBy}`)))),
    knownLimits: tools.rows.reduce((sum, row) => sum + row.caveats.length + (row.portableLimits?.length ?? 0), 0),
    portableTools: portable.length, portablePass: passed.length, portableTyped: typed.length,
    portableLimits: typed.map(row => `${row.name} (${row.portableOutcome!.code})`).join(' and '),
    portableTypedPhrase: typed.length === 1 ? 'retains a typed dependency limit' : 'retain typed dependency limits',
    portableLimitNoun: typed.length === 1 ? 'limit' : 'limits',
    // Zero typed limits reads as a sentence of its own, never "0 retain typed dependency limits: ."
    portableOutcomeSentence: typed.length === 0
      ? `All ${passed.length} return the exercised result; no typed dependency limit remains.`
      : `${passed.length} return the exercised result and ${typed.length} ${typed.length === 1 ? 'retains a typed dependency limit' : 'retain typed dependency limits'}: ${typed.map(row => `${row.name} (${row.portableOutcome!.code})`).join(' and ')}.`,
    portableReadmeSentence: typed.length === 0
      ? `${passed.length} results and no typed dependency limit.`
      : `${passed.length} results and ${typed.length} typed dependency ${typed.length === 1 ? 'limit' : 'limits'}, ${typed.map(row => `${row.name} (${row.portableOutcome!.code})`).join(' and ')}.`,
    traits: traits.length, vizTraits: traits.filter(row => row.definition.trait.category?.startsWith('viz')).length,
    traitSectionCount: traitSections.length, traitSectionRoster: traitSections.map(section => `<span class="k">${section}</span>`).join(', '),
    domainTraitsWord: words(traits.filter(row => row.file.startsWith('domains/')).length),
    traitRows: traitGroups.flatMap(group => {
      const rows = traits.filter(row => (row.file.startsWith('domains/') ? 'SaaS-billing pack' : row.file.split('/')[1]) === group);
      return [`<tr class="famrow"><td colspan="4">${html(group)} (${rows.length})</td></tr>`, ...rows.map(({ definition: t }) => `<tr><td>${html(t.trait.name)} <small>(${html(t.metadata?.maturity ?? 'unspecified')})</small></td><td>${html(t.trait.description?.replace(/,?\s*s\d{3}-m\d{2}/gi, '').replace(/Sprint \d+'s /g, 'The retained ').replace(/this sprint/g, 'in the current integration').replace(/\s+/g, ' ').trim() ?? '')}</td><td>${html(Object.keys(t.schema ?? {}).join(', ') || '—')}</td><td>${html(unique(Object.values(t.view_extensions ?? {}).flat().map(extension => extension.component)).join(', ') || '—')}</td></tr>`)];
    }).join('\n      '),
    objectDefinitions: objects.length, objectNames: unique(objects.map(row => row.definition.object.name)).length,
    objectRows: objects.map(({ file, definition: object }) => `<tr><td>${html(object.object.name)}<br><small>${html(file)}</small></td><td>${html(object.object.description ?? '')}</td><td>${html((object.traits ?? []).map(trait => trait.name).join(', '))}</td><td>${html(Object.keys(object.schema ?? {}).join(', '))}</td></tr>`).join('\n      '),
    productFields: Object.keys(product.schema).length,
    productStateCount: words(stateNames(loadObject('Product')).length), subscriptionStateCount: words(stateNames(subscription).length),
    productStatesType: stateNames(loadObject('Product')).map(state => `'${state}'`).join(' | '),
    statefulDetailPriority: stateful.view_extensions.detail.find(row => row.component === 'StatusTimeline')!.priority!,
    statefulExample: sourceExcerpt({ trait: { name: stateful.trait.name, version: stateful.trait.version, category: stateful.trait.category }, parameters: stateful.parameters.slice(0, 3).map(({ name, type, validation }) => ({ name, type, ...(validation ? { validation } : {}) })), schema: Object.fromEntries(Object.entries(stateful.schema).map(([name, field]) => [name, { type: field.type, ...(field.validation ? { validation: field.validation } : {}) }])), view_extensions: stateful.view_extensions, tokens: stateful.tokens }),
    productStateExample: sourceExcerpt([productDefinition.traits.find(trait => trait.name === 'lifecycle/Stateful')]),
    productDefinitionExample: sourceExcerpt({ object: { name: productDefinition.object.name, domain: productDefinition.object.domain }, traits: productExampleTraits, schema: Object.fromEntries(Object.entries(productDefinition.schema).map(([name, field]) => [name, { type: field.type }])) }) + `\n# Other traits: ${html(productDefinition.traits.filter(trait => !productExampleTraits.includes(trait)).map(trait => trait.name).join(', '))}`,
    tokenExample: html(tokenExample),
    productComponents: Object.entries(product.viewExtensions).map(([context, rows]) => `<tr><td>${html(context)}</td><td>${html(rows.map(row => row.component).join(', '))}</td></tr>`).join('\n      '),
    productNodes: screen.meta.nodeCount, productSlots: screen.selections.filter(row => row.selectedComponent).length,
    productTabs: screen.selections.filter(row => row.slotName.startsWith('tab-')).length,
    // s213-m02: selections list every slot the selector filled; the returned screen can carry fewer (the detail reconciler
    // drops empty panels and merges tabs), so the page states what the screen places, measured on the tree itself.
    productSlotsOnScreen: onScreen.length, productSlotsOnScreenRoster: prose(onScreen),
    productTabPhrase: `${words(tabPanels.length)} tab panel${tabPanels.length === 1 ? '' : 's'} (${tabPanels.map(panel => panel.props?.label ?? panel.id).join(', ')})`,
    productSlotRoster: screen.selections.map(row => `${row.slotName}: ${row.selectedComponent}`).join('; '),
    subscriptionExample: `# Canonical objects/core/Subscription.object.yaml composes ${subscription.traits.length} traits\nobject: { name: Subscription }\ntraits:\n${subscription.traits.map(trait => `  - name: ${trait.name}`).join('\n')}`,
    regionsWord: words(REGION_ORDER.length), regionRoster: REGION_ORDER.map(name => `<span class="k">${name}</span>`).join(', '),
    regionsMarkdown: REGION_ORDER.map(region => `- \`${region}\``).join('\n'), contexts: contexts.length, contextNames: contexts.map(context => `\`${context}\``).join(', '),
    rolesWord: capital(words(roles.length)), roleRoster: roles.join(', '),
    runtimePriority: sourceNumber('packages/mcp-server/src/objects/trait-composer.ts', /const pA = a.extension.priority \?\? (\d+)/),
    viewPriority: sourceNumber('src/core/merge-strategies/view-extensions-merger.ts', /const priorityA = a.priority \?\? (\d+)/),
    tabletWidth: json<{ sys: { breakpoint: { md: { $value: number } } } }>('packages/tokens/src/tokens/base/system/breakpoint.json').sys.breakpoint.md.$value,
    phoneWidth: sourceNumber('.storybook/preview.ts', /name: 'OODS mobile \((\d+)\)'/),
    bridgePort: sourceNumber('packages/mcp-bridge/src/server.ts', /process.env.MCP_BRIDGE_PORT \|\| (\d+)/),
    bridgeTimeout: sourceNumber('tools/agents-smoke/src/index.ts', /DEFAULT_TIMEOUT_MS = ([\d_]+)/),
    // s213-m02: "governed" is the predicate in component-contracts, and placement is what the latest runtime sweep's apps import.
    governedComponents: ledger.rows.filter(isGovernedComponent).length, governedDefinition: GOVERNED_DEFINITION,
    placedComponents: componentPlacement(ROOT, 'packages/mcp-server/registry/runtime-cells.v1.json').placed.size,
    components: ledger.rows.length, reactComponents: count('react', 'implemented-evidence-complete'), vueComponents: count('vue', 'implemented-evidence-complete'), htmlComponents: count('html', 'mapped'), contracts: Object.keys(componentContracts).length, scenarios: sharedScenarios.length,
    accessibleComponents: count('accessibility', 'verified'), themedComponents: count('theme', 'verified'), interactiveComponents: count('interaction', 'verified'), staticComponents: count('interaction', 'not-applicable'),
    nativeComponents: classification(ledger.rows, 'native'), recipeComponents: classification(ledger.rows, 'recipe'), aliasComponents: classification(ledger.rows, 'alias'),
    historicalRuntime: historical.rows.filter(row => row.proposedClassification !== 'authoring-only').length,
    historicalAuthoring: classification(historical.rows, 'authoring-only'), historicalNative: classification(historical.rows, 'native'), historicalRecipes: classification(historical.rows, 'recipe'),
    foundationReact: historical.foundationCells.filter(cell => cell.target === 'react' && cell.evaluation.candidate).length,
    foundationVue: historical.foundationCells.filter(cell => cell.target === 'vue' && cell.evaluation.candidate).length,
    foundationPromoted: promoted.foundationCells.filter(cell => cell.evaluation.foundationV1).length,
    foundationRoster: prose(unique(promoted.foundationCells.map(cell => cell.componentId)).sort()),
    tokenOutputs: words(Object.keys(tokenConfig.platforms).length), tokenVariables: new Set([...read('packages/tokens/dist/css/tokens.css').matchAll(/(--[a-zA-Z0-9_-]+):/g)].map(match => match[1])).size,
    tokenLeaves: baseLeaves[0], bridgedSlots: [...read('packages/tokens/scripts/brand-bridge.mjs').matchAll(/slot:\s*'(--theme-[^']+)'/g)].length,
    brandCountWord: capital(words(brands.length)), brandRoster: prose(brands), themeRoster: themes.join(', '), presetCountWord: words(presets.length), presetRoster: presets.join(', '),
    brandContrastRules: brandContrastRules(brands).length, brandContrastPairs: BRAND_CONTRAST_PAIRS.length, brandThemeCells: words(brands.length * themes.length), tokenContrastRules: DEFAULT_CONTRAST_RULES.length,
    composeContexts: schema('design.compose').properties.context.enum!.join(', '), composeLayouts: schema('design.compose').properties.layout.enum!.join(', '),
    uiNodeProperties: Object.keys(uiSchema.$defs.uiElement.properties).join(', '), uiRootProperties: Object.keys(uiSchema.properties).join(', '),
    renderLayouts: schema('design.compose').properties.layout.enum!.filter(value => value !== 'auto').join(', '),
    frameworks: schema('code.generate').properties.framework.enum!.join(' | '), styling: schema('code.generate').properties.options.properties!.styling.enum!.join(' | '),
    fidelitiesWord: words(schema('fidelity.preview').properties.fidelityKind.enum!.length),
    ttlMinutes: sourceNumber('packages/mcp-server/src/tools/schema-ref.ts', /return (\d+) \* 60 \* 1000;/),
    chartTypes: viz.properties.chartType.enum!.length, chartTypesWord: capital(words(viz.properties.chartType.enum!.length)),
    taxonomyIdentities: taxonomy.classified, taxonomyTypes: taxonomy.types, taxonomyPatterns: taxonomy.patterns + taxonomy.retiredPatterns, taxonomyRetiredPatterns: taxonomy.retiredPatterns, taxonomyFamiliesWord: words(taxonomy.families),
    cartesianCountWord: words(cartesian.length), primaryCountWord: words(primary.length), cartesianRoster: cartesian.join(', '), primaryRoster: primary.map(name => name.replaceAll('_', ' ')).join(', '),
    dashboardTypes: dashboardTypes.length, dashboardPrimaryWord: words(dashboardTypes.filter(value => primary.includes(value)).length),
    accuracyRules: ACCURACY_RULES.length + ECHARTS_ACCURACY_RULES.length,
    a11yRules: [...read('packages/viz-core/src/a11y/equivalence-rules.ts').matchAll(/id: 'A11Y-R-\d+'/g)].length,
    a11yDescriptionMinimum: sourceNumber('packages/viz-core/src/a11y/equivalence-rules.ts', /description.trim\(\).length >= (\d+)/),
    a11yFindingsRowMinimum: sourceNumber('packages/viz-core/src/a11y/equivalence-rules.ts', /analysis.rowCount < (\d+)/),
    a11yFindingsMinimumWord: words(sourceNumber('packages/viz-core/src/a11y/equivalence-rules.ts', /keyFindings.length >= (\d+)/)),
    statusTextRules: words(statusTextRules.length), statusIconRules: words(statusIconRules.length), darkContrastRules: words(DEFAULT_CONTRAST_RULES.filter(rule => rule.foreground.startsWith('theme-dark.')).length),
    textContrastThreshold: DEFAULT_CONTRAST_RULES.find(rule => rule.ruleId === 'text-on-surface')!.threshold,
    iconContrastThreshold: statusIconRules[0]?.threshold ?? (() => { throw new Error('Missing status icon rules.'); })(),
    certifyPillarsWord: words(json<{ properties: { pillars: { required: string[] } } }>('packages/mcp-server/src/schemas/artifact.certify.output.json').properties.pillars.required.length),
    releaseCells: release.rows.length, releasePass: release.rows.filter(row => row.status === 'pass').length,
    releaseTyped: release.rows.filter(row => row.status === 'typed-gap').length, releaseEqual: release.rows.filter(row => row.status === 'pass' && row.hashEqualToHost).length,
    releaseApps: prose(unique(release.rows.map(row => row.object)).sort()), releaseContexts: unique(release.rows.map(row => row.context)).length,
    releaseFrameworks: prose(unique(release.rows.map(row => row.framework)).sort()),
    releaseArchive: release.bundleHead.slice(0, 9),
    // A limits probe binds only to the archive the E2E ran (#2348); after a new archive and before its probe there is none.
    runtimeLimitSentence: (() => {
      const probed = tools.rows.filter(row => (row.portableLimits ?? []).some(limit => (limit as { source?: string }).source === 'limits-probe')).map(row => row.name);
      return probed.length
        ? `The exercised inputs do not cover every input: a limits probe of the same archive records what fails or does nothing from the runtime for ${prose(probed)}.`
        : 'The exercised inputs do not cover every input, and no limits probe has run against this archive yet.';
    })(),
  };
  return facts;
}

export function interpolate(template: string, facts: Facts): string {
  return template.replace(/\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g, (_, key: string) => {
    if (!(key in facts)) throw new Error(`Unknown claim fact: ${key}`);
    return String(facts[key]);
  });
}

export function renderMarkedClaims(content: string, claims: Record<string, string>, facts: Facts): string {
  const seen = new Set<string>();
  const rendered = content.replace(/<!-- forge-claim:([a-z0-9-]+) -->([\s\S]*?)<!-- \/forge-claim:\1 -->/g, (_, key: string) => {
    if (seen.has(key)) throw new Error(`Duplicate claim marker: ${key}`);
    if (!(key in claims)) throw new Error(`Unknown claim marker: ${key}`);
    seen.add(key);
    return `<!-- forge-claim:${key} -->${interpolate(claims[key], facts)}<!-- /forge-claim:${key} -->`;
  });
  for (const key of Object.keys(claims)) if (!seen.has(key)) throw new Error(`Missing claim marker: ${key}`);
  const markerCount = (content.match(/<!--\s*\/?forge-claim:/g) ?? []).length;
  if (markerCount !== seen.size * 2) throw new Error('Malformed or nested claim markers.');
  return rendered;
}

export function renderDocuments(facts: Facts, templates: Templates, documents: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(templates).map(([file, claims]) => [file,
    '$document' in claims ? interpolate(claims.$document, facts) : renderMarkedClaims(documents[file], claims, facts),
  ]));
}

export async function generateClaims(check = false): Promise<string[]> {
  const templates = json<Templates>(TEMPLATE_PATH);
  const originals = Object.fromEntries(Object.keys(templates).map(file => [file, fs.existsSync(path.join(ROOT, file)) ? read(file) : '']));
  const generated = renderDocuments(await collectFacts(), templates, originals);
  const changed = Object.keys(generated).filter(file => generated[file] !== originals[file]);
  if (!check) for (const file of changed) fs.writeFileSync(path.join(ROOT, file), generated[file]);
  return changed;
}

export function parseArguments(args: string[]): { check: boolean; root?: string } {
  let check = false;
  let root: string | undefined;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--') continue;
    if (arg === '--check') { check = true; continue; }
    if (arg === '--root') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error('--root requires a repository directory.');
      if (root !== undefined) throw new Error('--root may only be supplied once.');
      root = value;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { check, ...(root ? { root } : {}) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const options = parseArguments(process.argv.slice(2));
  if (options.root) {
    const target = fs.realpathSync(path.resolve(options.root));
    if (target !== fs.realpathSync(ROOT)) {
      // Execute the target copy: its TS imports, composer caches and JSON imports
      // must all resolve in the mutated repository, not in this generator's tree.
      const args = options.check ? ['--check'] : [];
      const child = spawnSync(process.execPath, [...process.execArgv, path.join(target, 'scripts/docs/generate-forge-claims.ts'), ...args], { cwd: target, stdio: 'inherit' });
      if (child.error) throw child.error;
      process.exit(child.status ?? 1);
    }
  }
  const check = options.check;
  const changed = await generateClaims(check);
  // s213-m02: every capability sentence on a served surface, generated or authored, must be supported by the ledgers and receipts.
  const unsupported = check ? checkCapabilityClaims(ROOT) : [];
  if (check && changed.length) {
    console.error(`Forge claims are stale: ${changed.join(', ')}. Run pnpm docs:claims.`);
    process.exitCode = 1;
  }
  if (unsupported.length) {
    for (const finding of unsupported) console.error(`Unsupported capability claim (${finding.rule}) in ${finding.file}: ${finding.sentence}`);
    process.exitCode = 1;
  }
  if (!process.exitCode) console.log(check ? 'Forge claims match every source-derived span and generated README, and every capability sentence is supported by the ledgers and receipts.' : `Generated Forge claims (${changed.length} files changed).`);
}
