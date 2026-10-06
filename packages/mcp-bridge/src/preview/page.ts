import { inspectionPage } from './inspection-page.js';
import type { PreviewRuntimeManifest } from './runtime.js';
import type { CompositionVersion, PreviewBrand, PreviewFramework, PreviewTheme } from './store.js';

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
/** Inline JSON inside <script>: close-tag and line-separator safe. */
export const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

export interface PreviewAppPageInput {
  record: CompositionVersion;
  framework: PreviewFramework;
  brand: PreviewBrand;
  theme: PreviewTheme;
  /** The token build's brands: a scope switch accepts only these (s213-m04). */
  brands: readonly PreviewBrand[];
  /** s213-m04: the token build's CSS, linked before the runtime styles (which carry the component CSS only). */
  tokensHref: string;
  runtime: PreviewRuntimeManifest;
  /** URL prefix the host serves under, e.g. "/preview". */
  base: string;
  /** The scope the served module was generated for and whether the version's placed chart makes that scope-specific. */
  generatedFor?: { brand: PreviewBrand; theme: PreviewTheme; chartScoped: boolean };
  /** The content hash of the artifact the module was compiled from (the scoped generation when one is served). */
  artifactContentHash?: string;
  /** s210-m01: the result-state filter the page opened with, so the inspection navigation selects the matching view. */
  resultState?: string;
  staleTokens?: boolean;
}

/**
 * The bare running app. It mounts the compiled artifact exactly as scripts/design-loop/serve.ts
 * consumerEntries does: data-theme/data-brand on the document and body, the deterministic field
 * model as props, every required action showing an integration notice and dispatching an observable event.
 * A parent frame (the lineage page) can post {type:'oods-preview-scope', brand, theme}: the page
 * swaps the scope attributes and re-mounts. A version whose placed chart was rendered for another
 * scope first asks the host for that scope's module (generated and certified on first use), so the
 * chart on screen is always the one rendered for the mounted brand and theme (Sprint 202 m01).
 */
export function renderPreviewAppPage({ record, framework, brand, theme, brands, tokensHref, runtime, base, generatedFor, artifactContentHash, resultState, staleTokens }: PreviewAppPageInput): string {
  const entry = record.artifacts[framework];
  if (!entry) throw new Error(`Composition ${record.compositionId}@${record.version} has no ${framework} artifact`);
  const runtimeBase = `${base}/runtime`;
  const importMap = { imports: Object.fromEntries(Object.entries(runtime.importMap).map(([specifier, file]) => [specifier, `${runtimeBase}/${file}`])) };
  const versionBase = `${base}/${record.compositionId}/${record.version}`;
  const moduleUrl = `${versionBase}/module.js?framework=${framework}&brand=${brand}&theme=${theme}`;
  const inspection = inspectionPage(record, versionBase, `framework=${framework}&brand=${brand}&theme=${theme}`, resultState);
  const scopeUrl = `${versionBase}/scope.json`;
  const workflow = entry.artifact.files.some(file => file.path === 'package.json');
  const title = `${record.compose.object ?? 'composition'} ${record.compose.context ?? ''} v${record.version} · ${framework} · ${brand}/${theme}`;
  const actions = `{${entry.artifact.actions.map(action => `${JSON.stringify(action.name)}: (...args) => { document.getElementById('oods-action-notice').textContent = ${JSON.stringify('This action needs your application’s data or navigation handler. No record was changed.')}; window.dispatchEvent(new CustomEvent('oods-design-loop-action', { detail: { name: ${JSON.stringify(action.name)}, args } })); }`).join(', ')}}`;
  const loader = workflow
    // A workflow artifact carries its own mount, store and sample data; importing the module runs it once into #app.
    ? `async function load(url) { document.getElementById('app').replaceChildren(); await import(url); currentModuleUrl = url; }\nfunction mount() {}\nfunction unmount() {}`
    : framework === 'react'
      ? `import React from 'react';\nimport { createRoot } from 'react-dom/client';\nlet Page = null;\nasync function load(url) { const Module = await import(url); Page = Module.GeneratedUI ?? Module.default; if (typeof Page !== 'function') throw new Error('The compiled module exports no GeneratedUI component.'); currentModuleUrl = url; }\nconst actions = ${actions};\nlet root = null;\nfunction mount() { if (!root) root = createRoot(document.getElementById('app')); root.render(React.createElement(Page, { ...model, actions })); }\nfunction unmount() { if (root) { root.unmount(); root = null; } }`
      : `import { createApp, shallowReactive, h } from 'vue';\nlet Page = null;\nasync function load(url) { const Module = await import(url); Page = Module.default ?? Module.GeneratedUI; if (!Page) throw new Error('The compiled module has no default export.'); currentModuleUrl = url; }\nconst actions = ${actions};\nlet app = null; let viewProps = null;\nfunction mount() { if (app) { Object.assign(viewProps, model); return; } viewProps = shallowReactive({ ...model }); app = createApp({ render: () => h(Page, { ...viewProps, actions }) }); app.mount('#app'); }\nfunction unmount() { if (app) { app.unmount(); app = null; } }`;
  const axeUrl = runtime.files['axe.js'] ? `${runtimeBase}/axe.js` : null;
  const measureUrl = `${versionBase}/measurements/axe`;
  const identity = {
    compositionId: record.compositionId, version: record.version, parentVersion: record.parentVersion, operation: record.operation, head: record.head, schemaHash: record.schemaHash, framework, brand, theme,
    object: record.compose.object ?? null, context: record.compose.context ?? null, artifactContentHash: artifactContentHash ?? entry.artifact.contentHash, workflow,
    generatedFor: generatedFor ?? { brand: record.brand, theme: record.theme, chartScoped: true },
    brands,
  };
  return [
    '<!doctype html>',
    `<html lang="en"${theme === 'dark' ? ' class="dark"' : ''} data-theme="${escapeHtml(theme)}" data-brand="${escapeHtml(brand)}">`,
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<script type="importmap">${scriptJson(importMap)}</script>`,
    `<link rel="stylesheet" href="${escapeHtml(tokensHref)}">`,
    `<link rel="stylesheet" href="${runtimeBase}/${escapeHtml(runtime.styles)}">`,
    // s206-m01: the page sets the design system's body type, as a generated workflow app's shell does; without it every
    // standalone screen rendered in the browser's default serif.
    '<style>html,body{margin:0;min-height:100%}body{background:var(--sys-surface-canvas);color:var(--sys-text-primary);font-family:var(--sys-text-scale-body-md-font-family);font-size:var(--sys-text-scale-body-md-font-size);line-height:var(--sys-text-scale-body-md-line-height)}.oods-inspection{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--sys-space-stack-default,.75rem);padding:var(--sys-space-inset-default,1rem);overflow-wrap:anywhere}.oods-inspection nav{display:flex;gap:1rem;flex-wrap:wrap}.oods-inspection a{color:inherit;text-decoration:underline}.oods-inspection p,.oods-inspection h2,.oods-inspection ul{margin:0}.oods-inspection ul{padding-left:1.5rem}.oods-inspection section{display:grid;gap:var(--sys-space-stack-compact,.5rem)}[data-oods-uniform-time="true"] .oods-collection-row [data-oods-component="RelativeTimestamp"]{display:none}</style>',
    '</head>',
    `<body data-theme="${escapeHtml(theme)}" data-brand="${escapeHtml(brand)}" style="color-scheme:${theme === 'dark' ? 'dark' : 'light'}">`,
    inspection.html,
    `<p id="oods-token-build-notice" role="status"${staleTokens ? '' : ' hidden'}>The token build changed since this chart was drawn. Reopen with design.preview to redraw it.</p>`,
    `<div id="app" data-oods-preview="${escapeHtml(record.compositionId)}" data-oods-preview-version="${record.version}" data-oods-preview-framework="${escapeHtml(framework)}"></div>`,
    '<p id="oods-action-notice" role="status"></p>',
    `<script type="module">\nconst model = ${scriptJson(record.model ?? {})};\nwindow.__oodsPreview = ${scriptJson(identity)};\nlet mounts = 0;\nlet currentModuleUrl = null;\nlet scopeRequests = 0;\nconst axeUrl = ${scriptJson(axeUrl)};\nconst measureUrl = ${scriptJson(measureUrl)};\nconst scopeUrl = ${scriptJson(scopeUrl)};\nwindow.__oodsPreview.axe = axeUrl ? 'pending' : 'unavailable';\n// axe-core runs inside this page, for the scope it is mounted in, after every mount; the result is stored on the version.\nasync function measure() {\n  if (!axeUrl) return;\n  try {\n    const module = await import(axeUrl);\n    const axe = module.default ?? module;\n    const results = await axe.run(document, { resultTypes: ['violations', 'passes', 'incomplete', 'inapplicable'] });\n    const body = { engine: { name: results.testEngine.name, version: results.testEngine.version }, ranAt: new Date().toISOString(), url: location.pathname + location.search, framework: window.__oodsPreview.framework, brand: window.__oodsPreview.brand, theme: window.__oodsPreview.theme,\n      violations: results.violations.map(v => ({ id: v.id, impact: v.impact ?? null, help: v.help, helpUrl: v.helpUrl, tags: v.tags, nodes: v.nodes.length, targets: v.nodes.slice(0, 5).map(n => n.target.join(' ')) })), passes: results.passes.length, incomplete: results.incomplete.length, inapplicable: results.inapplicable.length };\n    const response = await fetch(measureUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });\n    window.__oodsPreview.axe = response.ok ? { stored: true, scope: body.brand + '/' + body.theme, violations: body.violations.length, passes: body.passes } : { stored: false, status: response.status };\n    window.__oodsPreview.axeRuns = (window.__oodsPreview.axeRuns || 0) + 1;\n    document.documentElement.dataset.oodsAxeRuns = String(window.__oodsPreview.axeRuns);\n    window.dispatchEvent(new CustomEvent('oods-preview-measured', { detail: window.__oodsPreview.axe }));\n    if (window.parent !== window) window.parent.postMessage({ type: 'oods-preview-measured', compositionId: window.__oodsPreview.compositionId, version: window.__oodsPreview.version, axe: window.__oodsPreview.axe }, '*');\n  } catch (error) { window.__oodsPreview.axe = { stored: false, error: String(error && error.message || error) }; }\n}\n// Report content height, not the root viewport floor: a frame must shrink again after temporary tall content.\nif (window.parent !== window && typeof ResizeObserver === 'function') new ResizeObserver(() => window.parent.postMessage({ type: 'oods-preview-size', height: document.body.scrollHeight }, '*')).observe(document.body);\nfunction mounted() { mounts += 1; window.__oodsPreview.mounts = mounts; requestAnimationFrame(() => { document.documentElement.dataset.oodsPreviewMounted = 'true'; window.dispatchEvent(new CustomEvent('oods-preview-mounted', { detail: window.__oodsPreview })); if (window.parent !== window) window.parent.postMessage({ type: 'oods-preview-mounted', ...window.__oodsPreview }, '*'); measure(); }); }\n${loader}\n${inspection.script}\n// Brand and theme are switches: swap the scope on the document and re-mount. A placed chart is rendered per scope, so the\n// module for the requested scope comes from the host first (generated and certified on first use); nothing else is fetched again.\nasync function applyScope(scope) {\n  const brand = window.__oodsPreview.brands.includes(scope.brand) ? scope.brand : window.__oodsPreview.brand;\n  const theme = ['light', 'dark', 'hc'].includes(scope.theme) ? scope.theme : window.__oodsPreview.theme;\n  for (const element of [document.documentElement, document.body]) { element.dataset.theme = theme; element.dataset.brand = brand; }\n  document.documentElement.classList.toggle('dark', theme === 'dark');\n  document.body.style.colorScheme = theme === 'dark' ? 'dark' : 'light';\n  window.__oodsPreview.brand = brand; window.__oodsPreview.theme = theme;\n  document.documentElement.dataset.oodsPreviewMounted = 'false';\n  if (!window.__oodsPreview.generatedFor.chartScoped) {\n    window.__oodsPreview.generatedFor = { brand, theme, chartScoped: false };\n  } else {\n    const request = ++scopeRequests;\n    document.documentElement.dataset.oodsScopePending = 'true';\n    try {\n      const response = await fetch(scopeUrl + '?framework=' + window.__oodsPreview.framework + '&brand=' + brand + '&theme=' + theme);\n      const info = await response.json();\n      if (request !== scopeRequests) return;\n      if (response.ok && info.available !== false && info.moduleUrl && info.moduleUrl !== currentModuleUrl) await load(info.moduleUrl);\n      if (info.generatedFor) window.__oodsPreview.generatedFor = info.generatedFor;\n      if (info.artifactContentHash) window.__oodsPreview.artifactContentHash = info.artifactContentHash;\n      window.__oodsPreview.scopeCharts = info.charts ?? null;\n      document.getElementById('oods-token-build-notice').hidden = !info.staleTokens;\n      window.__oodsPreview.scopeError = info.available === false ? (info.reason || (info.error && info.error.message) || 'unavailable') : null;\n    } catch (error) { window.__oodsPreview.scopeError = String(error && error.message || error); }\n    finally { delete document.documentElement.dataset.oodsScopePending; }\n  }\n  unmount(); mount(); mounted();\n}\nwindow.__oodsPreviewApplyScope = applyScope;\nwindow.addEventListener('message', event => { if (event.data && event.data.type === 'oods-preview-scope') applyScope(event.data); });\nawait load(${JSON.stringify(moduleUrl)});\nmount();\nmounted();\n</script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
