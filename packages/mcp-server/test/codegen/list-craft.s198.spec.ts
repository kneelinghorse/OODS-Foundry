import { describe, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { OBJECTS, contextsForObject } from '../../src/lib/runtime-ledger.js';
import { populateListStates } from '../../src/compose/collections.js';
import { typecheckWorkflow } from '../product-reality/workflow-typecheck.js';
import type { UiElement } from '../../src/schemas/generated.js';
const walk = (nodes: UiElement[]): UiElement[] => nodes.flatMap(node => [node, ...walk(node.children ?? [])]);

describe('s198 standalone list craft stays at the producer boundary', () => {
  it.each(OBJECTS.filter(object => contextsForObject(object).includes('list')))('%s has one working search, row and paginator, without duplicate action buttons', async object => {
    const composition = await compose({ object, context: 'list' });
    expect(composition.status).toBe('ok');
    const nodes = walk(composition.schema.screens);
    for (const control of ['search', 'page', 'open']) expect(nodes.filter(node => node.collectionControl === control), `${object}/${control}`).toHaveLength(1);
    expect(nodes.filter(node => node.component === 'SearchInput')).toHaveLength(1);
    // Sprint 201 m06 (#2046 doubled empty states): the rows collection's own banner is the empty branch.
    expect(nodes.filter(node => node.state).map(node => node.state).sort()).toEqual(['empty', 'error', 'loading', 'success']);
    expect(nodes.find(node => node.state === 'empty')?.collectionControl).toBe('empty');
    const before = JSON.stringify(composition.schema);
    populateListStates(composition.schema);
    expect(JSON.stringify(composition.schema)).toBe(before);
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema: composition.schema, framework, profile: 'build' });
      expect(result.status, JSON.stringify(result.errors)).toBe('ok');
      expect(result.code).not.toMatch(/>Filter<|>Open row<|>Sort<|>Change page</);
      expect(result.code).toContain('collectionQuery.total ?? rows.length');
      expect(result.code).toContain('data-oods-collection-toolbar="true"');
    }
  });
  it('uses Organization label once and sorts that displayed value instead of its internal ID', async () => {
    const { schema } = await compose({ object: 'Organization', context: 'list' });
    const nodes = walk(schema.screens);
    expect(nodes.find(node => node.collection)?.collection?.labelField).toBe('label');
    expect(nodes.find(node => node.collectionControl === 'sort')?.props?.field).toBe('label');
    const row = nodes.find(node => node.collectionControl === 'open')!;
    expect(walk([row]).filter(node => node.props?.field === 'label')).toHaveLength(1);
  });
  it.each(['react', 'vue'] as const)('%s derives open string status choices from actual rows', async framework => {
    const { schema } = await compose({ object: 'User', context: 'list' });
    // User now resolves Stateful's declared enum; explicitly exercise an open vocabulary.
    delete schema.objectSchema!.status!.enum;
    walk(schema.screens).find(node => node.collectionControl === 'filter')!.props!.options = [{ value: '', label: 'All states' }];
    const result = await generate({ schema, framework, profile: 'build' });
    expect(result.code).toContain("rows.map(function(row) { return String(row.status ?? ''); })");
    expect(result.code).toContain("collectionQuery.status ?? ''");
  });
  it.each(['react', 'vue'] as const)('%s compiles the string-status lists with strict public props', async framework => {
    for (const object of ['Organization', 'User']) {
      const { schema } = await compose({ object, context: 'list' });
      const result = await generate({ schema, framework, profile: 'build' });
      expect(result.status).toBe('ok');
      const check = typecheckWorkflow({ ...result.artifact!, files: [...result.artifact!.files, {
        path: 'tsconfig.json', contents: JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true, jsx: 'react-jsx', esModuleInterop: true, skipLibCheck: false, noEmit: true, lib: ['ES2022', 'DOM', 'DOM.Iterable'] }, include: ['src'] }),
      }] });
      expect(check.status, object + check.stdout + check.stderr).toBe(0);
    }
  }, 60_000);
});

describe('list badge fallback parity', () => {
  it('preserves authored casing and omits invented icons for unregistered statuses in both frameworks', async () => {
    const { createRequire } = await import('node:module');
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { StatusBadge } = await import('../../../components-react/src/ported.js');
    const requireVue = createRequire(new URL('../../../components-vue/package.json', import.meta.url));
    const { h } = requireVue('vue');
    const { renderToString } = requireVue('@vue/server-renderer');
    const Vue = requireVue('@oods/components-vue');
    for (const status of ['prospect', 'Consumer status', 'pending_cancellation']) {
      for (const content of [undefined, 'Authored label']) {
        const props = { status, content };
        const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        const react = text(renderToStaticMarkup(createElement(StatusBadge, props)));
        const vue = text(await renderToString(h(Vue.StatusBadge, props)));
        expect(vue).toBe(react);
        if (content) expect(react).toContain(content);
        if (status === 'Consumer status' && !content) expect(react).toBe('Consumer status');
      }
    }
  });
});
