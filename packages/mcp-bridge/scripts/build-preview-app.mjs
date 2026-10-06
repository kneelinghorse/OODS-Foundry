#!/usr/bin/env node
// Builds dist/preview-app/app.html once per package build: the Forge design preview as one self-contained
// MCP App resource (Sprint 202). The app with the MCP Apps SDK (@modelcontextprotocol/ext-apps), the runtime the
// generated app runs on (React, ReactDOM, Vue, the foundation packages) and the runtime CSS are inlined, so the
// resource works under the host's default CSP (inline scripts and styles only, no network). The manifest records
// the bytes and digests; the adapter names the app's content hash in the resource URI.
//
//   node scripts/build-preview-app.mjs [--out <dir>] [--runtime-dir <dist/preview-runtime>]
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(PACKAGE_ROOT, 'package.json'));
const esbuild = require('esbuild');
const SOURCE = path.join(PACKAGE_ROOT, 'preview-app');
/** The bare specifiers a generated artifact may import, bound by the iife compile to globalThis.__oodsRuntime[specifier]. */
const RUNTIME_SPECIFIERS = ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', 'vue', '@oods/components-react', '@oods/components-react/table', '@oods/components-react/status', '@oods/components-vue', '@oods/component-contracts', '@oods/component-styles'];
/** The frame the app mounts the running app in (preview-app/index.html gives it `container: oods-app / inline-size`). */
const APP_CONTAINER = 'oods-app';
const sha256 = value => createHash('sha256').update(value).digest('hex');

/**
 * Inside the conversation the running app shares its document with the panel, so the viewport is not the app's width.
 * The inlined copy of the runtime styles answers the width-only media queries from the app's frame instead: the same
 * rules, keyed to the width the app is shown at. Every other media query (forced colors, reduced motion) stays one.
 */
function containerWidthQueries(css) {
  const rewritten = [];
  const kept = [];
  const text = css.replace(/@media\s*([^{]+)\{/g, (match, condition) => {
    const trimmed = condition.trim();
    if (/^\(\s*(?:max|min)-width\s*:\s*[^()]+\)$/.test(trimmed)) { rewritten.push(trimmed); return `@container ${APP_CONTAINER} ${trimmed}{`; }
    kept.push(trimmed);
    return match;
  });
  return { css: text, rewritten, kept };
}

/** One iife that defines globalThis.__oodsRuntime: every specifier's namespace (with __esModule, so the iife modules' interop keeps `default`). */
async function buildRuntime(includeAxe) {
  const specifiers = includeAxe ? [...RUNTIME_SPECIFIERS, 'axe-core'] : RUNTIME_SPECIFIERS;
  const shimDir = fs.mkdtempSync(path.join(PACKAGE_ROOT, '.preview-app-runtime-'));
  try {
    const entry = path.join(shimDir, 'runtime.js');
    fs.writeFileSync(entry, [
      ...specifiers.map((specifier, index) => `import * as m${index} from ${JSON.stringify(specifier)};`),
      'const esm = (module) => { const namespace = { __esModule: true }; for (const key of Object.keys(module)) Object.defineProperty(namespace, key, { get: () => module[key], enumerable: true }); if (!("default" in module)) namespace.default = namespace; return namespace; };',
      `globalThis.__oodsRuntime = { ${specifiers.map((specifier, index) => `${JSON.stringify(specifier)}: esm(m${index})`).join(', ')} };`,
      '',
    ].join('\n'));
    const result = await esbuild.build({
      absWorkingDir: PACKAGE_ROOT, entryPoints: [entry], bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022',
      minify: true, sourcemap: false, legalComments: 'none', logLevel: 'warning',
      define: { 'process.env.NODE_ENV': '"production"', __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' },
    });
    return { specifiers, script: result.outputFiles[0].text };
  } finally { fs.rmSync(shimDir, { recursive: true, force: true }); }
}

function parseArgs(argv) {
  let out = path.join(PACKAGE_ROOT, 'dist', 'preview-app');
  let runtimeDir = path.join(PACKAGE_ROOT, 'dist', 'preview-runtime');
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--out') out = path.resolve(argv[++index] ?? '');
    else if (argv[index] === '--runtime-dir') runtimeDir = path.resolve(argv[++index] ?? '');
    else throw new Error(`unknown argument: ${argv[index]}`);
  }
  return { out, runtimeDir };
}

async function main() {
  const { out, runtimeDir } = parseArgs(process.argv.slice(2));
  // The runtime file first: without it there is no app to emit, and nothing is written.
  const stylesFile = path.join(runtimeDir, 'styles.css');
  if (!fs.existsSync(stylesFile)) throw new Error(`The preview runtime styles are missing (${stylesFile}); build the preview runtime first. No app was emitted.`);
  const version = require(path.join(PACKAGE_ROOT, 'package.json')).version;
  // The SDK's exports map hides its package.json; read it beside the resolved entry.
  const sdkPackage = path.join(PACKAGE_ROOT, 'node_modules', '@modelcontextprotocol', 'ext-apps', 'package.json');
  if (!fs.existsSync(sdkPackage)) throw new Error('The preview app needs @modelcontextprotocol/ext-apps (the MCP Apps SDK) installed beside @oods/mcp-bridge.');
  const sdkVersion = JSON.parse(fs.readFileSync(sdkPackage, 'utf8')).version;
  const result = await esbuild.build({
    absWorkingDir: PACKAGE_ROOT, entryPoints: [path.join(SOURCE, 'main.ts')], bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022',
    minify: true, sourcemap: false, legalComments: 'none', logLevel: 'warning',
    define: { 'process.env.NODE_ENV': '"production"', __OODS_PREVIEW_APP_VERSION__: JSON.stringify(version) },
  });
  const script = result.outputFiles[0].text;
  // The runtime the running app needs, inlined (axe-core stays out unless asked: the stored measurements are shown instead).
  const includeAxe = process.env.OODS_PREVIEW_APP_AXE === '1';
  const runtime = await buildRuntime(includeAxe);
  const sourceStyles = fs.readFileSync(stylesFile, 'utf8');
  const { css: styles, rewritten, kept } = containerWidthQueries(sourceStyles);
  for (const [name, text] of [['app script', script], ['runtime script', runtime.script]]) if (/<\/script/i.test(text)) throw new Error(`The bundled ${name} contains a script close tag and cannot be inlined.`);
  if (/<\/style/i.test(styles)) throw new Error('The runtime styles contain a style close tag and cannot be inlined.');
  if (/url\(\s*["']?https?:|@import/i.test(styles)) throw new Error('The runtime styles reference the network.');
  const template = fs.readFileSync(path.join(SOURCE, 'index.html'), 'utf8');
  const markers = { '<!-- OODS_PREVIEW_RUNTIME_STYLES -->': `<style id="oods-runtime-styles">${styles}</style>`, '<!-- OODS_PREVIEW_RUNTIME_SCRIPT -->': `<script>${runtime.script}</script>`, '<!-- OODS_PREVIEW_APP_SCRIPT -->': `<script>${script}</script>` };
  for (const marker of Object.keys(markers)) if (!template.includes(marker)) throw new Error(`preview-app/index.html lacks ${marker}`);
  if (rewritten.length && !new RegExp(`container:\\s*${APP_CONTAINER}\\s*/\\s*inline-size`).test(template)) throw new Error(`preview-app/index.html must give the app frame container ${APP_CONTAINER} / inline-size: the runtime's width queries are answered there.`);
  if (/<meta[^>]+Content-Security-Policy/i.test(template)) throw new Error('The app template must not declare a CSP; the host default applies.');
  if (/\ssrc=["']https?:|\shref=["']https?:|url\(\s*["']?https?:/i.test(template)) throw new Error('The app template must not reference the network.');
  // Function replacers: the bundled scripts carry `$&` and friends, which a string replacement would expand.
  let html = template;
  for (const [marker, replacement] of Object.entries(markers)) html = html.replace(marker, () => replacement);
  const expected = template.length + Object.entries(markers).reduce((sum, [marker, replacement]) => sum + replacement.length - marker.length, 0);
  if (Object.keys(markers).some(marker => html.includes(marker)) || html.length !== expected) throw new Error('The app was not inlined verbatim.');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'app.html'), html);
  const digest = sha256(html);
  const manifest = {
    version: 1, builtAt: new Date().toISOString(), app: version, sdk: sdkVersion, esbuild: require('esbuild/package.json').version, react: require('react/package.json').version, vue: require('vue/package.json').version,
    bytes: Buffer.byteLength(html), sha256: digest, revision: digest.slice(0, 12), csp: 'none declared (host default)',
    app_script: { bytes: Buffer.byteLength(script), sha256: sha256(script) },
    runtime: { specifiers: runtime.specifiers, axe: includeAxe, bytes: Buffer.byteLength(runtime.script), sha256: sha256(runtime.script) },
    styles: {
      source: path.relative(PACKAGE_ROOT, stylesFile).split(path.sep).join('/'), sourceBytes: Buffer.byteLength(sourceStyles), sourceSha256: sha256(sourceStyles),
      bytes: Buffer.byteLength(styles), sha256: sha256(styles), widthQueries: { container: APP_CONTAINER, rewritten, kept },
    },
  };
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  process.stdout.write(`preview app: ${manifest.bytes} bytes (app ${manifest.app_script.bytes}, runtime ${manifest.runtime.bytes}${includeAxe ? ' with axe' : ''}, styles ${manifest.styles.bytes}, ${rewritten.length} width queries answered by the app frame), revision ${manifest.revision} → ${out}\n`);
}

main().catch(error => { process.stderr.write(`build-preview-app: ${error.stack ?? error.message}\n`); process.exit(1); });
