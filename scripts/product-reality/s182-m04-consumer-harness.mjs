import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ensureConsumerRollup } from './consumer-rollup.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const REPOSITORY_ROOT = path.resolve(scriptDirectory, '../..');

export const FOUNDATION_PACKAGE_RECORDS = Object.freeze([
  { name: '@oods/tokens', directory: 'packages/tokens' },
  { name: '@oods/component-contracts', directory: 'packages/component-contracts' },
  { name: '@oods/component-styles', directory: 'packages/component-styles' },
  { name: '@oods/components-react', directory: 'packages/components-react' },
  { name: '@oods/components-vue', directory: 'packages/components-vue' },
]);

export const FOUNDATION_V1_IDS = Object.freeze([
  'Badge', 'Banner', 'Button', 'Card', 'Checkbox', 'DatePicker', 'Grid',
  'Input', 'Select', 'Stack', 'Table', 'Tabs', 'Text', 'Textarea',
]);

const SHOWCASE_REQUIRED_MARKERS = Object.freeze([
  'Foundation v1 account operations',
  'Past due',
  'Payment failed',
  'Save changes',
  'Cancel',
  'Canonical fields retain their labels, help, and validation state.',
  'Product updates',
  '2026-09-30',
  'minColumnWidth',
  'Enter a valid email.',
  'Enterprise',
  'sub-2',
  'billing',
  'Call before renewal.',
]);

const SHOWCASE_EVENT_HANDLERS = Object.freeze([
  ['Dismiss', 'handleDismiss'],
  ['Activate', 'handleActivate'],
  ['Activate', 'handleSecondaryActivate'],
  ['Change', 'handleMarketingChange'],
  ['Change', 'handleRenewalChange'],
  ['Change', 'handleEmailChange'],
  ['Change', 'handlePlanChange'],
  ['RowActivate', 'handleRowActivate'],
  ['Change', 'handleTabChange'],
  ['Change', 'handleNotesChange'],
]);

const SHOWCASE_CALLBACK_HANDLERS = Object.freeze(
  SHOWCASE_EVENT_HANDLERS.map(([, handler]) => handler),
);

const PUBLIC_EXTERNAL_VERSIONS = Object.freeze({
  '@radix-ui/react-slot': '1.2.3',
  '@types/node': '20.19.21',
  '@types/react': '19.2.2',
  '@types/react-dom': '19.2.2',
  '@vitejs/plugin-vue': '5.2.4',
  '@vue/compiler-sfc': '3.5.42',
  '@vue/server-renderer': '3.5.42',
  'class-variance-authority': '0.7.1',
  react: '19.2.0',
  'react-dom': '19.2.0',
  typescript: '5.9.3',
  vite: '6.4.3',
  vue: '3.5.42',
  'vue-tsc': '3.3.11',
});

const compareCodePoint = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
export const canonicalJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const toPosix = (value) => value.split(path.sep).join('/');

function redact(value, replacements) {
  let redacted = value;
  for (const [literal, replacement] of replacements) {
    redacted = redacted.split(literal).join(replacement);
  }
  return redacted;
}

function commandResult(command, args, cwd, options = {}) {
  const environment = { ...process.env };
  if (options.scrubNpmCredentials) {
    for (const name of Object.keys(environment)) {
      if (/(?:npm|node).*?(?:auth|password|token|username)/i.test(name)) delete environment[name];
    }
  }
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
      `${label} failed (${result.exitCode}${result.signal ? `, ${result.signal}` : ''})\n` +
      `${result.stderr || result.stdout || result.error || 'no command output'}`,
    );
  }
}

async function writeJson(filePath, value) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, canonicalJson(value));
}

async function writeCommandLog(filePath, result, replacements = []) {
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

function packedManifest(tarballPath) {
  const result = commandResult('tar', ['-xOzf', tarballPath, 'package/package.json'], REPOSITORY_ROOT);
  requireGreen(result, `inspect ${path.basename(tarballPath)}`);
  return JSON.parse(result.stdout);
}

function expectedTarballName(manifest) {
  return `${manifest.name.replace(/^@/, '').replaceAll('/', '-')}-${manifest.version}.tgz`;
}

export async function packFoundationPackages(artifactRoot, { packageSourceRoot = REPOSITORY_ROOT, ignoreScripts = false } = {}) {
  const outputRoot = path.resolve(artifactRoot, 'submitted-packages');
  const tarballRoot = path.join(outputRoot, 'tarballs');
  const logRoot = path.join(outputRoot, 'logs');
  await mkdirFresh(outputRoot);
  await fsp.mkdir(tarballRoot);
  await fsp.mkdir(logRoot);

  const records = [];
  for (const foundation of FOUNDATION_PACKAGE_RECORDS) {
    const packageRoot = path.join(packageSourceRoot, foundation.directory);
    const sourceManifest = JSON.parse(await fsp.readFile(path.join(packageRoot, 'package.json'), 'utf8'));
    const result = commandResult(
      'npm',
      ['pack', packageRoot, '--json', '--pack-destination', tarballRoot, ...(ignoreScripts ? ['--ignore-scripts'] : [])],
      REPOSITORY_ROOT,
      {
        environment: {
          npm_config_audit: 'false',
          npm_config_fund: 'false',
          npm_config_update_notifier: 'false',
        },
      },
    );
    const slug = foundation.name.replace(/^@/, '').replaceAll('/', '-');
    await writeCommandLog(path.join(logRoot, `${slug}.log`), result, [[packageSourceRoot, '<package-source-root>'], [REPOSITORY_ROOT, '<repository-root>']]);
    requireGreen(result, `pack ${foundation.name}`);

    const tarballPath = path.join(tarballRoot, expectedTarballName(sourceManifest));
    const bytes = await fsp.readFile(tarballPath);
    const manifest = packedManifest(tarballPath);
    if (manifest.name !== foundation.name || manifest.version !== sourceManifest.version) {
      throw new Error(`Packed identity mismatch for ${foundation.name}.`);
    }
    if (/\b(?:workspace|file|link):/i.test(JSON.stringify(manifest))) {
      throw new Error(`Packed manifest for ${foundation.name} contains a workspace-only protocol.`);
    }
    records.push({
      name: foundation.name,
      directory: foundation.directory,
      version: sourceManifest.version,
      tarballPath,
      artifactPath: toPosix(path.relative(artifactRoot, tarballPath)),
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
      manifest,
    });
  }

  await writeJson(path.join(outputRoot, 'inventory.json'), records.map(({ tarballPath: _tarballPath, manifest, ...record }) => ({
    ...record,
    packedManifestSha256: sha256(canonicalJson(manifest)),
  })));
  return records;
}

/** Reuse a frozen publish set: never silently repack or accept changed tarball bytes. */
export async function reuseFoundationPackages(artifactRoot, frozenRoot) {
  const records = JSON.parse(await fsp.readFile(path.join(frozenRoot, 'submitted-packages/inventory.json'), 'utf8'));
  const expected = FOUNDATION_PACKAGE_RECORDS.map(row => row.name).sort();
  if (JSON.stringify(records.map(row => row.name).sort()) !== JSON.stringify(expected)) throw new Error('Frozen package population differs');
  for (const record of records) {
    const file = path.resolve(frozenRoot, record.artifactPath);
    if (!file.startsWith(path.resolve(frozenRoot) + path.sep)) throw new Error('Frozen package escapes its root');
    if (sha256(await fsp.readFile(file)) !== record.sha256) throw new Error(`Frozen package digest differs: ${record.name}`);
    const manifest = packedManifest(file);
    if (manifest.name !== record.name || manifest.version !== record.version) throw new Error(`Frozen package identity differs: ${record.name}`);
  }
  const output = path.join(artifactRoot, 'submitted-packages');
  if (fs.existsSync(output)) throw new Error('Submitted package output must be fresh');
  await fsp.cp(path.join(frozenRoot, 'submitted-packages'), output, { recursive: true });
  return records;
}

function findTarball(tarballs, packageName) {
  const record = tarballs.find((candidate) => candidate.name === packageName);
  if (!record) throw new Error(`Required submitted tarball missing: ${packageName}`);
  return record;
}

function isolatedNpmEnvironment(consumerRoot, emptyNpmConfig) {
  return {
    NPM_CONFIG_USERCONFIG: emptyNpmConfig,
    NPM_CONFIG_GLOBALCONFIG: path.join(consumerRoot, 'empty-global.npmrc'),
    npm_config_userconfig: emptyNpmConfig,
    npm_config_globalconfig: path.join(consumerRoot, 'empty-global.npmrc'),
    npm_config_cache: path.join(consumerRoot, '.npm-cache'),
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_package_lock: 'false',
    npm_config_registry: 'https://registry.npmjs.org/',
    npm_config_update_notifier: 'false',
  };
}

function publicTarballRecord(record) {
  const { tarballPath: _tarballPath, manifest: _manifest, ...publicRecord } = record;
  return publicRecord;
}

export async function runPackedExportProof({ artifactRoot, tarballs }) {
  const outputRoot = path.resolve(artifactRoot, 'packed-root-exports');
  await mkdirFresh(outputRoot);
  const consumerRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'oods-s182-b12-'));
  const emptyNpmConfig = path.join(consumerRoot, 'empty.npmrc');
  const replacements = [[consumerRoot, '<consumer-root>'], [REPOSITORY_ROOT, '<repository-root>']];
  try {
    await fsp.writeFile(emptyNpmConfig, '');
    await fsp.writeFile(path.join(consumerRoot, 'empty-global.npmrc'), '');
    await fsp.writeFile(path.join(consumerRoot, 'package.json'), canonicalJson({
      name: 'oods-s182-packed-root-export-proof',
      private: true,
      type: 'module',
    }));

    const installOperands = tarballs.map((record) => record.tarballPath);
    const installResult = commandResult(
      'npm',
      [
        'install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false',
        '--userconfig', emptyNpmConfig,
        ...installOperands,
        `@vue/server-renderer@${PUBLIC_EXTERNAL_VERSIONS['@vue/server-renderer']}`,
        `react@${PUBLIC_EXTERNAL_VERSIONS.react}`,
        `react-dom@${PUBLIC_EXTERNAL_VERSIONS['react-dom']}`,
        `vue@${PUBLIC_EXTERNAL_VERSIONS.vue}`,
      ],
      consumerRoot,
      { environment: isolatedNpmEnvironment(consumerRoot, emptyNpmConfig), scrubNpmCredentials: true },
    );
    await writeCommandLog(path.join(outputRoot, 'install.log'), installResult, replacements);
    requireGreen(installResult, 'isolated five-tarball install');
    assertInstalledPackagesAreIsolated(consumerRoot, 'react');
    assertInstalledPackagesAreIsolated(consumerRoot, 'vue');

    const verificationSource = `
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repositoryRoot = ${JSON.stringify(REPOSITORY_ROOT)};
const roots = {
  tokens: await import('@oods/tokens'),
  contracts: await import('@oods/component-contracts'),
  styles: await import('@oods/component-styles'),
  react: await import('@oods/components-react'),
  vue: await import('@oods/components-vue'),
};
// Nucleus membership comes from the packed @oods/component-contracts tarball, resolved per specifier. s221-m01: charter
// Rule 5b keeps this consumer inside the repository (.tmp is no pnpm workspace member), so the check is the installed
// boundary, this consumer's own node_modules, and never the repository's package source; a check on the repository root
// refused every in-repo consumer.
const consumerModules = realpathSync(process.cwd()) + '/node_modules/';
const repositorySource = realpathSync(repositoryRoot) + '/packages/';
const contractsPath = realpathSync(fileURLToPath(import.meta.resolve('@oods/component-contracts')));
if (!contractsPath.startsWith(consumerModules) || contractsPath.startsWith(repositorySource)) throw new Error('Contracts resolved outside the isolated consumer: ' + contractsPath);
const expectedIds = [...roots.contracts.NUCLEUS_COMPONENT_IDS];
for (const [name, namespace] of Object.entries(roots)) {
  if (!namespace || Object.keys(namespace).length === 0) throw new Error('Empty root export: ' + name);
}
for (const [target, namespace] of [['react', roots.react], ['vue', roots.vue]]) {
  const ids = expectedIds.filter((id) => typeof namespace[id] !== 'undefined');
  if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) {
    throw new Error(target + ' canonical root exports differ: ' + JSON.stringify(ids));
  }
}
const cssPath = fileURLToPath(import.meta.resolve('@oods/component-styles/css'));
const css = readFileSync(cssPath, 'utf8');
if (!css.includes("[data-oods-component='Tabs']") || !css.includes('@oods/tokens/css')) {
  throw new Error('Shared CSS root export lacks the component/token contract.');
}
const readiness = {};
const readinessPaths = [];
for (const target of ['react', 'vue']) {
  const packageName = '@oods/components-' + target;
  const readinessPath = fileURLToPath(import.meta.resolve(packageName + '/readiness'));
  readinessPaths.push(readinessPath);
  const document = JSON.parse(readFileSync(readinessPath, 'utf8'));
  const readinessIds = document.rows.map((row) => row.componentId);
  if (JSON.stringify(readinessIds) !== JSON.stringify(expectedIds) || document.rows.some((row) => row.emissionEligible !== true)) {
    throw new Error(target + ' readiness root is incomplete.');
  }
  readiness[target] = document.rows.length;
}
const resolved = [
  '@oods/tokens',
  '@oods/component-contracts',
  '@oods/component-styles',
  '@oods/components-react',
  '@oods/components-vue',
].map((specifier) => fileURLToPath(import.meta.resolve(specifier)));
for (const target of [...resolved, cssPath, ...readinessPaths]) {
  // Check the installed boundary, not an ancestor folder's name: charter Rule 5b keeps even isolated consumers
  // inside OODS-Forge/. Resolve symlinks before checking so a package file cannot escape its own node_modules.
  if (!realpathSync(target).startsWith(consumerModules)) throw new Error('Resolved outside isolated consumer: ' + target);
  if (realpathSync(target).startsWith(repositorySource)) throw new Error('Resolved repository source: ' + target);
}
process.stdout.write(JSON.stringify({
  rootNamespaces: Object.fromEntries(Object.entries(roots).map(([name, value]) => [name, Object.keys(value).length])),
  canonicalIds: expectedIds,
  readiness,
  cssBytes: Buffer.byteLength(css),
  resolvedInsideConsumer: resolved.length,
  auxiliaryResolvedInsideConsumer: 1 + readinessPaths.length,
}));
`.trimStart();
    await fsp.writeFile(path.join(consumerRoot, 'verify.mjs'), verificationSource);
    const verifyResult = commandResult('node', ['verify.mjs'], consumerRoot, {
      environment: isolatedNpmEnvironment(consumerRoot, emptyNpmConfig),
      scrubNpmCredentials: true,
    });
    await writeCommandLog(path.join(outputRoot, 'verify.log'), verifyResult, replacements);
    requireGreen(verifyResult, 'isolated package root import');
    const proof = JSON.parse(verifyResult.stdout);
    const report = {
      schemaVersion: '1.0.0',
      mission: 's182-m04',
      carrier: 'B-12',
      status: 'passed',
      selected: 1,
      passed: 1,
      failed: 0,
      skipped: 0,
      isolation: {
        outsidePnpmWorkspace: true,
        freshNodeModules: true,
        emptyVerifierOwnedNpmConfiguration: true,
        installScripts: false,
        workspaceSymlinks: false,
        repositorySourceImports: false,
      },
      tarballs: tarballs.map(publicTarballRecord),
      proof,
    };
    await writeJson(path.join(outputRoot, 'report.json'), report);
    return report;
  } catch (error) {
    const reason = error instanceof Error ? redact(error.message, replacements) : String(error);
    await writeJson(path.join(outputRoot, 'report.json'), {
      schemaVersion: '1.0.0',
      mission: 's182-m04',
      carrier: 'B-12',
      status: 'failed',
      selected: 1,
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

function extractBareImports(source) {
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

function loadSourceCompilers() {
  const rootRequire = createRequire(path.join(REPOSITORY_ROOT, 'package.json'));
  const vueRequire = createRequire(path.join(REPOSITORY_ROOT, 'packages/components-vue/package.json'));
  return {
    typescript: rootRequire('typescript'),
    vueCompiler: vueRequire('@vue/compiler-sfc'),
  };
}

function resolveGeneratedImports(sourceImports, framework) {
  const anchors = [
    path.join(REPOSITORY_ROOT, 'packages/mcp-server/package.json'),
    path.join(REPOSITORY_ROOT, `packages/components-${framework}/package.json`),
    path.join(REPOSITORY_ROOT, 'package.json'),
  ];
  return sourceImports.map((specifier) => {
    const attempts = [];
    for (const anchor of anchors) {
      try {
        const resolved = createRequire(anchor).resolve(specifier);
        return { specifier, status: 'resolved', resolvedPackageArtifact: toPosix(path.relative(REPOSITORY_ROOT, resolved)) };
      } catch (error) {
        attempts.push(error instanceof Error ? error.code ?? error.name : 'unknown');
      }
    }
    throw new Error(`${framework}: generated import does not resolve: ${specifier} (${attempts.join(', ')})`);
  });
}

function semanticCompileReact(ts, code, typescript) {
  const compileRoot = fs.mkdtempSync(path.join(REPOSITORY_ROOT, 'packages/mcp-server/.s182-react-matrix-'));
  try {
    const fileName = path.join(compileRoot, typescript ? 'GeneratedUI.tsx' : 'GeneratedUI.jsx');
    fs.writeFileSync(fileName, code);
    const options = {
      allowJs: !typescript,
      checkJs: !typescript,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noImplicitAny: typescript,
      noEmit: true,
      skipLibCheck: true,
      strict: true,
      target: ts.ScriptTarget.ES2022,
    };
    const program = ts.createProgram([fileName], options);
    return ts.getPreEmitDiagnostics(program)
      .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
  } finally {
    fs.rmSync(compileRoot, { recursive: true, force: true });
  }
}

function semanticCompileVue(code, typescript) {
  const packageRoot = path.join(REPOSITORY_ROOT, 'packages/mcp-server');
  const vueToolRoot = path.join(REPOSITORY_ROOT, 'packages/components-vue');
  const compileRoot = fs.mkdtempSync(path.join(packageRoot, '.s182-vue-matrix-'));
  try {
    const sourcePath = path.join(compileRoot, 'GeneratedUI.vue');
    const configPath = path.join(compileRoot, 'tsconfig.json');
    const localNodeModules = path.join(compileRoot, 'node_modules');
    fs.mkdirSync(localNodeModules);
    fs.symlinkSync(
      path.dirname(createRequire(path.join(vueToolRoot, 'package.json')).resolve('vue/package.json')),
      path.join(localNodeModules, 'vue'),
      'junction',
    );
    fs.writeFileSync(sourcePath, code);
    fs.writeFileSync(configPath, canonicalJson({
      compilerOptions: {
        allowJs: !typescript,
        allowSyntheticDefaultImports: true,
        checkJs: !typescript,
        isolatedModules: true,
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        moduleResolution: 'Bundler',
        noEmit: true,
        noImplicitAny: typescript,
        skipLibCheck: false,
        strict: true,
        target: 'ES2022',
      },
      include: ['./GeneratedUI.vue'],
    }));
    const vueTscEntrypoint = createRequire(path.join(vueToolRoot, 'package.json'))
      .resolve('vue-tsc/bin/vue-tsc.js');
    const result = commandResult(
      process.execPath,
      [vueTscEntrypoint, '--noEmit', '--pretty', 'false', '-p', configPath],
      packageRoot,
      { timeout: 120_000 },
    );
    if (result.exitCode === 0) return [];
    const output = `${result.stdout}\n${result.stderr}`
      .split(compileRoot).join('<matrix-root>')
      .split(REPOSITORY_ROOT).join('<repository-root>')
      .trim();
    return [output || result.error || `vue-tsc exited ${result.exitCode}`];
  } finally {
    fs.rmSync(compileRoot, { recursive: true, force: true });
  }
}

export function verifyGeneratedSource({ framework, styling, typescript, code, imports }) {
  const targetPackage = `@oods/components-${framework}`;
  const sourceImports = extractBareImports(code);
  const declaredImports = [...imports].sort(compareCodePoint);
  if (!sourceImports.includes(targetPackage) || code.includes("from '@oods/components'")) {
    throw new Error(`${framework}/${styling}/${typescript}: generated source does not use ${targetPackage}.`);
  }
  if (!sourceImports.includes('@oods/component-styles/css')) {
    throw new Error(`${framework}/${styling}/${typescript}: generated source omits shared CSS.`);
  }
  for (const required of [targetPackage, '@oods/component-styles/css']) {
    if (!declaredImports.includes(required)) {
      throw new Error(`${framework}/${styling}/${typescript}: imports metadata omits ${required}.`);
    }
  }
  if (canonicalJson(sourceImports) !== canonicalJson(declaredImports)) {
    throw new Error(
      `${framework}/${styling}/${typescript}: imports metadata differs from emitted bare imports: `
      + `${JSON.stringify({ declaredImports, sourceImports })}.`,
    );
  }
  const allowedImports = new Set([
    '@oods/component-styles/css',
    targetPackage,
    'class-variance-authority',
    'react',
    'vue',
  ]);
  const unexpected = sourceImports.filter((specifier) => !allowedImports.has(specifier));
  if (unexpected.length > 0) {
    throw new Error(`${framework}/${styling}/${typescript}: undeclared generated imports: ${unexpected.join(', ')}.`);
  }
  const hasCvaImport = sourceImports.includes('class-variance-authority');
  if (hasCvaImport !== (styling === 'tailwind')) {
    throw new Error(`${framework}/${styling}/${typescript}: CVA import does not match the Tailwind matrix dimension.`);
  }
  if (styling === 'tailwind' && (!code.includes('const buttonVariants = cva(') || !code.includes('buttonVariants('))) {
    throw new Error(`${framework}/${styling}/${typescript}: the two-intent Button fixture did not activate CVA.`);
  }

  const { typescript: ts, vueCompiler } = loadSourceCompilers();
  const compilerDiagnostics = [];
  let compiler;
  if (framework === 'react') {
    compiler = 'typescript.createProgram semantic no-emit';
    compilerDiagnostics.push(...semanticCompileReact(ts, code, typescript));
  } else {
    compiler = '@vue/compiler-sfc parse+compileScript+compileTemplate + vue-tsc semantic no-emit';
    const parsed = vueCompiler.parse(code, { filename: 'GeneratedUI.vue' });
    for (const error of parsed.errors) compilerDiagnostics.push(String(error));
    if (parsed.errors.length === 0) {
      try {
        const script = vueCompiler.compileScript(parsed.descriptor, {
          id: 's182-m04-matrix',
          inlineTemplate: false,
        });
        if (parsed.descriptor.template) {
          const template = vueCompiler.compileTemplate({
            id: 's182-m04-matrix',
            filename: 'GeneratedUI.vue',
            source: parsed.descriptor.template.content,
            compilerOptions: { bindingMetadata: script.bindings },
          });
          for (const error of template.errors) compilerDiagnostics.push(String(error));
        }
      } catch (error) {
        compilerDiagnostics.push(error instanceof Error ? error.message : String(error));
      }
    }
    if (compilerDiagnostics.length === 0) {
      compilerDiagnostics.push(...semanticCompileVue(code, typescript));
    }
  }
  if (compilerDiagnostics.length > 0) {
    throw new Error(`${framework}/${styling}/${typescript}: source compile failed: ${compilerDiagnostics.join(' | ')}`);
  }

  const dependencyResolution = resolveGeneratedImports(sourceImports, framework);

  for (const id of FOUNDATION_V1_IDS) {
    if (!code.includes(id)) throw new Error(`${framework}/${styling}/${typescript}: emitted source omits ${id}.`);
  }
  for (const marker of SHOWCASE_REQUIRED_MARKERS) {
    if (!code.includes(marker)) {
      throw new Error(`${framework}/${styling}/${typescript}: emitted source omits showcase marker ${marker}.`);
    }
  }
  for (const [event, handler] of SHOWCASE_EVENT_HANDLERS) {
    const binding = framework === 'react'
      ? `on${event}={${handler}}`
      : `@${event[0].toLowerCase()}${event.slice(1)}="${handler}"`;
    if (!code.includes(binding)) {
      throw new Error(`${framework}/${styling}/${typescript}: emitted source omits event binding ${binding}.`);
    }
  }

  return {
    framework,
    styling,
    typescript,
    status: 'passed',
    fileExtension: framework === 'react' ? (typescript ? '.tsx' : '.jsx') : '.vue',
    imports: declaredImports,
    sourceImports,
    sourceBytes: Buffer.byteLength(code),
    sourceSha256: sha256(code),
    compiler,
    compilerErrors: 0,
    dependencyResolution,
    dependencyResolutionErrors: 0,
    canonicalComponents: FOUNDATION_V1_IDS.length,
    requiredShowcaseMarkers: SHOWCASE_REQUIRED_MARKERS.length,
    requiredEventBindings: SHOWCASE_EVENT_HANDLERS.length,
    tailwindCva: styling === 'tailwind' ? 'activated' : 'not-applicable',
  };
}

const SHOWCASE_CSS = `
:root { font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: var(--sys-surface-canvas); }
* { box-sizing: border-box; }
body { margin: 0; min-width: 20rem; background: var(--sys-surface-canvas); color: var(--sys-text-primary); }
#foundation-v1-showcase {
  width: min(76rem, calc(100% - 2rem)); margin: 0 auto; padding: clamp(1rem, 3vw, 3rem);
  background: linear-gradient(145deg, var(--sys-surface-panel), var(--sys-surface-canvas));
}
#foundation-v1-showcase > * { min-width: 0; max-width: 100%; }
#showcase-title { max-width: 24ch; letter-spacing: -0.025em; }
#showcase-profile, #showcase-banner, #showcase-grid, [data-oods-component='Table'], [data-oods-component='Tabs'] {
  width: 100%;
}
#showcase-profile { padding: var(--ref-space-scale-lg); }
#showcase-grid { padding: var(--ref-space-scale-md); border: 1px solid var(--sys-border-subtle); }
.oods-table__container { width: 100%; max-width: 100%; min-width: 0; overflow-x: auto; }
.oods-table { min-width: 0; table-layout: auto; }
.oods-field { max-width: 42rem; }
button, input, select, textarea { font: inherit; }
@media (max-width: 42rem) {
  #foundation-v1-showcase { width: 100%; padding: 1rem; }
  #showcase-title { font-size: 1.65rem; }
}
`.trimStart();

function localTarballDependencies(framework, tarballs) {
  const required = [
    '@oods/tokens',
    '@oods/component-contracts',
    '@oods/component-styles',
    `@oods/components-${framework}`,
  ];
  return Object.fromEntries(required.map((name) => [name, `file:${findTarball(tarballs, name).tarballPath}`]));
}

function consumerManifest(framework, tarballs, source) {
  const local = localTarballDependencies(framework, tarballs);
  const generatedDependencies = extractBareImports(source).includes('class-variance-authority')
    ? { 'class-variance-authority': PUBLIC_EXTERNAL_VERSIONS['class-variance-authority'] }
    : {};
  if (framework === 'react') {
    return {
      name: 'oods-s182-react-generated-consumer',
      private: true,
      type: 'module',
      dependencies: {
        ...local,
        ...generatedDependencies,
        '@radix-ui/react-slot': PUBLIC_EXTERNAL_VERSIONS['@radix-ui/react-slot'],
        react: PUBLIC_EXTERNAL_VERSIONS.react,
        'react-dom': PUBLIC_EXTERNAL_VERSIONS['react-dom'],
      },
      devDependencies: {
        '@types/node': PUBLIC_EXTERNAL_VERSIONS['@types/node'],
        '@types/react': PUBLIC_EXTERNAL_VERSIONS['@types/react'],
        '@types/react-dom': PUBLIC_EXTERNAL_VERSIONS['@types/react-dom'],
        typescript: PUBLIC_EXTERNAL_VERSIONS.typescript,
        vite: PUBLIC_EXTERNAL_VERSIONS.vite,
      },
    };
  }
  return {
    name: 'oods-s182-vue-generated-consumer',
    private: true,
    type: 'module',
    dependencies: {
      ...local,
      ...generatedDependencies,
      '@vue/server-renderer': PUBLIC_EXTERNAL_VERSIONS['@vue/server-renderer'],
      vue: PUBLIC_EXTERNAL_VERSIONS.vue,
    },
    devDependencies: {
      '@types/node': PUBLIC_EXTERNAL_VERSIONS['@types/node'],
      '@vitejs/plugin-vue': PUBLIC_EXTERNAL_VERSIONS['@vitejs/plugin-vue'],
      '@vue/compiler-sfc': PUBLIC_EXTERNAL_VERSIONS['@vue/compiler-sfc'],
      typescript: PUBLIC_EXTERNAL_VERSIONS.typescript,
      vite: PUBLIC_EXTERNAL_VERSIONS.vite,
      'vue-tsc': PUBLIC_EXTERNAL_VERSIONS['vue-tsc'],
    },
  };
}

function normalizedConsumerManifest(framework, tarballs, source) {
  const manifest = consumerManifest(framework, tarballs, source);
  for (const [name, value] of Object.entries(manifest.dependencies)) {
    if (value.startsWith('file:')) {
      manifest.dependencies[name] = `file:<submitted-tarballs>/${path.basename(value.slice('file:'.length))}`;
    }
  }
  return manifest;
}

function reactConsumerFiles(source) {
  return {
    'src/GeneratedUI.tsx': source,
    'src/main.tsx': `
import '@oods/component-styles/css';
import './showcase.css';
import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { GeneratedUI } from './GeneratedUI.js';

document.documentElement.dataset.brand = 'A';
document.documentElement.dataset.theme = 'light';
const root = document.getElementById('app');
if (!root) throw new Error('Missing #app hydration root.');
function HydrationProbe() {
  React.useEffect(() => { window.__OODS_HYDRATED__ = true; }, []);
  const primaryAction = () => { window.__OODS_DOMAIN_ACTIONS__.primary += 1; };
  const secondaryAction = () => { window.__OODS_DOMAIN_ACTIONS__.secondary += 1; };
  const rowAction = (rowId: string) => {
    window.__OODS_DOMAIN_ACTIONS__.rowIds.push(rowId);
  };
  return <GeneratedUI actions={{
    handleActivate: primaryAction,
    handleSecondaryActivate: secondaryAction,
    handleRowActivate: rowAction,
  }} />;
}
window.__OODS_DOMAIN_ACTIONS__ = { primary: 0, secondary: 0, rowIds: [] };
hydrateRoot(root, <HydrationProbe />);
`.trimStart(),
    'src/ssr.tsx': `
import React from 'react';
import { renderToString } from 'react-dom/server';
import { GeneratedUI } from './GeneratedUI.js';

const html = renderToString(<GeneratedUI actions={{
  handleActivate: () => undefined,
  handleSecondaryActivate: () => undefined,
  handleRowActivate: () => undefined,
}} />);
process.stdout.write(JSON.stringify({ html }));
`.trimStart(),
    'src/showcase.css': SHOWCASE_CSS,
    'src/window.d.ts': `interface Window {\n  __OODS_HYDRATED__?: boolean;\n  __OODS_DOMAIN_ACTIONS__: { primary: number; secondary: number; rowIds: string[] };\n}\n`,
    'index.html': `<!doctype html><html data-brand="A" data-theme="light"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>React foundation-v1 showcase</title></head><body><div id="app"><!--SSR_MARKUP--></div><script type="module" src="/src/main.tsx"></script></body></html>\n`,
    'tsconfig.json': canonicalJson({
      compilerOptions: {
        strict: true,
        target: 'ES2022',
        useDefineForClassFields: true,
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        allowJs: false,
        skipLibCheck: false,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        module: 'ESNext',
        moduleResolution: 'Bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
      },
      include: ['src'],
    }),
    'vite.config.mjs': `
import { defineConfig } from 'vite';
export default defineConfig({ css: { postcss: { plugins: [] } }, build: { minify: false, sourcemap: true } });
`.trimStart(),
  };
}

function vueConsumerFiles(source) {
  return {
    'src/GeneratedUI.vue': source,
    'src/main.ts': `
import '@oods/component-styles/css';
import './showcase.css';
import { createSSRApp } from 'vue';
import GeneratedUI from './GeneratedUI.vue';

document.documentElement.dataset.brand = 'A';
document.documentElement.dataset.theme = 'light';
window.__OODS_DOMAIN_ACTIONS__ = { primary: 0, secondary: 0, rowIds: [] };
const primaryAction = () => { window.__OODS_DOMAIN_ACTIONS__.primary += 1; };
const secondaryAction = () => { window.__OODS_DOMAIN_ACTIONS__.secondary += 1; };
const rowAction = (rowId: string) => { window.__OODS_DOMAIN_ACTIONS__.rowIds.push(rowId); };
createSSRApp(GeneratedUI, { actions: {
  handleActivate: primaryAction,
  handleSecondaryActivate: secondaryAction,
  handleRowActivate: rowAction,
} }).mount('#app');
queueMicrotask(() => { window.__OODS_HYDRATED__ = true; });
`.trimStart(),
    'src/ssr.ts': `
import { renderToString } from '@vue/server-renderer';
import { createSSRApp } from 'vue';
import GeneratedUI from './GeneratedUI.vue';

async function main() {
  const html = await renderToString(createSSRApp(GeneratedUI, { actions: {
    handleActivate: () => undefined,
    handleSecondaryActivate: () => undefined,
    handleRowActivate: () => undefined,
  } }));
  process.stdout.write(JSON.stringify({ html }));
}
void main();
`.trimStart(),
    'src/showcase.css': SHOWCASE_CSS,
    'src/window.d.ts': `interface Window {\n  __OODS_HYDRATED__?: boolean;\n  __OODS_DOMAIN_ACTIONS__: { primary: number; secondary: number; rowIds: string[] };\n}\ndeclare module '*.vue';\n`,
    'index.html': `<!doctype html><html data-brand="A" data-theme="light"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vue foundation-v1 showcase</title></head><body><div id="app"><!--SSR_MARKUP--></div><script type="module" src="/src/main.ts"></script></body></html>\n`,
    'tsconfig.json': canonicalJson({
      compilerOptions: {
        strict: true,
        target: 'ES2022',
        useDefineForClassFields: true,
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        skipLibCheck: false,
        allowSyntheticDefaultImports: true,
        module: 'ESNext',
        moduleResolution: 'Bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        types: ['node', 'vite/client'],
      },
      include: ['src/**/*.ts', 'src/**/*.vue'],
    }),
    'vite.config.mjs': `
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig({ plugins: [vue()], css: { postcss: { plugins: [] } }, build: { minify: false, sourcemap: true } });
`.trimStart(),
  };
}

async function writeConsumerFiles(consumerRoot, files) {
  for (const [relativePath, contents] of Object.entries(files)) {
    const destination = path.join(consumerRoot, relativePath);
    await fsp.mkdir(path.dirname(destination), { recursive: true });
    await fsp.writeFile(destination, contents);
  }
}

function assertPackedDependency(framework, tarballs) {
  const target = findTarball(tarballs, `@oods/components-${framework}`);
  const requiredDependencies = ['@oods/component-contracts', '@oods/component-styles'];
  const missing = requiredDependencies.filter((name) => typeof target.manifest.dependencies?.[name] !== 'string');
  if (missing.length > 0) {
    throw new Error(`${target.name} packed manifest omits declared dependencies: ${missing.join(', ')}`);
  }
}

function assertInstalledPackagesAreIsolated(consumerRoot, framework) {
  const names = ['@oods/tokens', '@oods/component-contracts', '@oods/component-styles', `@oods/components-${framework}`];
  const realConsumerRoot = fs.realpathSync(consumerRoot);
  for (const name of names) {
    const directory = path.join(consumerRoot, 'node_modules', ...name.split('/'));
    const stats = fs.lstatSync(directory);
    if (stats.isSymbolicLink()) throw new Error(`Workspace symlink leaked into clean consumer: ${name}`);
    const real = fs.realpathSync(directory);
    if (!real.startsWith(`${realConsumerRoot}${path.sep}`)) {
      throw new Error(`Installed package resolved outside clean consumer: ${name}`);
    }
  }
}

async function directoryDigest(directory) {
  const entries = [];
  async function visit(current, prefix = '') {
    for (const entry of (await fsp.readdir(current, { withFileTypes: true })).sort((a, b) => compareCodePoint(a.name, b.name))) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute, relative);
      else if (entry.isFile()) {
        const bytes = await fsp.readFile(absolute);
        entries.push({ path: relative, bytes: bytes.byteLength, sha256: sha256(bytes) });
      }
    }
  }
  await visit(directory);
  return { files: entries, sha256: sha256(canonicalJson(entries)) };
}

function mimeType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.map')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

async function withStaticServer(directory, callback) {
  const server = http.createServer(async (request, response) => {
    try {
      const rawPath = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
      const relativePath = rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, '');
      const candidate = path.resolve(directory, relativePath);
      if (!candidate.startsWith(`${path.resolve(directory)}${path.sep}`) && candidate !== path.resolve(directory)) {
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
  if (!address || typeof address === 'string') throw new Error('Unable to resolve showcase server address.');
  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

function summarizeCallbackCoverage(rawCoverage, baseUrl, generatedSourceSha256) {
  const scripts = rawCoverage.result.filter((entry) => (
    entry.url.startsWith(baseUrl) && /\/assets\/[^/]+\.js$/.test(new URL(entry.url).pathname)
  ));
  const availableHandlerNames = [...new Set(scripts.flatMap((script) => (
    script.functions
      .map((record) => record.functionName)
      .filter((name) => name.startsWith('handle'))
  )))].sort(compareCodePoint);
  const handlers = SHOWCASE_CALLBACK_HANDLERS.map((name) => {
    const matches = scripts.flatMap((script) => script.functions
      .filter((record) => record.functionName === name)
      .map((record) => ({
        script: new URL(script.url).pathname,
        callCount: record.ranges[0]?.count ?? 0,
      })));
    if (matches.length !== 1) {
      throw new Error(
        `Precise callback coverage expected one ${name} function, received ${matches.length}; `
        + `available handlers: ${availableHandlerNames.join(', ') || '(none)'}.`,
      );
    }
    return { name, ...matches[0] };
  });
  const uncalled = handlers.filter((record) => record.callCount < 1);
  if (uncalled.length > 0) {
    throw new Error(`Generated callbacks were not invoked: ${uncalled.map((record) => record.name).join(', ')}.`);
  }
  return {
    engine: 'Chromium DevTools Protocol Profiler precise coverage',
    window: 'post-hydration interactions only',
    buildConditions: {
      command: 'vite build --config vite.config.mjs',
      mode: 'production',
      minify: false,
      sourcemap: true,
      sourceInstrumentation: 'none',
      generatedSourceSha256,
    },
    selected: handlers.length,
    called: handlers.length - uncalled.length,
    failed: uncalled.length,
    handlers,
  };
}

function assertShowcaseComputedStyles(framework, proof) {
  // s222-m02 (#2502 rulings 8-11): controls at 24/28/32/40 with padding-x 8/10/12/16 and their height from the control
  // size (no block padding); a secondary button is a subtle fill with no border; a solid badge is the tone's solid with its
  // on-solid text and no border; text lg is 18/25.2; table cells take their row height; tabs are 14/20.
  const expected = {
    primaryButton: {
      intent: 'primary',
      size: 'md',
      minBlockSize: '32px',
      fontSize: '14px',
      paddingBlockStart: '0px',
      paddingBlockEnd: '0px',
      paddingInlineStart: '12px',
      paddingInlineEnd: '12px',
      backgroundColor: proof.resolvedTokens.interactivePrimaryBackground,
      color: proof.resolvedTokens.onInteractiveText,
    },
    secondaryButton: {
      intent: 'secondary',
      size: 'sm',
      minBlockSize: '28px',
      fontSize: '14px',
      paddingBlockStart: '0px',
      paddingBlockEnd: '0px',
      paddingInlineStart: '10px',
      paddingInlineEnd: '10px',
      backgroundColor: proof.resolvedTokens.subtleBackground,
      color: proof.resolvedTokens.primaryText,
      borderColor: 'rgba(0, 0, 0, 0)',
    },
    badge: {
      tone: 'critical',
      emphasis: 'solid',
      backgroundColor: proof.resolvedTokens.criticalSolid,
      color: proof.resolvedTokens.criticalOnSolid,
    },
    banner: {
      tone: 'critical',
      emphasis: 'subtle',
      backgroundColor: proof.resolvedTokens.criticalSurfaceBackground,
      color: proof.resolvedTokens.criticalText,
      borderColor: proof.resolvedTokens.criticalBorder,
    },
    titleText: {
      size: 'lg',
      weight: 'semibold',
      fontSize: '18px',
      fontWeight: '600',
      lineHeight: '25.2px',
    },
    bodyText: {
      size: 'md',
      weight: framework === 'react' ? 'regular' : 'normal',
      fontSize: '16px',
      fontWeight: '400',
      lineHeight: '24px',
    },
    table: {
      density: 'compact',
    },
    tableCell: {
      paddingBlockStart: '0px',
      paddingBlockEnd: '0px',
      paddingInlineStart: '8px',
      paddingInlineEnd: '8px',
      fontSize: '14px',
    },
    tabs: {
      size: 'md',
    },
    tab: {
      paddingBlockStart: '10px',
      paddingBlockEnd: '10px',
      paddingInlineStart: '12px',
      paddingInlineEnd: '12px',
      fontSize: '14px',
    },
  };
  const findings = [];
  for (const [surface, properties] of Object.entries(expected)) {
    for (const [property, value] of Object.entries(properties)) {
      if (proof[surface][property] !== value) {
        findings.push({ surface, property, expected: value, received: proof[surface][property] });
      }
    }
  }
  if (proof.primaryButton.backgroundColor === proof.secondaryButton.backgroundColor) {
    findings.push({
      surface: 'buttons',
      property: 'backgroundColor',
      expected: 'distinct primary and secondary surfaces',
      received: proof.primaryButton.backgroundColor,
    });
  }
  if (findings.length > 0) {
    throw new Error(`${framework} computed prop styles differ: ${JSON.stringify(findings)}`);
  }
}

function assertFieldChrome(framework, proof) {
  const transparent = 'rgba(0, 0, 0, 0)';
  const findings = [];
  const zeroBox = {
    borderTopWidth: '0px',
    borderRightWidth: '0px',
    borderBottomWidth: '0px',
    borderLeftWidth: '0px',
    paddingBlockStart: '0px',
    paddingBlockEnd: '0px',
    paddingInlineStart: '0px',
    paddingInlineEnd: '0px',
    backgroundColor: transparent,
  };
  for (const wrapper of proof.wrappers) {
    for (const [property, expected] of Object.entries(zeroBox)) {
      if (wrapper[property] !== expected) {
        findings.push({ carrier: wrapper.carrier, property, expected, received: wrapper[property] });
      }
    }
  }
  const expectedControlIds = ['email', 'notes', 'plan', 'renewal'];
  if (proof.controls.map((control) => control.id).sort(compareCodePoint).join(',') !== expectedControlIds.join(',')) {
    findings.push({
      carrier: 'native-controls',
      property: 'ids',
      expected: expectedControlIds,
      received: proof.controls.map((control) => control.id).sort(compareCodePoint),
    });
  }
  for (const control of proof.controls) {
    for (const property of ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth']) {
      if (control[property] !== '1px') {
        findings.push({ carrier: control.id, property, expected: '1px', received: control[property] });
      }
    }
    if (control.backgroundColor === transparent) {
      findings.push({
        carrier: control.id,
        property: 'backgroundColor',
        expected: 'non-transparent native control surface',
        received: control.backgroundColor,
      });
    }
    // s222-m02 (#2502 ruling 9): a single-line control takes its height from its control size (24/28/32/40) with no block
    // padding; a textarea keeps its block padding. Text is never against an edge either way.
    const multiline = control.tagName === 'textarea';
    if ([control.paddingInlineStart, control.paddingInlineEnd, ...(multiline ? [control.paddingBlockStart, control.paddingBlockEnd] : [])]
      .some((value) => Number.parseFloat(value) <= 0) || (!multiline && !(control.renderedHeight >= 24))) {
      findings.push({
        carrier: control.id,
        property: 'padding',
        expected: 'positive inline padding, and a textarea\'s block padding or a single-line control at least 24px tall',
        received: [
          control.paddingBlockStart,
          control.paddingInlineEnd,
          control.paddingBlockEnd,
          control.paddingInlineStart,
        ],
      });
    }
  }
  if (framework === 'vue' && !proof.wrappers.some((wrapper) => wrapper.carrier === 'renewal:date-picker')) {
    findings.push({
      carrier: 'renewal:date-picker',
      property: 'presence',
      expected: 'Vue DatePicker outer wrapper measured',
      received: 'missing',
    });
  }
  if (findings.length > 0) {
    throw new Error(`${framework} field wrapper/control chrome differs: ${JSON.stringify(findings)}`);
  }
}

function assertShowcaseStructure(framework, proof) {
  const findings = [];
  if (proof.checkboxRequired.visibleLabelText !== 'Product updates*') {
    findings.push({
      surface: 'checkbox',
      property: 'visibleLabelText',
      expected: 'Product updates*',
      received: proof.checkboxRequired.visibleLabelText,
    });
  }
  if (proof.checkboxRequired.markerCount !== 1
    || proof.checkboxRequired.markerText !== '*'
    || proof.checkboxRequired.markerAriaHidden !== 'true') {
    findings.push({
      surface: 'checkbox',
      property: 'requiredMarker',
      expected: { markerCount: 1, markerText: '*', markerAriaHidden: 'true' },
      received: proof.checkboxRequired,
    });
  }
  // s222-m02 (#2502 ruling 11): a banner's title is semibold, on the type scale's label weight.
  if (proof.bannerTitle.text !== 'Payment failed' || proof.bannerTitle.fontWeight !== '600') {
    findings.push({
      surface: 'bannerTitle',
      property: 'text/fontWeight',
      expected: { text: 'Payment failed', fontWeight: '600' },
      received: proof.bannerTitle,
    });
  }
  const expectedHeaders = ['Name', 'Plan', 'Status'];
  if (canonicalJson(proof.table.headers) !== canonicalJson(expectedHeaders)) {
    findings.push({
      surface: 'table',
      property: 'headers',
      expected: expectedHeaders,
      received: proof.table.headers,
    });
  }
  const expectedRows = [
    { cells: ['Northwind', 'Enterprise', 'Active'], actionCellIndex: 0, actionText: 'Northwind', ariaLabel: null },
    { cells: ['Contoso', 'Pro', 'Past due'], actionCellIndex: 0, actionText: 'Contoso', ariaLabel: null },
  ];
  if (canonicalJson(proof.table.rows) !== canonicalJson(expectedRows)) {
    findings.push({
      surface: 'table',
      property: 'rows/actions',
      expected: expectedRows,
      received: proof.table.rows,
    });
  }
  if (proof.table.headers.includes('Actions') || proof.table.rows.some((row) => row.cells.length !== 3)) {
    findings.push({
      surface: 'table',
      property: 'declared-column parity',
      expected: 'no Actions column and exactly three cells per row',
      received: proof.table,
    });
  }
  if (findings.length > 0) {
    throw new Error(`${framework} showcase structure differs: ${JSON.stringify(findings)}`);
  }
}

function assertTableViewportGeometry(framework, viewport, cells) {
  const findings = [];
  if (cells.length !== 9) {
    findings.push({ expectedCells: 9, receivedCells: cells.length });
  }
  for (const cell of cells) {
    if (cell.textRuns.length !== 1 || cell.textRuns[0]?.lineCount !== 1) {
      findings.push({
        cell: cell.carrier,
        property: 'text lines',
        expected: 'one visible unwrapped text run on one line',
        received: cell.textRuns,
      });
    }
    if (cell.scrollWidth > cell.clientWidth + 1 || cell.scrollHeight > cell.clientHeight + 1) {
      findings.push({
        cell: cell.carrier,
        property: 'scroll geometry',
        expected: `scroll size within client size (${cell.clientWidth}×${cell.clientHeight})`,
        received: `${cell.scrollWidth}×${cell.scrollHeight}`,
      });
    }
    if (cell.textRuns.some((run) => run.outsideContentBox)) {
      findings.push({
        cell: cell.carrier,
        property: 'content bounds',
        expected: 'text fully inside the padded cell content box',
        received: cell.textRuns,
      });
    }
  }
  if (findings.length > 0) {
    throw new Error(`${framework} ${viewport} table clips or wraps content: ${JSON.stringify(findings)}`);
  }
}

async function browserProof({ framework, distRoot, screenshotRoot, generatedSourceSha256 }) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    return await withStaticServer(distRoot, async (url) => {
      const runtimeErrors = [];
      const interactionPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      interactionPage.on('pageerror', (error) => runtimeErrors.push(error.message));
      interactionPage.on('console', (message) => {
        if (message.type() === 'error') runtimeErrors.push(message.text());
      });
      await interactionPage.goto(url, { waitUntil: 'networkidle' });
      await interactionPage.waitForFunction(() => window.__OODS_HYDRATED__ === true);
      const initialHydration = await interactionPage.evaluate(() => {
        const selectedTab = document.querySelector('[role="tab"][aria-selected="true"]');
        return {
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          activeElementTag: document.activeElement?.tagName ?? null,
          activeElementId: document.activeElement instanceof HTMLElement
            ? document.activeElement.id || null
            : null,
          selectedTabId: selectedTab instanceof HTMLElement ? selectedTab.dataset.tabId ?? null : null,
          selectedTabFocused: selectedTab !== null && document.activeElement === selectedTab,
        };
      });
      if (initialHydration.scrollX !== 0
        || initialHydration.scrollY !== 0
        || initialHydration.selectedTabId !== 'overview'
        || initialHydration.selectedTabFocused) {
        throw new Error(`${framework} hydration moved initial focus or scroll: ${JSON.stringify(initialHydration)}`);
      }
      const componentCounts = await interactionPage.evaluate((ids) => Object.fromEntries(
        ids.map((id) => [id, document.querySelectorAll(`[data-oods-component="${id}"]`).length]),
      ), FOUNDATION_V1_IDS);
      const missing = Object.entries(componentCounts).filter(([, count]) => count === 0).map(([id]) => id);
      if (missing.length > 0) throw new Error(`${framework} hydrated showcase omits: ${missing.join(', ')}`);

      const computedStyles = await interactionPage.evaluate(() => {
        const elementStyle = (selector) => {
          const element = document.querySelector(selector);
          if (!(element instanceof HTMLElement)) throw new Error(`Missing computed-style carrier ${selector}.`);
          const style = getComputedStyle(element);
          return {
            intent: element.dataset.intent ?? null,
            size: element.dataset.size ?? null,
            weight: element.dataset.weight ?? null,
            tone: element.dataset.tone ?? null,
            emphasis: element.dataset.emphasis ?? null,
            density: element.dataset.density ?? null,
            minBlockSize: style.minBlockSize,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            lineHeight: style.lineHeight,
            paddingBlockStart: style.paddingBlockStart,
            paddingBlockEnd: style.paddingBlockEnd,
            paddingInlineStart: style.paddingInlineStart,
            paddingInlineEnd: style.paddingInlineEnd,
            backgroundColor: style.backgroundColor,
            color: style.color,
            borderColor: style.borderColor,
          };
        };
        const boxStyle = (element, carrier) => {
          if (!(element instanceof HTMLElement)) throw new Error(`Missing box-style carrier ${carrier}.`);
          const style = getComputedStyle(element);
          return {
            carrier,
            tagName: element.tagName.toLowerCase(),
            borderTopWidth: style.borderTopWidth,
            borderRightWidth: style.borderRightWidth,
            borderBottomWidth: style.borderBottomWidth,
            borderLeftWidth: style.borderLeftWidth,
            paddingBlockStart: style.paddingBlockStart,
            paddingBlockEnd: style.paddingBlockEnd,
            paddingInlineStart: style.paddingInlineStart,
            paddingInlineEnd: style.paddingInlineEnd,
            backgroundColor: style.backgroundColor,
          };
        };
        const controls = ['email', 'renewal', 'plan', 'notes'].map((id) => {
          const control = document.getElementById(id);
          return { id, ...boxStyle(control, `${id}:native-control`), renderedHeight: Math.round(control.getBoundingClientRect().height) };
        });
        const wrappers = [];
        const measuredWrappers = new Set();
        const addWrapper = (carrier, element) => {
          if (!(element instanceof HTMLElement) || measuredWrappers.has(element)) return;
          measuredWrappers.add(element);
          wrappers.push(boxStyle(element, carrier));
        };
        for (const id of ['email', 'renewal', 'plan', 'notes', 'marketing']) {
          const control = document.getElementById(id);
          if (!(control instanceof HTMLElement)) throw new Error(`Missing field control #${id}.`);
          addWrapper(`${id}:field`, control.closest('.oods-field'));
          addWrapper(`${id}:control-wrapper`, control.closest('.form-field__control'));
          addWrapper(`${id}:date-picker`, control.closest('.oods-date-picker'));
          if (id === 'marketing') addWrapper(`${id}:checkbox-wrapper`, control.closest('.oods-checkbox'));
        }
        const checkbox = document.getElementById('marketing');
        if (!(checkbox instanceof HTMLInputElement)) throw new Error('Missing Checkbox #marketing.');
        const checkboxLabel = checkbox.closest('label')
          ?? document.querySelector(`label[for="${CSS.escape(checkbox.id)}"]`);
        if (!(checkboxLabel instanceof HTMLLabelElement)) throw new Error('Missing visible Checkbox label.');
        const requiredMarkers = [...checkboxLabel.querySelectorAll('.oods-field-required')];
        const bannerTitle = document.querySelector(
          '#showcase-banner .oods-banner__title, #showcase-banner .oods-banner-title',
        );
        if (!(bannerTitle instanceof HTMLElement)) throw new Error('Missing Banner title carrier.');
        const table = document.querySelector('#showcase-subscriptions');
        if (!(table instanceof HTMLTableElement)) throw new Error('Missing subscriptions Table.');
        const normalizeText = (value) => value.replace(/\s+/g, ' ').trim();
        const tableRows = [...table.querySelectorAll('tbody tr')].map((row) => {
          const cells = [...row.querySelectorAll(':scope > td')];
          const action = row.querySelector('.oods-table-row-action');
          return {
            cells: cells.map((cell) => normalizeText(cell.textContent ?? '')),
            actionCellIndex: action ? cells.findIndex((cell) => cell.contains(action)) : -1,
            actionText: action ? normalizeText(action.textContent ?? '') : null,
            ariaLabel: action?.getAttribute('aria-label') ?? null,
          };
        });
        const resolveColor = (property, value) => {
          const probe = document.createElement('span');
          probe.style.setProperty(property, value);
          document.body.append(probe);
          const resolved = getComputedStyle(probe).getPropertyValue(property).trim();
          probe.remove();
          return resolved;
        };
        return {
          theme: {
            brand: document.documentElement.dataset.brand ?? null,
            theme: document.documentElement.dataset.theme ?? null,
          },
          resolvedTokens: {
            interactivePrimaryBackground: resolveColor('background-color', 'var(--sys-surface-interactive-primary-default)'),
            subtleBackground: resolveColor('background-color', 'var(--sys-surface-subtle)'),
            onInteractiveText: resolveColor('color', 'var(--sys-text-on-interactive)'),
            primaryText: resolveColor('color', 'var(--sys-text-primary)'),
            strongBorder: resolveColor('border-color', 'var(--sys-border-strong)'),
            criticalSurfaceBackground: resolveColor('background-color', 'var(--sys-status-critical-surface)'),
            criticalSurfaceText: resolveColor('color', 'var(--sys-status-critical-surface)'),
            criticalTextBackground: resolveColor('background-color', 'var(--sys-status-critical-text)'),
            criticalText: resolveColor('color', 'var(--sys-status-critical-text)'),
            criticalTextBorder: resolveColor('border-color', 'var(--sys-status-critical-text)'),
            criticalBorder: resolveColor('border-color', 'var(--sys-status-critical-border)'),
            criticalSolid: resolveColor('background-color', 'var(--sys-status-critical-solid)'),
            criticalOnSolid: resolveColor('color', 'var(--sys-status-critical-on-solid)'),
          },
          primaryButton: elementStyle('#showcase-action'),
          secondaryButton: elementStyle('#showcase-secondary-action'),
          badge: elementStyle('#showcase-status'),
          banner: elementStyle('#showcase-banner'),
          bannerTitle: {
            text: normalizeText(bannerTitle.textContent ?? ''),
            fontWeight: getComputedStyle(bannerTitle).fontWeight,
          },
          titleText: elementStyle('#showcase-title'),
          bodyText: elementStyle('#showcase-profile-copy'),
          table: elementStyle('#showcase-subscriptions'),
          tableCell: elementStyle('#showcase-subscriptions th'),
          tabs: elementStyle('#showcase-tabs'),
          tab: elementStyle('#showcase-tabs [role="tab"]'),
          fieldChrome: { wrappers, controls },
          checkboxRequired: {
            visibleLabelText: normalizeText(checkboxLabel.innerText).replace(/\s+\*$/, '*'),
            markerCount: requiredMarkers.length,
            markerText: requiredMarkers.length === 1
              ? normalizeText(requiredMarkers[0].textContent ?? '')
              : null,
            markerAriaHidden: requiredMarkers.length === 1
              ? requiredMarkers[0].getAttribute('aria-hidden')
              : null,
          },
          tableStructure: {
            headers: [...table.querySelectorAll('thead th')]
              .map((header) => normalizeText(header.textContent ?? '')),
            rows: tableRows,
          },
        };
      });
      if (computedStyles.theme.brand !== 'A' || computedStyles.theme.theme !== 'light') {
        throw new Error(`${framework} computed-style proof requires Brand A light: ${JSON.stringify(computedStyles.theme)}`);
      }
      assertShowcaseComputedStyles(framework, computedStyles);
      assertFieldChrome(framework, computedStyles.fieldChrome);
      assertShowcaseStructure(framework, {
        checkboxRequired: computedStyles.checkboxRequired,
        bannerTitle: computedStyles.bannerTitle,
        table: computedStyles.tableStructure,
      });
      for (const name of ['Northwind', 'Contoso']) {
        const accessibleRowAction = interactionPage.getByRole('button', { name, exact: true });
        if (await accessibleRowAction.count() !== 1) {
          throw new Error(`${framework} Table row action does not have exact accessible name ${name}.`);
        }
      }

      const coverageSession = await interactionPage.context().newCDPSession(interactionPage);
      await coverageSession.send('Profiler.enable');
      await coverageSession.send('Profiler.startPreciseCoverage', {
        callCount: true,
        detailed: true,
        allowTriggeredUpdates: false,
      });

      await interactionPage.evaluate(() => {
        window.__OODS_INTERACTIONS__ = { button: 0, secondaryButton: 0, tableRow: 0, bannerDismiss: 0 };
        document.addEventListener('click', (event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (!target) return;
          if (target.closest('#showcase-action')) window.__OODS_INTERACTIONS__.button += 1;
          if (target.closest('#showcase-secondary-action')) window.__OODS_INTERACTIONS__.secondaryButton += 1;
          if (target.closest('.oods-table-row-action')) window.__OODS_INTERACTIONS__.tableRow += 1;
          if (target.closest('#showcase-banner')) window.__OODS_INTERACTIONS__.bannerDismiss += 1;
        }, { capture: true });
      });

      const button = interactionPage.getByRole('button', { name: 'Save changes' });
      await button.click();
      const secondaryButton = interactionPage.getByRole('button', { name: 'Cancel' });
      await secondaryButton.click();
      const email = interactionPage.getByLabel('Email');
      const emailValidBeforeInput = await email.evaluate((element) => element.checkValidity());
      await email.fill('user@example.com');
      const emailValidAfterInput = await email.evaluate((element) => element.checkValidity());
      const plan = interactionPage.getByLabel('Plan');
      const planInitialValue = await plan.inputValue();
      const planInitialLabel = await plan.locator('option:checked').textContent();
      if (planInitialValue !== 'pro' || planInitialLabel !== 'Pro') {
        throw new Error(
          `${framework} Select did not preserve its initial Pro default: `
          + `${JSON.stringify({ planInitialValue, planInitialLabel })}`,
        );
      }
      await plan.selectOption('basic');
      const planSelectedValue = await plan.inputValue();
      const planSelectedLabel = await plan.locator('option:checked').textContent();
      if (planSelectedValue !== 'basic' || planSelectedLabel !== 'Basic') {
        throw new Error(
          `${framework} Select did not transition from Pro to Basic: `
          + `${JSON.stringify({ planInitialValue, planInitialLabel, planSelectedValue, planSelectedLabel })}`,
        );
      }
      const renewal = interactionPage.getByLabel('Renewal date');
      await renewal.fill('2026-10-15');
      const marketing = interactionPage.getByLabel('Product updates');
      const marketingBefore = await marketing.isChecked();
      await marketing.click();
      const marketingAfter = await marketing.isChecked();
      const notes = interactionPage.getByLabel('Notes');
      await notes.fill('Follow up tomorrow.');
      const billingTab = interactionPage.getByRole('tab', { name: 'Billing' });
      await billingTab.click();
      const selectedTab = await billingTab.getAttribute('aria-selected');
      const securityTabDisabled = await interactionPage.getByRole('tab', { name: 'Security' }).isDisabled();
      const rowAction = interactionPage.locator('.oods-table-row-action').first();
      await rowAction.click();
      const dismiss = interactionPage.getByRole('button', { name: 'Dismiss payment warning' });
      await dismiss.click();
      const banner = interactionPage.locator('#showcase-banner');
      await banner.waitFor({ state: 'detached' });
      const bannerVisibleAfterDismiss = await banner.isVisible();
      const observed = await interactionPage.evaluate(() => ({
        counters: window.__OODS_INTERACTIONS__,
        domainActions: window.__OODS_DOMAIN_ACTIONS__,
        emailValue: document.querySelector('#email')?.value ?? null,
        planValue: document.querySelector('#plan')?.value ?? null,
        renewalValue: document.querySelector('#renewal')?.value ?? null,
        notesValue: document.querySelector('#notes')?.value ?? null,
      }));
      if (observed.counters.button !== 1
        || observed.counters.secondaryButton !== 1
        || observed.counters.tableRow !== 1
        || observed.counters.bannerDismiss !== 1) {
        throw new Error(`${framework} native interaction counters differ: ${JSON.stringify(observed.counters)}`);
      }
      if (observed.domainActions.primary !== 1
        || observed.domainActions.secondary !== 1
        || JSON.stringify(observed.domainActions.rowIds) !== JSON.stringify(['sub-1'])) {
        throw new Error(`${framework} injected domain actions differ: ${JSON.stringify(observed.domainActions)}`);
      }
      if (observed.emailValue !== 'user@example.com'
        || observed.planValue !== 'basic'
        || observed.renewalValue !== '2026-10-15'
        || observed.notesValue !== 'Follow up tomorrow.') {
        throw new Error(`${framework} form interaction state did not persist: ${JSON.stringify(observed)}`);
      }
      if (emailValidBeforeInput || !emailValidAfterInput) {
        throw new Error(
          `${framework} native email validity did not transition invalid-to-valid: `
          + `${JSON.stringify({ emailValidBeforeInput, emailValidAfterInput })}`,
        );
      }
      if (bannerVisibleAfterDismiss) {
        throw new Error(`${framework} Banner remained visible after its local dismiss action.`);
      }
      if (marketingBefore === marketingAfter || selectedTab !== 'true' || !securityTabDisabled) {
        throw new Error(`${framework} controlled interaction state did not change.`);
      }
      if (runtimeErrors.length > 0) throw new Error(`${framework} browser runtime errors: ${runtimeErrors.join(' | ')}`);
      const rawCallbackCoverage = await coverageSession.send('Profiler.takePreciseCoverage');
      await coverageSession.send('Profiler.stopPreciseCoverage');
      await coverageSession.send('Profiler.disable');
      await coverageSession.detach();
      const callbackCoverage = summarizeCallbackCoverage(rawCallbackCoverage, url, generatedSourceSha256);

      const screenshots = [];
      const widths = [
        { name: 'phone', width: 375, height: 812 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'desktop', width: 1280, height: 900 },
      ];
      for (const viewport of widths) {
        const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => window.__OODS_HYDRATED__ === true);
        const metrics = await page.evaluate((ids) => {
          const table = document.querySelector('#showcase-subscriptions');
          if (!(table instanceof HTMLTableElement)) throw new Error('Missing subscriptions Table.');
          const tableCells = [...table.querySelectorAll('th, td')].map((cell, index) => {
            const style = getComputedStyle(cell);
            const bounds = cell.getBoundingClientRect();
            const number = (value) => Number.parseFloat(value) || 0;
            const contentBounds = {
              left: bounds.left + number(style.borderLeftWidth) + number(style.paddingLeft),
              right: bounds.right - number(style.borderRightWidth) - number(style.paddingRight),
              top: bounds.top + number(style.borderTopWidth) + number(style.paddingTop),
              bottom: bounds.bottom - number(style.borderBottomWidth) - number(style.paddingBottom),
            };
            const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
            const textRuns = [];
            let textNode = walker.nextNode();
            while (textNode) {
              const text = (textNode.textContent ?? '').replace(/\s+/g, ' ').trim();
              if (text) {
                const range = document.createRange();
                range.selectNodeContents(textNode);
                const rectangles = [...range.getClientRects()].filter((rectangle) => (
                  rectangle.width > 0 && rectangle.height > 0
                ));
                const lineTops = new Set(rectangles.map((rectangle) => Math.round(rectangle.top * 2) / 2));
                textRuns.push({
                  text,
                  lineCount: lineTops.size,
                  outsideContentBox: rectangles.some((rectangle) => (
                    rectangle.left < contentBounds.left - 1
                    || rectangle.right > contentBounds.right + 1
                    || rectangle.top < contentBounds.top - 1
                    || rectangle.bottom > contentBounds.bottom + 1
                  )),
                });
              }
              textNode = walker.nextNode();
            }
            return {
              carrier: `${cell.tagName.toLowerCase()}-${index}:${(cell.textContent ?? '').replace(/\s+/g, ' ').trim()}`,
              clientWidth: cell.clientWidth,
              clientHeight: cell.clientHeight,
              scrollWidth: cell.scrollWidth,
              scrollHeight: cell.scrollHeight,
              textRuns,
            };
          });
          const visibleComponentCounts = Object.fromEntries(ids.map((id) => {
            const visible = [...document.querySelectorAll(`[data-oods-component="${id}"]`)]
              .filter((element) => {
                const bounds = element.getBoundingClientRect();
                const style = getComputedStyle(element);
                return bounds.width > 0
                  && bounds.height > 0
                  && style.display !== 'none'
                  && style.visibility !== 'hidden';
              });
            return [id, visible.length];
          }));
          return {
            clientWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            bodyHeight: document.body.scrollHeight,
            visibleComponentCounts,
            tableCells,
          };
        }, FOUNDATION_V1_IDS);
        const hiddenComponents = Object.entries(metrics.visibleComponentCounts)
          .filter(([, count]) => count === 0)
          .map(([id]) => id);
        if (hiddenComponents.length > 0) {
          throw new Error(`${framework} ${viewport.name} screenshot hides: ${hiddenComponents.join(', ')}`);
        }
        if (metrics.scrollWidth > metrics.clientWidth) {
          throw new Error(
            `${framework} ${viewport.name} screenshot overflows horizontally (${metrics.scrollWidth} > ${metrics.clientWidth}).`,
          );
        }
        assertTableViewportGeometry(framework, viewport.name, metrics.tableCells);
        const fileName = `${framework}-A-light-${viewport.name}-${viewport.width}.png`;
        const filePath = path.join(screenshotRoot, fileName);
        await page.screenshot({ path: filePath, fullPage: true });
        const bytes = await fsp.readFile(filePath);
        screenshots.push({
          viewport: viewport.name,
          width: viewport.width,
          height: viewport.height,
          file: fileName,
          bytes: bytes.byteLength,
          sha256: sha256(bytes),
          horizontalOverflow: metrics.scrollWidth > metrics.clientWidth,
          bodyHeight: metrics.bodyHeight,
          visibleComponentCounts: metrics.visibleComponentCounts,
          tableCells: metrics.tableCells,
        });
        await page.close();
      }
      await interactionPage.close();
      return {
        mount: 'passed',
        hydration: 'passed',
        initialHydration,
        componentCounts,
        computedStyles,
        callbackCoverage,
        interactions: {
          buttonActivationCount: observed.counters.button,
          secondaryButtonActivationCount: observed.counters.secondaryButton,
          emailValue: observed.emailValue,
          emailValidBeforeInput,
          emailValidAfterInput,
          planInitialValue,
          planInitialLabel,
          planValue: observed.planValue,
          planSelectedLabel,
          renewalValue: observed.renewalValue,
          notesValue: observed.notesValue,
          checkboxToggled: marketingBefore !== marketingAfter,
          selectedTab,
          securityTabDisabled,
          tableRowActivationCount: observed.counters.tableRow,
          bannerDismissActivationCount: observed.counters.bannerDismiss,
          bannerVisibleAfterDismiss,
          domainActions: observed.domainActions,
        },
        browserRuntimeErrors: runtimeErrors,
        screenshots,
      };
    });
  } finally {
    await browser.close();
  }
}

async function runFrameworkConsumer({ framework, source, artifactRoot, tarballs }) {
  const outputRoot = path.join(artifactRoot, 'consumers', framework);
  await mkdirFresh(outputRoot);
  const logRoot = path.join(outputRoot, 'logs');
  const sourceRoot = path.join(outputRoot, 'source');
  const buildRoot = path.join(outputRoot, 'build');
  const screenshotRoot = path.join(outputRoot, 'screenshots');
  await Promise.all([
    fsp.mkdir(logRoot),
    fsp.mkdir(sourceRoot),
    fsp.mkdir(buildRoot),
    fsp.mkdir(screenshotRoot),
  ]);

  const consumerRoot = await fsp.mkdtemp(path.join(os.tmpdir(), `oods-s182-${framework}-consumer-`));
  const emptyNpmConfig = path.join(consumerRoot, 'empty.npmrc');
  const replacements = [[consumerRoot, '<consumer-root>'], [REPOSITORY_ROOT, '<repository-root>']];
  const commands = [];
  try {
    assertPackedDependency(framework, tarballs);
    const manifest = consumerManifest(framework, tarballs, source);
    await fsp.writeFile(emptyNpmConfig, '');
    await fsp.writeFile(path.join(consumerRoot, 'empty-global.npmrc'), '');
    await fsp.writeFile(path.join(consumerRoot, 'package.json'), canonicalJson(manifest));
    await writeJson(
      path.join(sourceRoot, 'consumer-package.json'),
      normalizedConsumerManifest(framework, tarballs, source),
    );
    const files = framework === 'react' ? reactConsumerFiles(source) : vueConsumerFiles(source);
    await writeConsumerFiles(consumerRoot, files);
    await writeConsumerFiles(sourceRoot, files);

    const environment = isolatedNpmEnvironment(consumerRoot, emptyNpmConfig);
    const installArgs = ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', '--userconfig', emptyNpmConfig];
    const install = commandResult(
      'npm',
      installArgs,
      consumerRoot,
      { environment, scrubNpmCredentials: true },
    );
    commands.push({ name: 'install', result: install });
    await writeCommandLog(path.join(logRoot, 'install.log'), install, replacements);
    requireGreen(install, `${framework} clean install`);
    await writeJson(path.join(logRoot, 'rollup.json'), await ensureConsumerRollup(consumerRoot, async extraArgs => {
      const retry = commandResult('npm', [...installArgs, ...extraArgs], consumerRoot, { environment, scrubNpmCredentials: true });
      await writeCommandLog(path.join(logRoot, 'install-optional-retry.log'), retry, replacements);
      requireGreen(retry, `${framework} optional native package reinstall`);
    }));
    assertInstalledPackagesAreIsolated(consumerRoot, framework);

    const typecheckArgs = framework === 'react'
      ? ['exec', '--', 'tsc', '--noEmit', '--pretty', 'false']
      : ['exec', '--', 'vue-tsc', '--noEmit', '--pretty', 'false'];
    const typecheck = commandResult('npm', typecheckArgs, consumerRoot, { environment, scrubNpmCredentials: true });
    commands.push({ name: 'typecheck', result: typecheck });
    await writeCommandLog(path.join(logRoot, 'typecheck.log'), typecheck, replacements);
    requireGreen(typecheck, `${framework} strict typecheck`);

    const clientBuild = commandResult(
      'npm',
      ['exec', '--', 'vite', 'build', '--config', 'vite.config.mjs'],
      consumerRoot,
      { environment, scrubNpmCredentials: true },
    );
    commands.push({ name: 'production-build', result: clientBuild });
    await writeCommandLog(path.join(logRoot, 'production-build.log'), clientBuild, replacements);
    requireGreen(clientBuild, `${framework} production build`);

    const ssrEntry = framework === 'react' ? 'src/ssr.tsx' : 'src/ssr.ts';
    const ssrBuild = commandResult(
      'npm',
      ['exec', '--', 'vite', 'build', '--config', 'vite.config.mjs', '--ssr', ssrEntry, '--outDir', 'dist-ssr'],
      consumerRoot,
      { environment, scrubNpmCredentials: true },
    );
    commands.push({ name: 'ssr-build', result: ssrBuild });
    await writeCommandLog(path.join(logRoot, 'ssr-build.log'), ssrBuild, replacements);
    requireGreen(ssrBuild, `${framework} SSR build`);

    const ssrCandidates = (await fsp.readdir(path.join(consumerRoot, 'dist-ssr')))
      .filter((entry) => entry.endsWith('.js') || entry.endsWith('.mjs'))
      .sort(compareCodePoint);
    if (ssrCandidates.length !== 1) throw new Error(`${framework} expected one SSR entry, received ${ssrCandidates.length}.`);
    const ssrRun = commandResult(
      'node',
      [path.join('dist-ssr', ssrCandidates[0])],
      consumerRoot,
      { environment, scrubNpmCredentials: true },
    );
    commands.push({ name: 'ssr-render', result: ssrRun });
    await writeCommandLog(path.join(logRoot, 'ssr-render.log'), ssrRun, replacements);
    requireGreen(ssrRun, `${framework} SSR render`);
    const ssrProof = JSON.parse(ssrRun.stdout);
    const missingSsrComponents = FOUNDATION_V1_IDS.filter(
      (id) => !ssrProof.html.includes(`data-oods-component=\\"${id}\\"`) && !ssrProof.html.includes(`data-oods-component="${id}"`),
    );
    if (missingSsrComponents.length > 0) {
      throw new Error(`${framework} SSR output omits components: ${missingSsrComponents.join(', ')}`);
    }

    const distRoot = path.join(consumerRoot, 'dist');
    const indexPath = path.join(distRoot, 'index.html');
    const clientHtml = await fsp.readFile(indexPath, 'utf8');
    if (!clientHtml.includes('<!--SSR_MARKUP-->')) throw new Error(`${framework} production index lost SSR marker.`);
    await fsp.writeFile(indexPath, clientHtml.replace('<!--SSR_MARKUP-->', ssrProof.html));

    const cssFiles = (await fsp.readdir(path.join(distRoot, 'assets')))
      .filter((entry) => entry.endsWith('.css'))
      .sort(compareCodePoint);
    if (cssFiles.length === 0) throw new Error(`${framework} production build emitted no CSS asset.`);
    const css = (await Promise.all(cssFiles.map((entry) => fsp.readFile(path.join(distRoot, 'assets', entry), 'utf8')))).join('\n');
    if (!css.includes('data-oods-component') || !css.includes('--cmp-button')) {
      throw new Error(`${framework} production CSS lacks the shared component contract.`);
    }

    const browser = await browserProof({
      framework,
      distRoot,
      screenshotRoot,
      generatedSourceSha256: sha256(source),
    });
    await fsp.cp(distRoot, path.join(buildRoot, 'client'), { recursive: true });
    await fsp.cp(path.join(consumerRoot, 'dist-ssr'), path.join(buildRoot, 'ssr'), { recursive: true });
    const clientDigest = await directoryDigest(path.join(buildRoot, 'client'));
    const ssrDigest = await directoryDigest(path.join(buildRoot, 'ssr'));
    await writeJson(path.join(outputRoot, 'build-inventory.json'), { client: clientDigest, ssr: ssrDigest });

    const report = {
      schemaVersion: '1.0.0',
      mission: 's182-m04',
      framework,
      status: 'passed',
      selected: 8,
      passed: 8,
      failed: 0,
      skipped: 0,
      checks: [
        'fresh exact-tarball install',
        'strict typecheck',
        'production build',
        'server render',
        'mount',
        'hydration',
        'shared CSS resolution',
        'interaction path',
      ],
      isolation: {
        outsidePnpmWorkspace: true,
        freshNodeModules: true,
        emptyVerifierOwnedNpmConfiguration: true,
        installScripts: false,
        workspaceSymlinks: false,
        repositorySourceImports: false,
      },
      source: {
        bytes: Buffer.byteLength(source),
        sha256: sha256(source),
      },
      tarballs: tarballs
        .filter((record) => ['@oods/tokens', '@oods/component-contracts', '@oods/component-styles', `@oods/components-${framework}`].includes(record.name))
        .map(publicTarballRecord),
      commands: commands.map(({ name, result }) => ({ name, exitCode: result.exitCode })),
      ssr: {
        bytes: Buffer.byteLength(ssrProof.html),
        sha256: sha256(ssrProof.html),
        canonicalComponents: FOUNDATION_V1_IDS.length,
      },
      css: {
        files: cssFiles,
        bytes: Buffer.byteLength(css),
        sha256: sha256(css),
      },
      browser,
      build: {
        clientSha256: clientDigest.sha256,
        ssrSha256: ssrDigest.sha256,
      },
    };
    await writeJson(path.join(outputRoot, 'report.json'), report);
    return report;
  } catch (error) {
    const reason = error instanceof Error ? redact(error.message, replacements) : String(error);
    await writeJson(path.join(outputRoot, 'report.json'), {
      schemaVersion: '1.0.0',
      mission: 's182-m04',
      framework,
      status: 'failed',
      selected: 1,
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

export async function runGeneratedConsumerProof({ artifactRoot, sources, tarballs }) {
  const outputRoot = path.resolve(artifactRoot, 'generated-consumers');
  await mkdirFresh(outputRoot);
  await fsp.mkdir(path.join(outputRoot, 'consumers'));
  const reports = [];
  for (const framework of ['react', 'vue']) {
    const source = sources[framework];
    if (typeof source !== 'string' || source.length === 0) throw new Error(`Missing generated ${framework} source.`);
    reports.push(await runFrameworkConsumer({ framework, source, artifactRoot: outputRoot, tarballs }));
  }
  const report = {
    schemaVersion: '1.0.0',
    mission: 's182-m04',
    status: reports.every((item) => item.status === 'passed') ? 'passed' : 'failed',
    selected: reports.length,
    passed: reports.filter((item) => item.status === 'passed').length,
    failed: reports.filter((item) => item.status !== 'passed').length,
    skipped: 0,
    frameworks: reports.map((item) => ({
      framework: item.framework,
      status: item.status,
      report: `consumers/${item.framework}/report.json`,
      reportSha256: sha256(canonicalJson(item)),
      sourceSha256: item.source.sha256,
      clientBuildSha256: item.build.clientSha256,
      ssrBuildSha256: item.build.ssrSha256,
    })),
  };
  await writeJson(path.join(outputRoot, 'report.json'), report);
  if (report.status !== 'passed') throw new Error('One or more generated consumers failed.');
  return { report, frameworkReports: reports };
}

export async function writeMatrixEvidence({ artifactRoot, cells }) {
  const outputRoot = path.resolve(artifactRoot, 'codegen-matrix');
  await mkdirFresh(outputRoot);
  const { typescript, vueCompiler } = loadSourceCompilers();
  const vueRequire = createRequire(path.join(REPOSITORY_ROOT, 'packages/components-vue/package.json'));
  const sorted = [...cells].sort((left, right) => compareCodePoint(
    `${left.framework}/${left.styling}/${left.typescript}`,
    `${right.framework}/${right.styling}/${right.typescript}`,
  ));
  const passed = sorted.filter((cell) => cell.status === 'passed').length;
  const report = {
    schemaVersion: '1.0.0',
    mission: 's182-m04',
    dimensions: {
      framework: ['react', 'vue'],
      styling: ['inline', 'tailwind', 'tokens'],
      typescript: [false, true],
    },
    status: passed === 12 && sorted.length === 12 ? 'passed' : 'failed',
    selected: sorted.length,
    passed,
    failed: sorted.length - passed,
    skipped: 0,
    toolchain: {
      node: process.version,
      typescript: typescript.version,
      vueCompilerSfc: vueCompiler.version,
      vueTsc: vueRequire('vue-tsc/package.json').version,
    },
    cells: sorted,
  };
  await writeJson(path.join(outputRoot, 'report.json'), report);
  if (report.status !== 'passed') throw new Error(`M04 matrix is not 12/12 green (${passed}/${sorted.length}).`);
  return report;
}

export async function writeCodegenUsableLedger({ artifactRoot, matrixReport, consumerReport }) {
  if (matrixReport.status !== 'passed' || matrixReport.selected !== 12 || matrixReport.failed !== 0) {
    throw new Error('codegenUsable requires a green 12-cell matrix.');
  }
  if (consumerReport.status !== 'passed' || consumerReport.selected !== 2 || consumerReport.failed !== 0) {
    throw new Error('codegenUsable requires both clean generated consumers.');
  }
  const matrixPath = path.join(artifactRoot, 'codegen-matrix', 'report.json');
  const consumerPath = path.join(artifactRoot, 'generated-consumers', 'report.json');
  const matrixSha256 = sha256(await fsp.readFile(matrixPath));
  const consumerSha256 = sha256(await fsp.readFile(consumerPath));
  const frameworkEvidence = Object.fromEntries(consumerReport.frameworks.map((record) => [record.framework, record]));
  for (const target of ['react', 'vue']) {
    const record = frameworkEvidence[target];
    if (record?.status !== 'passed' || typeof record.reportSha256 !== 'string') {
      throw new Error(`codegenUsable requires digest-bound ${target} consumer evidence.`);
    }
  }
  const rows = ['react', 'vue'].flatMap((target) => {
    const record = frameworkEvidence[target];
    return FOUNDATION_V1_IDS.map((componentId) => ({
      componentId,
      target,
      codegenUsable: true,
      evidence: [
        { class: '12-cell-source-compile-and-dependency', path: 'codegen-matrix/report.json', sha256: matrixSha256 },
        {
          class: 'default-token-typescript-clean-consumer',
          path: `generated-consumers/${record.report}`,
          sha256: record.reportSha256,
        },
      ],
    }));
  });
  const ledger = {
    schemaVersion: '1.0.0',
    mission: 's182-m04',
    predicate: 'codegenUsable',
    status: 'derived',
    controllingComponentDenominator: 109,
    selectedComponents: FOUNDATION_V1_IDS.length,
    selectedTargets: 2,
    selectedCells: FOUNDATION_V1_IDS.length * 2,
    codegenUsableCells: FOUNDATION_V1_IDS.length * 2,
    derivedPredicates: ['codegenUsable'],
    withheldPredicates: ['foundation-v1-candidate', 'foundation-v1'],
    foundationV1Candidate: false,
    foundationV1: false,
    nonDerivationReason: 'Sprint 182 m04 derives only codegenUsable; candidate and foundation-v1 require m05 and independent review.',
    evidenceIndex: [
      { path: 'codegen-matrix/report.json', sha256: matrixSha256 },
      { path: 'generated-consumers/report.json', sha256: consumerSha256 },
    ],
    rows,
  };
  const ledgerPath = path.resolve(artifactRoot, 'codegen-usable-ledger.json');
  await writeJson(ledgerPath, ledger);
  return ledger;
}

export async function digestFile(filePath) {
  return sha256(await fsp.readFile(filePath));
}

export function fileUrl(filePath) {
  return pathToFileURL(filePath).href;
}
