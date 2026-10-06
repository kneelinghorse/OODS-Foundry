import { describe, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { reconcileFormDetail } from '../../src/compose/form-detail.js';
import { composeObject } from '../../src/objects/trait-composer.js';
import { loadObject } from '../../src/objects/object-loader.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';

const nodes = (roots: UiElement[]): UiElement[] => roots.flatMap(node => [node, ...nodes(node.children ?? [])]);

describe('form headings describe the screen rather than an arbitrary scalar (s230-m04)', () => {
  it.each([undefined, { title: 'Text' }])('names the Plan form with title choice %j and retains its name editor', async componentOverrides => {
    const result = await compose({ object: 'Plan', context: 'form', preferences: { componentOverrides }, options: { transient: true } });
    expect(result.status).toBe('ok');
    const tree = nodes(result.schema.screens);
    // The generic title slot previously consumed consumed_quantity and rendered the heading as "0".
    expect(tree.some(node => node.props?.as === 'h1' && node.props?.field)).toBe(false);
    expect(tree.find(node => node.component === 'Input' && node.props?.field === 'plan_name')?.bindings?.onChange).toBe('handleChange_plan_name');
    for (const framework of ['react', 'vue', 'html'] as const) {
      const generated = await generate({ schema: result.schema, framework, profile: 'build' });
      expect(generated.status, JSON.stringify(generated.errors)).toBe('ok');
      expect(generated.code).toContain('>Plan form</h1>');
    }
  });

  it('keeps authored headings and field editors even when they name a scalar', () => {
    const authored: UiElement[] = [
      { id: 'form-title-1', component: 'Text', props: { as: 'h1', content: 'Edit your plan' }, meta: { intent: 'slot:title' } },
      { id: 'record-heading', component: 'Text', props: { as: 'h1', field: 'plan_name' } },
      { id: 'plan-name', component: 'Input', props: { field: 'plan_name' }, bindings: { onChange: 'handleChange_plan_name' } },
    ];
    const schema: UiSchema = { version: '2026.02', screens: [{ id: 'screen-form-2', component: 'Stack', children: structuredClone(authored) }] };
    reconcileFormDetail(schema, 'form', composeObject(loadObject('Plan')));
    expect(schema.screens[0].children).toEqual(authored);
  });

  it('recreates the required editor when an unfilled title was the only binding', () => {
    const schema: UiSchema = { version: '2026.02', objectSchema: { plan_name: { type: 'string', required: true } }, screens: [
      { id: 'screen-form-3', component: 'Stack', children: [
        { id: 'form-title-1', component: 'Text', props: { as: 'h1', field: 'plan_name' }, meta: { intent: 'slot:title' } },
        { id: 'form-fields-2', component: 'Stack', children: [] },
      ] },
    ] };
    reconcileFormDetail(schema, 'form', composeObject(loadObject('Plan')));
    const tree = nodes(schema.screens);
    expect(tree.some(node => node.id === 'form-title-1')).toBe(false);
    expect(tree.filter(node => node.props?.field === 'plan_name')).toMatchObject([
      { component: 'Input', bindings: { onChange: 'handleChange_plan_name' } },
    ]);
  });
});
