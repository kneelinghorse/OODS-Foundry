#!/usr/bin/env node
// Builds dist/preview-runtime once per package build: the browser runtimes the preview host
// serves beside every compiled artifact (React, ReactDOM, Vue, the foundation packages' dist and
// the component-styles CSS), as ES modules that share one React and one Vue instance. The token CSS
// is not copied in (s213-m04): the host serves it from the token build, so a brand or token value
// built after the bridge reaches the preview.
//
//   node scripts/build-preview-runtime.mjs [--out <dir>]
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(PACKAGE_ROOT, 'package.json'));
const esbuild = require('esbuild');

/** Bare specifier → runtime file. CommonJS packages get an explicit named re-export shim. */
const ENTRIES = [
  { specifier: 'react', file: 'react.js', commonjs: true },
  { specifier: 'react/jsx-runtime', file: 'react-jsx-runtime.js', commonjs: true },
  { specifier: 'react-dom', file: 'react-dom.js', commonjs: true },
  { specifier: 'react-dom/client', file: 'react-dom-client.js', commonjs: true },
  { specifier: 'vue', file: 'vue.js', commonjs: false },
  { specifier: '@oods/components-react', file: 'oods-components-react.js', commonjs: false },
  { specifier: '@oods/components-react/table', file: 'oods-components-react-table.js', commonjs: false },
  { specifier: '@oods/components-react/status', file: 'oods-components-react-status.js', commonjs: false },
  { specifier: '@oods/components-vue', file: 'oods-components-vue.js', commonjs: false },
  { specifier: '@oods/component-contracts', file: 'oods-component-contracts.js', commonjs: false },
  { specifier: '@oods/component-styles', file: 'oods-component-styles.js', commonjs: false },
  // axe-core runs inside the running page for the current brand and theme; its results are posted back to the host.
  { specifier: 'axe-core', file: 'axe.js', commonjs: true },
];
const STYLES = { specifier: '@oods/component-styles/css', file: 'styles.css' };
/** component-styles' CSS imports the token CSS first; the host links that file itself, from the token build (s213-m04). */
const TOKENS_CSS = '@oods/tokens/css';
const liveTokens = {
  name: 'oods-live-tokens',
  setup(build) {
    build.onResolve({ filter: /^@oods\/tokens\/css$/ }, () => ({ path: TOKENS_CSS, namespace: 'oods-live-tokens' }));
    build.onLoad({ filter: /.*/, namespace: 'oods-live-tokens' }, () => ({ contents: '', loader: 'css' }));
  },
};

function parseArgs(argv) {
  let out = path.join(PACKAGE_ROOT, 'dist', 'preview-runtime');
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--out') out = path.resolve(argv[++index] ?? '');
    else throw new Error(`unknown argument: ${argv[index]}`);
  }
  return { out };
}

function shimSource(specifier) {
  const module = require(specifier);
  const names = Object.keys(module).filter(name => name !== 'default' && /^[A-Za-z_$][\w$]*$/.test(name)).sort();
  return `import m from ${JSON.stringify(specifier)};\nexport const { ${names.join(', ')} } = m;\nexport default m;\n`;
}

async function main() {
  const { out } = parseArgs(process.argv.slice(2));
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  // Shims resolve bare imports from inside this package, so they live under it while building.
  const shimDir = fs.mkdtempSync(path.join(PACKAGE_ROOT, '.preview-runtime-shims-'));
  try {
    const entryPoints = {};
    for (const entry of ENTRIES) {
      const name = entry.file.replace(/\.js$/, '');
      if (entry.commonjs) {
        const shim = path.join(shimDir, entry.file);
        fs.writeFileSync(shim, shimSource(entry.specifier));
        entryPoints[name] = shim;
      } else entryPoints[name] = entry.specifier;
    }
    entryPoints[STYLES.file.replace(/\.css$/, '')] = STYLES.specifier;
    const result = await esbuild.build({
      absWorkingDir: PACKAGE_ROOT, entryPoints, bundle: true, splitting: true, format: 'esm', platform: 'browser', target: 'es2022',
      outdir: out, minify: true, sourcemap: false, metafile: true, logLevel: 'warning', legalComments: 'none', plugins: [liveTokens],
      define: { 'process.env.NODE_ENV': '"production"', __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' },
    });
    const files = {};
    for (const file of fs.readdirSync(out).sort()) {
      const bytes = fs.readFileSync(path.join(out, file));
      files[file] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    }
    const version = name => require(`${name}/package.json`).version;
    const manifest = {
      version: 1, builtAt: new Date().toISOString(), esbuild: version('esbuild'), react: version('react'), vue: version('vue'), axe: version('axe-core'),
      importMap: Object.fromEntries(ENTRIES.map(entry => [entry.specifier, entry.file])), styles: STYLES.file, files,
      outputs: Object.keys(result.metafile.outputs).length,
    };
    fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    const total = Object.values(files).reduce((sum, file) => sum + file.bytes, 0);
    process.stdout.write(`preview runtime: ${Object.keys(files).length} files, ${total} bytes → ${out}\n`);
  } finally {
    fs.rmSync(shimDir, { recursive: true, force: true });
  }
}

main().catch(error => { process.stderr.write(`build-preview-runtime: ${error.stack ?? error.message}\n`); process.exit(1); });
