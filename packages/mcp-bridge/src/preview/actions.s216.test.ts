import fs from 'node:fs';
import vm from 'node:vm';
import { expect, it } from 'vitest';
import { renderPreviewAppPage } from './page.js';
import type { CompositionVersion } from './store.js';
const fixture = JSON.parse(fs.readFileSync(new URL('./__fixtures__/subscription-card.json', import.meta.url), 'utf8'));
it.each(['react', 'vue'] as const)('%s preview action shows the integration notice and never claims a save', framework => {
  const record = { ...fixture, compositionId: 'cmp-actions', version: 1, slots: [], measurements: {}, artifacts: { [framework]: { artifact: { ...fixture.frameworks[framework].artifact, actions: [{ name: 'saveRecord', parameters: [], sources: [] }] } } } } as unknown as CompositionVersion;
  const html = renderPreviewAppPage({ record, framework, brand: 'A', theme: 'light', brands: ['A'], tokensHref: '/tokens.css', runtime: { files: {}, importMap: {}, styles: 'styles.css' } as any, base: '/preview' });
  expect(html).toContain('id="oods-action-notice" role="status"');
  const actionCode = html.match(/const actions = (\{[^\n]+\});/)?.[1];
  expect(actionCode).toBeTruthy();
  const notice = { textContent: '' };
  const actions = vm.runInNewContext(`(${actionCode})`, { document: { getElementById: () => notice }, window: { dispatchEvent: () => {} }, CustomEvent: class {} });
  actions.saveRecord();
  expect(notice.textContent).toBe('This action needs your application’s data or navigation handler. No record was changed.');
});
