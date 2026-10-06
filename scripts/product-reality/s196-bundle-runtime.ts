import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import { handle as compose } from '../../packages/mcp-server/src/tools/design.compose.js';
import { handle as generate } from '../../packages/mcp-server/src/tools/code.generate.js';
import { handle as renderChart } from '../../packages/mcp-server/src/tools/viz.render.js';
import { handle as certifyChart } from '../../packages/mcp-server/src/tools/artifact.certify.js';
import type { RuntimeCell } from '../../packages/mcp-server/src/lib/runtime-ledger.js';
import type { ReleaseCell } from '../../packages/mcp-server/src/lib/release-ledger.js';
import { isolatedCommand } from '../runtime/e2e-npm.mjs';
import { McpClient } from '../runtime/e2e.mjs';
import { canonicalJson, sha256, sha256File, verifyEmbeddedManifest, RUNTIME_MANIFEST_FILE } from '../runtime/manifest.mjs';

export type BundleRuntimeInput = { bundleDirectory: string; archivePath: string; scope?: 'release' | 'runtime' };
export type BundleRuntimeConfiguration = BundleRuntimeInput & {
  bundleHead: string;
  archiveSha256: string;
  timezone: string;
};
export type GenerationComparison = {
  framework: string;
  bundleHead: string;
  requestHash: string;
  hostArtifactHash: string | null;
  bundleArtifactHash: string | null;
  hashEqualToHost: boolean;
  hostResponse: string;
  bundleResponse: string;
};
type HostTools = { compose: typeof compose; generate: typeof generate; renderChart: typeof renderChart; certifyChart: typeof certifyChart };
export type RuntimeToolset = HostTools & {
  configuration?: BundleRuntimeConfiguration;
  comparisons: GenerationComparison[];
  close: () => Promise<void>;
};
const HOST_TOOLS: HostTools = { compose, generate, renderChart, certifyChart };
const json = async (file: string, value: unknown) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, canonicalJson(value));
};

/** Proof ledgers and documentation may follow a build without changing generated product bytes. */
export function isRuntimeProductPath(file: string): boolean {
  if (/\.(?:test|spec)\.[^/]+$/.test(file) || file.endsWith('.md')) return false;
  if (/^packages\/mcp-server\/registry\//.test(file)) return false;
  return /^(?:domains|objects|traits|schemas|artifacts\/structured-data)\//.test(file)
    || /^packages\/[^/]+\/(?:src|evidence|registry)\//.test(file)
    || /^packages\/[^/]+\/package\.json$/.test(file)
    || ['package.json', 'pnpm-lock.yaml', 'configs/agent/policy.json'].includes(file);
}

export function assertBundleSourceMatches(repositoryRoot: string, bundleHead: string) {
  assert.match(bundleHead, /^[0-9a-f]{40}$/);
  const git = (args: string[]) => execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  // Compare against the recorded manifest head, including staged/unstaged and
  // untracked product files. Never substitute the current checkout's revision.
  const changed = git(['diff', '--name-only', '-z', bundleHead, '--']).split('\0').filter(Boolean);
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean);
  const mismatched = [...new Set([...changed, ...untracked])].filter(isRuntimeProductPath).sort();
  assert.deepEqual(mismatched, [], `Host product sources differ from bundle ${bundleHead}: ${mismatched.join(', ')}`);
  return { sourceHead: bundleHead, productSourcesMatch: true, ignoredChangedPaths: changed.filter(file => !isRuntimeProductPath(file)).sort() };
}

export async function prepareBundleRuntime(repositoryRoot: string, input: BundleRuntimeInput, output: string): Promise<BundleRuntimeConfiguration> {
  const bundleDirectory = await fs.realpath(input.bundleDirectory);
  const repository = await fs.realpath(repositoryRoot);
  const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: repository, encoding: 'utf8' }).trim();
  const relative = path.relative(path.dirname(common), bundleDirectory);
  assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'The extracted bundle must stay inside the canonical repository; dependency isolation is enforced separately.');
  const archivePath = await fs.realpath(input.archivePath);
  const verified = await verifyEmbeddedManifest(bundleDirectory);
  const manifest = verified.manifest;
  const members = execFileSync('tar', ['-tzf', archivePath], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).split('\n');
  const manifestMember = members.filter(member => member.replace(/^\.\//, '') === RUNTIME_MANIFEST_FILE);
  assert.equal(manifestMember.length, 1, 'The supplied archive must contain one embedded manifest.');
  const archiveManifest = JSON.parse(execFileSync('tar', ['-xOzf', archivePath, manifestMember[0]!], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));
  assert.deepEqual(archiveManifest, manifest, 'Archive and extracted bundle manifests differ.');
  assert(members.filter(Boolean).every(member => !path.isAbsolute(member) && !member.split('/').includes('..')), 'Archive members must remain inside the extraction root.');
  await fs.mkdir(output, { recursive: true });
  const archiveVerificationRoot = await fs.mkdtemp(path.join(output, '.archive-verification-'));
  try {
    execFileSync('tar', ['-xzf', archivePath, '-C', archiveVerificationRoot]);
    const archived = await verifyEmbeddedManifest(archiveVerificationRoot);
    assert.equal(archived.payload.sha256, verified.payload.sha256, 'Archive payload differs from the extracted runtime.');
  } finally { await fs.rm(archiveVerificationRoot, { recursive: true, force: true }); }
  const source = assertBundleSourceMatches(repository, manifest.commit);
  const configuration = {
    bundleDirectory, archivePath, scope: input.scope, bundleHead: manifest.commit,
    archiveSha256: await sha256File(archivePath),
    timezone: process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  await json(path.join(output, 'bundle-identity.json'), { ...configuration, source, manifestVerified: true, payload: verified.payload });
  return configuration;
}

export function bundleRuntimeFromEnvironment(): BundleRuntimeConfiguration | undefined {
  return process.env.OODS_RUNTIME_BUNDLE_CONFIG ? JSON.parse(process.env.OODS_RUNTIME_BUNDLE_CONFIG) : undefined;
}

export function releaseCellProvenance(row: RuntimeCell, tools: Pick<RuntimeToolset, 'configuration' | 'comparisons'>): ReleaseCell {
  assert(tools.configuration, 'Release provenance requires a verified bundle configuration.');
  const comparison = tools.comparisons.find(value => value.framework === row.framework);
  return Object.assign(row, {
    bundleHead: tools.configuration.bundleHead,
    archiveSha256: tools.configuration.archiveSha256,
    hostArtifactHash: comparison?.hostArtifactHash ?? null,
    hashEqualToHost: comparison?.hashEqualToHost ?? false,
  });
}

/** The same operands cross the adapter and host; comparison receipts precede every assertion. */
export async function createRuntimeToolset(
  output: string,
  configuration?: BundleRuntimeConfiguration,
): Promise<RuntimeToolset> {
  if (!configuration) return { ...HOST_TOOLS, comparisons: [], close: async () => {} };
  const state = await fs.mkdtemp(path.join(process.env.TMPDIR ?? output, 's218-bundle-state-'));
  const invocation = isolatedCommand(configuration.bundleDirectory, process.execPath, [path.join(configuration.bundleDirectory, 'packages/mcp-adapter/index.js')]);
  const client = new McpClient({
    command: invocation.command, args: invocation.args,
    cwd: path.join(configuration.bundleDirectory, 'packages/mcp-adapter'),
    env: { PATH: process.env.PATH ?? '', LANG: process.env.LANG ?? 'C.UTF-8', LC_ALL: process.env.LC_ALL ?? 'C.UTF-8',
      TZ: configuration.timezone, NODE_ENV: 'production', NO_COLOR: '1', NODE_OPTIONS: '--no-global-search-paths', TMPDIR: state, HOME: state, MCP_SCHEMA_STORE_ROOT: state, MCP_SCHEMA_STORE_DIR: 'schemas' },
  });
  const comparisons: GenerationComparison[] = [];
  let compositionCount = 0;
  const close = async () => {
    const lifecycle = await client.terminate();
    await json(path.join(output, 'adapter-lifecycle.json'), lifecycle);
    assert.equal(lifecycle.forcedKill, false, 'Release adapter required a forced kill.');
    assert(lifecycle.code === 0 || lifecycle.signal === 'SIGTERM', 'Release adapter did not stop cleanly.');
    await fs.rm(state, { recursive: true, force: true });
  };
  try {
    const initialized = await client.request<{ protocolVersion: string }>('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'forge-release-runtime', version: '1.0.0' } });
    assert.equal(initialized.protocolVersion, '2024-11-05');
    client.notify('notifications/initialized');
  } catch (error) { await close(); throw error; }
  return {
    configuration, comparisons, close,
    compose: async (input) => {
      const result = await client.callTool('design_compose', input) as Awaited<ReturnType<typeof compose>>;
      const host = await compose(structuredClone(input));
      const prefix = `composition-${++compositionCount}`;
      await json(path.join(output, `${prefix}-bundle.json`), result);
      await json(path.join(output, `${prefix}-host.json`), host);
      await json(path.join(output, `${prefix}-comparison.json`), {
        request: input, bundleHead: configuration.bundleHead,
        bundleSchemaHash: sha256(canonicalJson(result.schema)), hostSchemaHash: sha256(canonicalJson(host.schema)),
      });
      assert.equal(result.status, host.status, 'Bundle and host composition outcomes differ.');
      assert.equal(canonicalJson(result.schema), canonicalJson(host.schema), 'Bundle and host composition schemas differ on the JSON wire.');
      return result;
    },
    generate: async (input) => {
      const result = await client.callTool('code_generate', input) as Awaited<ReturnType<typeof generate>>;
      const host = await generate(structuredClone(input));
      const prefix = `generation-${comparisons.length + 1}-${input.framework ?? 'resolved'}`;
      const comparison: GenerationComparison = {
        framework: result.framework, bundleHead: configuration.bundleHead,
        requestHash: `sha256:${sha256(canonicalJson(input))}`,
        hostArtifactHash: host.artifact?.contentHash ?? null,
        bundleArtifactHash: result.artifact?.contentHash ?? null,
        hashEqualToHost: Boolean(result.artifact && host.artifact && result.artifact.contentHash === host.artifact.contentHash),
        hostResponse: `${prefix}-host.json`, bundleResponse: `${prefix}-bundle.json`,
      };
      comparisons.push(comparison);
      await json(path.join(output, comparison.bundleResponse), result);
      await json(path.join(output, comparison.hostResponse), host);
      await json(path.join(output, `${prefix}-request.json`), input);
      await json(path.join(output, 'generation-comparisons.json'), comparisons);
      if (result.status === 'ok' || host.status === 'ok') {
        assert.equal(comparison.hashEqualToHost, true, `Bundle ${result.framework} artifact differs from the host at ${configuration.bundleHead}.`);
      } else {
        assert.equal(canonicalJson(result.errors), canonicalJson(host.errors), 'Bundle and host generation refusals differ on the JSON wire.');
      }
      return result;
    },
    renderChart: async (input) => client.callTool<Awaited<ReturnType<typeof renderChart>>>('viz_render', input),
    certifyChart: async (input) => client.callTool<Awaited<ReturnType<typeof certifyChart>>>('artifact_certify', input),
  };
}
