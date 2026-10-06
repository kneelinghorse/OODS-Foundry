import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { packFoundationPackages } from './s182-m04-consumer-harness.mjs';
import { ensureConsumerRollup } from './consumer-rollup.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const REPOSITORY_ROOT = path.resolve(scriptDirectory, '../..');
export const M04_ROOT = path.join(REPOSITORY_ROOT, 'artifacts/product-reality/sprint-183/m04');
export const DEFAULT_OUTPUT_ROOT = path.join(REPOSITORY_ROOT, 'artifacts/product-reality/sprint-183/m05');

export const GATE_NAMES = Object.freeze([
  'fresh-exact-tarball-install',
  'strict-typecheck',
  'production-build',
  'server-render',
  'mount',
  'hydration',
  'shared-css-resolution',
  'interaction-evidence',
]);

export const MUTATION_KINDS = Object.freeze([
  'tabs-selection-behavior-removed',
  'domain-action-handle-edit-inert',
]);

const FRAMEWORKS = Object.freeze(['react', 'vue']);
const REQUIRED_COMPONENTS = Object.freeze(['Card', 'Stack', 'Tabs', 'Text']);
const REQUIRED_ACTIONS = Object.freeze(['handleDelete', 'handleEdit']);
const EXPECTED_SCHEMA_REF = 'compose-7d860337';
const EXPECTED_SCHEMA_NAME = 'tier1-acceptance-sub-detail';

const VERIFIER_DEPENDENCIES = Object.freeze({
  react: Object.freeze({
    '@types/node': '20.19.21',
    '@types/react': '19.2.2',
    '@types/react-dom': '19.2.2',
    typescript: '5.9.3',
    vite: '6.4.3',
  }),
  vue: Object.freeze({
    '@types/node': '20.19.21',
    '@vitejs/plugin-vue': '5.2.4',
    '@vue/compiler-sfc': '3.5.42',
    '@vue/server-renderer': '3.5.42',
    typescript: '5.9.3',
    vite: '6.4.3',
    'vue-tsc': '3.3.11',
  }),
});

const MODEL = Object.freeze({
  accountName: 'Northwind Research',
  amountMinor: 129900,
  billingInterval: 'month',
  consumedQuantity: 37,
  currency: 'USD',
  currentPeriodEnd: '2026-10-01T00:00:00.000Z',
  currentPeriodStart: '2026-09-01T00:00:00.000Z',
  includedQuantity: 50,
  meterName: 'Analytics seats',
  periodEnd: '2026-10-01',
  periodStart: '2026-09-01',
  planCode: 'enterprise-monthly',
  planName: 'Enterprise',
  provider: 'stripe',
  status: 'active',
  subscriptionId: 'sub-s183-001',
  unitLabel: 'seat',
});

const CONSUMER_CSS = `
:root { font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
body { margin: 0; color: var(--sys-text-primary); background: var(--sys-surface-canvas); }
#consumer-shell { max-width: 72rem; margin: 0 auto; padding: var(--ref-space-scale-lg); }
#domain-actions { display: flex; gap: var(--ref-space-scale-sm); margin-block-end: var(--ref-space-scale-md); }
#domain-actions button { min-block-size: 2.5rem; padding-inline: 1rem; }
`.trimStart();

const FINGERPRINT_SCRIPT = `
window.__OODS_CAPTURE_FINGERPRINT__ = () => ({
  rootIds: ['consumer-shell', 'screen-detail-13', 'detail-tabs-9'].filter((id) => document.getElementById(id)),
  componentIds: [...document.querySelectorAll('[data-oods-component]')]
    .map((element) => element.id || element.getAttribute('data-oods-component')),
  actionControlIds: [...document.querySelectorAll('#domain-actions button')].map((element) => element.id),
  tabs: [...document.querySelectorAll('[role="tab"]')].map((tab) => {
    const panelId = tab.getAttribute('aria-controls');
    const panel = panelId ? document.getElementById(panelId) : null;
    return {
      tabId: tab.getAttribute('data-tab-id'),
      selected: tab.getAttribute('aria-selected'),
      panelId,
      panelHidden: panel?.hasAttribute('hidden') ?? null,
      panelContentIds: panel ? [...panel.querySelectorAll('[id]')].map((element) => element.id) : [],
    };
  }),
});
window.__OODS_SSR_FINGERPRINT__ = window.__OODS_CAPTURE_FINGERPRINT__();
`.trim();

const compareCodePoint = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
export const canonicalJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const sha256Urn = (value) => `sha256:${sha256(value)}`;
const toPosix = (value) => value.split(path.sep).join('/');

function canonicalizeValue(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((entry) => canonicalizeValue(entry));
  if (typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort(compareCodePoint).map((key) => [key, canonicalizeValue(value[key])]),
  );
}

export const canonicalize = (value) => JSON.stringify(canonicalizeValue(value));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function commandResult(command, args, cwd, options = {}) {
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) {
    if (options.scrubNpmCredentials && (
      /^npm_config_/i.test(name)
      || /(?:npm|node).*?(?:auth|password|token|username)/i.test(name)
    )) {
      delete environment[name];
    }
  }
  delete environment.NODE_PATH;
  delete environment.INIT_CWD;
  Object.assign(environment, {
    CI: '1',
    FORCE_COLOR: '0',
    NO_COLOR: '1',
    ...options.environment,
  });
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: environment,
    maxBuffer: 64 * 1024 * 1024,
    timeout: options.timeout ?? 600_000,
  });
  return {
    command: [command, ...args].join(' '),
    exitCode: result.status ?? 127,
    signal: result.signal ?? null,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    ...(result.error ? { error: result.error.message } : {}),
  };
}

function requireGreen(result, label) {
  if (result.exitCode !== 0) {
    throw new Error(
      `${label} failed (${result.exitCode}${result.signal ? `, ${result.signal}` : ''})\n`
      + `${result.stderr || result.stdout || result.error || 'no command output'}`,
    );
  }
}

function redact(value, replacements) {
  let redacted = value;
  for (const [literal, replacement] of replacements) {
    redacted = redacted.split(literal).join(replacement);
  }
  return redacted;
}

async function writeJson(filePath, value) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, canonicalJson(value));
}

async function writeCommandLog(filePath, result, replacements) {
  const contents = [
    `$ ${redact(result.command, replacements)}`,
    `exitCode=${result.exitCode}`,
    `signal=${result.signal ?? ''}`,
    '',
    '[stdout]',
    redact(result.stdout, replacements),
    '[stderr]',
    redact(result.stderr, replacements),
    ...(result.error ? ['[spawn-error]', redact(result.error, replacements)] : []),
  ].join('\n');
  await fsp.writeFile(filePath, `${contents.trimEnd()}\n`);
}

async function mkdirFresh(directory) {
  try {
    await fsp.mkdir(directory);
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'EEXIST') {
      throw new Error(`Refusing to overwrite evidence directory: ${directory}`);
    }
    throw error;
  }
}

function artifactFile(artifact) {
  if (!Array.isArray(artifact.files) || artifact.files.length !== 1) {
    throw new Error('Runnable artifact must contain exactly one generated source file.');
  }
  return artifact.files[0];
}

function normalizePackageName(specifier) {
  if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/');
  return specifier.split('/')[0];
}

export function extractBareImports(source) {
  const imports = new Set();
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?[^'";]*?\sfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (!match[1].startsWith('.') && !match[1].startsWith('/')) imports.add(match[1]);
    }
  }
  return [...imports].sort(compareCodePoint);
}

export function validateRunnableArtifact({ artifact, framework }) {
  if (!FRAMEWORKS.includes(framework)) throw new Error(`Unsupported framework: ${framework}`);
  if (!artifact || typeof artifact !== 'object') throw new Error(`${framework}: artifact is required.`);
  if (artifact.schemaVersion !== '1.0.0' || artifact.framework !== framework) {
    throw new Error(`${framework}: artifact identity is not schemaVersion 1.0.0/${framework}.`);
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(artifact.contentHash ?? '')) {
    throw new Error(`${framework}: artifact contentHash is missing or malformed.`);
  }
  const { contentHash: _contentHash, ...artifactPayload } = artifact;
  if (artifact.contentHash !== sha256Urn(canonicalize(artifactPayload))) {
    throw new Error(`${framework}: artifact contentHash does not match its canonical envelope payload.`);
  }

  const file = artifactFile(artifact);
  const expectedPath = framework === 'react' ? 'src/GeneratedUI.tsx' : 'src/GeneratedUI.vue';
  if (file.path !== expectedPath || typeof file.contents !== 'string' || file.contents.length === 0) {
    throw new Error(`${framework}: artifact source file is not ${expectedPath}.`);
  }
  if (file.contentHash !== sha256Urn(file.contents)) {
    throw new Error(`${framework}: generated source contentHash does not match its bytes.`);
  }
  if (!file.contents.includes('data-oods-component="Tabs"')
    || !file.contents.includes('detail-tab-panel-3')
    || !file.contents.includes('detail-tab-panel-5')
    || !file.contents.includes('detail-tab-panel-7')) {
    throw new Error(`${framework}: generated source omits the genuine saved-schema Tabs structure.`);
  }

  if (!Array.isArray(artifact.dependencies) || artifact.dependencies.length === 0) {
    throw new Error(`${framework}: artifact dependency manifest is empty.`);
  }
  const dependencyNames = new Set();
  for (const dependency of artifact.dependencies) {
    if (!dependency || typeof dependency.name !== 'string' || typeof dependency.version !== 'string') {
      throw new Error(`${framework}: artifact has an invalid dependency record.`);
    }
    if (dependencyNames.has(dependency.name)) throw new Error(`${framework}: duplicate dependency ${dependency.name}.`);
    dependencyNames.add(dependency.name);
    if (!['dependency', 'peerDependency'].includes(dependency.kind)) {
      throw new Error(`${framework}: dependency ${dependency.name} has invalid kind ${dependency.kind}.`);
    }
    if (/\b(?:workspace|file|link):/i.test(dependency.version)) {
      throw new Error(`${framework}: dependency ${dependency.name} uses a local-only protocol.`);
    }
    if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(dependency.version)) {
      throw new Error(`${framework}: dependency ${dependency.name} does not use an exact semantic version.`);
    }
  }
  for (const required of ['@oods/component-styles', `@oods/components-${framework}`, framework]) {
    if (!dependencyNames.has(required)) throw new Error(`${framework}: artifact omits dependency ${required}.`);
  }
  if (framework === 'react' && !dependencyNames.has('react-dom')) {
    throw new Error('react: artifact omits dependency react-dom.');
  }

  if (!Array.isArray(artifact.actions)) throw new Error(`${framework}: artifact actions are missing.`);
  const actionNames = artifact.actions.map((action) => action.name).sort(compareCodePoint);
  if (canonicalJson(actionNames) !== canonicalJson([...REQUIRED_ACTIONS])) {
    throw new Error(`${framework}: artifact action contract differs: ${actionNames.join(', ')}.`);
  }
  for (const name of REQUIRED_ACTIONS) {
    if (!file.contents.includes(`@oods-domain-action ${name}`)
      || !file.contents.includes(`actions.${name}`)) {
      throw new Error(`${framework}: generated source omits typed action ${name}.`);
    }
  }

  const bareImports = extractBareImports(file.contents);
  const barePackages = [...new Set(bareImports.map(normalizePackageName))].sort(compareCodePoint);
  const undeclaredImports = barePackages.filter((name) => !dependencyNames.has(name));
  if (undeclaredImports.length > 0) {
    throw new Error(`${framework}: generated bare imports lack artifact dependencies: ${undeclaredImports.join(', ')}.`);
  }
  return {
    schemaVersion: artifact.schemaVersion,
    framework,
    contentHash: artifact.contentHash,
    source: { path: file.path, bytes: Buffer.byteLength(file.contents), contentHash: file.contentHash },
    dependencies: clone(artifact.dependencies),
    actions: clone(artifact.actions),
    bareImports,
  };
}

function tarballByName(tarballs, name) {
  const record = tarballs.find((candidate) => candidate.name === name);
  if (!record) throw new Error(`No freshly packed tarball exists for ${name}.`);
  return record;
}

function publicTarball(record) {
  return {
    name: record.name,
    version: record.version,
    artifactPath: record.artifactPath,
    bytes: record.bytes,
    sha256: record.sha256,
  };
}

export function deriveConsumerDependencies({ artifact, tarballs }) {
  const framework = artifact.framework;
  const artifactDependencies = artifact.dependencies.map((dependency) => ({ ...dependency }));
  const runtime = {};
  const localNames = new Set();
  const queue = [];

  for (const dependency of artifactDependencies) {
    if (dependency.name.startsWith('@oods/')) {
      const packed = tarballByName(tarballs, dependency.name);
      if (packed.version !== dependency.version) {
        throw new Error(`${framework}: ${dependency.name} artifact version ${dependency.version} != packed ${packed.version}.`);
      }
      runtime[dependency.name] = `file:${packed.tarballPath}`;
      localNames.add(dependency.name);
      queue.push(packed);
    } else {
      runtime[dependency.name] = dependency.version;
    }
  }

  while (queue.length > 0) {
    const packed = queue.shift();
    for (const [name, requestedVersion] of Object.entries(packed.manifest.dependencies ?? {})) {
      if (!name.startsWith('@oods/')) continue;
      const transitive = tarballByName(tarballs, name);
      if (requestedVersion !== transitive.version) {
        throw new Error(
          `${framework}: packed ${packed.name} requests ${name}@${requestedVersion}, packed closure is ${transitive.version}.`,
        );
      }
      if (!localNames.has(name)) {
        localNames.add(name);
        queue.push(transitive);
      }
      runtime[name] = `file:${transitive.tarballPath}`;
    }
  }

  const installedDependencies = Object.entries(runtime)
    .sort(([left], [right]) => compareCodePoint(left, right))
    .map(([name, installSpec]) => {
      const direct = artifactDependencies.find((dependency) => dependency.name === name);
      const packed = name.startsWith('@oods/') ? tarballByName(tarballs, name) : null;
      return {
        name,
        version: direct?.version ?? packed?.version,
        kind: direct?.kind ?? 'dependency',
        role: direct ? 'artifact-root' : 'transitive-local',
        installSpec: installSpec.startsWith('file:')
          ? `file:<submitted-tarballs>/${path.basename(installSpec.slice('file:'.length))}`
          : installSpec,
        source: direct ? 'artifact-manifest' : 'packed-local-transitive-closure',
      };
    });
  const transitiveLocalClosure = [...localNames]
    .filter((name) => !artifactDependencies.some((dependency) => dependency.name === name))
    .sort(compareCodePoint)
    .map((name) => publicTarball(tarballByName(tarballs, name)));

  return {
    artifactDependencies,
    transitiveLocalClosure,
    installedDependencies,
    runtime,
    verifierDependencies: { ...VERIFIER_DEPENDENCIES[framework] },
    localTarballs: [...localNames].sort(compareCodePoint).map((name) => publicTarball(tarballByName(tarballs, name))),
  };
}

export async function loadCommittedRunnableArtifacts() {
  const reportPath = path.join(M04_ROOT, 'compilation-report.json');
  const reportBytes = await fsp.readFile(reportPath);
  const report = JSON.parse(reportBytes);
  const result = report.results?.find((candidate) => candidate.name === EXPECTED_SCHEMA_NAME);
  if (!result || result.schemaRef !== EXPECTED_SCHEMA_REF) {
    throw new Error(`M04 report does not identify ${EXPECTED_SCHEMA_NAME}/${EXPECTED_SCHEMA_REF}.`);
  }

  const artifacts = {};
  const artifactFiles = {};
  for (const framework of FRAMEWORKS) {
    const target = result.targets?.[framework];
    if (target?.disposition !== 'compiled' || typeof target.artifact?.path !== 'string') {
      throw new Error(`M04 ${framework} target is not compiled.`);
    }
    const artifactPath = path.join(M04_ROOT, target.artifact.path);
    const bytes = await fsp.readFile(artifactPath);
    if (sha256Urn(bytes) !== target.artifact.fileSha256) {
      throw new Error(`M04 ${framework} artifact file digest differs from compilation-report.json.`);
    }
    const artifact = JSON.parse(bytes);
    const validation = validateRunnableArtifact({ artifact, framework });
    if (artifact.contentHash !== target.artifact.contentHash) {
      throw new Error(`M04 ${framework} contentHash differs from compilation-report.json.`);
    }
    artifacts[framework] = artifact;
    artifactFiles[framework] = {
      path: toPosix(path.relative(REPOSITORY_ROOT, artifactPath)),
      fileSha256: sha256Urn(bytes),
      contentHash: validation.contentHash,
    };
  }
  return {
    artifacts,
    provenance: {
      mission: 's183-m04',
      schemaName: result.name,
      schemaRef: result.schemaRef,
      createdAt: result.createdAt,
      sourceSha256: result.sourceSha256,
      compilationReport: {
        path: toPosix(path.relative(REPOSITORY_ROOT, reportPath)),
        sha256: sha256Urn(reportBytes),
      },
      artifacts: artifactFiles,
    },
  };
}

function reactFiles(source) {
  return {
    'src/GeneratedUI.tsx': source,
    'src/App.tsx': `
import React from 'react';
import { GeneratedUI, type GeneratedUIActions, type PageProps } from './GeneratedUI.js';

export type ConsumerActions = GeneratedUIActions;
const model = ${JSON.stringify(MODEL, null, 2)} satisfies Omit<PageProps, 'actions'>;

export function App({ actions }: { actions: ConsumerActions }) {
  return (
    <main id="consumer-shell">
      <nav id="domain-actions" aria-label="Subscription actions">
        <button id="domain-edit" type="button" onClick={actions.handleEdit}>Edit subscription</button>
        <button id="domain-delete" type="button" onClick={actions.handleDelete}>Delete subscription</button>
      </nav>
      <GeneratedUI {...model} actions={actions} />
    </main>
  );
}
`.trimStart(),
    'src/main.tsx': `
import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { App, type ConsumerActions } from './App.js';
import './consumer.css';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app hydration root.');
window.__OODS_DOMAIN_ACTIONS__ = { handleEdit: 0, handleDelete: 0 };
const actions = Object.freeze<ConsumerActions>({
  handleEdit: () => { window.__OODS_DOMAIN_ACTIONS__.handleEdit += 1; },
  handleDelete: () => { window.__OODS_DOMAIN_ACTIONS__.handleDelete += 1; },
});
window.__OODS_ACTIONS_FROZEN__ = Object.isFrozen(actions);
function HydrationProbe() {
  React.useEffect(() => { window.__OODS_HYDRATED__ = true; }, []);
  return <App actions={actions} />;
}
hydrateRoot(root, <HydrationProbe />);
`.trimStart(),
    'src/ssr.tsx': `
import React from 'react';
import { renderToString } from 'react-dom/server';
import { App } from './App.js';

const html = renderToString(<App actions={{ handleEdit: () => undefined, handleDelete: () => undefined }} />);
process.stdout.write(JSON.stringify({ html }));
`.trimStart(),
    'src/consumer.css': CONSUMER_CSS,
    'src/window.d.ts': `interface Window {\n  __OODS_HYDRATED__?: boolean;\n  __OODS_ACTIONS_FROZEN__?: boolean;\n  __OODS_DOMAIN_ACTIONS__: { handleEdit: number; handleDelete: number };\n  __OODS_CAPTURE_FINGERPRINT__: () => unknown;\n  __OODS_SSR_FINGERPRINT__: unknown;\n}\n`,
    'index.html': `<!doctype html><html data-brand="A" data-theme="light"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>S183 React saved-schema consumer</title></head><body><div id="app"><!--SSR_MARKUP--></div><script>${FINGERPRINT_SCRIPT}</script><script type="module" src="/src/main.tsx"></script></body></html>\n`,
    'tsconfig.json': canonicalJson({
      compilerOptions: {
        strict: true,
        target: 'ES2022',
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        skipLibCheck: false,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        module: 'ESNext',
        moduleResolution: 'Bundler',
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
      },
      include: ['src'],
    }),
    'vite.config.mjs': `import { defineConfig } from 'vite';\nexport default defineConfig({ build: { minify: false, sourcemap: true } });\n`,
  };
}

function vueFiles(source) {
  return {
    'src/GeneratedUI.vue': source,
    'src/App.vue': `
<template>
  <main id="consumer-shell">
    <nav id="domain-actions" aria-label="Subscription actions">
      <button id="domain-edit" type="button" @click="actions.handleEdit">Edit subscription</button>
      <button id="domain-delete" type="button" @click="actions.handleDelete">Delete subscription</button>
    </nav>
    <GeneratedUI v-bind="model" :actions="actions" />
  </main>
</template>

<script setup lang="ts">
import GeneratedUI from './GeneratedUI.vue';

export interface ConsumerActions {
  handleEdit: () => void;
  handleDelete: () => void;
}
defineProps<{ actions: ConsumerActions }>();
const model = ${JSON.stringify(MODEL, null, 2)};
</script>
`.trimStart(),
    'src/main.ts': `
import { createSSRApp } from 'vue';
import App, { type ConsumerActions } from './App.vue';
import './consumer.css';

window.__OODS_DOMAIN_ACTIONS__ = { handleEdit: 0, handleDelete: 0 };
const actions = Object.freeze<ConsumerActions>({
  handleEdit: () => { window.__OODS_DOMAIN_ACTIONS__.handleEdit += 1; },
  handleDelete: () => { window.__OODS_DOMAIN_ACTIONS__.handleDelete += 1; },
});
window.__OODS_ACTIONS_FROZEN__ = Object.isFrozen(actions);
createSSRApp(App, { actions }).mount('#app');
queueMicrotask(() => { window.__OODS_HYDRATED__ = true; });
`.trimStart(),
    'src/ssr.ts': `
import { renderToString } from '@vue/server-renderer';
import { createSSRApp } from 'vue';
import App from './App.vue';

async function main() {
  const html = await renderToString(createSSRApp(App, {
    actions: { handleEdit: () => undefined, handleDelete: () => undefined },
  }));
  process.stdout.write(JSON.stringify({ html }));
}
void main();
`.trimStart(),
    'src/consumer.css': CONSUMER_CSS,
    'src/window.d.ts': `interface Window {\n  __OODS_HYDRATED__?: boolean;\n  __OODS_ACTIONS_FROZEN__?: boolean;\n  __OODS_DOMAIN_ACTIONS__: { handleEdit: number; handleDelete: number };\n  __OODS_CAPTURE_FINGERPRINT__: () => unknown;\n  __OODS_SSR_FINGERPRINT__: unknown;\n}\ndeclare module '*.vue';\n`,
    'index.html': `<!doctype html><html data-brand="A" data-theme="light"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>S183 Vue saved-schema consumer</title></head><body><div id="app"><!--SSR_MARKUP--></div><script>${FINGERPRINT_SCRIPT}</script><script type="module" src="/src/main.ts"></script></body></html>\n`,
    'tsconfig.json': canonicalJson({
      compilerOptions: {
        strict: true,
        target: 'ES2022',
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        skipLibCheck: false,
        allowSyntheticDefaultImports: true,
        module: 'ESNext',
        moduleResolution: 'Bundler',
        isolatedModules: true,
        noEmit: true,
        types: ['node', 'vite/client'],
      },
      include: ['src/**/*.ts', 'src/**/*.vue'],
    }),
    'vite.config.mjs': `import { defineConfig } from 'vite';\nimport vue from '@vitejs/plugin-vue';\nexport default defineConfig({ plugins: [vue()], build: { minify: false, sourcemap: true } });\n`,
  };
}

function replaceExactlyOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0 || source.indexOf(needle, first + needle.length) >= 0) {
    throw new Error(`${label}: mutation needle must occur exactly once.`);
  }
  return `${source.slice(0, first)}${replacement}${source.slice(first + needle.length)}`;
}

function unifiedSingleLinePatch(filePath, before, after) {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  if (beforeLines.length !== afterLines.length) {
    throw new Error(`${filePath}: mutation patch must retain the source line count.`);
  }
  const changed = beforeLines.flatMap((line, index) => (line === afterLines[index] ? [] : [index]));
  if (changed.length !== 1) throw new Error(`${filePath}: expected one changed source line, received ${changed.length}.`);
  const changedIndex = changed[0];
  let start = Math.max(0, changedIndex - 3);
  let end = Math.min(beforeLines.length, changedIndex + 4);
  while (start < changedIndex && beforeLines[start] === '') start += 1;
  while (end > changedIndex + 1 && beforeLines[end - 1] === '') end -= 1;
  const body = [];
  for (let index = start; index < end; index += 1) {
    if (index === changedIndex) {
      body.push(`-${beforeLines[index]}`, `+${afterLines[index]}`);
    } else {
      body.push(` ${beforeLines[index]}`);
    }
  }
  return [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    `@@ -${start + 1},${end - start} +${start + 1},${end - start} @@`,
    ...body,
    '',
  ].join('\n');
}

export function applyConsumerMutation({ framework, kind, files }) {
  if (!FRAMEWORKS.includes(framework)) throw new Error(`Unsupported mutation framework: ${framework}`);
  if (!MUTATION_KINDS.includes(kind)) throw new Error(`Unsupported mutation kind: ${kind}`);
  const mutated = { ...files };
  let targetFile;
  let needle;
  let replacement;
  let expectedGate;
  if (kind === 'tabs-selection-behavior-removed') {
    targetFile = framework === 'react' ? 'src/GeneratedUI.tsx' : 'src/GeneratedUI.vue';
    if (framework === 'react') {
      needle = '"id":"detail-tab-panel-5","label":"Tab 2"';
      replacement = '"id":"detail-tab-panel-5","label":"Tab 2","disabled":true';
    } else {
      needle = "'id':'detail-tab-panel-5','label':'Tab 2','panel':''";
      replacement = "'id':'detail-tab-panel-5','label':'Tab 2','panel':'','disabled':true";
    }
    expectedGate = 'interaction-evidence';
  } else {
    targetFile = framework === 'react' ? 'src/main.tsx' : 'src/main.ts';
    needle = '  handleEdit: () => { window.__OODS_DOMAIN_ACTIONS__.handleEdit += 1; },';
    replacement = '  handleEdit: () => undefined,';
    expectedGate = 'interaction-evidence';
  }
  mutated[targetFile] = replaceExactlyOnce(mutated[targetFile], needle, replacement, `${framework}/${kind}`);
  const patch = unifiedSingleLinePatch(targetFile, files[targetFile], mutated[targetFile]);
  return {
    files: mutated,
    patch,
    descriptor: {
      schemaVersion: '1.0.0',
      mission: 's183-m05',
      framework,
      kind,
      operation: 'replace-exactly-once',
      targetFile,
      needle,
      replacement,
      expectedGate,
      beforeSha256: sha256Urn(files[targetFile]),
      afterSha256: sha256Urn(mutated[targetFile]),
      patchSha256: sha256Urn(patch),
    },
  };
}

async function writeFiles(root, files) {
  for (const [relativePath, contents] of Object.entries(files)) {
    const destination = path.join(root, relativePath);
    await fsp.mkdir(path.dirname(destination), { recursive: true });
    await fsp.writeFile(destination, contents);
  }
}

function isolatedNpmEnvironment(consumerRoot, userConfig, globalConfig) {
  return {
    NODE_PATH: '',
    NPM_CONFIG_USERCONFIG: userConfig,
    NPM_CONFIG_GLOBALCONFIG: globalConfig,
    npm_config_userconfig: userConfig,
    npm_config_globalconfig: globalConfig,
    npm_config_cache: path.join(consumerRoot, '.npm-cache'),
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_package_lock: 'false',
    npm_config_registry: 'https://registry.npmjs.org/',
    npm_config_update_notifier: 'false',
  };
}

function assertInstalledIsolation(consumerRoot, dependencyPlan) {
  const realRoot = fs.realpathSync(consumerRoot);
  if (realRoot.startsWith(`${fs.realpathSync(REPOSITORY_ROOT)}${path.sep}`)) {
    throw new Error('Clean consumer was created inside the pnpm workspace.');
  }
  for (const dependency of dependencyPlan.installedDependencies) {
    if (!dependency.name.startsWith('@oods/')) continue;
    const directory = path.join(consumerRoot, 'node_modules', ...dependency.name.split('/'));
    const stats = fs.lstatSync(directory);
    if (stats.isSymbolicLink()) throw new Error(`Workspace symlink leaked into consumer: ${dependency.name}.`);
    const real = fs.realpathSync(directory);
    if (!real.startsWith(`${realRoot}${path.sep}`)) {
      throw new Error(`Installed package resolved outside consumer: ${dependency.name}.`);
    }
  }
}

function assertImportsRepresented(framework, files, manifest) {
  const imports = [...new Set(Object.values(files).flatMap((contents) => extractBareImports(contents)))].sort(compareCodePoint);
  const packages = [...new Set(imports.map(normalizePackageName))].sort(compareCodePoint);
  const represented = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ]);
  const missing = packages.filter((name) => !represented.has(name));
  if (missing.length > 0) throw new Error(`${framework}: bare imports lack install operands: ${missing.join(', ')}.`);
  return { imports, packages };
}

async function directoryDigest(directory) {
  const entries = [];
  async function visit(current, prefix = '') {
    for (const entry of (await fsp.readdir(current, { withFileTypes: true }))
      .sort((left, right) => compareCodePoint(left.name, right.name))) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute, relative);
      else if (entry.isFile()) {
        const bytes = await fsp.readFile(absolute);
        entries.push({ path: relative, bytes: bytes.byteLength, sha256: sha256Urn(bytes) });
      }
    }
  }
  await visit(directory);
  return { files: entries, contentHash: sha256Urn(canonicalJson(entries)) };
}

function mimeType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.map')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

async function withStaticServer(directory, callback) {
  const root = path.resolve(directory);
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
      const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const candidate = path.resolve(root, relative);
      if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const contents = await fsp.readFile(candidate);
      response.writeHead(200, { 'content-type': mimeType(candidate), 'cache-control': 'no-store' });
      response.end(contents);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Unable to resolve static server address.');
  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function browserProof({ framework, distRoot, hydrationTimeout = 10_000 }) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    return await withStaticServer(distRoot, async (url) => {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const runtimeErrors = [];
      page.on('pageerror', (error) => runtimeErrors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') runtimeErrors.push(message.text());
      });
      await page.goto(url, { waitUntil: 'networkidle' });
      const hydrated = await page.waitForFunction(() => window.__OODS_HYDRATED__ === true, undefined, {
        timeout: hydrationTimeout,
      }).then(() => true, () => false);
      const mounted = await page.locator('#screen-detail-13').count() === 1;
      const hydrationInvariant = await page.evaluate(() => {
        const before = window.__OODS_SSR_FINGERPRINT__;
        const after = window.__OODS_CAPTURE_FINGERPRINT__();
        return { before, after, equal: JSON.stringify(before) === JSON.stringify(after) };
      });
      const componentCounts = await page.evaluate((ids) => Object.fromEntries(
        ids.map((id) => [id, document.querySelectorAll(`[data-oods-component="${id}"]`).length]),
      ), REQUIRED_COMPONENTS);
      let interactionState = {
        initialSelectedTab: null,
        selectedTab: null,
        selectedPanel: null,
        selectedTabPanelDomId: null,
        initialVisiblePanelContentId: null,
        initialFirstTabSelected: null,
        initialFirstPanelHidden: null,
        firstTabSelectedAfter: null,
        firstPanelHiddenAfter: null,
        secondTabSelectedAfter: null,
        secondPanelHiddenAfter: null,
        domainActions: { handleEdit: 0, handleDelete: 0 },
      };
      let css = { tabPaddingInlineStart: null, primaryTextToken: null };
      if (hydrated && mounted) {
        interactionState = await page.evaluate(() => {
          const firstTab = document.querySelector('[data-tab-id="detail-tab-panel-3"]');
          const firstPanelId = firstTab?.getAttribute('aria-controls');
          const firstPanel = firstPanelId ? document.getElementById(firstPanelId) : null;
          return {
            initialSelectedTab: document.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute('data-tab-id') ?? null,
            selectedTab: null,
            selectedPanel: null,
            selectedTabPanelDomId: null,
            initialVisiblePanelContentId: firstPanel?.querySelector('#slot-tab-0-4')?.getAttribute('id') ?? null,
            initialFirstTabSelected: firstTab?.getAttribute('aria-selected') === 'true',
            initialFirstPanelHidden: firstPanel?.hasAttribute('hidden') ?? null,
            firstTabSelectedAfter: null,
            firstPanelHiddenAfter: null,
            secondTabSelectedAfter: null,
            secondPanelHiddenAfter: null,
            domainActions: { ...window.__OODS_DOMAIN_ACTIONS__ },
          };
        });
        css = await page.evaluate(() => {
          const tab = document.querySelector('[role="tab"]');
          return {
            tabPaddingInlineStart: tab instanceof HTMLElement ? getComputedStyle(tab).paddingInlineStart : null,
            primaryTextToken: getComputedStyle(document.documentElement).getPropertyValue('--sys-text-primary').trim() || null,
          };
        });
        await page.locator('#domain-edit').click();
        await page.locator('#domain-delete').click();
        await page.evaluate(() => {
          const tab = document.querySelector('[data-tab-id="detail-tab-panel-5"]');
          if (tab instanceof HTMLButtonElement) tab.click();
        });
        await page.waitForTimeout(50);
        interactionState = await page.evaluate((initial) => {
          const firstTab = document.querySelector('[data-tab-id="detail-tab-panel-3"]');
          const firstPanelId = firstTab?.getAttribute('aria-controls');
          const firstPanel = firstPanelId ? document.getElementById(firstPanelId) : null;
          const secondTab = document.querySelector('[data-tab-id="detail-tab-panel-5"]');
          const secondPanelId = secondTab?.getAttribute('aria-controls');
          const secondPanel = secondPanelId ? document.getElementById(secondPanelId) : null;
          const selected = document.querySelector('[role="tab"][aria-selected="true"]');
          const selectedPanel = document.querySelector('[role="tabpanel"]:not([hidden])');
          return {
            ...initial,
            selectedTab: selected?.getAttribute('data-tab-id') ?? null,
            selectedPanel: selectedPanel?.querySelector('#slot-tab-1-6')?.getAttribute('id') ?? null,
            selectedTabPanelDomId: selectedPanel?.getAttribute('id') ?? null,
            firstTabSelectedAfter: firstTab?.getAttribute('aria-selected') === 'true',
            firstPanelHiddenAfter: firstPanel?.hasAttribute('hidden') ?? null,
            secondTabSelectedAfter: secondTab?.getAttribute('aria-selected') === 'true',
            secondPanelHiddenAfter: secondPanel?.hasAttribute('hidden') ?? null,
            domainActions: { ...window.__OODS_DOMAIN_ACTIONS__ },
          };
        }, interactionState);
      }
      const actionsFrozen = await page.evaluate(() => window.__OODS_ACTIONS_FROZEN__ === true);
      await page.close();
      return {
        framework,
        mount: mounted ? 'passed' : 'failed',
        hydration: hydrated ? 'passed' : 'failed',
        hydrationInvariant,
        actionsFrozen,
        runtimeErrors,
        componentCounts,
        css,
        interactions: interactionState,
      };
    });
  } finally {
    await browser.close();
  }
}

export function assertMountHydrationEvidence(framework, proof) {
  if (proof.mount !== 'passed') {
    throw new Error(`[mount] ${framework} did not retain exactly one genuine saved-schema root.`);
  }
  if (proof.hydration !== 'passed' || proof.runtimeErrors.length > 0 || proof.hydrationInvariant?.equal !== true) {
    throw new Error(
      `[hydration] ${framework} failed its SSR-to-hydrated invariant: ${JSON.stringify({
        mount: proof.mount,
        hydration: proof.hydration,
        runtimeErrors: proof.runtimeErrors,
        hydrationInvariant: proof.hydrationInvariant,
      })}`,
    );
  }
  const missing = REQUIRED_COMPONENTS.filter((name) => (proof.componentCounts[name] ?? 0) < 1);
  if (missing.length > 0) throw new Error(`[mount] ${framework} omits components: ${missing.join(', ')}.`);
}

export function assertInteractionEvidence(framework, proof) {
  const interactions = proof.interactions;
  if (proof.actionsFrozen !== true) {
    throw new Error(`[interaction-evidence] ${framework} did not share a frozen action object.`);
  }
  if (interactions.initialSelectedTab !== 'detail-tab-panel-3'
    || interactions.initialVisiblePanelContentId !== 'slot-tab-0-4'
    || interactions.initialFirstTabSelected !== true
    || interactions.initialFirstPanelHidden !== false
    || interactions.selectedTab !== 'detail-tab-panel-5'
    || interactions.selectedPanel !== 'slot-tab-1-6'
    || typeof interactions.selectedTabPanelDomId !== 'string'
    || !interactions.selectedTabPanelDomId.endsWith('panel-detail-tab-panel-5')
    || interactions.firstTabSelectedAfter !== false
    || interactions.firstPanelHiddenAfter !== true
    || interactions.secondTabSelectedAfter !== true
    || interactions.secondPanelHiddenAfter !== false) {
    throw new Error(`[interaction-evidence] ${framework} Tabs did not select Tab 2: ${JSON.stringify(interactions)}.`);
  }
  if (interactions.domainActions.handleEdit !== 1 || interactions.domainActions.handleDelete !== 1) {
    throw new Error(`[interaction-evidence] ${framework} domain actions were not both invoked once: ${JSON.stringify(interactions.domainActions)}.`);
  }
}

export function evaluateMutationControl({ framework, kind, proof }) {
  const expectedGate = 'interaction-evidence';
  try {
    assertMountHydrationEvidence(framework, proof);
    assertInteractionEvidence(framework, proof);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (!reason.startsWith(`[${expectedGate}]`)) {
      throw new Error(`${framework}/${kind}: mutation failed at the wrong gate: ${reason}`);
    }
    return {
      status: 'detected',
      expected: { gate: expectedGate, status: 'failed' },
      observed: { gate: expectedGate, status: 'failed' },
      reason,
    };
  }
  throw new Error(`${framework}/${kind}: mutation was missed by ${expectedGate}.`);
}

function consumerManifest(framework, dependencyPlan) {
  const verifier = dependencyPlan.verifierDependencies;
  const runtime = { ...dependencyPlan.runtime };
  const devDependencies = { ...verifier };
  if (framework === 'vue') {
    runtime['@vue/server-renderer'] = verifier['@vue/server-renderer'];
    delete devDependencies['@vue/server-renderer'];
  }
  return {
    name: `oods-s183-${framework}-saved-schema-consumer`,
    private: true,
    type: 'module',
    dependencies: runtime,
    devDependencies,
  };
}

function normalizedManifest(manifest) {
  const result = clone(manifest);
  for (const section of ['dependencies', 'devDependencies']) {
    for (const [name, value] of Object.entries(result[section] ?? {})) {
      if (value.startsWith('file:')) {
        result[section][name] = `file:<submitted-tarballs>/${path.basename(value.slice('file:'.length))}`;
      }
    }
  }
  return result;
}

async function runSsr({ framework, consumerRoot, environment, outputDirectory, logRoot, replacements, label }) {
  const entry = framework === 'react' ? 'src/ssr.tsx' : 'src/ssr.ts';
  const build = commandResult('npm', [
    'exec', '--', 'vite', 'build', '--config', 'vite.config.mjs', '--ssr', entry, '--outDir', outputDirectory,
  ], consumerRoot, { environment, scrubNpmCredentials: true });
  await writeCommandLog(path.join(logRoot, `${label}-build.log`), build, replacements);
  requireGreen(build, `${framework} ${label} build`);
  const candidates = (await fsp.readdir(path.join(consumerRoot, outputDirectory)))
    .filter((name) => name.endsWith('.js') || name.endsWith('.mjs'))
    .sort(compareCodePoint);
  if (candidates.length !== 1) throw new Error(`${framework}: ${label} emitted ${candidates.length} entries.`);
  const render = commandResult('node', [path.join(outputDirectory, candidates[0])], consumerRoot, {
    environment,
    scrubNpmCredentials: true,
  });
  await writeCommandLog(path.join(logRoot, `${label}-render.log`), render, replacements);
  requireGreen(render, `${framework} ${label} render`);
  const proof = JSON.parse(render.stdout);
  if (typeof proof.html !== 'string' || !proof.html.includes('id="screen-detail-13"')) {
    throw new Error(`${framework}: ${label} omitted saved-schema root.`);
  }
  return { build, render, html: proof.html };
}

async function injectSsrMarkup(distRoot, html) {
  const indexPath = path.join(distRoot, 'index.html');
  const contents = await fsp.readFile(indexPath, 'utf8');
  if (!contents.includes('<!--SSR_MARKUP-->')) throw new Error('Production index lost SSR marker.');
  await fsp.writeFile(indexPath, contents.replace('<!--SSR_MARKUP-->', html));
}

async function cssProof(distRoot) {
  const assetRoot = path.join(distRoot, 'assets');
  const files = (await fsp.readdir(assetRoot)).filter((name) => name.endsWith('.css')).sort(compareCodePoint);
  if (files.length === 0) throw new Error('Production build emitted no CSS asset.');
  const contents = (await Promise.all(files.map((name) => fsp.readFile(path.join(assetRoot, name), 'utf8')))).join('\n');
  if (!contents.includes('data-oods-component') || !contents.includes('oods-tab') || !contents.includes('--sys-text-primary')) {
    throw new Error('Production CSS does not contain the shared OODS component/token contract.');
  }
  return { files, bytes: Buffer.byteLength(contents), sha256: sha256Urn(contents) };
}

async function runMutation({
  framework,
  kind,
  baselineFiles,
  consumerRoot,
  outputRoot,
  environment,
  replacements,
}) {
  const mutationRoot = path.join(outputRoot, 'mutations', kind);
  await fsp.mkdir(path.join(mutationRoot, 'logs'), { recursive: true });
  const { files, patch, descriptor } = applyConsumerMutation({ framework, kind, files: baselineFiles });
  await writeJson(path.join(mutationRoot, 'transform.json'), descriptor);
  const patchPath = path.join(mutationRoot, 'mutation.patch');
  await fsp.writeFile(patchPath, patch);
  const patchCheck = commandResult('git', ['apply', '--check', '--whitespace=nowarn', patchPath], consumerRoot);
  await writeCommandLog(path.join(mutationRoot, 'logs', 'patch-check.log'), patchCheck, replacements);
  requireGreen(patchCheck, `${framework}/${kind} archived patch check`);
  const patchApply = commandResult('git', ['apply', '--whitespace=nowarn', patchPath], consumerRoot);
  await writeCommandLog(path.join(mutationRoot, 'logs', 'patch-apply.log'), patchApply, replacements);
  requireGreen(patchApply, `${framework}/${kind} archived patch replay`);
  const appliedBytes = await fsp.readFile(path.join(consumerRoot, descriptor.targetFile), 'utf8');
  if (sha256Urn(appliedBytes) !== descriptor.afterSha256 || appliedBytes !== files[descriptor.targetFile]) {
    throw new Error(`${framework}/${kind}: archived patch replay differs from deterministic transform.`);
  }
  const slug = kind.replaceAll('-', '_');
  const build = commandResult('npm', [
    'exec', '--', 'vite', 'build', '--config', 'vite.config.mjs', '--outDir', `dist-${slug}`,
  ], consumerRoot, { environment, scrubNpmCredentials: true });
  await writeCommandLog(path.join(mutationRoot, 'logs', 'production-build.log'), build, replacements);
  requireGreen(build, `${framework}/${kind} production build`);
  const ssr = await runSsr({
    framework,
    consumerRoot,
    environment,
    outputDirectory: `dist-ssr-${slug}`,
    logRoot: path.join(mutationRoot, 'logs'),
    replacements,
    label: 'server-render',
  });
  const distRoot = path.join(consumerRoot, `dist-${slug}`);
  await injectSsrMarkup(distRoot, ssr.html);
  const proof = await browserProof({ framework, distRoot, hydrationTimeout: 3_000 });
  const evaluation = evaluateMutationControl({ framework, kind, proof });
  const report = {
    schemaVersion: '1.0.0',
    mission: 's183-m05',
    framework,
    kind,
    ...evaluation,
    descriptor,
    replay: {
      patch: 'mutation.patch',
      patchSha256: descriptor.patchSha256,
      checkExitCode: patchCheck.exitCode,
      applyExitCode: patchApply.exitCode,
      appliedFileSha256: sha256Urn(appliedBytes),
      matchesDeterministicTransform: true,
    },
    browser: proof,
  };
  await writeJson(path.join(mutationRoot, 'report.json'), report);
  await writeFiles(consumerRoot, baselineFiles);
  return report;
}

async function runFrameworkConsumer({ framework, artifact, artifactRoot, tarballs, runMutations }) {
  const outputRoot = path.join(artifactRoot, 'consumers', framework);
  await mkdirFresh(outputRoot);
  const logRoot = path.join(outputRoot, 'logs');
  const sourceRoot = path.join(outputRoot, 'source');
  await Promise.all([fsp.mkdir(logRoot), fsp.mkdir(sourceRoot)]);
  const consumerRoot = await fsp.mkdtemp(path.join(os.tmpdir(), `oods-s183-${framework}-consumer-`));
  const userConfig = path.join(consumerRoot, 'empty-user.npmrc');
  const globalConfig = path.join(consumerRoot, 'empty-global.npmrc');
  const replacements = [[consumerRoot, '<consumer-root>'], [REPOSITORY_ROOT, '<repository-root>']];
  const commands = [];
  try {
    const artifactProof = validateRunnableArtifact({ artifact, framework });
    const dependencyPlan = deriveConsumerDependencies({ artifact, tarballs });
    const manifest = consumerManifest(framework, dependencyPlan);
    const generatedSource = artifactFile(artifact).contents;
    const files = framework === 'react' ? reactFiles(generatedSource) : vueFiles(generatedSource);
    const imports = assertImportsRepresented(framework, files, manifest);
    await Promise.all([fsp.writeFile(userConfig, ''), fsp.writeFile(globalConfig, '')]);
    await fsp.writeFile(path.join(consumerRoot, 'package.json'), canonicalJson(manifest));
    await writeFiles(consumerRoot, files);
    await writeFiles(sourceRoot, files);
    await writeJson(path.join(outputRoot, 'dependency-plan.json'), {
      ...dependencyPlan,
      runtime: undefined,
      verifierInfrastructure: {
        packageRole: 'consumer verifier only; not part of the generated artifact dependency contract',
        browser: 'playwright from repository verifier',
      },
      bareImports: imports,
    });
    await writeJson(path.join(sourceRoot, 'consumer-package.json'), normalizedManifest(manifest));

    const environment = isolatedNpmEnvironment(consumerRoot, userConfig, globalConfig);
    const installArgs = ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', '--userconfig', userConfig];
    const install = commandResult('npm', installArgs, consumerRoot, { environment, scrubNpmCredentials: true });
    commands.push({ name: 'install', result: install });
    await writeCommandLog(path.join(logRoot, 'install.log'), install, replacements);
    requireGreen(install, `${framework} clean consumer install`);
    await writeJson(path.join(logRoot, 'rollup.json'), await ensureConsumerRollup(consumerRoot, async extraArgs => {
      const retry = commandResult('npm', [...installArgs, ...extraArgs], consumerRoot, { environment, scrubNpmCredentials: true });
      await writeCommandLog(path.join(logRoot, 'install-optional-retry.log'), retry, replacements);
      requireGreen(retry, `${framework} optional native package reinstall`);
    }));
    assertInstalledIsolation(consumerRoot, dependencyPlan);

    const typecheckArgs = framework === 'react'
      ? ['exec', '--', 'tsc', '--noEmit', '--pretty', 'false']
      : ['exec', '--', 'vue-tsc', '--noEmit', '--pretty', 'false'];
    const typecheck = commandResult('npm', typecheckArgs, consumerRoot, {
      environment,
      scrubNpmCredentials: true,
    });
    commands.push({ name: 'typecheck', result: typecheck });
    await writeCommandLog(path.join(logRoot, 'typecheck.log'), typecheck, replacements);
    requireGreen(typecheck, `${framework} strict typecheck`);

    const clientBuild = commandResult('npm', [
      'exec', '--', 'vite', 'build', '--config', 'vite.config.mjs', '--outDir', 'dist',
    ], consumerRoot, { environment, scrubNpmCredentials: true });
    commands.push({ name: 'production-build', result: clientBuild });
    await writeCommandLog(path.join(logRoot, 'production-build.log'), clientBuild, replacements);
    requireGreen(clientBuild, `${framework} production build`);
    const ssr = await runSsr({
      framework,
      consumerRoot,
      environment,
      outputDirectory: 'dist-ssr',
      logRoot,
      replacements,
      label: 'server-render',
    });
    commands.push({ name: 'server-render-build', result: ssr.build });
    commands.push({ name: 'server-render', result: ssr.render });
    for (const component of REQUIRED_COMPONENTS) {
      if (!ssr.html.includes(`data-oods-component=\\"${component}\\"`)
        && !ssr.html.includes(`data-oods-component="${component}"`)) {
        throw new Error(`${framework}: server render omits ${component}.`);
      }
    }
    const distRoot = path.join(consumerRoot, 'dist');
    await injectSsrMarkup(distRoot, ssr.html);
    const sharedCss = await cssProof(distRoot);
    const browser = await browserProof({ framework, distRoot });
    assertMountHydrationEvidence(framework, browser);
    assertInteractionEvidence(framework, browser);
    if (!browser.css.primaryTextToken || browser.css.tabPaddingInlineStart === '0px') {
      throw new Error(`${framework}: browser did not resolve shared OODS CSS.`);
    }

    const mutationControls = [];
    if (runMutations) {
      for (const kind of MUTATION_KINDS) {
        mutationControls.push(await runMutation({
          framework,
          kind,
          baselineFiles: files,
          consumerRoot,
          outputRoot,
          environment,
          replacements,
        }));
      }
    }

    const build = {
      client: await directoryDigest(path.join(consumerRoot, 'dist')),
      ssr: await directoryDigest(path.join(consumerRoot, 'dist-ssr')),
    };
    await writeJson(path.join(outputRoot, 'build-inventory.json'), build);
    const gates = GATE_NAMES.map((name) => ({ name, status: 'passed' }));
    const report = {
      schemaVersion: '1.0.0',
      mission: 's183-m05',
      framework,
      status: 'passed',
      selected: GATE_NAMES.length,
      passed: GATE_NAMES.length,
      failed: 0,
      skipped: 0,
      gates,
      artifact: {
        contentHash: artifact.contentHash,
        source: artifactProof.source,
        dependencies: artifactProof.dependencies,
        actions: artifactProof.actions,
      },
      artifactPreflight: artifactProof,
      dependencyPlan: {
        artifactDependencies: dependencyPlan.artifactDependencies,
        transitiveLocalClosure: dependencyPlan.transitiveLocalClosure,
        installedDependencies: dependencyPlan.installedDependencies,
        verifierDependencies: dependencyPlan.verifierDependencies,
      },
      consumerManifest: {
        artifactDependencies: dependencyPlan.artifactDependencies,
        installedDependencies: dependencyPlan.installedDependencies,
        normalized: normalizedManifest(manifest),
      },
      isolation: {
        outsidePnpmWorkspace: true,
        freshNodeModules: true,
        emptyVerifierOwnedNpmConfiguration: true,
        installScripts: false,
        workspaceSymlinks: false,
        repositorySourceImports: false,
        inheritedNodeModules: false,
      },
      domainActionBoundary: 'Consumer-owned Edit/Delete controls invoke the exact same frozen typed actions object passed to GeneratedUI; screen-level semantic actions are consumer contract requirements, not invented component events.',
      commands: commands.map(({ name, result }) => ({ name, exitCode: result.exitCode })),
      ssr: { bytes: Buffer.byteLength(ssr.html), sha256: sha256Urn(ssr.html) },
      css: sharedCss,
      browser,
      mutationControls,
      build,
    };
    await writeJson(path.join(outputRoot, 'report.json'), report);
    return report;
  } catch (error) {
    const reason = error instanceof Error ? redact(error.message, replacements) : String(error);
    await writeJson(path.join(outputRoot, 'report.json'), {
      schemaVersion: '1.0.0',
      mission: 's183-m05',
      framework,
      status: 'failed',
      selected: GATE_NAMES.length,
      passed: 0,
      failed: 1,
      skipped: 0,
      reason,
    });
    throw new Error(reason);
  } finally {
    await fsp.rm(consumerRoot, { recursive: true, force: true });
  }
}

export async function runSavedSchemaConsumerProof({
  artifactRoot,
  artifacts,
  tarballs,
  provenance = {
    mission: 's183-m04',
    schemaName: EXPECTED_SCHEMA_NAME,
    schemaRef: EXPECTED_SCHEMA_REF,
  },
  runMutations = true,
}) {
  if (!artifactRoot) throw new Error('artifactRoot is required.');
  await fsp.mkdir(artifactRoot, { recursive: true });
  if (!artifacts?.react || !artifacts?.vue) throw new Error('Both committed React and Vue artifacts are required.');
  const submittedTarballs = tarballs ?? await packFoundationPackages(artifactRoot);
  const consumersRoot = path.join(artifactRoot, 'consumers');
  await mkdirFresh(consumersRoot);
  const frameworkReports = [];
  for (const framework of FRAMEWORKS) {
    frameworkReports.push(await runFrameworkConsumer({
      framework,
      artifact: artifacts[framework],
      artifactRoot,
      tarballs: submittedTarballs,
      runMutations,
    }));
  }
  const selected = frameworkReports.reduce((sum, report) => sum + report.selected, 0);
  const passed = frameworkReports.reduce((sum, report) => sum + report.passed, 0);
  const report = {
    schemaVersion: '1.0.0',
    mission: 's183-m05',
    kind: 'genuine-saved-schema-clean-consumer-proof',
    status: passed === selected && selected === FRAMEWORKS.length * GATE_NAMES.length ? 'passed' : 'failed',
    selected,
    passed,
    failed: selected - passed,
    skipped: 0,
    provenance,
    equalityRule: 'React and Vue run the same eight named gates; no framework receives a waiver or substitute.',
    frameworks: frameworkReports.map((frameworkReport) => ({
      framework: frameworkReport.framework,
      status: frameworkReport.status,
      selected: frameworkReport.selected,
      passed: frameworkReport.passed,
      report: `consumers/${frameworkReport.framework}/report.json`,
      reportSha256: sha256Urn(canonicalJson(frameworkReport)),
      artifactContentHash: frameworkReport.artifact.contentHash,
    })),
    mutationControls: frameworkReports.flatMap((frameworkReport) => frameworkReport.mutationControls.map((control) => ({
      framework: frameworkReport.framework,
      kind: control.kind,
      status: control.status,
      expected: control.expected,
      observed: control.observed,
      report: `consumers/${frameworkReport.framework}/mutations/${control.kind}/report.json`,
    }))),
  };
  await writeJson(path.join(artifactRoot, 'report.json'), report);
  if (report.status !== 'passed') throw new Error(`Saved-schema consumer proof is not green (${passed}/${selected}).`);
  return { report, frameworkReports };
}

async function main() {
  const outputFlag = process.argv.indexOf('--output');
  const outputRoot = outputFlag >= 0
    ? path.resolve(process.argv[outputFlag + 1] ?? '')
    : DEFAULT_OUTPUT_ROOT;
  if (!outputRoot) throw new Error('--output requires a directory.');
  await mkdirFresh(outputRoot);
  const { artifacts, provenance } = await loadCommittedRunnableArtifacts();
  const result = await runSavedSchemaConsumerProof({ artifactRoot: outputRoot, artifacts, provenance });
  process.stdout.write(`${JSON.stringify({
    status: result.report.status,
    selected: result.report.selected,
    passed: result.report.passed,
    output: toPosix(path.relative(REPOSITORY_ROOT, outputRoot)),
  })}\n`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
