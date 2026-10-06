import type { UiSchema } from '../schemas/generated.js';
import type { CodegenOptions, CodegenResult } from './types.js';
import { GENERATED_APP_NODE_FLOOR, GENERATED_DEPENDENCY_CATALOG } from './artifact-envelope.js';
import { deriveConsumerModel } from './preview-model.js';
import { workflowSampleRecords } from './workflow-data-emitter.js';
import { snakeToCamel } from './binding-utils.js';

/** The component API remains the boundary; this app supplies sample data and makes unwired actions visible. */
export function screenApp(result: CodegenResult, schema: UiSchema, options: CodegenOptions, record: Record<string, unknown>): void {
  const framework = result.framework as 'react' | 'vue';
  const theme = options.theme ?? 'light', brand = options.brand ?? 'A';
  const model = options.sampleModel ?? deriveConsumerModel(schema, Object.fromEntries(Object.entries(record).map(([key, value]) => [snakeToCamel(key), value])));
  const json = (value: unknown) => JSON.stringify(value, null, 2).replaceAll('<', '\\u003c');
  const actionNames = result.actions?.map(action => action.name) ?? [];
  const actions = actionNames.map(name => `${JSON.stringify(name)}: (..._args: unknown[]) => { notice${framework === 'react' ? '(' : '.value = '}${JSON.stringify(`${name} needs your application’s data or navigation handler. No record was changed.`)}${framework === 'react' ? ')' : ''}; }`).join(',\n');
  const props = json(model);
  const files = result.files ?? [{ path: `src/GeneratedUI${result.fileExtension}`, contents: result.code }];
  const entry = framework === 'react' ? 'src/main.tsx' : 'src/main.ts';
  const app = framework === 'react'
    ? `import React from 'react';\nimport { GeneratedUI } from './GeneratedUI';\nimport './app.css';\nconst model: Omit<React.ComponentProps<typeof GeneratedUI>, 'actions'> = ${props};\nexport default function App() { const [message, notice] = React.useState(''); const actions = {${actions}}; return <main className="screen-app"><p className="sample-notice">Sample data · Connect actions to your application.</p><GeneratedUI {...model} ${actionNames.length ? 'actions={actions}' : ''} /><p role="status">{message}</p></main>; }\n`
    : `<script setup lang="ts">\nimport { ref } from 'vue';\nimport GeneratedUI from './GeneratedUI.vue';\nimport './app.css';\nconst model: Omit<InstanceType<typeof GeneratedUI>['$props'], 'actions'> = ${props};\nconst notice = ref(''); const actions = {${actions}};\n</script>\n<template><main class="screen-app"><p class="sample-notice">Sample data · Connect actions to your application.</p><GeneratedUI v-bind="model" ${actionNames.length ? ':actions="actions"' : ''} /><p role="status">{{ notice }}</p></main></template>\n`;
  files.push({ path: `src/App${result.fileExtension}`, contents: app });
  files.push({ path: entry, contents: framework === 'react' ? "import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App';\ncreateRoot(document.getElementById('app')!).render(<App />);\n" : "import { createApp } from 'vue';\nimport App from './App.vue';\ncreateApp(App).mount('#app');\n" });
  if (framework === 'react') result.imports.push('react-dom/client'); else result.imports.push('@vitejs/plugin-vue');
  files.push({ path: 'vite.config.mjs', contents: framework === 'vue' ? "import vue from '@vitejs/plugin-vue';\nexport default { plugins: [vue()], css: { postcss: { plugins: [] } } };\n" : 'export default { css: { postcss: { plugins: [] } } };\n' });
  const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  files.push({ path: 'index.html', contents: `<!doctype html>\n<html lang="en"${theme === 'dark' ? ' class="dark"' : ''} data-brand="${escape(brand)}" data-theme="${theme}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(options.documentTitle ?? 'Sample screen')}</title></head><body data-brand="${escape(brand)}" data-theme="${theme}"><div id="app"></div><script type="module" src="/${entry}"></script></body></html>\n` });
  // s219-m01: the brand's body typography, as the preview page and the workflow app set it; system-ui made the installed
  // app a different typeface from the preview it was chosen from.
  // Native date controls follow the same theme as the preview, including when an embedded app changes theme.
  files.push({ path: 'src/app.css', contents: '[data-theme="light"], [data-theme="hc"] { color-scheme: light; } [data-theme="dark"] { color-scheme: dark; } body { margin: 0; background: var(--sys-surface-canvas, Canvas); color: var(--sys-text-primary, CanvasText); font-family: var(--sys-text-scale-body-md-font-family, system-ui, sans-serif); font-size: var(--sys-text-scale-body-md-font-size); line-height: var(--sys-text-scale-body-md-line-height); } .screen-app { max-width: 90rem; margin: auto; padding: 1.5rem; } .sample-notice { font-size: .875rem; }\n' });
  files.push({ path: 'tsconfig.json', contents: json({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true, jsx: 'react-jsx', esModuleInterop: true, skipLibCheck: false, noEmit: true, lib: ['ES2022', 'DOM', 'DOM.Iterable'] }, include: ['src'] }) + '\n' });
  const dependencies: Record<string, string> = {};
  for (const specifier of result.imports) {
    const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]!;
    const known = GENERATED_DEPENDENCY_CATALOG[name as keyof typeof GENERATED_DEPENDENCY_CATALOG];
    if (known) dependencies[name] = known.version;
  }
  files.push({ path: 'package.json', contents: json({ name: `generated-screen-${framework}`, version: '1.0.0', private: true, type: 'module', engines: { node: GENERATED_APP_NODE_FLOOR }, scripts: { dev: 'vite --host 127.0.0.1', build: `${framework === 'react' ? 'tsc' : 'vue-tsc'} --noEmit && vite build`, typecheck: `${framework === 'react' ? 'tsc' : 'vue-tsc'} --noEmit` }, dependencies, devDependencies: { typescript: '5.9.3', vite: '6.4.3', '@types/node': '20.19.21', ...(framework === 'react' ? { '@types/react': '19.2.2', '@types/react-dom': '19.2.1' } : { 'vue-tsc': '3.3.11' }) } }) + '\n' });
  files.push({ path: 'README.md', contents: '# Generated sample screen\n\nRun `npm install`: package.json pins the @oods packages and any mapped team packages at exact versions, and the @oods packages install from npm. A mapped team package that is not on a registry installs from its own tarball or folder. Then run `npm run build` and `npm run dev`.\n\nThe component lives in src/GeneratedUI. src/App supplies deterministic sample props and displays a notice for actions that need your application’s data or navigation handler. It never claims to save or delete data. Replace those handlers and sample props to integrate the screen.\n\nA new generation is a complete new app and merges nothing into your app. Keep your changes in your own files, and see GENERATED-APPS.md in @oods/foundry.\n' });
  result.files = files;
}

export function screenSampleRecord(schema: UiSchema): Record<string, unknown> {
  return workflowSampleRecords(schema)[0] ?? {};
}
