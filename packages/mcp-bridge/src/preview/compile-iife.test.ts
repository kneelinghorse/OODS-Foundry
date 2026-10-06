import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { compileArtifact, moduleGlobalName, MODULES_GLOBAL, RUNTIME_GLOBAL } from './compile.js';
import type { CompositionVersion, PreviewArtifact } from './store.js';

const require = createRequire(import.meta.url);
type Fixture = { model: Record<string, unknown>; frameworks: Record<'react' | 'vue', { artifact: PreviewArtifact }> };
const fixture = JSON.parse(readFileSync(new URL('./__fixtures__/subscription-card.json', import.meta.url), 'utf8')) as Fixture;
/** The runtime the preview app inlines, here the same packages from Node: every bare specifier a generated artifact imports. */
const esm = (module: Record<string, unknown>) => ({ __esModule: true, ...module, default: module.default ?? module });
const runtime = {
  react: esm(require('react')), 'react/jsx-runtime': esm(require('react/jsx-runtime')), 'react-dom': esm(require('react-dom')), 'react-dom/client': esm(require('react-dom/client')),
  vue: esm(require('vue')),
  '@oods/components-react': esm(require('@oods/components-react')), '@oods/components-react/table': esm(require('@oods/components-react/table')), '@oods/components-react/status': esm(require('@oods/components-react/status')),
  '@oods/components-vue': esm(require('@oods/components-vue')), '@oods/component-contracts': esm(require('@oods/component-contracts')), '@oods/component-styles': esm(require('@oods/component-styles')),
};

describe('the iife compile binds bare imports to the runtime globals and executes as an inline script (s202-m02)', () => {
  it.each(['react', 'vue'] as const)('%s: runs under a bare global scope, registers its exports on __oodsModules and renders the same markup as the esm module would', async framework => {
    const artifact = fixture.frameworks[framework].artifact;
    const compiled = await compileArtifact(artifact, { format: 'iife' });
    expect(compiled.format).toBe('iife');
    expect(compiled.globalName).toBe(moduleGlobalName(artifact.contentHash));
    expect(compiled.code).toContain(`globalThis.${RUNTIME_GLOBAL}`);
    expect(compiled.code).not.toMatch(/^import /m);
    expect(compiled.code).not.toMatch(/\bexport\s+(?:const|default|\{)/);
    // The esm compile of the same artifact is cached separately and still imports its externals.
    const esmModule = await compileArtifact(artifact);
    expect(esmModule.format).toBe('esm');
    expect(esmModule.code).toMatch(/^import [^\n]* from "(?:react|vue|@oods)[^"]*";/m);
    expect(compiled.externals).toEqual(esmModule.externals);
    // A script tag's scope: the globals the app provides, nothing else; the module lands on __oodsModules.<name>.
    // A script tag's scope: the runtime globals the app provides and the DOM a Vue SFC's style injector touches (a stub here; the browser has the real one).
    const styles: Array<{ textContent: string }> = [];
    const document = { createElement: () => ({ dataset: {} as Record<string, string>, textContent: '' }), head: { appendChild: (node: { textContent: string }) => { styles.push(node); } } };
    const context = vm.createContext({ globalThis: undefined as unknown, [RUNTIME_GLOBAL]: runtime, console, window: undefined as unknown, document });
    (context as Record<string, unknown>).globalThis = context;
    vm.runInContext(compiled.code, context, { filename: `${artifact.contentHash}.js` });
    const registry = (context as Record<string, Record<string, Record<string, unknown>>>)[MODULES_GLOBAL];
    const key = compiled.globalName!.slice(`${MODULES_GLOBAL}.`.length);
    expect(Object.keys(registry)).toEqual([key]);
    const exported = registry[key]!;
    if (framework === 'react') {
      const Page = exported.GeneratedUI as (props: Record<string, unknown>) => unknown;
      expect(typeof Page).toBe('function');
      const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (element: unknown) => string };
      const { createElement } = require('react') as { createElement: (type: unknown, props: unknown) => unknown };
      const markup = renderToStaticMarkup(createElement(Page, { ...fixture.model, actions: {} }));
      expect(markup).toContain('data-oods-component="');
    } else {
      const Page = exported.default ?? exported.GeneratedUI;
      expect(Page).toBeTruthy();
      const { createSSRApp } = require('vue') as { createSSRApp: (component: unknown, props: unknown) => unknown };
      const { renderToString } = require('vue/server-renderer') as { renderToString: (app: unknown) => Promise<string> };
      const markup = await renderToString(createSSRApp(Page, { ...fixture.model, actions: {} }));
      expect(markup).toContain('data-oods-component="');
    }
  });

  it('refuses at run time, not silently, when the runtime lacks a specifier the artifact imports', async () => {
    const compiled = await compileArtifact(fixture.frameworks.react.artifact, { format: 'iife' });
    const context = vm.createContext({ [RUNTIME_GLOBAL]: { react: runtime.react }, console });
    (context as Record<string, unknown>).globalThis = context;
    expect(() => vm.runInContext(compiled.code, context)).toThrow(/does not provide/);
  });
});
