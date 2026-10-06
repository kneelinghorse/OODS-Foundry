/**
 * Object-aware compose → validate → render → target-readiness preflight.
 *
 * HTML remains usable for the complete object schemas. React and Vue now build
 * the fully ported Subscription list, while compositions that still contain an
 * unavailable component fail loudly instead of returning a partial payload.
 */
import { describe, expect, it } from 'vitest';
import type { UiSchema } from '../../src/schemas/generated.js';
import { handle as composeHandle } from '../../src/tools/design.compose.js';
import { handle as codegenHandle } from '../../src/tools/code.generate.js';
import { handle as validateHandle } from '../../src/tools/repl.validate.js';
import { handle as renderHandle } from '../../src/tools/repl.render.js';
import { validateGeneratedArtifact } from '../../src/codegen/artifact-envelope.js';
import { chartNodes } from '../../src/codegen/chart-declaration.js';
import { preflightTargetCapabilities } from '../../src/codegen/target-readiness.js';

type Framework = 'react' | 'vue';
type AffectedNode = readonly [nodeId: string, component: string];

const USER_DETAIL_NEWLY_READY: readonly AffectedNode[] = [
  ['ve-header-29', 'TagSummary'],
  ['slot-tab-1-6', 'MembershipPanel'],
  ['slot-tab-2-8', 'AddressCollectionPanel'],
  ['slot-tab-3-15', 'PreferencePanel'],
];

const DASHBOARD_NEWLY_READY: readonly AffectedNode[] = [
  ['slot-header-2', 'DetailHeader'],
  ['slot-main-content-6', 'VizAreaPreview'],
];

function countNodes(schema: UiSchema): number {
  let count = 0;
  const visit = (nodes: ReadonlyArray<UiSchema['screens'][number]>): void => {
    for (const node of nodes) {
      count += 1;
      if (node.children) visit(node.children);
    }
  };
  visit(schema.screens);
  return count;
}

function countComponents(schema: UiSchema): number {
  const ids = new Set<string>();
  const visit = (nodes: ReadonlyArray<UiSchema['screens'][number]>): void => {
    for (const node of nodes) {
      ids.add(node.component);
      if (node.children) visit(node.children);
    }
  };
  visit(schema.screens);
  return ids.size;
}

async function expectTargetGenerated(
  schemaRef: string,
  schema: UiSchema,
  framework: Framework,
): Promise<void> {
  const result = await codegenHandle({
    schemaRef,
    framework,
    options: { typescript: true, styling: 'tokens' },
  });

  expect(result).toMatchObject({
    status: 'ok',
    framework,
    warnings: [],
    meta: {
      nodeCount: countNodes(schema),
      componentCount: countComponents(schema),
    },
  });
  expect(result.errors).toBeUndefined();
  expect(result.code.length).toBeGreaterThan(0);
  expect(result.code).toContain(`from '@oods/components-${framework}'`);
  expect(result.code).toContain("import '@oods/component-styles/css';");
  expect(result.imports).toEqual(expect.arrayContaining([
    `@oods/components-${framework}`,
    '@oods/component-styles/css',
  ]));
  expect(result.imports).not.toContain(`@oods/components-${framework}/ported`);
  expect(result.imports).not.toContain('@oods/component-styles/css-ported');
  const assets = result.artifact!.files.filter(file => file.path.endsWith('.svg'));
  // Every placed chart ships its design-size render and its narrow render (Sprint 202 m01), and the wide render a
  // desktop column shows (s213-m01, finding 5); s222-m02 (F7): the three in each of the light, dark and hc themes.
  expect(assets).toHaveLength(chartNodes(schema.screens).length * 9);
  expect(result.artifact?.files).toHaveLength(1 + assets.length);
  for (const asset of assets) {
    expect(asset.contents).toContain('role="graphics-object"');
    expect(result.code).toContain(JSON.stringify(asset.contents).slice(1, -1));
  }
  expect(result.artifact?.files[0]?.contents.length).toBeGreaterThan(0);
  expect(result.validationReceipt.checks).toEqual(expect.arrayContaining([
    'target-readiness',
    'dependency-closure',
  ]));
}

async function composeAndCheck(
  object: 'Subscription' | 'User',
  context: 'detail' | 'list',
): Promise<void> {
  const compose = await composeHandle({ object, context });
  expect(compose.status).toBe('ok');
  expect(compose.schemaRef).toBeTruthy();
  expect(compose.objectUsed?.name).toBe(object);
  expect(compose.objectUsed?.traits.length).toBeGreaterThan(0);
  expect(compose.objectUsed?.fieldsComposed).toBeGreaterThan(0);
  expect(compose.schema.objectSchema).toBeDefined();

  const rootBindings = compose.schema.screens[0].bindings;
  if (context === 'detail') {
    expect(rootBindings?.onEdit).toBe('handleEdit');
    expect(rootBindings?.onDelete).toBe('handleDelete');
  } else {
    expect(rootBindings?.onRowClick).toBe('handleRowClick');
    expect(rootBindings?.onSort).toBe('handleSort');
    expect(rootBindings?.onFilter).toBe('handleFilter');
  }

  const schemaRef = compose.schemaRef!;
  const validation = await validateHandle({ mode: 'full', schemaRef });
  expect(validation.status).toBe('ok');

  const render = await renderHandle({ mode: 'full', schemaRef, apply: true });
  expect(render.status).toBe('ok');
  expect(render.html).toContain('<!DOCTYPE html>');
  expect(render.html).toContain('data-oods-component=');
  expect(render.html!.match(/data-oods-component=/g)?.length ?? 0).toBeGreaterThan(1);

  for (const framework of ['react', 'vue'] as const) {
    await expectTargetGenerated(schemaRef, compose.schema, framework);
  }
}

describe('E2E object codegen target readiness', () => {
  it('builds the original Subscription detail now that ArchiveSummary is governed', async () => {
    await composeAndCheck('Subscription', 'detail');
  });

  it('builds the fully ported Subscription list for both framework targets', async () => {
    await composeAndCheck('Subscription', 'list');
  });

  it('keeps the original User detail tree and builds it after the StatusTimeline binding repair', async () => {
    const compose = await composeHandle({ object: 'User', context: 'detail' });
    expect(compose.status).toBe('ok');
    expect(compose.schemaRef).toBeTruthy();
    expect(compose.objectUsed?.name).toBe('User');
    expect(compose.schema.objectSchema).toBeDefined();
    expect(compose.schema.screens[0].bindings).toMatchObject({ onEdit: 'handleEdit', onDelete: 'handleDelete' });
    const schemaRef = compose.schemaRef!;
    expect((await validateHandle({ mode: 'full', schemaRef })).status).toBe('ok');
    const render = await renderHandle({ mode: 'full', schemaRef, apply: true });
    expect(render.status).toBe('ok');
    expect(render.html).toContain('<!DOCTYPE html>');
    for (const [nodeId, component] of USER_DETAIL_NEWLY_READY) {
      expect(render.html).toContain(`id="${nodeId}"`);
      expect(render.html).toContain(`data-oods-component="${component}"`);
    }

    for (const framework of ['react', 'vue'] as const) {
      expect(preflightTargetCapabilities(compose.schema.screens, framework)).toEqual([]);
      await expectTargetGenerated(schemaRef, compose.schema, framework);
    }
  });

  it('keeps objectSchema field metadata through successful framework emission', async () => {
    const compose = await composeHandle({ object: 'Subscription', context: 'detail' });
    expect(compose.status).toBe('ok');
    expect(Object.keys(compose.schema.objectSchema ?? {}).length).toBeGreaterThan(5);
    for (const entry of Object.values(compose.schema.objectSchema ?? {})) {
      expect(entry.type).toBeTruthy();
      expect(typeof entry.required).toBe('boolean');
    }

    await expectTargetGenerated(compose.schemaRef!, compose.schema, 'react');
  });

  it('builds the unchanged intent-only dashboard through both root component packages', async () => {
    const compose = await composeHandle({ intent: 'dashboard with metrics' });
    expect(compose.status).toBe('ok');
    expect(compose.schemaRef).toBeTruthy();
    expect(compose.schema.objectSchema).toBeUndefined();

    // DetailHeader and VizAreaPreview now have real root exports. Keep the
    // original intent and prove the full composed tree survives generation.
    for (const framework of ['react', 'vue'] as const) {
      const result = await codegenHandle({
        schemaRef: compose.schemaRef!,
        framework,
        options: { typescript: true, styling: 'tokens' },
      });
      expect(result, JSON.stringify(result.errors ?? [])).toMatchObject({
        status: 'ok', framework, warnings: [],
        meta: { nodeCount: countNodes(compose.schema), componentCount: countComponents(compose.schema) },
      });
      expect(result.errors).toBeUndefined();
      expect(result.imports).toEqual(expect.arrayContaining([
        `@oods/components-${framework}`, '@oods/component-styles/css',
      ]));
      expect(result.imports).not.toContain(`@oods/components-${framework}/ported`);
      expect(result.code).toContain(`from '@oods/components-${framework}'`);
      expect(result.code).toContain("import '@oods/component-styles/css';");
      expect(result.code.match(/data-oods-component=/g)).toHaveLength(countNodes(compose.schema));
      for (const [nodeId, component] of DASHBOARD_NEWLY_READY) {
        expect(result.code).toContain(`<${component} `);
        expect(result.code).toContain(`id="${nodeId}"`);
        expect(result.code).toContain(`data-oods-component="${component}"`);
      }
      expect(result.artifact).toBeDefined();
      expect(result.artifact!.files).toHaveLength(1);
      expect(result.artifact!.files[0]!.contents).toBe(result.code);
      expect(result.artifact!.actions).toEqual([]);
      expect(validateGeneratedArtifact(result.artifact!)).toEqual([]);
      expect(result.validationReceipt.checks).toEqual(expect.arrayContaining([
        'target-readiness', 'normalization-fidelity', 'props-contract', 'dependency-closure',
      ]));
    }
  });
});
