import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getAjv } from '../../src/lib/ajv.js';
import inputSchema from '../../src/schemas/catalog.list.input.json' assert { type: 'json' };
import outputSchema from '../../src/schemas/catalog.list.output.json' assert { type: 'json' };
import {
  buildStoryIndex,
  handle,
  PRIMITIVE_PROP_SCHEMAS,
  transformComponentsToSummary,
} from '../../src/tools/catalog.list.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { readComponentsDataset } from '../../src/tools/catalog.shared.js';
import { resolveComponentCount } from '../../src/tools/catalog.shared.js';
import { renderMappedComponent } from '../../src/render/component-map.js';
import type {
  CatalogListInput,
  CatalogListOutput,
  ComponentCatalogEntry,
  ComponentCatalogSummary,
  ComponentProductReality,
} from '../../src/tools/types.js';
import type { UiElement } from '../../src/schemas/generated.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ajv = getAjv();
const validateInput = ajv.compile(inputSchema);
const validateOutput = ajv.compile(outputSchema);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../../../');
const codeConnectPathEnv = 'MCP_CODE_CONNECT_PATH';

describe('catalog.list', () => {
  let originalCodeConnectPathEnv: string | undefined;
  let codeConnectTmpDir: string;
  let codeConnectPath: string;

  beforeAll(() => {
    originalCodeConnectPathEnv = process.env[codeConnectPathEnv];
    codeConnectTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-catalog-code-connect-'));
    codeConnectPath = path.join(codeConnectTmpDir, 'code-connect.json');
    process.env[codeConnectPathEnv] = codeConnectPath;
  });

  afterAll(() => {
    if (originalCodeConnectPathEnv === undefined) {
      delete process.env[codeConnectPathEnv];
    } else {
      process.env[codeConnectPathEnv] = originalCodeConnectPathEnv;
    }

    fs.rmSync(codeConnectTmpDir, { recursive: true, force: true });
  });

  it('validates schema contracts', async () => {
    expect(validateInput({})).toBe(true);
    expect(validateInput({ category: 'core' })).toBe(true);
    expect(validateInput({ detail: 'summary' })).toBe(true);
    expect(validateInput({ page: 1, pageSize: 10 })).toBe(true);
    expect(validateInput({ unknown: true })).toBe(false);
    expect(validateInput({ detail: 'expanded' })).toBe(false);
    expect(validateInput({ page: 0 })).toBe(false);

    const output = await handle({});
    expect(validateOutput(output)).toBe(true);
    expect(validateOutput.errors).toBeNull();
  });

  it('should return component catalog', async () => {
    const input: CatalogListInput = {};
    const output: CatalogListOutput = await handle(input);

    expect(output).toBeDefined();
    expect(output.components).toBeDefined();
    expect(Array.isArray(output.components)).toBe(true);
    expect(output.totalCount).toBeGreaterThan(0);
    expect(output.returnedCount).toBe(output.components.length);
    expect(output.page).toBeGreaterThan(0);
    expect(output.pageSize).toBeGreaterThanOrEqual(0);
    expect(typeof output.hasMore).toBe('boolean');
    expect(output.detail).toBeDefined();
    expect(output.generatedAt).toBeDefined();
    expect(output.stats).toBeDefined();
    expect(output.stats.componentCount).toBeGreaterThan(0);
  });

  it('B-02 derives the catalog count from unique row IDs instead of stale stats', async () => {
    const components = Array.from({ length: 109 }, (_, index) => ({ id: `Component${index}` }));
    expect(resolveComponentCount({ stats: { componentCount: 101 }, components })).toBe(109);
    expect(resolveComponentCount({
      stats: { componentCount: 101 },
      components: [...components, { id: 'Component0' }],
    })).toBe(109);

    const output = await handle({});
    // s222-m02 (#2502 ruling 11): Switch and Dialog join the 110. s223-m02 (#2527 rulings 10-12): SegmentedControl and
    // Combobox join the 112.
    expect(output.totalCount).toBe(114);
    expect(output.stats.componentCount).toBe(114);
  });

  it('exposes accepted retained scope plus the declared graph addition without turning historical proposals into exclusions', async () => {
    const output = await handle({ detail: 'summary', pageSize: 200 });
    const data = readComponentsDataset<{ generatedAt: string; components: Array<{ id: string }>; obligationScope: unknown }>();
    expect(output.generatedAt).toBe(data.generatedAt);
    expect(output.components.map((row) => row.name).sort()).toEqual(data.components.map((row) => row.id).sort());
    expect(new Set(output.components.map((row) => row.name)).size).toBe(114);
    expect(output.obligationScope).toMatchObject(data.obligationScope as object);
    expect(output.obligationScope?.runtimeEvidence).toMatch(/packed runtime gates|runtime proof is unavailable/);
    // s222-m02: the denominator moved to 112 under decision #2502, as Sprint 199's graph moved it to 110 under #2054;
    // s223-m02 moved it to 114 under #2527.
    expect(output.obligationScope).toMatchObject({ decisionId: 2527, disposition: 'retain-all-obligations', controllingObligationDenominator: 114, approvedRuntimeCensus: null, classificationStatus: 'proposed-awaiting-approval' });
    expect(validateOutput(output)).toBe(true);
    expect(validateOutput({ ...output, obligationScope: { ...output.obligationScope, approvedRuntimeCensus: 98 } })).toBe(false);
    // Measured implementation changes the proposal, never the approved denominator. (Evidence is in detail full, s211-m01.)
    const full = await handle({ detail: 'full' });
    expect((full.components.find((row) => row.name === 'BillingAmountInput') as ComponentCatalogEntry)?.productReality?.proposedClassification).toBe('native');
  });

  it('keeps HTML stability, governed maturity, and actual public runtime placement distinct', async () => {
    const stable = await handle({ status: 'stable', detail: 'full', pageSize: 200 }) as { components: ComponentCatalogEntry[] };
    for (const component of ['ArchivePill', 'ArchiveEvent', 'BillingAmountInput'] as const) {
      const row = stable.components.find(entry => entry.name === component)!;
      expect(row.status).toBe('stable');
      for (const target of ['react', 'vue'] as const) {
        expect(row.productReality?.surfaces[target].state).toBe('implemented-evidence-complete');
        const result = await generate({ framework: target, profile: 'build', schema: { version: '1.0.0', screens: [{ id: 'discovery-probe', component }] } });
        expect(result.status, JSON.stringify(result.errors)).toBe('ok');
      }
      for (const surface of ['accessibility', 'theme'] as const) expect(row.productReality?.surfaces[surface].state).toBe('verified');
    }
    const fixtureOnly = stable.components.find(row => row.name === 'VizOpacityControls')!;
    expect(fixtureOnly.productReality?.surfaces.react.state).toBe('implemented-evidence-complete');
    expect(fixtureOnly.productReality?.surfaces.interaction.state).toBe('verified');
    expect(fixtureOnly.productReality?.surfaces.generatedConsumer).toMatchObject({ state: 'unavailable', reason: expect.stringContaining('No current runtime cell places this component') });
    // s233-m02: ArchiveEvent was placed only by repository integrations. Its implementation and HTML stability stay
    // available, while their removal from the public population honestly removes its generated-consumer claim.
    const repositoryOnly = stable.components.find(row => row.name === 'ArchiveEvent')!;
    expect(repositoryOnly.productReality?.surfaces.generatedConsumer).toMatchObject({ state: 'unavailable', reason: expect.stringContaining('No current runtime cell places this component') });
    const placed = stable.components.find(row => row.name === 'ArchivePill')!;
    expect(placed.productReality?.surfaces.interaction.state).toBe('not-applicable');
    expect(placed.productReality?.surfaces.generatedConsumer.state).toBe('implemented-evidence-complete');
    const runtimePath = 'packages/mcp-server/registry/runtime-cells.v1.json';
    const runtime = JSON.parse(fs.readFileSync(path.join(repoRoot, runtimePath), 'utf8'));
    const refs = placed.productReality!.surfaces.generatedConsumer.evidence;
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref.startsWith(`${runtimePath}#/rows/`)).toBe(true);
      const index = ref.split('#/rows/')[1];
      expect(index).toMatch(/^\d+$/);
      const cell = runtime.rows[Number(index)];
      expect(cell.status).toBe('pass');
      expect(cell.components).toContain(placed.name);
    }
    expect(runtime.rows.some((row: { components: string[] }) => row.components.includes(repositoryOnly.name))).toBe(false);
    const planned = await handle({ status: 'planned', detail: 'full', pageSize: 200 });
    expect(planned.components.some(row => row.name === 'BillingAmountInput')).toBe(false);
  });

  it('passes additive target-specific product reality through summary output', async () => {
    const evidence = (state: string) => ({ state, evidence: [`evidence/${state}.json`] });
    const productReality: ComponentProductReality = {
      schemaVersion: '1.0.0',
      proposedClassification: 'native',
      reconciliationState: 'proposed-awaiting-approval',
      surfaces: {
        contract: evidence('versioned-v1'),
        metadata: evidence('available'),
        html: evidence('mapped'),
        react: evidence('implemented-unverified'),
        vue: evidence('unavailable'),
        generatedConsumer: evidence('unavailable'),
        accessibility: evidence('unverified'),
        theme: evidence('unverified'),
        interaction: evidence('unverified'),
      },
    };
    const [summary] = transformComponentsToSummary({
      components: [{
        id: 'SyntheticComponent',
        displayName: 'Synthetic component',
        categories: [],
        tags: [],
        contexts: [],
        regions: [],
        traitUsages: [],
        productReality,
      }],
    });

    expect(summary.productReality).toEqual(productReality);

    const output = await handle({});
    const schemaCandidate = {
      ...output,
      components: [summary],
      totalCount: 1,
      returnedCount: 1,
      pageSize: 1,
      hasMore: false,
    };
    expect(validateOutput(schemaCandidate)).toBe(true);
    expect(validateOutput.errors).toBeNull();
  });

  it('should default to brief mode with pagination for unfiltered calls', async () => {
    const output: CatalogListOutput = await handle({});

    // s211-m01: an unfiltered call answers each component's name, categories and one readiness label.
    // s212-m01 added what each component is: its one-line description from component-contracts' descriptions.json,
    // which export generation requires for every component (sprint-213/m01/base-failures.md).
    expect(output.detail).toBe('brief');
    for (const component of output.components) {
      expect(Object.keys(component).sort()).toEqual(['categories', 'description', 'name', 'readiness']);
      expect((component as { description?: string }).description, component.name).toMatch(/^[^\n]+$/);
    }
    expect(output.returnedCount).toBe(output.components.length);
    expect(output.totalCount).toBeGreaterThanOrEqual(output.returnedCount);
    if (output.pageSize > 0) {
      expect(output.components.length).toBeLessThanOrEqual(output.pageSize);
    }

    const firstComponent = output.components[0] as any;
    if (firstComponent) {
      expect(firstComponent.propSchema).toBeUndefined();
      expect(firstComponent.slots).toBeUndefined();
      expect(firstComponent.codeReferences).toBeUndefined();
      expect(firstComponent.codeSnippet).toBeUndefined();
    }
  });

  it('should allow explicit full detail without default pagination', async () => {
    const output: CatalogListOutput = await handle({ detail: 'full' });

    expect(output.detail).toBe('full');
    expect(output.hasMore).toBe(false);
    expect(output.totalCount).toBe(output.components.length);
  });

  it('should paginate when page/pageSize are provided', async () => {
    const firstPage: CatalogListOutput = await handle({ detail: 'summary', page: 1, pageSize: 1 });

    expect(firstPage.page).toBe(1);
    expect(firstPage.pageSize).toBe(1);
    expect(firstPage.returnedCount).toBe(firstPage.components.length);
    expect(firstPage.returnedCount).toBeLessThanOrEqual(1);

    if (firstPage.totalCount > 1) {
      const secondPage: CatalogListOutput = await handle({ detail: 'summary', page: 2, pageSize: 1 });
      expect(secondPage.page).toBe(2);
      expect(secondPage.pageSize).toBe(1);
      expect(secondPage.returnedCount).toBeLessThanOrEqual(1);
      if (firstPage.components[0] && secondPage.components[0]) {
        expect(firstPage.components[0].name).not.toBe(secondPage.components[0].name);
      }
    }
  });

  it('should include component properties', async () => {
    const input: CatalogListInput = { detail: 'full' };
    const output: CatalogListOutput = await handle(input);

    expect(output.components.length).toBeGreaterThan(0);

    const firstComponent = output.components[0];
    expect(firstComponent.name).toBeDefined();
    expect(firstComponent.displayName).toBeDefined();
    expect(Array.isArray(firstComponent.categories)).toBe(true);
    expect(Array.isArray(firstComponent.tags)).toBe(true);
    expect(Array.isArray(firstComponent.contexts)).toBe(true);
    expect(Array.isArray(firstComponent.regions)).toBe(true);
    expect(Array.isArray(firstComponent.traits)).toBe(true);
    expect(typeof firstComponent.propSchema).toBe('object');
    expect(typeof firstComponent.slots).toBe('object');
  });

  it('should filter by category', async () => {
    const input: CatalogListInput = { category: 'core' };
    const output: CatalogListOutput = await handle(input);

    expect(output.components.length).toBeGreaterThan(0);
    expect(output.components.every((c) => c.categories.includes('core'))).toBe(true);
  });

  it('includes filteredCount in stats when filters are active', async () => {
    const output: CatalogListOutput = await handle({ category: 'financial' });

    expect(output.stats.filteredCount).toBeDefined();
    expect(output.stats.filteredCount).toBe(output.totalCount);
    expect(output.stats.filteredCount).toBe(output.returnedCount);
    expect(output.stats.componentCount).toBeGreaterThanOrEqual(output.stats.filteredCount ?? 0);
  });

  it('should filter by trait', async () => {
    const allComponents = await handle({ detail: 'summary' }) as { components: ComponentCatalogSummary[] };

    // Find a trait that exists
    const availableTraits = new Set<string>();
    allComponents.components.forEach((c) => {
      c.traits.forEach((t) => availableTraits.add(t));
    });

    if (availableTraits.size > 0) {
      const testTrait = Array.from(availableTraits)[0];
      const input: CatalogListInput = { trait: testTrait };
      const output: CatalogListOutput = await handle(input);

      expect(output.components.length).toBeGreaterThan(0);
      expect(output.components.every((c) => c.traits.includes(testTrait))).toBe(true);
    }
  });

  it('suggests traits when a trait filter returns zero results', async () => {
    const allComponents = await handle({ detail: 'summary' }) as { components: ComponentCatalogSummary[] };
    const availableTraits = new Set<string>();
    allComponents.components.forEach((c) => {
      c.traits.forEach((t) => availableTraits.add(t));
    });

    if (availableTraits.size > 0) {
      const knownTrait = Array.from(availableTraits)[0];
      let query = knownTrait.toLowerCase();
      if (query === knownTrait) {
        query = `${knownTrait}x`;
      }
      const output: CatalogListOutput = await handle({ trait: query });

      expect(output.components.length).toBe(0);
      expect(output.suggestions?.traits).toContain(knownTrait);
    }
  });

  it('should filter by context', async () => {
    const allComponents = await handle({ detail: 'summary' }) as { components: ComponentCatalogSummary[] };

    // Find a context that exists
    const availableContexts = new Set<string>();
    allComponents.components.forEach((c) => {
      c.contexts.forEach((ctx) => availableContexts.add(ctx));
    });

    if (availableContexts.size > 0) {
      const testContext = Array.from(availableContexts)[0];
      const input: CatalogListInput = { context: testContext };
      const output: CatalogListOutput = await handle(input);

      expect(output.components.length).toBeGreaterThan(0);
      expect(output.components.every((c) => c.contexts.includes(testContext))).toBe(true);
    }
  });

  it('keeps the filtered total distinct from the bounded default page', async () => {
    const input: CatalogListInput = { category: 'core' };
    const output: CatalogListOutput = await handle(input);

    expect(output.totalCount).toBeGreaterThan(output.components.length);
    expect(output.components).toHaveLength(10);
    expect(output.nextPage).toMatchObject({ category: 'core', page: 2, pageSize: 10 });
    expect(output.returnedCount).toBe(output.components.length);
  });

  it('deduplicates trait names per component', async () => {
    const output: CatalogListOutput = await handle({ detail: 'full' });
    const statusBadge = output.components.find((c) => c.name === 'StatusBadge');

    expect(statusBadge).toBeDefined();
    if (statusBadge) {
      const unique = new Set(statusBadge.traits);
      expect(statusBadge.traits.length).toBe(unique.size);
      // s212-m01 adopted the fresh export (#2324), the first to record Assessable (s205-m03) and Supersedable (s203-m02),
      // whose view extensions place StatusBadge; each trait is named once however many contexts it places it in.
      expect(statusBadge.traits).toEqual(['Assessable', 'Stateful', 'Statusable', 'Supersedable']);
    }
  });

  it('should include propSchema for components with traits', async () => {
    const output: CatalogListOutput = await handle({ detail: 'full' });

    const componentsWithTraits = output.components.filter((c) => c.traits.length > 0);
    expect(componentsWithTraits.length).toBeGreaterThan(0);

    // Components with traits might have prop schemas derived from those traits
    const componentsWithProps = componentsWithTraits.filter(
      (c) => Object.keys(c.propSchema).length > 0
    );

    // Note: Not all components with traits will have props, but some should
    expect(componentsWithProps.length).toBeGreaterThan(0);
  });

  it('should have valid structure for propSchema entries', async () => {
    const output: CatalogListOutput = await handle({ detail: 'full' });

    const componentWithProps = output.components.find(
      (c) => Object.keys(c.propSchema).length > 0
    );

    if (componentWithProps) {
      const propKeys = Object.keys(componentWithProps.propSchema);
      expect(propKeys.length).toBeGreaterThan(0);

      // Each prop should have metadata
      propKeys.forEach((key) => {
        const propMeta = componentWithProps.propSchema[key] as any;
        expect(propMeta).toBeDefined();
        expect(typeof propMeta).toBe('object');
      });
    }
  });

  it('surfaces real content props in propSchema for primitive components (Workbench signal)', async () => {
    const output: CatalogListOutput = await handle({ detail: 'full' });
    const byName = new Map(output.components.map((c) => [c.name, c]));

    for (const [componentName, props] of Object.entries(PRIMITIVE_PROP_SCHEMAS)) {
      const component = byName.get(componentName);
      expect(component, `${componentName} should be in the catalog`).toBeDefined();
      if (!component) continue;

      // Primitives have empty traitUsages, so every advertised prop must be surfaced.
      for (const [propName, entry] of Object.entries(props)) {
        const surfaced = component.propSchema[propName] as
          | { type?: string; description?: string; source?: string }
          | undefined;
        expect(surfaced, `${componentName}.${propName} should be advertised`).toBeDefined();
        expect(surfaced?.type).toBe(entry.type);
        expect(surfaced?.source).toBe('primitive-renderer');
        expect(typeof surfaced?.description).toBe('string');
      }
    }

    // The exact case from the Workbench report: Text advertises `text`, not `content`.
    const text = byName.get('Text');
    expect(Object.keys(text?.propSchema ?? {})).toContain('text');
    expect(Object.keys(text?.propSchema ?? {})).not.toContain('content');
  });

  it('advertised primitive content props actually render (parity guard vs renderer drift)', () => {
    const el = (component: string, props: Record<string, unknown>): UiElement =>
      ({ id: `${component}-1`, component, props }) as UiElement;

    const cases: Array<{ component: string; props: Record<string, unknown>; expected: string }> = [
      { component: 'Text', props: { text: 'Hello world' }, expected: 'Hello world' },
      { component: 'Button', props: { label: 'Save changes' }, expected: 'Save changes' },
      { component: 'Card', props: { body: 'Card body copy' }, expected: 'Card body copy' },
      { component: 'Select', props: { options: ['Alpha', 'Beta'] }, expected: '<option' },
      { component: 'Tabs', props: { tabs: ['Overview', 'Details'] }, expected: 'Overview' },
      { component: 'Table', props: { columns: ['Name'], rows: [{ Name: 'Acme' }] }, expected: 'Name' },
      { component: 'Input', props: { value: 'typed value' }, expected: 'typed value' },
    ];

    for (const { component, props, expected } of cases) {
      const html = renderMappedComponent(el(component, props), '');
      expect(html, `${component} should render its advertised content prop`).toContain(expected);
    }
  });

  it('should have valid structure for slots', async () => {
    const output: CatalogListOutput = await handle({ detail: 'full' });

    const componentWithSlots = output.components.find(
      (c) => Object.keys(c.slots).length > 0
    );

    if (componentWithSlots) {
      const slotKeys = Object.keys(componentWithSlots.slots);
      expect(slotKeys.length).toBeGreaterThan(0);

      slotKeys.forEach((slotName) => {
        const slot = componentWithSlots.slots[slotName];
        expect(slot).toBeDefined();

        if (slot.accept) {
          expect(Array.isArray(slot.accept)).toBe(true);
        }

        if (slot.role) {
          expect(typeof slot.role).toBe('string');
        }
      });
    }
  });

  it('indexes only explicit Storybook parameters.oodsComponentId(s)', () => {
    const storiesDir = path.join(codeConnectTmpDir, 'stories');
    fs.mkdirSync(storiesDir, { recursive: true });
    fs.writeFileSync(path.join(storiesDir, 'Explicit.stories.tsx'), [
      "import { TagInput } from '@oods/components-react';",
      'const meta = {',
      "  title: 'Components/Explicit',",
      '  parameters: {',
      "    oodsComponentId: 'TagInput',",
      "    oodsComponentIds: ['TagManager'],",
      '  },',
      '};',
      'export default meta;',
      'export const Demo = () => <TagInput />;',
    ].join('\n'));
    fs.writeFileSync(path.join(storiesDir, 'ProseOnly.stories.tsx'), [
      "import { TemplatePicker } from '@oods/components-react';",
      "const arbitraryObject = { parameters: { oodsComponentId: 'TemplatePicker' } };",
      "const meta = { title: 'Components/TemplatePicker' };",
      '// parameters: { oodsComponentId: \'TemplatePicker\' },',
      "const prose = \"parameters: { oodsComponentId: 'TemplatePicker' }\";",
      "const unrelated = { oodsComponentId: 'TemplatePicker' };",
      'export default meta;',
      'export const Demo = () => <TemplatePicker />;',
    ].join('\n'));

    const index = buildStoryIndex(['TagInput', 'TagManager', 'TemplatePicker'], storiesDir);
    expect(index.get('TagInput')).toHaveLength(1);
    expect(index.get('TagInput')?.[0]?.snippet).toContain("import { TagInput }");
    expect(index.get('TagManager')).toHaveLength(1);
    expect(index.has('TemplatePicker')).toBe(false);
  });

  it('should prefer code-connect snippets when available', async () => {
    try {
      const payload = {
        generatedAt: new Date().toISOString(),
        components: {
          TagInput: [
            {
              path: 'upstream/stories/components/classification/TagInput.stories.tsx',
              snippet: '// code-connect: TagInput usage example',
            },
          ],
        },
      };

      fs.writeFileSync(codeConnectPath, JSON.stringify(payload, null, 2));

      const output: CatalogListOutput = await handle({ detail: 'full' });
      const byName = new Map(output.components.map((component) => [component.name, component]));
      const tagInput = byName.get('TagInput');

      expect(tagInput).toBeDefined();
      expect(tagInput?.codeReferences?.some((ref) => ref.kind === 'code-connect')).toBe(true);
      expect(tagInput?.codeSnippet).toBe('// code-connect: TagInput usage example');
    } finally {
      fs.rmSync(codeConnectPath, { force: true });
    }
  });

  // ── Status filter tests ──

  it('every component has a non-empty status field', async () => {
    const output = await handle({ detail: 'summary' }) as { components: ComponentCatalogSummary[] };
    for (const component of output.components) {
      expect(component.status).toBeDefined();
      expect(['stable', 'beta', 'planned']).toContain(component.status);
    }
  });

  it('documents legacy status as static HTML-renderer-only', () => {
    const componentSchema = outputSchema.$defs.componentEntry;
    expect(componentSchema.properties.status.description).toMatch(/static-HTML renderer status only/i);
    expect(componentSchema.properties.status.description).toMatch(/not a React, Vue, code-generation, or release-readiness claim/i);
  });

  it('filters by status=stable', async () => {
    const output: CatalogListOutput = await handle({ status: 'stable' });
    expect(output.totalCount).toBeGreaterThan(0);
    for (const component of output.components) {
      expect(component.status).toBe('stable');
    }
  });

  // s222-m02 (#2502 ruling 11): Switch and Dialog each have an HTML renderer, so the mapped census is 112; s223-m02 (#2527):
  // SegmentedControl and Combobox have theirs, 114.
  it('keeps the legacy status census scoped to the 114 mapped / 0 fallback HTML surface after the three disputed roots', async () => {
    const stable = await handle({ status: 'stable' });
    const planned = await handle({ status: 'planned' });
    const beta = await handle({ status: 'beta' });

    expect(stable.totalCount).toBe(114);
    expect(planned.totalCount).toBe(0);
    expect(beta.totalCount).toBe(0);
  });

  // s222-m03 (#2502 ruling 16, V120): Communicable no longer places MessageEventTimeline on the timeline, whose template
  // has no slot for it; the component itself stays in the catalog, stable, with no trait placing it.
  it('all 3 Communicable components have stable status', async () => {
    const output: CatalogListOutput = await handle({ trait: 'Communicable', detail: 'summary' });
    const communicableNames = output.components.map((c) => c.name);
    expect(communicableNames.sort()).toEqual(['CommunicationDetailPanel', 'MessageStatusBadge', 'TemplatePicker']);

    for (const component of output.components) {
      expect(component.status).toBe('stable');
    }
    const timeline = (await handle({ detail: 'summary', pageSize: 500 })).components.find((c) => c.name === 'MessageEventTimeline');
    expect(timeline).toMatchObject({ status: 'stable', traits: [] });
  });

  it('status filter validates in input schema', () => {
    expect(validateInput({ status: 'stable' })).toBe(true);
    expect(validateInput({ status: 'planned' })).toBe(true);
    expect(validateInput({ status: 'beta' })).toBe(true);
    expect(validateInput({ status: 'invalid' })).toBe(false);
  });
});
