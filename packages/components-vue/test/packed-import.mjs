import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(packageRoot, '../..');
const artifactArgument = process.argv.indexOf('--artifact-root');
const missionArgument = process.argv.indexOf('--mission');

if (artifactArgument < 0 || !process.argv[artifactArgument + 1]) {
  throw new Error('Usage: node test/packed-import.mjs --artifact-root <directory>');
}

const artifactRoot = resolve(repositoryRoot, process.argv[artifactArgument + 1]);
const mission = missionArgument >= 0 && process.argv[missionArgument + 1]
  ? process.argv[missionArgument + 1]
  : 's182-m03';
const tarballRoot = resolve(artifactRoot, 'tarballs');
const consumerRoot = mkdtempSync(join(tmpdir(), 'oods-vue-s182-m03-'));
const packageDirectories = [
  'packages/tokens',
  'packages/component-contracts',
  'packages/component-styles',
  'packages/components-vue',
];
function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      CI: '1',
      FORCE_COLOR: '0',
      NO_COLOR: '1',
      NPM_CONFIG_USERCONFIG: '/dev/null',
      npm_config_audit: 'false',
      npm_config_fund: 'false',
      npm_config_package_lock: 'false',
    },
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    command: [command, ...args].join(' '),
    exitCode: result.status ?? 127,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    ...(result.error ? { error: result.error.message } : {}),
  };
}

function requireGreen(result) {
  if (result.exitCode !== 0) {
    throw new Error(`${result.command} failed (${result.exitCode})\n${result.stderr || result.stdout}`);
  }
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

mkdirSync(tarballRoot, { recursive: true });
const commands = [];

try {
  const tarballs = {};
  for (const directory of packageDirectories) {
    const result = run('npm', ['pack', resolve(repositoryRoot, directory), '--pack-destination', tarballRoot, '--json'], repositoryRoot);
    commands.push(result);
    requireGreen(result);
    const manifest = JSON.parse(readFileSync(resolve(repositoryRoot, directory, 'package.json'), 'utf8'));
    const filename = `${manifest.name.replace(/^@/, '').replaceAll('/', '-')}-${manifest.version}.tgz`;
    const tarballPath = resolve(tarballRoot, filename);
    readFileSync(tarballPath);
    tarballs[manifest.name] = tarballPath;
  }

  const consumerManifest = {
    name: 'oods-vue-s182-m03-packed-consumer',
    version: '1.0.0',
    private: true,
    type: 'module',
    dependencies: {
      '@oods/component-contracts': `file:${tarballs['@oods/component-contracts']}`,
      '@oods/component-styles': `file:${tarballs['@oods/component-styles']}`,
      '@oods/components-vue': `file:${tarballs['@oods/components-vue']}`,
      '@oods/tokens': `file:${tarballs['@oods/tokens']}`,
      '@vue/server-renderer': '3.5.42',
      vue: '3.5.42',
      typescript: '5.9.3',
    },
  };
  const consumerSource = `
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToString } from '@vue/server-renderer';
import { NUCLEUS_COMPONENT_IDS, evaluateEmissionEligibility } from '@oods/component-contracts';
import { sharedScenarios } from '@oods/component-contracts';
import { createSSRApp, h } from 'vue';
import readiness from '@oods/components-vue/readiness' with { type: 'json' };
import * as components from '@oods/components-vue';

const canonicalIds = [...NUCLEUS_COMPONENT_IDS];
const consumerPackage = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
if (consumerPackage.dependencies?.['@vue/server-renderer'] !== '3.5.42') {
  throw new Error('Packed consumer must declare its direct @vue/server-renderer import.');
}
const require = createRequire(import.meta.url);
const commonJs = require('@oods/components-vue');
const compatibilityIds = ['AuditTimeline', 'CancellationSummary', 'PaginationBar', 'PriceBadge', 'RelativeTimestamp', 'SearchInput', 'StatusBadge', 'StatusTimeline'];
const commonJsRoot = require('@oods/components-vue');
// The former eight compatibility families ship through the root only: their historical
// subpaths were retired in Sprint 200 m04 and must fail to resolve from a packed install.
const compatibilityProof = [];
for (const id of compatibilityIds) {
  const scenario = sharedScenarios.find(item => item.oodsComponentId === id);
  if (!scenario) throw new Error('Missing canonical scenario for compatibility family: ' + id);
  const rootMarkup = await renderToString(createSSRApp({ render: () => h(components[id], scenario.props) }));
  const result = { componentId: id, esmPresent: components[id] !== undefined, cjsPresent: commonJsRoot[id] !== undefined, rootMarkup };
  if (!result.esmPresent || !result.cjsPresent || !rootMarkup.includes('data-oods-component="' + id + '"')) throw new Error('Compatibility family changed ' + id);
  compatibilityProof.push(result);
}
const rootRuntimeIds = compatibilityIds.filter(id => id in components);
const retiredSpecifiers = {};
for (const specifier of ['@oods/components-vue/ported', '@oods/components-vue/readiness-ported', '@oods/component-styles/css-ported', '@oods/component-styles/ported']) {
  try { import.meta.resolve(specifier); throw new Error('Retired subpath still resolves: ' + specifier); }
  catch (error) { if (error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw error; retiredSpecifiers[specifier] = error.code; }
}
const runtimeIds = canonicalIds.filter((id) => id in components);
const commonJsIds = canonicalIds.filter((id) => id in commonJs);
if (JSON.stringify(runtimeIds) !== JSON.stringify(canonicalIds)) throw new Error('ESM canonical export mismatch.');
if (JSON.stringify(commonJsIds) !== JSON.stringify(canonicalIds)) throw new Error('CJS canonical export mismatch.');
const readinessIds = readiness.rows.map((row) => row.componentId);
const derivedReadiness = readiness.rows.map((row) => evaluateEmissionEligibility(row.evidence));
if (
  readiness.target !== 'vue'
  || JSON.stringify(readinessIds) !== JSON.stringify(canonicalIds)
  || derivedReadiness.some((result) => !result.emissionEligible || result.incomplete.length > 0)
  || readiness.rows.some((row) => !row.emissionEligible)
) {
  throw new Error('Packed readiness evidence is incomplete.');
}
const cssUrl = import.meta.resolve('@oods/component-styles/css');
const cssPath = fileURLToPath(cssUrl);
const css = readFileSync(cssPath, 'utf8');
if (!css.includes('@import "@oods/tokens/css"') || !css.includes("[data-oods-component='Tabs']")) {
  throw new Error('Packed shared CSS closure is incomplete.');
}
const repositoryRoot = ${JSON.stringify(repositoryRoot)};
for (const target of [import.meta.resolve('@oods/component-contracts'), import.meta.resolve('@oods/components-vue'), cssUrl, import.meta.resolve('@oods/components-vue/readiness')]) {
  const path = fileURLToPath(target);
  if (!path.startsWith(process.cwd())) throw new Error(\`Resolved outside isolated consumer: \${path}\`);
  if (path.startsWith(repositoryRoot + '/')) throw new Error(\`Resolved repository source: \${path}\`);
  if (path.includes('/OODs-Forge/') || path.includes('/OODS-Forge/')) throw new Error(\`Resolved repository source: \${path}\`);
}
const html = await renderToString(createSSRApp({
  render: () => h(components.Button, { content: 'Packed Vue import' }),
}));
if (!html.includes('data-oods-component="Button"') || !html.includes('type="button"')) {
  throw new Error('Packed SSR smoke did not render canonical Button semantics.');
}

const breadthIds = ['DetailHeader', 'CardHeader', 'ColorSwatch', 'ColorizedBadge', 'VizAreaPreview', 'ClassificationPanel', 'FilterPanel', 'PriceSummary', 'AddressCollectionPanel', 'MembershipPanel', 'PreferencePanel', 'TagManager', 'AddressSummaryBadge', 'MessageStatusBadge', 'PreferenceSummaryBadge', 'RoleBadgeList', 'TagPills', 'AddressValidationTimeline', 'AuditEvent', 'MembershipAuditTimeline', 'MessageEventTimeline', 'PreferenceTimeline', 'AddressEditor', 'PreferenceEditor', 'RoleAssignmentForm', 'StatusSelector', 'TagInput', 'TemplatePicker'];
const breadthProof = [];
for (const id of breadthIds) {
  const scenario = sharedScenarios.find((item) => item.oodsComponentId === id);
  if (!scenario) throw new Error('Missing installed shared scenario: ' + id);
  const markup = await renderToString(createSSRApp({ render: () => h(components[id], scenario.props, scenario.slots.default === undefined ? undefined : { default: () => String(scenario.slots.default) }) }));
  if (!markup.includes('data-oods-component="' + id + '"')) throw new Error('Missing packed marker: ' + id);
  if (id === 'DetailHeader' && (!markup.includes('<h1') || !markup.includes(scenario.props.title) || !markup.includes(scenario.props.subtitle) || !markup.includes(scenario.props.metadata))) throw new Error('Packed DetailHeader lost heading/text semantics.');
  if (id === 'CardHeader' && (!markup.includes('<h2') || !markup.includes(scenario.props.supportingText))) throw new Error('Packed CardHeader lost heading/supporting text.');
  if (id === 'ColorSwatch' && (!markup.includes('data-oods-swatch-chip') || !markup.includes(scenario.props.label) || !markup.includes('--oods-swatch-color') || !markup.includes('data-swatch-color="' + scenario.props.color + '"'))) throw new Error('Packed ColorSwatch lost label/chip semantics.');
  if (id === 'ColorizedBadge' && (!markup.includes('data-oods-badge-marker') || !markup.includes(scenario.props.label) || !markup.includes('data-badge-color="' + scenario.props.color + '"'))) throw new Error('Packed ColorizedBadge lost color/text semantics.');
  if (id === 'VizAreaPreview' && (!markup.includes('data-viz-preview-type="area"') || !markup.includes('data-viz-width="640"') || !markup.includes('data-viz-height="360"') || !markup.includes(String(scenario.slots.default)) || markup.includes('data-viz-preview-placeholder'))) throw new Error('Packed preview lost frame/slot semantics.');
  if (id === 'ClassificationPanel' && (!markup.includes('data-panel-type="classification"') || !markup.includes('<h2>Classification</h2>') || !markup.includes(String(scenario.props.summary).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')))) throw new Error('Packed ClassificationPanel lost heading/summary semantics.');
  if (id === 'FilterPanel' && (!markup.includes('aria-label="Filters"') || !markup.includes('data-filter-mode="batch"') || !markup.includes('<legend>Status</legend>') || !markup.includes('data-filter-apply'))) throw new Error('Packed FilterPanel lost region/legend/apply semantics.');
  if (['AddressCollectionPanel', 'MembershipPanel', 'PreferencePanel'].includes(id) && (!markup.includes('data-panel-type=') || !markup.includes('<h2>') || !markup.includes('data-panel-summary'))) throw new Error('Packed ' + id + ' lost heading/summary semantics.');
  if (['AddressSummaryBadge', 'MessageStatusBadge', 'PreferenceSummaryBadge'].includes(id) && (!markup.includes('data-badge-variant=') || !markup.includes('data-badge-status=') || !markup.includes('data-oods-badge-label'))) throw new Error('Packed ' + id + ' lost badge semantics.');
  if (id === 'RoleBadgeList' && (!markup.includes('data-badge-variant="session"') || !markup.includes('data-role-badge'))) throw new Error('Packed RoleBadgeList lost item semantics.');
  if (id === 'TagPills' && (!markup.includes('data-summary-type="tag-pills"') || !markup.includes('data-tag-pill') || !markup.includes('>+5<') || markup.includes('{{'))) throw new Error('Packed TagPills lost overflow substitution.');
  if (['AddressValidationTimeline', 'MembershipAuditTimeline', 'MessageEventTimeline', 'PreferenceTimeline'].includes(id) && (!markup.includes('role="log"') || !markup.includes('data-timeline-type=') || !markup.includes('data-timeline-events'))) throw new Error('Packed ' + id + ' lost log semantics.');
  if (id === 'AuditEvent' && (!markup.includes('data-event-type="audit"') || !markup.includes('<time') || !markup.includes('data-event-label'))) throw new Error('Packed AuditEvent lost article semantics.');
  if (id === 'TagManager' && (!markup.includes('data-form-type="tag-manager"') || !markup.includes('<h2>Tags</h2>') || !markup.includes('data-tag-item') || !markup.includes('name="newTag"'))) throw new Error('Packed TagManager lost list/add-control semantics.');
  if (id === 'PriceSummary' && (!markup.includes('data-summary-type="price"') || !markup.includes('<dt>Amount</dt>') || !markup.includes('<dd>$1,299.00</dd>'))) throw new Error('Packed PriceSummary lost term/value semantics.');
  if (id === 'AddressEditor' && (!markup.includes('data-form-type="address-editor"') || !markup.includes('<h2>Shipping address</h2>') || !markup.includes('name="street"') || !markup.includes('name="postalCode"'))) throw new Error('Packed AddressEditor lost form/input semantics.');
  if (id === 'PreferenceEditor' && (!markup.includes('data-form-type="preference-editor"') || !markup.includes('name="namespace"') || !markup.includes('<textarea') || !markup.includes('billing'))) throw new Error('Packed PreferenceEditor lost select/textarea semantics.');
  if (id === 'RoleAssignmentForm' && (!markup.includes('data-form-type="role-assignment"') || !markup.includes('name="role"') || !markup.includes('>Owner</option>') || !markup.includes('name="assignee"'))) throw new Error('Packed RoleAssignmentForm lost select/input semantics.');
  if (id === 'StatusSelector' && (!markup.includes('data-summary-type="status-selector"') || !markup.includes('name="status"') || !markup.includes('selected') || !markup.includes('>active</option>'))) throw new Error('Packed StatusSelector lost labelled select semantics.');
  if (id === 'TagInput' && (!markup.includes('data-form-type="tag-input"') || !markup.includes('<legend>Tags</legend>') || !markup.includes('name="tag"') || !markup.includes('placeholder="Add a tag"') || !markup.includes('data-tag-item'))) throw new Error('Packed TagInput lost fieldset/input/tag semantics.');
  if (id === 'TemplatePicker' && (!markup.includes('data-form-type="template-picker"') || !markup.includes('name="template"') || !markup.includes('>Welcome</option>') || !markup.includes('name="channel"'))) throw new Error('Packed TemplatePicker lost select semantics.');
  breadthProof.push({ componentId: id, markup });
}
const emptyPreview = await renderToString(createSSRApp({ render: () => h(components.VizAreaPreview) }));
if (!emptyPreview.includes('data-viz-preview-placeholder') || !emptyPreview.includes('Area preview (640 x 360)')) throw new Error('Packed empty preview placeholder missing.');

const resolvedSpecifiers = Object.fromEntries(['@oods/component-contracts', '@oods/components-vue', '@oods/components-vue/readiness', '@oods/component-styles/css', '@oods/tokens/css', 'vue', '@vue/server-renderer'].map((specifier) => {
  const resolved = fileURLToPath(import.meta.resolve(specifier));
  if (!resolved.startsWith(process.cwd() + '/') || resolved.startsWith(repositoryRoot + '/')) throw new Error('Specifier escaped isolated consumer: ' + specifier);
  return [specifier, resolved];
}));
process.stdout.write(JSON.stringify({
    breadthProof, emptyPreview, resolvedSpecifiers, compatibilityProof, retiredSpecifiers, rootRuntimeIds,
    status: 'passed',
    directServerRendererDependency: consumerPackage.dependencies['@vue/server-renderer'],
    readinessDerivedFromInstalledContracts: true,
    esmCanonicalExports: runtimeIds.length,
  cjsCanonicalExports: commonJsIds.length,
  readinessRows: readiness.rows.length,
  cssPath,
  ssrHtml: html,
}));
`;
  writeFileSync(resolve(consumerRoot, 'package.json'), `${JSON.stringify(consumerManifest, null, 2)}\n`);
  writeFileSync(resolve(consumerRoot, 'verify.mjs'), consumerSource.trimStart());
  writeFileSync(resolve(artifactRoot, 'consumer-package.json'), `${JSON.stringify(consumerManifest, null, 2)}\n`);
  writeFileSync(resolve(artifactRoot, 'consumer.mjs'), consumerSource.trimStart());

  const install = run('npm', ['install', '--ignore-scripts', '--package-lock=false', '--no-audit', '--no-fund'], consumerRoot);
  commands.push(install);
  requireGreen(install);
  const typeSource = `import * as root from '@oods/components-vue';\n`
    + ['AuditTimeline', 'CancellationSummary', 'PaginationBar', 'PriceBadge', 'RelativeTimestamp', 'SearchInput', 'StatusBadge', 'StatusTimeline'].map(id => `const ${id}: typeof root.${id} = root.${id};`).join('\n') + '\n';
  writeFileSync(resolve(consumerRoot, 'compatibility-types.ts'), typeSource);
  writeFileSync(resolve(artifactRoot, 'compatibility-types.ts'), typeSource);
  const compile = run(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--strict', '--skipLibCheck', 'false', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022', '--lib', 'ES2022,DOM', 'compatibility-types.ts'], consumerRoot);
  commands.push(compile);
  requireGreen(compile);
  const execute = run(process.execPath, ['verify.mjs'], consumerRoot);
  commands.push(execute);
  requireGreen(execute);
  const packedProof = JSON.parse(execute.stdout);

  const inventory = Object.entries(tarballs).map(([name, path]) => ({
    name,
    file: basename(path),
    path: path.slice(repositoryRoot.length + 1),
    bytes: readFileSync(path).byteLength,
    sha256: sha256(path),
  }));
  const report = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    mission,
    target: 'vue',
    strictCompatibilityCompile: { status: 'passed', skipLibCheck: false, stdout: compile.stdout.trim() },
    status: 'passed',
    selected: 6,
    failed: 0,
    skipped: 0,
    isolatedConsumer: true,
    emptyNpmUserConfig: true,
    packageLockWritten: false,
    inventory,
    packedProof,
    commands: commands.map(({ command, exitCode }) => ({ command, exitCode })),
  };
  writeFileSync(resolve(artifactRoot, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(resolve(artifactRoot, 'commands.log'), commands.map((result) => [
    `$ ${result.command}`,
    `exitCode=${result.exitCode}`,
    '[stdout]',
    result.stdout,
    '[stderr]',
    result.stderr,
  ].join('\n')).join('\n\n'));
  process.stdout.write(`Vue packed import: ${report.selected} passed, 0 failed, 0 skipped\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  writeFileSync(resolve(artifactRoot, 'report.json'), `${JSON.stringify({
    schemaVersion: '1.0.0',
    mission,
    target: 'vue',
    status: 'failed',
    selected: 1,
    failed: 1,
    skipped: 0,
    reason: message,
  }, null, 2)}\n`);
  throw error;
} finally {
  rmSync(consumerRoot, { recursive: true, force: true });
}
