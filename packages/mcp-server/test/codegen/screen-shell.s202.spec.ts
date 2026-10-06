import { describe, expect, it } from 'vitest';
import { hasLevelOneHeading, labelScreens, objectLabel, pluralLabel, screenShell, screenTitle } from '../../src/codegen/screen-shell.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import type { UiSchema } from '../../src/schemas/generated.js';

const composed = async (object: string, context: string): Promise<UiSchema> => {
  const result = await compose({ object, context, options: { transient: true } });
  expect(result.status, JSON.stringify(result.errors)).toBe('ok');
  return result.schema!;
};
const code = async (schema: UiSchema, framework: 'react' | 'vue') => {
  const result = await generate({ schema, framework, profile: 'build' });
  expect(result.status, JSON.stringify(result.errors)).toBe('ok');
  return result.artifact!.files.find(file => /GeneratedUI\.(tsx|vue)$|src\/main\.tsx?$/.test(file.path))!.contents;
};

describe('the generated shell is a page: one main landmark and one level-one heading (s202-m01)', () => {
  it('names the screen after its object and context and titles a list by the plural', () => {
    expect(objectLabel('Subscription')).toBe('Subscription');
    expect(objectLabel('AddressEntry')).toBe('Address Entry');
    expect(pluralLabel('Subscription')).toBe('Subscriptions');
    expect(pluralLabel('Address')).toBe('Addresses');
    expect(pluralLabel('Policy')).toBe('Policies');
    expect(screenTitle('Subscription', 'list')).toBe('Subscriptions');
    expect(screenTitle('Subscription', 'form')).toBe('Subscription form');
    expect(screenTitle('Subscription', 'timeline')).toBe('Subscription timeline');
    expect(screenTitle('Subscription', 'detail')).toBe('Subscription');
    const schema: UiSchema = { version: '1', screens: [{ id: 'screen-list-3', component: 'Stack' }, { id: 'screen-detail-4', component: 'Stack', meta: { label: 'Authored' } }] };
    labelScreens(schema, 'Subscription', 'workflow');
    expect(schema.screens.map(screen => screen.meta?.label)).toEqual(['Subscriptions', 'Authored']);
    labelScreens(schema, undefined, 'list');
    expect(schema.screens[0]!.meta?.label).toBe('Subscriptions');
  });

  it('recognises a level-one heading the screen already places and otherwise renders the label as the shell heading', () => {
    expect(hasLevelOneHeading([{ id: 'a', component: 'Stack', children: [{ id: 'b', component: 'DetailHeader', props: { headingLevel: 1 } }] }])).toBe(true);
    expect(hasLevelOneHeading([{ id: 'a', component: 'DetailHeader', props: { headingLevel: 2 } }])).toBe(false);
    expect(hasLevelOneHeading([{ id: 'a', component: 'Text', props: { as: 'h1', content: 'Title' } }])).toBe(true);
    expect(screenShell({ screens: [{ id: 'screen-list-1', component: 'Stack', meta: { label: 'Subscriptions' } }] }, {})).toEqual({ screenId: 'screen-list-1', heading: 'Subscriptions' });
    expect(screenShell({ screens: [{ id: 'screen-detail-1', component: 'Stack', meta: { label: 'Subscription' }, children: [{ id: 'title', component: 'DetailHeader', props: { headingLevel: 1 } }] }] }, {})).toEqual({ screenId: 'screen-detail-1' });
    expect(screenShell({ screens: [{ id: 'screen-list-1', component: 'Stack' }] }, {})).toEqual({ screenId: 'screen-list-1' });
    expect(screenShell({ screens: [{ id: 'screen-list-1', component: 'Stack', meta: { label: 'Subscriptions' } }] }, { workflowCollections: true })).toBeUndefined();
  });

  it('wraps a standalone detail in main with the record title at level one, in both frameworks', async () => {
    const schema = await composed('Subscription', 'detail');
    expect(schema.screens[0]!.meta?.label).toBe('Subscription');
    for (const framework of ['react', 'vue'] as const) {
      const source = await code(schema, framework);
      expect(source).toContain('<main data-oods-shell="screen-detail-');
      expect(source).toContain(framework === 'react' ? 'level={1}' : ':level="1"');
      expect(source).not.toContain('data-oods-shell-heading');
      expect(source.match(/<main\b/g)).toHaveLength(1);
    }
  });

  it('gives a list, a form and a timeline a shell heading from the screen label', async () => {
    for (const [context, heading] of [['list', 'Subscriptions'], ['form', 'Subscription form'], ['timeline', 'Subscription timeline']] as const) {
      const schema = await composed('Subscription', context);
      for (const framework of ['react', 'vue'] as const) {
        const source = await code(schema, framework);
        expect(source, `${context} ${framework}`).toContain(`<h1 data-oods-shell-heading="true">${heading}</h1>`);
        expect(source.match(/<main\b/g), `${context} ${framework}`).toHaveLength(1);
      }
    }
  });

  it('leaves the workflow app as the only shell: no main from the embedded screens and their record title at level two', async () => {
    const schema = await composed('Subscription', 'workflow');
    for (const framework of ['react', 'vue'] as const) {
      const result = await generate({ schema, framework, profile: 'build', options: { typescript: true } });
      expect(result.status, JSON.stringify(result.errors)).toBe('ok');
      const files = result.artifact!.files;
      const app = files.find(file => /src\/App\.(tsx|vue)$/.test(file.path))!.contents;
      expect(app.match(/<main\b/g)).toHaveLength(1);
      expect(app).toContain('<h1>');
      const detail = files.find(file => /src\/screens\/Detail\.(tsx|vue)$/.test(file.path))!.contents;
      expect(detail).not.toContain('<main');
      expect(detail).not.toContain('data-oods-shell');
      expect(detail).toContain(framework === 'react' ? 'level={2}' : ':level="2"');
    }
  });
});
