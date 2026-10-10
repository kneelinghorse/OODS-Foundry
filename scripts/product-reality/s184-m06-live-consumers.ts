import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isolatedCommand } from '../runtime/e2e-npm.mjs';

import type {
  GeneratedArtifact,
  GeneratedArtifactAction,
} from '../../packages/mcp-server/src/codegen/types.js';
import type { UiSchema } from '../../packages/mcp-server/src/schemas/generated.js';
import { handle as designCompose } from '../../packages/mcp-server/src/tools/design.compose.js';
import { handle as objectList } from '../../packages/mcp-server/src/tools/object.list.js';
import { handle as codeGenerate } from '../../packages/mcp-server/src/tools/code.generate.js';
import type { CodeGenerateOutput } from '../../packages/mcp-server/src/tools/types.js';
import { packFoundationPackages } from './s182-m04-consumer-harness.mjs';
import { ensureConsumerRollup } from './consumer-rollup.mjs';
import { extractBareImports } from './s183-m05-saved-schema-consumers.mjs';
import {
  EDITOR_TYPED_TEXT,
  S185_SCHEMA_NAMES,
  S186_SCHEMA_NAMES,
  deriveActionArguments, collectionActionControl, sourceOwnsControl, htmlHasSelector, type CollectionActionControl,
  deriveBoundFieldProbe,
  deriveValueProbes,
  schemaNodes,
  deriveSharedNativeFieldProbes,
  type SharedNativeFieldProbe,
  type ValueProbe,
  deriveConsumerModel,
  deriveInteraction,
  deriveMountObligations,
  isDisabledScreenAction,
  inspectFrameworkAttachment,
  observeMountObligations,
  selectorForNode,
  summarizeGateAccounting,
  type ConsumerInteraction,
  type BoundFieldProbe,
  type MountObligation,
} from './s185-m04-consumer-contract.js';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const REPOSITORY_ROOT = path.resolve(scriptDirectory, '../..');
export const DEFAULT_ARTIFACT_ROOT = path.join(
  REPOSITORY_ROOT,
  'artifacts/product-reality/sprint-184/m06/live-consumers',
);

export const SCHEMA_NAMES = Object.freeze([
  'subscription-list-dark',
  'subscription-detail-dark',
] as const);
export const FRAMEWORKS = Object.freeze(['react', 'vue'] as const);
export const GATE_NAMES = Object.freeze([
  'fresh-exact-tarball-install',
  'strict-typecheck',
  'production-build',
  'server-render',
  'mount',
  'hydration',
  'shared-css-resolution',
  'interaction-evidence',
] as const);

export type S184M06SchemaName =
  | (typeof SCHEMA_NAMES)[number]
  | (typeof S185_SCHEMA_NAMES)[number]
  | (typeof S186_SCHEMA_NAMES)[number]
  | `fresh-${string}`;

export type FreshCompositionInput = { object: string; context: 'detail' | 'list' | 'form' | 'timeline' | 'card' | 'inline' };
export type S184M06Framework = (typeof FRAMEWORKS)[number];
export type S184M06GateName = (typeof GATE_NAMES)[number];

type CommandResult = {
  command: string;
  exitCode: number;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  error?: string;
  moduleIsolation?: { blockedAncestors: string[]; globalSearch: false };
};

export type PackedPackageRecord = {
  name: string;
  directory: string;
  version: string;
  tarballPath: string;
  artifactPath: string;
  bytes: number;
  sha256: string;
  manifest: Record<string, unknown>;
};

export type LiveGenerationCell = {
  mission?: string;
  schema: S184M06SchemaName;
  schemaRef: string;
  sourceSchema?: UiSchema;
  composition?: Record<string, unknown>;
  derivation?: Record<string, unknown>;
  framework: S184M06Framework;
  status: 'passed';
  artifact: GeneratedArtifact;
  source: string;
  sourcePath: string;
  sourceSha256: string;
  generationLog: string;
  generationFingerprint: {
    handler: 'code.generate';
    invocation: 'live-in-process';
    profile: 'build';
    sourceOfArtifact: 'current-in-run-output';
    artifactContentHash: string;
    generatedAt: string;
  };
  sourceOwnership: SourceOwnership;
  interaction?: ConsumerInteraction;
  model?: Record<string, unknown>;
};

type SourceOwnership = {
  generatedFile: string;
  bindingMarkerCount: number;
  actionSelectors: Array<{
    action: string;
    selector: string;
    generatedSourceOccurrences: number;
    generatedRenderCallOccurrences: number;
  }>;
  generatedOwnsEverySelector: boolean;
  generatedForwardsEveryAction: boolean;
  consumerEntryFiles: string[];
  selectorOccurrencesInConsumerEntries: number;
  consumerComponentDeclarations: string[];
  interaction?: ConsumerInteraction;
  generatedInteractionNodeOccurrences: number;
};

type GateRow = {
  name: S184M06GateName;
  status: 'passed' | 'failed' | 'unproven' | 'not-applicable';
  logs: string[];
  reason?: string;
  detail?: Record<string, unknown>;
};

export type S184M06ConsumerGateMutation = {
  id: string;
  gate: S184M06GateName;
};

type MutationOperation = {
  target: string;
  operation: string;
  replacementCount: number;
  beforeSha256: string | null;
  afterSha256: string;
};

type AppliedMutation = {
  id: string;
  gate: S184M06GateName;
  operations: MutationOperation[];
};

type SavedSchemaRecord = {
  composition?: Record<string, unknown>;
  /** Present only on a derived record outside the frozen saved store. */
  derivation?: Record<string, unknown>;
  schemaRef: string;
  name: S184M06SchemaName;
  schema: UiSchema;
};

type LiveGenerator = typeof codeGenerate;

// Historical CSS cohort, retained for replaying older artifacts that import
// compatibility subpaths. Current generation imports the single root union.
const HISTORICAL_PORTED_COMPONENT_IDS = Object.freeze([
  'StatusBadge',
  'PriceBadge',
  'StatusTimeline',
  'AuditTimeline',
  'CancellationSummary',
  'SearchInput',
  'PaginationBar',
  'RelativeTimestamp',
]);

const LOCAL_CLOSURE = Object.freeze([
  '@oods/tokens',
  '@oods/component-contracts',
  '@oods/component-styles',
]);

const VERIFIER_DEPENDENCIES = Object.freeze({
  react: Object.freeze({
    '@radix-ui/react-slot': '1.2.3',
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
    vue: '3.5.42',
    'vue-tsc': '3.3.11',
  }),
});

const MODEL = Object.freeze({
  allowedTransitions: ['paused', 'pending_cancellation'],
  amount: 129900,
  billingInterval: 'month',
  cancelAtPeriodEnd: false,
  cancellationReason: 'Requested by account owner',
  cancellationReasonCode: 'customer_request',
  cancellationRequestedAt: '2026-09-05T12:00:00.000Z',
  createdAt: '2026-01-02T03:04:05.000Z',
  currency: 'USD',
  currentPeriodEnd: '2026-10-01T00:00:00.000Z',
  currentPeriodProgress: 0.42,
  currentPeriodStart: '2026-09-01T00:00:00.000Z',
  customerEmail: 'billing@example.test',
  customerName: 'Northwind Research',
  lastEvent: 'subscription.updated',
  lastEventAt: '2026-09-05T12:00:00.000Z',
  lastPaymentAt: '2026-09-01T00:00:00.000Z',
  nextPaymentDueAt: '2026-10-01T00:00:00.000Z',
  paymentMethodType: 'card',
  paymentStatus: 'succeeded',
  planCode: 'enterprise-monthly',
  planInterval: 'month',
  planName: 'Enterprise',
  prorationAmount: 0,
  status: 'active',
  subscriptionId: 'sub-s184-001',
  updatedAt: '2026-09-05T12:00:00.000Z',
});

const CONSUMER_CSS = `
:root { font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
body { margin: 0; color: var(--sys-text-primary); background: var(--sys-surface-canvas); }
#app { max-width: 72rem; margin: 0 auto; padding: var(--ref-space-scale-lg); }
`.trimStart();

const FINGERPRINT_SCRIPT = `
window.__OODS_CAPTURE_FINGERPRINT__ = () => ({
  rootChildren: [...document.querySelectorAll('#app > *')].map((element) => ({
    tag: element.tagName,
    id: element.id,
    component: element.getAttribute('data-oods-component'),
  })),
  elements: [...document.querySelectorAll('#app [id], #app [data-oods-component], #app [role]')]
    .map((element) => ({
      tag: element.tagName,
      id: element.id || null,
      component: element.getAttribute('data-oods-component'),
      role: element.getAttribute('role'),
      selected: element.getAttribute('aria-selected'),
      hidden: element.hasAttribute('hidden'),
    })),
});
window.__OODS_SSR_FINGERPRINT__ = window.__OODS_CAPTURE_FINGERPRINT__();
window.__OODS_SSR_ROOT_NODE__ = document.querySelector('#app > [data-oods-component]');
window.__OODS_SSR_ACTION_NODE__ = document.querySelector('[data-oods-screen-actions] button');
window.__OODS_SSR_NODES__ = [...document.querySelectorAll('#app *')];
`.trim();

const compareCodePoint = (left: string, right: string): number => (
  left < right ? -1 : left > right ? 1 : 0
);
const toPosix = (value: string): string => value.split(path.sep).join('/');
const sha256 = (value: crypto.BinaryLike): string => (
  crypto.createHash('sha256').update(value).digest('hex')
);
const sha256Urn = (value: crypto.BinaryLike): string => `sha256:${sha256(value)}`;
const canonicalJson = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

function canonicalizeValue(value: unknown): unknown {
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((entry) => canonicalizeValue(entry));
  return Object.fromEntries(Object.keys(value as Record<string, unknown>)
    .sort(compareCodePoint)
    .map((key) => [key, canonicalizeValue((value as Record<string, unknown>)[key])]));
}

const canonicalize = (value: unknown): string => JSON.stringify(canonicalizeValue(value));

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function commandResult(
  command: string,
  args: string[],
  cwd: string,
  options: { environment?: NodeJS.ProcessEnv; timeout?: number; scrubNpmCredentials?: boolean; isolateDependencies?: boolean } = {},
): CommandResult {
  const environment = { ...process.env };
  delete environment.NODE_PATH;
  delete environment.INIT_CWD;
  if (options.scrubNpmCredentials) {
    for (const name of Object.keys(environment)) {
      if (/^npm_config_/i.test(name) || /(?:npm|node).*?(?:auth|password|token|username)/i.test(name)) {
        delete environment[name];
      }
    }
  }
  Object.assign(environment, {
    CI: '1',
    FORCE_COLOR: '0',
    NO_COLOR: '1',
    ...options.environment,
  });
  // Sprint 212: physical in-repo placement and dependency isolation are separate concerns.
  const invocation = options.isolateDependencies ? isolatedCommand(cwd, command, args) : { command, args, blocked: [] };
  if (options.isolateDependencies) environment.NODE_OPTIONS = [environment.NODE_OPTIONS, '--no-global-search-paths'].filter(Boolean).join(' ');
  const result = spawnSync(invocation.command, invocation.args, {
    cwd,
    encoding: 'utf8',
    env: environment,
    maxBuffer: 64 * 1024 * 1024,
    timeout: options.timeout ?? 600_000,
  });
  return {
    command: [command, ...args].join(' '),
    ...(options.isolateDependencies ? { moduleIsolation: { blockedAncestors: invocation.blocked, globalSearch: false as const } } : {}),
    exitCode: result.status ?? 127,
    signal: result.signal,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    ...(result.error ? { error: result.error.message } : {}),
  };
}

function requireGreen(result: CommandResult, label: string): void {
  if (result.exitCode !== 0) {
    throw new Error(
      `${label} failed (${result.exitCode}${result.signal ? `, ${result.signal}` : ''})\n`
      + `${result.stderr || result.stdout || result.error || 'no command output'}`,
    );
  }
}

function redact(value: string, replacements: Array<[string, string]>): string {
  let redacted = value;
  for (const [literal, replacement] of replacements) {
    redacted = redacted.split(literal).join(replacement);
  }
  return redacted;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, canonicalJson(value));
}

async function writeLog(filePath: string, contents: string): Promise<void> {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, `${contents.trimEnd()}\n`);
}

async function writeCommandLog(
  filePath: string,
  result: CommandResult,
  replacements: Array<[string, string]>,
): Promise<void> {
  await writeLog(filePath, [
    `$ ${redact(result.command, replacements)}`,
    `exitCode=${result.exitCode}`,
    `signal=${result.signal ?? ''}`,
    '',
    '[stdout]',
    redact(result.stdout, replacements),
    '[stderr]',
    redact(result.stderr, replacements),
    ...(result.error ? ['[spawn-error]', redact(result.error, replacements)] : []),
  ].join('\n'));
}

async function writeFiles(root: string, files: Record<string, string>): Promise<void> {
  for (const [relativePath, contents] of Object.entries(files)) {
    const destination = path.join(root, relativePath);
    await fsp.mkdir(path.dirname(destination), { recursive: true });
    await fsp.writeFile(destination, contents);
  }
}

function occurrenceCount(source: string, pattern: RegExp): number {
  return [...source.matchAll(pattern)].length;
}

function selectorFor(actionName: string): string {
  return `[data-oods-action="${actionName}"]`;
}

function generatedFile(artifact: GeneratedArtifact): GeneratedArtifact['files'][number] {
  if (artifact.files.length !== 1) {
    throw new Error(`Expected exactly one generated file; received ${artifact.files.length}.`);
  }
  return artifact.files[0]!;
}

function validateArtifact(
  result: CodeGenerateOutput,
  schema: S184M06SchemaName,
  framework: S184M06Framework,
): { artifact: GeneratedArtifact; source: string } {
  if (result.status !== 'ok' || !result.artifact) {
    throw new Error(`${schema}/${framework}: live code.generate failed: ${JSON.stringify(result.errors ?? [])}`);
  }
  const artifact = result.artifact;
  const file = generatedFile(artifact);
  const expectedPath = framework === 'react' ? 'src/GeneratedUI.tsx' : 'src/GeneratedUI.vue';
  if (artifact.framework !== framework || artifact.schemaVersion !== '1.0.0') {
    throw new Error(`${schema}/${framework}: generated artifact identity is invalid.`);
  }
  if (file.path !== expectedPath || file.contents !== result.code || file.contents.length === 0) {
    throw new Error(`${schema}/${framework}: generated source is not the current handler output.`);
  }
  if (file.contentHash !== sha256Urn(file.contents)) {
    throw new Error(`${schema}/${framework}: generated source content hash differs from its bytes.`);
  }
  const { contentHash: _contentHash, ...payload } = artifact;
  if (artifact.contentHash !== sha256Urn(canonicalize(payload))) {
    throw new Error(`${schema}/${framework}: artifact content hash differs from its canonical payload.`);
  }
  if (!result.validationReceipt.checks.includes('dependency-closure')) {
    throw new Error(`${schema}/${framework}: live result did not reach dependency-closure.`);
  }
  return { artifact, source: file.contents };
}

function sourceOwnership(
  source: string,
  generatedPath: string,
  actions: GeneratedArtifactAction[],
  consumerFiles: Record<string, string> = {},
  interaction?: ConsumerInteraction,
  schema?: UiSchema,
): SourceOwnership {
  const actionSelectors = actions.map((action) => {
    const escaped = escapeRegExp(action.name);
    const control = schema && collectionActionControl(schema, action);
    return {
      action: action.name,
      selector: control?.selector ?? selectorFor(action.name),
      generatedSourceOccurrences: control ? Number(sourceOwnsControl(source, control.nodeId)) : occurrenceCount(
        source,
        new RegExp(`data-oods-action=["']${escaped}["']`, 'g'),
      ),
      generatedRenderCallOccurrences: occurrenceCount(
        source,
        new RegExp(`\\bactions\\.${escaped}\\s*\\(`, 'g'),
      ),
    };
  });
  const entries = Object.entries(consumerFiles)
    .filter(([filePath]) => filePath !== generatedPath)
    .sort(([left], [right]) => compareCodePoint(left, right));
  const consumerComponentDeclarations = entries.flatMap(([filePath, contents]) => {
    const matches = [
      ...contents.matchAll(/\b(?:function|class)\s+([A-Z][A-Za-z0-9_]*)\b/g),
      ...contents.matchAll(/\b(?:const|let|var)\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g),
      ...contents.matchAll(/\bdefineComponent\s*\(/g),
    ];
    return matches.map((match) => `${filePath}:${match[1] ?? 'defineComponent'}`);
  });
  return {
    generatedFile: generatedPath,
    bindingMarkerCount: occurrenceCount(source, /@oods-(?:domain|local)-binding\b/g),
    actionSelectors,
    generatedOwnsEverySelector: actionSelectors.every((record) => record.generatedSourceOccurrences >= 1),
    generatedForwardsEveryAction: actionSelectors.every((record) => record.generatedRenderCallOccurrences >= 1),
    consumerEntryFiles: entries.map(([filePath]) => filePath),
    selectorOccurrencesInConsumerEntries: entries.reduce((sum, [, contents]) => (
      sum + occurrenceCount(contents, /data-oods-action/g)
    ), 0),
    consumerComponentDeclarations,
    interaction,
    generatedInteractionNodeOccurrences: interaction && interaction.kind !== 'none'
      ? Number(sourceOwnsControl(source, interaction.nodeId))
      : 0,
  };
}

function assertGeneratedOwnership(
  ownership: SourceOwnership,
  schema: S184M06SchemaName,
  framework: S184M06Framework,
): void {
  if (ownership.actionSelectors.length > 0 && ownership.bindingMarkerCount < 1) {
    throw new Error(`${schema}/${framework}: generated source has no domain/local binding marker.`);
  }
  if (!ownership.generatedOwnsEverySelector || !ownership.generatedForwardsEveryAction) {
    throw new Error(`${schema}/${framework}: generated source does not own and forward every action selector.`);
  }
  if (ownership.interaction && ownership.interaction.kind !== 'none'
    && ownership.generatedInteractionNodeOccurrences < 1) {
    throw new Error(`${schema}/${framework}: the selected interaction node is not owned by the generated source.`);
  }
  if (ownership.selectorOccurrencesInConsumerEntries !== 0) {
    throw new Error(`${schema}/${framework}: a consumer entry file owns a generated interaction selector.`);
  }
  if (ownership.consumerComponentDeclarations.length > 0) {
    throw new Error(
      `${schema}/${framework}: consumer source declares replacement components: `
      + ownership.consumerComponentDeclarations.join(', '),
    );
  }
}

export const SAVED_SCHEMA_STORE = 'artifacts/product-reality/sprint-183/m04/saved-schema-store';

/**
 * Load a saved-schema record. A derived store (a saved schema with named nodes
 * pruned, carrying its own `derivation` provenance) may stand in for the frozen
 * store when a schema's remaining defects are composer-authored; every cell then
 * reports the derivation so no derived proof reads as the saved schema's.
 */
function savedSchema(name: S184M06SchemaName, store: string = SAVED_SCHEMA_STORE): SavedSchemaRecord {
  const filePath = path.join(REPOSITORY_ROOT, store, `${name}.json`);
  const record = JSON.parse(fs.readFileSync(filePath, 'utf8')) as SavedSchemaRecord;
  if (record.name !== name || typeof record.schemaRef !== 'string' || !record.schema) {
    throw new Error(`${name}: immutable saved-schema record has an invalid identity.`);
  }
  if (store !== SAVED_SCHEMA_STORE && !record.derivation) {
    throw new Error(`${name}: a record outside the saved store must carry derivation provenance.`);
  }
  return record;
}

async function mkdirAbsent(directory: string): Promise<void> {
  await fsp.mkdir(path.dirname(directory), { recursive: true });
  try {
    await fsp.mkdir(directory);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
      throw new Error(`Refusing to overwrite evidence directory: ${directory}`);
    }
    throw error;
  }
}

function assertSchemaSelection(names: readonly S184M06SchemaName[]): void {
  const available = new Set<string>([...SCHEMA_NAMES, ...S185_SCHEMA_NAMES, ...S186_SCHEMA_NAMES]);
  if (names.length === 0 || new Set(names).size !== names.length || names.some((name) => !available.has(name))) {
    throw new Error('Select distinct immutable schemas from the supported saved-schema corpus.');
  }
}

/** Only public object/context operands are accepted; the composer output is never patched. */
export async function composeFreshInputs(inputs: readonly FreshCompositionInput[]): Promise<SavedSchemaRecord[]> {
  const objects = new Set((await objectList({})).objects.map((entry) => entry.name));
  const contexts = ['detail', 'list', 'form', 'timeline', 'card', 'inline'];
  const identities = inputs.map(({ object, context }) => `${object}/${context}`);
  if (!inputs.length || new Set(identities).size !== inputs.length
    || inputs.some((input) => Object.keys(input).sort().join(',') !== 'context,object'
      || !objects.has(input.object) || !contexts.includes(input.context))) {
    throw new Error('Fresh inputs require distinct public {object, context} operands without overrides.');
  }
  const identity = commandResult('git', ['rev-parse', 'HEAD'], REPOSITORY_ROOT);
  requireGreen(identity, 'fresh source identity');
  const sourceHead = identity.stdout.trim();
  const sourceDiff = commandResult('git', ['diff', 'HEAD', '--', 'packages', 'scripts'], REPOSITORY_ROOT).stdout;
  const records = [];
  for (const input of inputs) {
    const composed = await designCompose(input);
    if (composed.status !== 'ok' || !composed.schema) throw new Error(`Fresh composition failed: ${JSON.stringify({ input, composed })}`);
    const schemaSha256 = sha256Urn(canonicalJson(composed.schema));
    records.push({
      name: `fresh-${input.object}-${input.context}` as S184M06SchemaName,
      schemaRef: schemaSha256, schema: composed.schema,
      composition: { handler: 'design.compose', input, sourceHead, sourceDiffSha256: sha256Urn(sourceDiff), sourceDiffPath: 'live-generation/source.diff', schemaSha256, composedAt: new Date().toISOString() },
    });
  }
  return records;
}

export async function runLiveGenerationOnly({
  artifactRoot,
  generate = codeGenerate,
  schemaNames,
  freshInputs,
  mission = 's184-m06',
  schemaStore = SAVED_SCHEMA_STORE,
}: {
  artifactRoot: string;
  generate?: LiveGenerator;
  schemaNames?: readonly S184M06SchemaName[];
  freshInputs?: readonly FreshCompositionInput[];
  mission?: string;
  schemaStore?: string;
}): Promise<{ report: Record<string, unknown>; cells: LiveGenerationCell[] }> {
  if (!artifactRoot) throw new Error('artifactRoot is required.');
  if (freshInputs && (schemaNames || schemaStore !== SAVED_SCHEMA_STORE)) throw new Error('Fresh inputs and saved-store selection are mutually exclusive.');
  if (!freshInputs) assertSchemaSelection(schemaNames ?? SCHEMA_NAMES);
  await fsp.mkdir(artifactRoot, { recursive: true });
  const outputRoot = path.join(artifactRoot, 'live-generation');
  await mkdirAbsent(outputRoot);
  const cells: LiveGenerationCell[] = [];

  const records = freshInputs ? await composeFreshInputs(freshInputs)
    : (schemaNames ?? SCHEMA_NAMES).map((name) => savedSchema(name, schemaStore));
  if (freshInputs) {
    const diff = commandResult('git', ['diff', 'HEAD', '--', 'packages', 'scripts'], REPOSITORY_ROOT);
    requireGreen(diff, 'fresh source diff');
    if (records.some((record) => record.composition?.sourceDiffSha256 !== sha256Urn(diff.stdout))) {
      throw new Error('Source changed during fresh composition.');
    }
    await fsp.writeFile(path.join(outputRoot, 'source.diff'), diff.stdout);
  }
  for (const record of records) {
    const schemaName = record.name;
    const composition = record.composition;
    if (composition) await writeJson(path.join(outputRoot, schemaName, 'composition.json'), record);
    for (const framework of FRAMEWORKS) {
      const startedAt = new Date().toISOString();
      const result = await generate({
        framework,
        profile: 'build',
        schema: record.schema,
        options: { styling: 'tokens', typescript: true },
      });
      const { artifact, source } = validateArtifact(result, schemaName, framework);
      const file = generatedFile(artifact);
      const cellRoot = path.join(outputRoot, schemaName, framework);
      await fsp.mkdir(cellRoot, { recursive: true });
      const sourceFileName = path.basename(file.path);
      const sourcePath = toPosix(path.join(
        'live-generation', schemaName, framework, sourceFileName,
      ));
      const generationLog = toPosix(path.join(
        'live-generation', schemaName, framework, 'generation.log',
      ));
      await fsp.writeFile(path.join(cellRoot, sourceFileName), source);
      await writeJson(path.join(cellRoot, 'artifact.json'), artifact);
      const fingerprint = {
        handler: 'code.generate' as const,
        invocation: 'live-in-process' as const,
        profile: 'build' as const,
        sourceOfArtifact: 'current-in-run-output' as const,
        artifactContentHash: artifact.contentHash,
        generatedAt: startedAt,
      };
      const interaction = deriveInteraction(record.schema, artifact.actions);
      const model = deriveConsumerModel(record.schema, composition ? {} : MODEL);
      const ownership = sourceOwnership(source, file.path, artifact.actions, {}, interaction, record.schema);
      assertGeneratedOwnership(ownership, schemaName, framework);
      await writeLog(path.join(artifactRoot, generationLog), [
        'handler=code.generate',
        'invocation=live-in-process',
        'profile=build',
        `schema=${schemaName}`,
        `schemaRef=${record.schemaRef}`,
        `framework=${framework}`,
        `status=${result.status}`,
        `codeBytes=${Buffer.byteLength(source)}`,
        `sourceSha256=${sha256Urn(source)}`,
        `artifactContentHash=${artifact.contentHash}`,
        `bindingMarkerCount=${ownership.bindingMarkerCount}`,
        `actionCount=${artifact.actions.length}`,
        `validationChecks=${result.validationReceipt.checks.join(',')}`,
      ].join('\n'));
      cells.push({
        mission,
        schema: schemaName,
        schemaRef: record.schemaRef,
        sourceSchema: record.schema,
        ...(composition ? { composition } : {}),
        ...(record.derivation ? { derivation: record.derivation } : {}),
        framework,
        status: 'passed',
        artifact,
        source,
        sourcePath,
        sourceSha256: sha256Urn(source),
        generationLog,
        generationFingerprint: fingerprint,
        sourceOwnership: ownership,
        interaction,
        model,
      });
    }
  }

  const publicCells = cells.map(({ artifact: _artifact, source: _source, sourceSchema: _schema, ...cell }) => cell);
  const report = {
    schemaVersion: '1.0.0',
    mission,
    schemaStore: freshInputs ? null : schemaStore,
    ...(freshInputs ? { freshInputs } : {}),
    kind: 'live-code-generate-fingerprint',
    status: 'passed',
    handler: 'code.generate',
    sourcePolicy: 'Every source and artifact fingerprint comes from this invocation; no committed generated artifact is read.',
    cellCount: publicCells.length,
    cells: publicCells,
  };
  await writeJson(path.join(outputRoot, 'report.json'), report);
  return { report, cells };
}

function consumerDataSource(framework: S184M06Framework, source: string, model: Record<string, unknown>): string {
  const hasPageProps = framework === 'react' && source.includes('export interface PageProps {');
  const typePreamble = hasPageProps
    ? "import type { PageProps } from './GeneratedUI.js';\n\n"
    : '';
  const typeAnnotation = hasPageProps ? ": Omit<PageProps, 'actions'>" : '';
  return `${typePreamble}export const model${typeAnnotation} = ${JSON.stringify(model, null, 2)};\n`;
}

function actionObjectSource(
  actions: GeneratedArtifactAction[],
  mode: 'browser' | 'server',
  framework: S184M06Framework,
): string {
  const typePrefix = framework === 'react' && actions.length > 0 ? ': GeneratedUIActions' : '';
  const rows = actions.map((action) => {
    if (mode === 'server') return `  ${action.name}: (..._args: unknown[]) => undefined,`;
    return [
      `  ${action.name}: (...args: unknown[]) => {`,
      `    window.__OODS_ACTION_COUNTS__.${action.name} += 1;`,
      `    window.__OODS_ACTION_ARGS__.${action.name}.push(args);`,
      '  },',
    ].join('\n');
  });
  return `const actions${typePrefix} = Object.freeze({\n${rows.join('\n')}\n});`;
}

export function createConsumerFiles({
  framework,
  source,
  actions,
  schemaName,
  schemaStore = SAVED_SCHEMA_STORE,
  model = deriveConsumerModel(savedSchema(schemaName, schemaStore).schema, MODEL),
  mission = 's184-m06',
}: {
  framework: S184M06Framework;
  source: string;
  actions: GeneratedArtifactAction[];
  schemaName: S184M06SchemaName;
  schemaStore?: string;
  model?: Record<string, unknown>;
  mission?: string;
}): Record<string, string> {
  const actionCounts = Object.fromEntries(actions.map(({ name }) => [name, 0]));
  const actionArgs = Object.fromEntries(actions.map(({ name }) => [name, []]));
  const title = `${mission} ${schemaName} ${framework} live consumer`;
  const consumerCss = schemaName.startsWith('fresh-')
    ? CONSUMER_CSS.replace('max-width: 72rem', 'max-width: 112rem') : CONSUMER_CSS;
  const acceptsModel = framework === 'react' ? source.includes('export interface PageProps {') : source.includes('interface Props {');
  const suppliedModel = acceptsModel ? model : {};
  const propsExpression = actions.length > 0 ? '{ ...model, actions }' : '{ ...model }';
  const actionTypeImport = actions.length > 0 ? ', type GeneratedUIActions' : '';
  const windowTypes = `interface Window {\n  __OODS_ACTIONS_FROZEN__?: boolean;\n  __OODS_ACTION_COUNTS__: Record<string, number>;\n  __OODS_ACTION_ARGS__: Record<string, unknown[][]>;\n  __OODS_CAPTURE_FINGERPRINT__: () => unknown;\n  __OODS_SSR_FINGERPRINT__: unknown;\n  __OODS_SSR_ROOT_NODE__: Element | null;\n  __OODS_SSR_ACTION_NODE__: Element | null;\n}\n`;
  if (framework === 'react') {
    return {
      'src/GeneratedUI.tsx': source,
      'src/consumer-data.ts': consumerDataSource(framework, source, suppliedModel),
      'src/main.tsx': `
import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { GeneratedUI${actionTypeImport} } from './GeneratedUI.js';
import { model } from './consumer-data.js';
import './consumer.css';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app hydration root.');
window.__OODS_ACTION_COUNTS__ = ${JSON.stringify(actionCounts)};
window.__OODS_ACTION_ARGS__ = ${JSON.stringify(actionArgs)};
${actionObjectSource(actions, 'browser', framework)}
window.__OODS_ACTIONS_FROZEN__ = Object.isFrozen(actions);
hydrateRoot(root, React.createElement(GeneratedUI, ${propsExpression}));
`.trimStart(),
      'src/ssr.tsx': `
import React from 'react';
import { renderToString } from 'react-dom/server';
import { GeneratedUI${actionTypeImport} } from './GeneratedUI.js';
import { model } from './consumer-data.js';

${actionObjectSource(actions, 'server', framework)}
const html = renderToString(React.createElement(GeneratedUI, ${propsExpression}));
process.stdout.write(JSON.stringify({ html }));
`.trimStart(),
      'src/consumer.css': consumerCss,
      'src/window.d.ts': windowTypes,
      'index.html': `<!doctype html><html data-brand="A" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body><div id="app"><!--SSR_MARKUP--></div><script>${FINGERPRINT_SCRIPT}</script><script type="module" src="/src/main.tsx"></script></body></html>\n`,
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
          types: ['node', 'vite/client'],
          typeRoots: ['./node_modules/@types', './node_modules'],
        },
        include: ['src'],
      }),
      'vite.config.mjs': "import { defineConfig } from 'vite';\nexport default defineConfig({ css: { postcss: { plugins: [] } }, build: { minify: false, sourcemap: true } });\n",
    };
  }
  return {
    'src/GeneratedUI.vue': source,
    'src/consumer-data.ts': consumerDataSource(framework, source, suppliedModel),
    'src/main.ts': `
import { createSSRApp } from 'vue';
import GeneratedUI from './GeneratedUI.vue';
import { model } from './consumer-data.js';
import './consumer.css';

window.__OODS_ACTION_COUNTS__ = ${JSON.stringify(actionCounts)};
window.__OODS_ACTION_ARGS__ = ${JSON.stringify(actionArgs)};
${actionObjectSource(actions, 'browser', framework)}
window.__OODS_ACTIONS_FROZEN__ = Object.isFrozen(actions);
createSSRApp(GeneratedUI, ${propsExpression}).mount('#app');
`.trimStart(),
    'src/ssr.ts': `
import { renderToString } from '@vue/server-renderer';
import { createSSRApp } from 'vue';
import GeneratedUI from './GeneratedUI.vue';
import { model } from './consumer-data.js';

${actionObjectSource(actions, 'server', framework)}
async function main() {
  const html = await renderToString(createSSRApp(GeneratedUI, ${propsExpression}));
  process.stdout.write(JSON.stringify({ html }));
}
void main();
`.trimStart(),
    'src/consumer.css': consumerCss,
    'src/window.d.ts': `${windowTypes}declare module '*.vue';\n`,
    'index.html': `<!doctype html><html data-brand="A" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body><div id="app"><!--SSR_MARKUP--></div><script>${FINGERPRINT_SCRIPT}</script><script type="module" src="/src/main.ts"></script></body></html>\n`,
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
        typeRoots: ['./node_modules/@types', './node_modules'],
      },
      include: ['src/**/*.ts', 'src/**/*.vue'],
    }),
    'vite.config.mjs': "import { defineConfig } from 'vite';\nimport vue from '@vitejs/plugin-vue';\nexport default defineConfig({ plugins: [vue()], css: { postcss: { plugins: [] } }, build: { minify: false, sourcemap: true } });\n",
  };
}

function findTarball(tarballs: PackedPackageRecord[], packageName: string): PackedPackageRecord {
  const record = tarballs.find((candidate) => candidate.name === packageName);
  if (!record) throw new Error(`Required submitted tarball missing: ${packageName}`);
  return record;
}

function exactVersion(value: string, label: string): string {
  if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(value)) {
    throw new Error(`${label} does not use an exact semantic version: ${value}`);
  }
  return value;
}

async function prepareManifest(
  framework: S184M06Framework,
  artifact: GeneratedArtifact,
  tarballs: PackedPackageRecord[],
  consumerRoot: string,
): Promise<{ manifest: Record<string, unknown>; localTarballs: Array<Record<string, unknown>> }> {
  const localNames = [...LOCAL_CLOSURE, `@oods/components-${framework}`];
  const tarballRoot = path.join(consumerRoot, 'tarballs');
  await fsp.mkdir(tarballRoot);
  const localTarballs = [];
  for (const name of localNames) {
    const record = findTarball(tarballs, name);
    const destination = path.join(tarballRoot, path.basename(record.tarballPath));
    await fsp.copyFile(record.tarballPath, destination);
    const bytes = await fsp.readFile(destination);
    if (sha256(bytes) !== record.sha256) throw new Error(`${name}: copied tarball digest differs.`);
    localTarballs.push({
      name,
      version: exactVersion(record.version, name),
      artifactVersion: artifact.dependencies.find(dependency => dependency.name === name)?.version ?? null,
      installSpec: `file:./tarballs/${path.basename(destination)}`,
      sha256: `sha256:${record.sha256}`,
      bytes: bytes.byteLength,
    });
  }
  const dependencies: Record<string, string> = Object.fromEntries(
    localTarballs.map(({ name, installSpec }) => [name, installSpec]),
  );
  for (const dependency of artifact.dependencies) {
    const version = exactVersion(dependency.version, dependency.name);
    if (dependency.name.startsWith('@oods/')) {
      const packed = findTarball(tarballs, dependency.name);
      // Sprint 233 deliberately preserves 0.6.2 generated bytes while proving them
      // against the exact 0.7.0 libraries; Sprints 235–238 carry those pins into 0.8.0, 0.9.0, 0.10.0 and 0.10.1.
      // Keep both versions in localTarballs;
      // no other mismatch is accepted and the artifact itself is never rewritten.
      const preservedArtifactUpgrade = version === '0.6.2' && ['0.7.0', '0.8.0', '0.9.0', '0.10.0', '0.10.1', '0.10.2', '0.11.0', '0.11.1'].includes(packed.version);
      if (packed.version !== version && !preservedArtifactUpgrade) {
        throw new Error(
          `${dependency.name}: artifact declares ${version} but the submitted tarball is ${packed.version}.`,
        );
      }
      continue;
    }
    dependencies[dependency.name] = version;
  }
  if (framework === 'react') dependencies['@radix-ui/react-slot'] = '1.2.3';
  if (framework === 'vue') dependencies['@vue/server-renderer'] = '3.5.42';
  const devDependencies = { ...VERIFIER_DEPENDENCIES[framework] } as Record<string, string>;
  for (const name of Object.keys(dependencies)) delete devDependencies[name];
  return {
    manifest: {
      name: `oods-s184-m06-${framework}-live-consumer`,
      version: '1.0.0',
      private: true,
      type: 'module',
      dependencies,
      devDependencies,
    },
    localTarballs,
  };
}

function normalizedManifest(manifest: Record<string, unknown>): Record<string, unknown> {
  const result = structuredClone(manifest) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  for (const section of [result.dependencies, result.devDependencies]) {
    for (const [name, value] of Object.entries(section ?? {})) {
      if (value.startsWith('file:')) {
        section![name] = `file:<consumer-tarballs>/${path.basename(value.slice('file:'.length))}`;
      }
    }
  }
  return result as Record<string, unknown>;
}

function isolatedNpmEnvironment(
  consumerRoot: string,
  userConfig: string,
  globalConfig: string,
): NodeJS.ProcessEnv {
  fs.mkdirSync(path.join(consumerRoot, ".home"), { recursive: true });
  return {
    HOME: path.join(consumerRoot, ".home"),
    TMPDIR: consumerRoot,
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

function assertInstalledIsolation(
  consumerRoot: string,
  framework: S184M06Framework,
  localTarballs: Array<Record<string, unknown>>,
  sources: Record<string, string>,
): Record<string, unknown> {
  const realConsumerRoot = fs.realpathSync(consumerRoot);
  const realRepositoryRoot = fs.realpathSync(REPOSITORY_ROOT);
  if (realConsumerRoot === realRepositoryRoot) throw new Error('The checkout root cannot be a clean consumer.');
  const insideRepository = realConsumerRoot.startsWith(`${realRepositoryRoot}${path.sep}`);
  if (Object.values(sources).some((contents) => contents.includes(REPOSITORY_ROOT))) {
    throw new Error(`${framework}: consumer source embeds the repository path.`);
  }
  const installed = localTarballs.map((record) => {
    const name = String(record.name);
    const packageRoot = path.join(consumerRoot, 'node_modules', ...name.split('/'));
    if (fs.lstatSync(packageRoot).isSymbolicLink()) {
      throw new Error(`${framework}: ${name} is a workspace symlink.`);
    }
    const resolved = fs.realpathSync(packageRoot);
    if (!resolved.startsWith(`${realConsumerRoot}${path.sep}`)) {
      throw new Error(`${framework}: ${name} resolves outside the clean consumer.`);
    }
    const installedManifest = JSON.parse(fs.readFileSync(path.join(resolved, 'package.json'), 'utf8')) as {
      name: string;
      version: string;
    };
    if (installedManifest.name !== name || installedManifest.version !== record.version) {
      throw new Error(`${framework}: ${name} installed identity differs from its exact tarball.`);
    }
    return {
      name,
      version: installedManifest.version,
      consumerRelative: toPosix(path.relative(realConsumerRoot, resolved)),
    };
  });
  // Prove the sandbox boundary instead of equating a path outside the checkout with isolation.
  const peer = path.join(consumerRoot, 'node_modules', framework);
  const held = peer + '.s218-held';
  const probe = () => commandResult(process.execPath, ['--input-type=module', '-e', `import {createRequire} from 'node:module'; console.log(createRequire(process.cwd() + '/package.json').resolve('${framework}'));`], consumerRoot, { isolateDependencies: true });
  const positive = probe(); requireGreen(positive, 'installed framework peer');
  if (!positive.stdout.trim().startsWith(realConsumerRoot + path.sep)) throw new Error('Framework peer resolves outside consumer');
  fs.renameSync(peer, held);
  let negative: CommandResult;
  try { negative = probe(); } finally { fs.renameSync(held, peer); }
  if (negative.exitCode === 0 || !/MODULE_NOT_FOUND|Cannot find module/.test(negative.stderr)) throw new Error('Missing framework peer was not refused');
  return {
    outsidePnpmWorkspace: !insideRepository,
    freshNodeModules: true,
    emptyVerifierOwnedNpmConfiguration: true,
    installScripts: false,
    localPackagesFromBuiltTarballsOnly: true,
    workspaceAliases: false,
    workspaceSymlinks: false,
    repositorySourceImports: false,
    inheritedNodeModules: false,
    allResolvedPathsOutsideRepository: !insideRepository,
    allResolvedPathsInsideConsumer: true,
    ancestorLookupDenied: true,
    missingPeer: { package: framework, positive: positive.exitCode, negative: negative.exitCode, restored: true },
    installed,
  };
}

function resolveImports(
  consumerRoot: string,
  files: Record<string, string>,
): Array<{ specifier: string; consumerRelative: string }> {
  const specifiers = [...new Set(
    Object.values(files).flatMap((contents) => extractBareImports(contents)),
  )].sort(compareCodePoint);
  const anchor = path.join(consumerRoot, 'resolve.mjs');
  const resolver = [
    "import path from 'node:path';",
    "import { realpathSync } from 'node:fs';",
    "import { fileURLToPath } from 'node:url';",
    `const root = realpathSync(${JSON.stringify(consumerRoot)});`,
    `const specifiers = ${JSON.stringify(specifiers)};`,
    'const rows = specifiers.map((specifier) => {',
    '  const resolved = realpathSync(fileURLToPath(import.meta.resolve(specifier)));',
    '  const relative = path.relative(root, resolved);',
    "  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`${specifier} resolved outside consumer: ${resolved}`);",
    "  return { specifier, consumerRelative: relative.split(path.sep).join('/') };",
    '});',
    'process.stdout.write(JSON.stringify(rows));',
    '',
  ].join('\n');
  fs.writeFileSync(anchor, resolver);
  const result = commandResult('node', [anchor], consumerRoot, { scrubNpmCredentials: true, isolateDependencies: true });
  requireGreen(result, 'resolve clean-consumer imports');
  return JSON.parse(result.stdout) as Array<{ specifier: string; consumerRelative: string }>;
}

async function directoryDigest(directory: string): Promise<Record<string, unknown>> {
  const entries: Array<Record<string, unknown>> = [];
  async function visit(current: string, prefix = ''): Promise<void> {
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
  return { files: entries, contentHash: sha256Urn(canonicalize(entries)) };
}

function mimeType(filePath: string): string {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.map')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

async function withStaticServer<T>(directory: string, callback: (url: string) => Promise<T>): Promise<T> {
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
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Unable to resolve static server address.');
  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      // Proof work is finished; forwarded browser connections may still hold
      // an incomplete request open. Stop accepting first, then release them.
      server.closeAllConnections();
    });
  }
}

// A remote Linux browser can exercise native select arrow keys on macOS hosts.
// Playwright's loopback forwarding keeps temporary consumer servers local.
export async function launchProofBrowser() {
  const { chromium } = await import('playwright');
  return process.env.OODS_PLAYWRIGHT_WS_ENDPOINT
    ? chromium.connect(process.env.OODS_PLAYWRIGHT_WS_ENDPOINT, { exposeNetwork: '<loopback>' })
    : chromium.launch({ headless: true });
}

async function browserProof({
  framework,
  schemaName,
  rootId,
  distRoot,
  actions,
  expectedComponents,
  interaction,
  boundFieldProbe,
  valueProbes = [],
  sharedNativeFields = [],
  cancellationFormIds = [],
  viewport = { width: 1280, height: 800 },
  mountObligations,
  collectionControls = {},
  disabledActions = [],
  screenshotPath,
}: {
  framework: S184M06Framework;
  schemaName: S184M06SchemaName;
  rootId: string;
  distRoot: string;
  actions: GeneratedArtifactAction[];
  expectedComponents: string[];
  interaction: ConsumerInteraction;
  boundFieldProbe: BoundFieldProbe | null;
  valueProbes?: ValueProbe[];
  sharedNativeFields?: SharedNativeFieldProbe[];
  cancellationFormIds?: string[];
  viewport?: { width: number; height: number };
  disabledActions?: string[];
  mountObligations: MountObligation[];
  collectionControls?: Record<string, CollectionActionControl>;
  screenshotPath?: string;
}): Promise<Record<string, unknown>> {
  const browser = await launchProofBrowser();
  try {
    return await withStaticServer(distRoot, async (url) => {
      const page = await browser.newPage({ viewport });
      const runtimeErrors: string[] = [];
      page.on('pageerror', (error) => runtimeErrors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') runtimeErrors.push(message.text());
      });
      await page.goto(url, { waitUntil: 'networkidle' });
      const rootCount = await page.locator(`#${rootId}`).count();
      if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
      const requiredMounts = observeMountObligations(mountObligations, await page.locator('#app').innerHTML());
      const componentCounts = await page.evaluate((ids) => Object.fromEntries(
        ids.map((id) => [id, document.querySelectorAll(`[data-oods-component="${id}"]`).length]),
      ), expectedComponents);
      const hydrationInvariant = await page.evaluate(() => {
        const proofWindow = window as unknown as Window & {
          __OODS_SSR_FINGERPRINT__: unknown;
          __OODS_CAPTURE_FINGERPRINT__: () => unknown;
        };
        const before = proofWindow.__OODS_SSR_FINGERPRINT__;
        const after = proofWindow.__OODS_CAPTURE_FINGERPRINT__();
        return { before, after, equal: JSON.stringify(before) === JSON.stringify(after) };
      });
      const attachment = await page.evaluate(inspectFrameworkAttachment, framework);
      const reusedServerNodes = await page.evaluate(() => {
        const proofWindow = window as unknown as Window & {
          __OODS_SSR_ROOT_NODE__: Element | null;
          __OODS_SSR_ACTION_NODE__: Element | null;
          __OODS_SSR_NODES__: Element[];
        };
        return {
          root: proofWindow.__OODS_SSR_ROOT_NODE__ === document.querySelector('#app > [data-oods-component]'),
          action: proofWindow.__OODS_SSR_ACTION_NODE__ === document.querySelector('[data-oods-screen-actions] button'),
          everyCapturedNode: proofWindow.__OODS_SSR_NODES__.every((node) => document.getElementById('app')!.contains(node)),
        };
      });
      const boundValues = [];
      for (const probe of valueProbes) {
        const owner = page.locator(selectorForNode(probe.nodeId));
        const visible = await owner.isVisible();
        const target = probe.selector ? owner.locator(probe.selector) : owner;
        const actual = probe.kind === 'numeric-input' || probe.kind === 'query-input' || probe.kind === 'native-value' ? await target.inputValue()
          : probe.kind === 'status' ? await owner.locator('[data-timeline-current]').textContent() : await target.textContent();
        boundValues.push({ ...probe, actual, visible, passed: visible && actual?.trim() === probe.expected });
      }
      const interactionEvidence: Record<string, unknown> = { ...interaction, status: 'unproven' };
      let selectedSelector: string | null = interaction.kind === 'none' ? null : interaction.selector;
      let selectorCount = 0;
      let eventHandlerAttached = false;
      try {
        if (interaction.kind === 'tabs') {
          const owner = page.locator(interaction.selector);
          const target = owner.locator('[role="tab"]:not([aria-selected="true"]):not([disabled])').first();
          const before = await owner.locator('[role="tab"][aria-selected="true"]').getAttribute('id');
          const targetId = await target.getAttribute('id');
          const panelId = await target.getAttribute('aria-controls');
          selectedSelector = targetId ? selectorForNode(targetId) : interaction.selector;
          selectorCount = await target.count();
          await target.click();
          const selected = await page.waitForFunction((id) => id !== null
            && document.getElementById(id)?.getAttribute('aria-selected') === 'true', targetId, { timeout: 2_000 })
            .then(() => true, () => false);
          const panelVisible = !!panelId && await page.locator(selectorForNode(panelId)).isVisible();
          const selectedCount = await owner.locator('[role="tab"][aria-selected="true"]').count();
          eventHandlerAttached = selected && before !== targetId && panelVisible && selectedCount === 1;
          Object.assign(interactionEvidence, { before, after: targetId, panelId, panelVisible, selectedCount });
        } else if (interaction.kind === 'action') {
          const control = page.locator(interaction.selector).first();
          selectorCount = await control.count();
          await control.click();
          eventHandlerAttached = await page.waitForFunction((name) => (
            (window as unknown as { __OODS_ACTION_COUNTS__: Record<string, number> }).__OODS_ACTION_COUNTS__[name] === 1
          ), interaction.action, { timeout: 2_000 }).then(() => true, () => false);
        } else if (interaction.kind === 'field') {
          const control = page.locator(interaction.selector);
          selectorCount = await control.count();
          const before = await control.inputValue();
          const value = interaction.inputType === 'number' ? '7'
            : interaction.inputType === 'date' ? '2026-10-02' : 'Consumer interaction proof';
          if (interaction.component === 'Checkbox') {
            const checked = await control.isChecked();
            await control.setChecked(!checked);
            eventHandlerAttached = await control.isChecked() !== checked;
          } else if (interaction.component === 'Select') {
            const choices = await control.locator('option:not([disabled])').evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
            const next = choices.find((choice) => choice !== before);
            if (next === undefined) throw new Error('No distinct enabled select choice.');
            await control.selectOption(next);
            eventHandlerAttached = await control.inputValue() === next;
          } else {
            await control.fill(value);
            eventHandlerAttached = await control.inputValue() === value && value !== before;
            if (interaction.component === 'SearchInput') {
              const owner = control.locator('xpath=ancestor::*[@data-oods-component="SearchInput"][1]');
              const clearVisible = await owner.locator('button[aria-label="Clear search"]').isVisible();
              await control.press('Escape');
              const cleared = await control.inputValue() === '';
              eventHandlerAttached = eventHandlerAttached && clearVisible && cleared;
              Object.assign(interactionEvidence, { clearVisible, cleared });
            }
          }
          Object.assign(interactionEvidence, {
            before, attemptedValue: value, after: await control.inputValue(),
            scope: 'native/component control state only; no generated application filtering or domain state is asserted',
          });
        } else {
          const disabledControls = [];
          for (const nodeId of interaction.disabledPaginationNodeIds) {
            const owner = page.locator(selectorForNode(nodeId));
            const buttons = owner.locator('button');
            const count = await buttons.count();
            const before = await owner.textContent();
            const observations = [];
            for (let index = 0; index < count; index += 1) {
              const button = buttons.nth(index);
              observations.push({ visible: await button.isVisible(), disabled: await button.isDisabled() });
              await button.evaluate((element) => (element as HTMLButtonElement).click());
            }
            const unchanged = before === await owner.textContent();
            const passed = count === 2 && observations.every((entry) => entry.visible && entry.disabled) && unchanged;
            disabledControls.push({ nodeId, count, observations, unchanged, passed });
          }
          Object.assign(interactionEvidence, { disabledControls });
          if (disabledControls.some(({ passed }) => !passed)) throw new Error('Declared empty pagination controls were not visible, disabled, and inert.');
          interactionEvidence.status = 'not-applicable';
        }
        const cancellationControls = [];
        for (const nodeId of cancellationFormIds) {
          const form = page.locator(selectorForNode(nodeId));
          const reason = form.locator('textarea[name="reason"]');
          const code = form.locator('select[name="reasonCode"]');
          const before = { reason: await reason.inputValue(), code: await code.inputValue() };
          const choices = await code.locator('option:not([disabled])').evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
          const next = choices.find((choice) => choice !== before.code);
          if (!next) throw new Error('CancellationForm needs a distinct enabled reason-code choice.');
          await reason.fill('Local cancellation reason');
          await code.selectOption(next);
          const submit = await form.evaluate((element) => {
            const proofWindow = window as unknown as { __OODS_ACTION_COUNTS__: unknown };
            const beforeCounts = JSON.stringify(proofWindow.__OODS_ACTION_COUNTS__);
            const event = new Event('submit', { bubbles: true, cancelable: true });
            element.dispatchEvent(event);
            return { prevented: event.defaultPrevented, actionCountsUnchanged: JSON.stringify(proofWindow.__OODS_ACTION_COUNTS__) === beforeCounts };
          });
          const after = { reason: await reason.inputValue(), code: await code.inputValue() };
          const passed = after.reason === 'Local cancellation reason' && after.code === next && submit.prevented && submit.actionCountsUnchanged;
          cancellationControls.push({ nodeId, before, after, ...submit, passed });
        }
        if (cancellationControls.length) {
          Object.assign(interactionEvidence, { cancellationControls, cancellationScope: 'local native controls and prevented submission only; no cancellation, save or persistence action' });
          eventHandlerAttached = eventHandlerAttached && cancellationControls.every(({ passed }) => passed);
        }
        const numericUpdates = [];
        for (const probe of valueProbes.filter((entry) => entry.kind === 'numeric-input' && entry.editable)) {
          const control = page.locator(selectorForNode(probe.nodeId));
          const values = [];
          for (const next of ['7', '0']) {
            await control.fill(next);
            await control.blur();
            values.push({ expected: next, actual: await control.inputValue() });
          }
          numericUpdates.push({ nodeId: probe.nodeId, values, passed: values.every(({ expected, actual }) => expected === actual) });
        }
        if (numericUpdates.length) {
          Object.assign(interactionEvidence, { numericUpdates, numericScope: 'generated local numeric editor state; no application filtering is claimed' });
          eventHandlerAttached = eventHandlerAttached && numericUpdates.every(({ passed }) => passed);
        }
        const billingControls = [];
        for (const probe of valueProbes.filter((entry) => entry.kind === 'native-value' && entry.editable)) {
          const control = page.locator(selectorForNode(probe.nodeId));
          if (probe.options) {
            const options = await control.locator('option:not([disabled])').evaluateAll((items) => items.map((item) => (item as HTMLOptionElement).value));
            await control.focus(); await control.press('Home'); await control.press('ArrowDown');
            const selected = await control.inputValue();
            billingControls.push({ nodeId: probe.nodeId, kind: 'interval-keyboard', options, expectedOptions: probe.options, selected, expectedSelected: probe.options[1], passed: JSON.stringify(options) === JSON.stringify(probe.options) && selected === probe.options[1] });
          } else if (await control.getAttribute('data-billing-minor-units')) {
            await control.fill('19.99');
            const amount = await control.inputValue();
            await control.fill('-1');
            const invalid = await control.getAttribute('aria-invalid');
            const described = await control.getAttribute('aria-describedby');
            const errorId = (described ?? '').split(' ').find((id) => id.endsWith('-error'));
            const message = errorId ? await page.locator(selectorForNode(errorId)).innerText() : '';
            await control.fill(''); const blank = await control.inputValue();
            await control.fill('0'); const zero = await control.inputValue();
            billingControls.push({ nodeId: probe.nodeId, kind: 'amount-validation', amount, invalid, message, blank, zero, passed: amount === '19.99' && invalid === 'true' && message === 'Enter a non-negative amount.' && blank === '' && zero === '0' });
          }
        }
        if (billingControls.length) {
          Object.assign(interactionEvidence, { billingControls });
          eventHandlerAttached = eventHandlerAttached && billingControls.every(({ passed }) => passed);
        }
        const sharedNativeUpdates = [];
        for (const probe of sharedNativeFields) {
          const input = page.locator(selectorForNode(probe.inputId));
          const owner = page.locator(selectorForNode(probe.selectId));
          const select = probe.selectContainer ? owner.locator('select') : owner;
          const choices = await select.locator('option:not([disabled])').evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
          if (choices.length < 2) throw new Error(`Shared field ${probe.field} needs two real choices for its two-writer proof.`);
          await input.fill(choices[0]!);
          const inputToSelect = await page.waitForFunction(({ selectId, selectContainer, expected }) => {
            const owner = document.getElementById(selectId);
            const control = selectContainer ? owner?.querySelector('select') : owner;
            return (control as HTMLSelectElement)?.value === expected;
          }, { selectId: probe.selectId, selectContainer: probe.selectContainer, expected: choices[0]! }, { timeout: 2_000 }).then(() => true, () => false);
          await select.selectOption(choices[1]!);
          const passed = await page.waitForFunction(({ inputId, expected }) =>
            (document.getElementById(inputId) as HTMLInputElement)?.value === expected,
          { inputId: probe.inputId, expected: choices[1]! }, { timeout: 2_000 }).then(() => true, () => false);
          sharedNativeUpdates.push({ ...probe, choices: choices.slice(0, 2), input: await input.inputValue(), select: await select.inputValue(), inputToSelect, selectToInput: passed, passed: inputToSelect && passed });
        }
        if (sharedNativeUpdates.length) {
          Object.assign(interactionEvidence, { sharedNativeUpdates, sharedNativeScope: 'two native writers of generated local field state; no persistence is claimed' });
          eventHandlerAttached = eventHandlerAttached && sharedNativeUpdates.every(({ passed }) => passed);
        }
        if (boundFieldProbe) {
          const control = page.locator(selectorForNode(boundFieldProbe.writerId));
          const heading = page.locator(selectorForNode(boundFieldProbe.readerId)).locator('h1,h2,h3,h4,h5,h6');
          const before = { value: await control.inputValue(), heading: await heading.textContent() };
          const next = 'Consumer updated bound field';
          await control.fill(next);
          const stateUpdated = await page.waitForFunction(({ readerId, expected }) =>
            document.getElementById(readerId)?.querySelector('h1,h2,h3,h4,h5,h6')?.textContent === expected,
          { readerId: boundFieldProbe.readerId, expected: next }, { timeout: 2_000 }).then(() => true, () => false);
          const after = { value: await control.inputValue(), heading: await heading.textContent() };
          const passed = stateUpdated && after.value === next && before.heading !== after.heading;
          Object.assign(interactionEvidence, { boundField: { ...boundFieldProbe, before, after, passed, scope: 'generated local writer state observed by the bound real heading' } });
          eventHandlerAttached = eventHandlerAttached && passed;
        }
        if (interaction.kind !== 'none') interactionEvidence.status = eventHandlerAttached ? 'passed' : 'failed';
      } catch (error) {
        interactionEvidence.status = 'failed';
        interactionEvidence.reason = error instanceof Error ? error.message : String(error);
      }
      await page.evaluate(() => {
        const proofWindow = window as unknown as Window & {
          __OODS_ACTION_COUNTS__: Record<string, number>;
          __OODS_ACTION_ARGS__: Record<string, unknown[][]>;
        };
        for (const name of Object.keys(proofWindow.__OODS_ACTION_COUNTS__)) {
          proofWindow.__OODS_ACTION_COUNTS__[name] = 0;
          proofWindow.__OODS_ACTION_ARGS__[name] = [];
        }
      });
      const hydrated = attachment.attached && reusedServerNodes.root && reusedServerNodes.everyCapturedNode
        && (interaction.kind === 'none' || eventHandlerAttached);
      const hydrationProbe = {
        selector: selectedSelector, selectorCount, eventHandlerAttached, reusedServerNodes, attachment,
      };
      const selectorEvidence = [];
      for (const action of actions) {
        const control = collectionControls[action.name];
        const selector = control?.selector ?? selectorFor(action.name);
        const owner = page.locator(selector);
        const count = await owner.count();
        // s221-m01: a screen action that needs the application's input renders disabled and says so (isDisabledScreenAction);
        // it is proven disabled, not clicked.
        if (disabledActions.includes(action.name)) {
          const disabled = count > 0 && await owner.first().isDisabled();
          const title = count > 0 ? await owner.first().getAttribute('title') : null;
          selectorEvidence.push({ action: action.name, selector, count, clicked: false, disabled, title, mode: 'disabled' });
          continue;
        }
        // A screen surface button or a Button is clicked. An editor that owns
        // its action (AddressEditor.onChange) fires from input, so the consumer
        // types into its first text input and the editor emits its record.
        const mode = count > 0 && await owner.first().evaluate((element) => (
          element.tagName !== 'BUTTON' && element.querySelector('input[type="text"]') !== null
        )) ? 'typed' : 'clicked';
        if (count > 0 && control?.operation === 'type') await owner.first().fill(control.value!);
        else if (count > 0 && control?.operation === 'select') await owner.first().selectOption(control.value!);
        else if (count > 0 && mode === 'typed') await owner.first().locator('input[type="text"]').first().fill(EDITOR_TYPED_TEXT);
        else if (count > 0) await owner.first().click();
        selectorEvidence.push({ action: action.name, selector, count, clicked: count > 0, mode });
      }
      await page.waitForTimeout(25);
      const actionCounts = await page.evaluate(() => ({
        ...(window as unknown as Window & { __OODS_ACTION_COUNTS__: Record<string, number> }).__OODS_ACTION_COUNTS__,
      }));
      const actionArgs = await page.evaluate(() => structuredClone(
        (window as unknown as Window & { __OODS_ACTION_ARGS__: Record<string, unknown[][]> }).__OODS_ACTION_ARGS__,
      ));
      const actionsFrozen = await page.evaluate(() => (
        (window as Window & { __OODS_ACTIONS_FROZEN__?: boolean }).__OODS_ACTIONS_FROZEN__ === true
      ));
      const labelVisibility = await page.evaluate(() => {
        const selectors: Record<string, string> = {
          DetailHeader: 'h1,h2,h3,h4,h5,h6', CardHeader: 'h1,h2,h3,h4,h5,h6',
          ColorSwatch: '[data-oods-swatch-label]', ColorizedBadge: '[data-oods-badge-label]',
        };
        return Object.entries(selectors).flatMap(([component, selector]) =>
          Array.from(document.querySelectorAll(`[data-oods-component="${component}"]`)).map((root) => {
            const label = root.querySelector<HTMLElement>(selector);
            const text = label?.textContent?.trim() ?? '';
            const style = label ? getComputedStyle(label) : null;
            const bounds = label?.getBoundingClientRect();
            const visible = !!label && !!bounds && bounds.width > 0 && bounds.height > 0
              && style?.display !== 'none' && style?.visibility !== 'hidden' && style?.opacity !== '0'
              && label.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
            return { component, rootId: root.id, text, visible, passed: text.length > 0 && visible };
          }));
      });
      const css = await page.evaluate(() => ({
        primaryTextToken: getComputedStyle(document.documentElement).getPropertyValue('--sys-text-primary').trim() || null,
        canvasToken: getComputedStyle(document.documentElement).getPropertyValue('--sys-surface-canvas').trim() || null,
      }));
      await page.close();
      return {
        framework,
        schema: schemaName,
        ...(screenshotPath ? { screenshot: { file: path.basename(screenshotPath), sha256: sha256Urn(await fsp.readFile(screenshotPath)) } } : {}),
        boundValues,
        viewport,
        mount: rootCount === 1 ? 'passed' : 'failed',
        rootId,
        rootCount,
        hydration: hydrated ? 'passed' : 'failed',
        hydrationProbe,
        hydrationInvariant,
        interactionEvidence,
        labelVisibility,
        runtimeErrors,
        componentCounts,
        requiredMounts,
        selectorEvidence,
        actionCounts,
        actionArgs,
        actionsFrozen,
        css,
      };
    });
  } finally {
    await browser.close();
  }
}

async function injectSsrMarkup(distRoot: string, html: string): Promise<void> {
  const indexPath = path.join(distRoot, 'index.html');
  const contents = await fsp.readFile(indexPath, 'utf8');
  if (!contents.includes('<!--SSR_MARKUP-->')) throw new Error('Production index lost SSR marker.');
  await fsp.writeFile(indexPath, contents.replace('<!--SSR_MARKUP-->', html));
}

async function cssProof(distRoot: string, requiresPorted: boolean): Promise<Record<string, unknown>> {
  const assetRoot = path.join(distRoot, 'assets');
  const files = (await fsp.readdir(assetRoot)).filter((name) => name.endsWith('.css')).sort(compareCodePoint);
  if (files.length === 0) throw new Error('Production build emitted no CSS asset.');
  const contents = (await Promise.all(files.map((name) => fsp.readFile(path.join(assetRoot, name), 'utf8')))).join('\n');
  const core = contents.includes('data-oods-component') && contents.includes('Stack');
  const ported = HISTORICAL_PORTED_COMPONENT_IDS.some((name) => contents.includes(name));
  const tokens = contents.includes('--sys-text-primary');
  if (!core || (requiresPorted && !ported) || !tokens) {
    throw new Error(`Production CSS closure is incomplete: ${JSON.stringify({ core, ported, tokens })}`);
  }
  return { files, bytes: Buffer.byteLength(contents), sha256: sha256Urn(contents), core, ported, requiresPorted, tokens };
}

function gateRows(logPrefix: string): GateRow[] {
  const logMap: Record<S184M06GateName, string[]> = {
    'fresh-exact-tarball-install': [`${logPrefix}/install.log`, `${logPrefix}/isolation.log`],
    'strict-typecheck': [`${logPrefix}/typecheck.log`],
    'production-build': [`${logPrefix}/production-build.log`],
    'server-render': [`${logPrefix}/server-render-build.log`, `${logPrefix}/server-render-render.log`],
    mount: [`${logPrefix}/browser-proof.log`],
    hydration: [`${logPrefix}/browser-proof.log`],
    'shared-css-resolution': [`${logPrefix}/css-proof.log`, `${logPrefix}/browser-proof.log`],
    'interaction-evidence': [`${logPrefix}/browser-proof.log`, `${logPrefix}/source-ownership.log`],
  };
  return GATE_NAMES.map((name) => ({
    name,
    status: 'unproven',
    logs: logMap[name],
    reason: 'Gate has not run.',
  }));
}

function passGate(rows: GateRow[], name: S184M06GateName, detail?: Record<string, unknown>): void {
  const row = rows.find((candidate) => candidate.name === name)!;
  row.status = 'passed';
  delete row.reason;
  if (detail) row.detail = detail;
}

function failGate(rows: GateRow[], name: S184M06GateName, reason: string): void {
  const row = rows.find((candidate) => candidate.name === name)!;
  row.status = 'failed';
  row.reason = reason;
}

function accounting(rows: GateRow[]): Record<string, unknown> {
  return summarizeGateAccounting(rows);
}

function replacementCount(source: string, needle: string): number {
  if (needle.length === 0) return 0;
  return source.split(needle).length - 1;
}

async function mutateExistingFile({
  consumerRoot,
  recorder,
  relativePath,
  needle,
  replacement,
  operation,
  exactCount = 1,
}: {
  consumerRoot: string;
  recorder: AppliedMutation;
  relativePath: string;
  needle: string;
  replacement: string;
  operation: string;
  exactCount?: number | null;
}): Promise<void> {
  const absolutePath = path.join(consumerRoot, relativePath);
  const before = await fsp.readFile(absolutePath, 'utf8');
  const count = replacementCount(before, needle);
  if (exactCount === null ? count < 1 : count !== exactCount) {
    throw new Error(
      `${recorder.id}: ${relativePath} mutation matched ${count} occurrences; `
      + `expected ${exactCount === null ? 'at least 1' : exactCount}.`,
    );
  }
  const after = before.split(needle).join(replacement);
  await fsp.writeFile(absolutePath, after);
  recorder.operations.push({
    target: relativePath,
    operation,
    replacementCount: count,
    beforeSha256: sha256Urn(before),
    afterSha256: sha256Urn(after),
  });
}

async function createMutationFile({
  consumerRoot,
  recorder,
  relativePath,
  contents,
  operation,
}: {
  consumerRoot: string;
  recorder: AppliedMutation;
  relativePath: string;
  contents: string;
  operation: string;
}): Promise<void> {
  const absolutePath = path.join(consumerRoot, relativePath);
  if (fs.existsSync(absolutePath)) throw new Error(`${recorder.id}: ${relativePath} already exists.`);
  await fsp.mkdir(path.dirname(absolutePath), { recursive: true });
  await fsp.writeFile(absolutePath, contents);
  recorder.operations.push({
    target: relativePath,
    operation,
    replacementCount: 1,
    beforeSha256: null,
    afterSha256: sha256Urn(contents),
  });
}

async function firstBuiltAsset(
  consumerRoot: string,
  extension: '.js' | '.css',
  needle: string,
): Promise<string> {
  const assetRoot = path.join(consumerRoot, 'dist/assets');
  const candidates = (await fsp.readdir(assetRoot))
    .filter((name) => name.endsWith(extension))
    .sort(compareCodePoint);
  for (const name of candidates) {
    const relativePath = toPosix(path.join('dist/assets', name));
    const contents = await fsp.readFile(path.join(consumerRoot, relativePath), 'utf8');
    if (contents.includes(needle)) return relativePath;
  }
  throw new Error(`No built ${extension} asset contains ${needle}.`);
}

async function retainActualGateLogs(
  artifactRoot: string,
  cellRelative: string,
  rows: GateRow[],
  reason: string,
): Promise<void> {
  for (const row of rows) {
    if (row.status === 'unproven') {
      row.logs = [];
      continue;
    }
    row.logs = row.logs.filter((logPath) => fs.existsSync(path.join(artifactRoot, logPath)));
  }
  const failed = rows.find(({ status }) => status === 'failed');
  if (failed && failed.logs.length === 0) {
    const diagnostic = toPosix(path.join(
      cellRelative,
      'logs',
      `${failed.name}-failure-diagnostic.log`,
    ));
    await writeLog(path.join(artifactRoot, diagnostic), [
      'kind=in-process-gate-failure-diagnostic',
      `gate=${failed.name}`,
      'status=failed',
      `reason=${reason}`,
    ].join('\n'));
    failed.logs = [diagnostic];
  }
}

async function runSsr({
  framework,
  consumerRoot,
  environment,
  logRoot,
  replacements,
}: {
  framework: S184M06Framework;
  consumerRoot: string;
  environment: NodeJS.ProcessEnv;
  logRoot: string;
  replacements: Array<[string, string]>;
}): Promise<{ html: string; build: CommandResult; render: CommandResult }> {
  const entry = framework === 'react' ? 'src/ssr.tsx' : 'src/ssr.ts';
  const build = commandResult('npm', [
    'exec', '--', 'vite', 'build', '--config', 'vite.config.mjs', '--ssr', entry, '--outDir', 'dist-ssr',
  ], consumerRoot, { environment, scrubNpmCredentials: true, isolateDependencies: true });
  await writeCommandLog(path.join(logRoot, 'server-render-build.log'), build, replacements);
  requireGreen(build, `${framework} server-render build`);
  const candidates = (await fsp.readdir(path.join(consumerRoot, 'dist-ssr')))
    .filter((name) => name.endsWith('.js') || name.endsWith('.mjs'))
    .sort(compareCodePoint);
  if (candidates.length !== 1) throw new Error(`${framework}: SSR emitted ${candidates.length} entries.`);
  const render = commandResult('node', [path.join('dist-ssr', candidates[0]!)], consumerRoot, {
    environment,
    scrubNpmCredentials: true, isolateDependencies: true,
  });
  await writeCommandLog(path.join(logRoot, 'server-render-render.log'), render, replacements);
  requireGreen(render, `${framework} server render`);
  const payload = JSON.parse(render.stdout) as { html?: unknown };
  if (typeof payload.html !== 'string') throw new Error(`${framework}: SSR output omitted HTML.`);
  return { build, render, html: payload.html };
}

export async function runLiveConsumerCell({
  artifactRoot,
  generation,
  tarballs,
  mutation,
  mission = generation.mission ?? 's184-m06',
  schemaStore = SAVED_SCHEMA_STORE,
}: {
  artifactRoot: string;
  generation: LiveGenerationCell;
  tarballs: PackedPackageRecord[];
  mutation?: S184M06ConsumerGateMutation;
  mission?: string;
  schemaStore?: string;
}): Promise<Record<string, unknown>> {
  const { schema: schemaName, framework, artifact, source } = generation;
  const schema = generation.sourceSchema ?? savedSchema(schemaName, schemaStore).schema;
  const interaction = generation.interaction ?? deriveInteraction(schema, artifact.actions);
  const model = generation.model ?? deriveConsumerModel(schema, MODEL);
  const mountObligations = deriveMountObligations(schema, source, model);
  const cellRelative = mutation
    ? toPosix(path.join('gate-bites', ...(mission === 's184-m06' ? [] : [schemaName]), framework, mutation.gate))
    : toPosix(path.join('cells', schemaName, framework));
  const outputRoot = path.join(artifactRoot, cellRelative);
  await mkdirAbsent(outputRoot);
  const sourceRoot = path.join(outputRoot, 'source');
  const logRoot = path.join(outputRoot, 'logs');
  await Promise.all([fsp.mkdir(sourceRoot), fsp.mkdir(logRoot)]);
  const consumerRoot = await fsp.mkdtemp(path.join(os.tmpdir(), `oods-s184-m06-${schemaName}-${framework}-`));
  const replacements: Array<[string, string]> = [
    [consumerRoot, '<consumer-root>'],
    [REPOSITORY_ROOT, '<repository-root>'],
  ];
  const rows = gateRows(toPosix(path.join(cellRelative, 'logs')));
  const appliedMutation: AppliedMutation | undefined = mutation
    ? { id: mutation.id, gate: mutation.gate, operations: [] }
    : undefined;
  let activeGate: S184M06GateName = 'fresh-exact-tarball-install';
  let mutationMissed = false;
  try {
    if (fs.existsSync(path.join(consumerRoot, 'node_modules'))) {
      throw new Error(`${schemaName}/${framework}: consumer unexpectedly began with node_modules.`);
    }
    const files = createConsumerFiles({ framework, source, actions: artifact.actions, schemaName, model, mission });
    const generatedPath = framework === 'react' ? 'src/GeneratedUI.tsx' : 'src/GeneratedUI.vue';
    const ownership = sourceOwnership(source, generatedPath, artifact.actions, files, interaction, schema);
    assertGeneratedOwnership(ownership, schemaName, framework);
    await writeLog(path.join(logRoot, 'source-ownership.log'), canonicalJson(ownership));
    await writeFiles(consumerRoot, files);
    await writeFiles(sourceRoot, files);

    const { manifest, localTarballs } = await prepareManifest(framework, artifact, tarballs, consumerRoot);
    const userConfig = path.join(consumerRoot, 'empty-user.npmrc');
    const globalConfig = path.join(consumerRoot, 'empty-global.npmrc');
    await Promise.all([
      fsp.writeFile(userConfig, ''),
      fsp.writeFile(globalConfig, ''),
      fsp.writeFile(path.join(consumerRoot, '.npmrc'), ''),
      fsp.writeFile(path.join(consumerRoot, 'package.json'), canonicalJson(manifest)),
    ]);
    if (mutation?.gate === 'fresh-exact-tarball-install') {
      const packageName = `@oods/components-${framework}`;
      const installSpec = (manifest.dependencies as Record<string, string>)[packageName]!;
      await mutateExistingFile({
        consumerRoot,
        recorder: appliedMutation!,
        relativePath: 'package.json',
        needle: installSpec,
        replacement: 'file:./tarballs/missing-s184-gate-bite.tgz',
        operation: `replace the exact ${packageName} tarball with a nonexistent archive`,
      });
    }
    await writeJson(path.join(sourceRoot, 'consumer-package.json'), normalizedManifest(manifest));
    const environment = isolatedNpmEnvironment(consumerRoot, userConfig, globalConfig);
    const installArgs = ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', '--userconfig', userConfig];
    const install = commandResult('npm', installArgs, consumerRoot, { environment, scrubNpmCredentials: true, isolateDependencies: true });
    await writeCommandLog(path.join(logRoot, 'install.log'), install, replacements);
    requireGreen(install, `${schemaName}/${framework} fresh exact tarball install`);
    await writeJson(path.join(logRoot, 'rollup.json'), await ensureConsumerRollup(consumerRoot, async extraArgs => {
      const retry = commandResult('npm', [...installArgs, ...extraArgs], consumerRoot, { environment, scrubNpmCredentials: true, isolateDependencies: true });
      await writeCommandLog(path.join(logRoot, 'install-optional-retry.log'), retry, replacements);
      requireGreen(retry, `${framework} optional native package reinstall`);
    }));
    const isolation = assertInstalledIsolation(consumerRoot, framework, localTarballs, files);
    const resolutions = resolveImports(consumerRoot, files);
    await writeLog(path.join(logRoot, 'isolation.log'), canonicalJson({ isolation, localTarballs, resolutions }));
    passGate(rows, activeGate, { localTarballCount: localTarballs.length, isolation, resolutions });

    activeGate = 'strict-typecheck';
    if (mutation?.gate === activeGate) {
      await createMutationFile({
        consumerRoot,
        recorder: appliedMutation!,
        relativePath: 'src/s184-gate-bite.ts',
        contents: "const strictGateBite: string = 42;\nexport { strictGateBite };\n",
        operation: 'add a strict TypeScript assignment error to the included source set',
      });
    }
    const typecheckArgs = framework === 'react'
      ? ['exec', '--', 'tsc', '--noEmit', '--pretty', 'false']
      : ['exec', '--', 'vue-tsc', '--noEmit', '--pretty', 'false'];
    const typecheck = commandResult('npm', typecheckArgs, consumerRoot, {
      environment,
      scrubNpmCredentials: true, isolateDependencies: true,
    });
    await writeCommandLog(path.join(logRoot, 'typecheck.log'), typecheck, replacements);
    requireGreen(typecheck, `${schemaName}/${framework} strict typecheck`);
    passGate(rows, activeGate, { exitCode: typecheck.exitCode });

    activeGate = 'production-build';
    if (mutation?.gate === activeGate) {
      const entry = framework === 'react' ? '/src/main.tsx' : '/src/main.ts';
      await mutateExistingFile({
        consumerRoot,
        recorder: appliedMutation!,
        relativePath: 'index.html',
        needle: entry,
        replacement: '/src/missing-s184-production-entry.ts',
        operation: 'replace the production module entry with a nonexistent source',
      });
    }
    if (mutation?.gate === 'interaction-evidence') {
      const generatedPath = framework === 'react' ? 'src/GeneratedUI.tsx' : 'src/GeneratedUI.vue';
      await mutateExistingFile({
        consumerRoot,
        recorder: appliedMutation!,
        relativePath: generatedPath,
        needle: 'actions.handleEdit();',
        replacement: 'actions.handleDelete();',
        operation: 'forward the generated handleEdit adapter to the different handleDelete action',
      });
    }
    if (mutation?.gate === 'hydration') {
      const mainPath = framework === 'react' ? 'src/main.tsx' : 'src/main.ts';
      const hydrationCall = files[mainPath]!.split('\n').find((line) => framework === 'react'
        ? line.startsWith('hydrateRoot(root, ') : line.startsWith('createSSRApp(GeneratedUI, '));
      if (!hydrationCall) throw new Error('The consumer entry has no canonical hydration call to mutate.');
      const unmountedTree = framework === 'react'
        ? hydrationCall.slice('hydrateRoot(root, '.length, -2)
        : hydrationCall.replace(/\.mount\('#app'\);$/, '');
      await mutateExistingFile({
        consumerRoot,
        recorder: appliedMutation!,
        relativePath: mainPath,
        needle: hydrationCall,
        replacement: `(window as unknown as { __OODS_UNMOUNTED_TREE__: unknown }).__OODS_UNMOUNTED_TREE__ = ${unmountedTree};`,
        operation: 'construct but do not mount the generated tree, preserving the production dependency and CSS closure while leaving the server-rendered DOM inert',
      });
      await writeFiles(path.join(outputRoot, 'mutation-source'), {
        [mainPath]: await fsp.readFile(path.join(consumerRoot, mainPath), 'utf8'),
      });
    }
    const productionBuild = commandResult('npm', [
      'exec', '--', 'vite', 'build', '--config', 'vite.config.mjs', '--outDir', 'dist',
    ], consumerRoot, { environment, scrubNpmCredentials: true, isolateDependencies: true });
    await writeCommandLog(path.join(logRoot, 'production-build.log'), productionBuild, replacements);
    requireGreen(productionBuild, `${schemaName}/${framework} production build`);
    passGate(rows, activeGate, { exitCode: productionBuild.exitCode });

    activeGate = 'server-render';
    if (mutation?.gate === activeGate) {
      const entry = framework === 'react' ? 'src/ssr.tsx' : 'src/ssr.ts';
      const before = await fsp.readFile(path.join(consumerRoot, entry), 'utf8');
      const addition = "\nthrow new Error('s184 server-render gate bite');\n";
      await fsp.writeFile(path.join(consumerRoot, entry), `${before}${addition}`);
      appliedMutation!.operations.push({
        target: entry,
        operation: 'append an executed SSR-only throw after the green client build',
        replacementCount: 1,
        beforeSha256: sha256Urn(before),
        afterSha256: sha256Urn(`${before}${addition}`),
      });
    }
    const ssr = await runSsr({ framework, consumerRoot, environment, logRoot, replacements });
    const requiredSsrNodes = observeMountObligations(mountObligations, ssr.html);
    const missingSsrNodes = requiredSsrNodes.filter(({ passed }) => !passed);
    if (missingSsrNodes.length > 0) {
      throw new Error(`${schemaName}/${framework}: server render omitted source-owned nodes: ${JSON.stringify(missingSsrNodes)}.`);
    }
    const rootId = schema.screens[0]!.id;
    if (!ssr.html.includes(`id=\\"${rootId}\\"`) && !ssr.html.includes(`id="${rootId}"`)) {
      throw new Error(`${schemaName}/${framework}: server render omitted saved-schema root ${rootId}.`);
    }
    for (const action of artifact.actions) {
      const control = collectionActionControl(schema, action);
      if (control ? !htmlHasSelector(ssr.html, control.selector) : !ssr.html.includes(`data-oods-action=\\"${action.name}\\"`)
        && !ssr.html.includes(`data-oods-action="${action.name}"`)) {
        throw new Error(`${schemaName}/${framework}: server render omitted generated selector ${action.name}.`);
      }
    }
    passGate(rows, activeGate, { bytes: Buffer.byteLength(ssr.html), sha256: sha256Urn(ssr.html), requiredSsrNodes });
    const distRoot = path.join(consumerRoot, 'dist');
    let browserHtml = ssr.html;
    if (mutation?.gate === 'mount') {
      const mutatedRootId = `${rootId}-removed-by-gate-bite`;
      const htmlCount = replacementCount(browserHtml, rootId);
      if (htmlCount < 1) throw new Error(`${mutation.id}: SSR root id does not occur in rendered HTML.`);
      const htmlBefore = browserHtml;
      browserHtml = browserHtml.split(rootId).join(mutatedRootId);
      appliedMutation!.operations.push({
        target: 'server-render-output.html',
        operation: 'replace the expected saved-schema root id in SSR output before hydration',
        replacementCount: htmlCount,
        beforeSha256: sha256Urn(htmlBefore),
        afterSha256: sha256Urn(browserHtml),
      });
      const clientAsset = await firstBuiltAsset(consumerRoot, '.js', rootId);
      await mutateExistingFile({
        consumerRoot,
        recorder: appliedMutation!,
        relativePath: clientAsset,
        needle: rootId,
        replacement: mutatedRootId,
        operation: 'replace the expected saved-schema root id in the built client artifact',
        exactCount: null,
      });
    }
    if (mutation?.gate === 'shared-css-resolution') {
      const cssAsset = await firstBuiltAsset(consumerRoot, '.css', '--sys-text-primary');
      await mutateExistingFile({
        consumerRoot,
        recorder: appliedMutation!,
        relativePath: cssAsset,
        needle: '--sys-text-primary',
        replacement: '--s184-muted-text-primary',
        operation: 'remove the shared primary-text token name from the built CSS asset',
        exactCount: null,
      });
    }
    await injectSsrMarkup(distRoot, browserHtml);

    activeGate = 'shared-css-resolution';
    const requiresPorted = source.includes('@oods/component-styles/css-ported');
    const css = await cssProof(distRoot, requiresPorted);
    await writeLog(path.join(logRoot, 'css-proof.log'), canonicalJson(css));

    const expectedComponents = [...new Set(
      [...source.matchAll(/data-oods-component=["']([^"']+)["']/g)].map((match) => match[1]!),
    )].sort(compareCodePoint);
    const mountedExpectedComponents = [...new Set(
      [...ssr.html.matchAll(/data-oods-component=["']([^"']+)["']/g)].map((match) => match[1]!),
    )].sort(compareCodePoint);
    const coreComponents = requiresPorted
      ? expectedComponents.filter((name) => !HISTORICAL_PORTED_COMPONENT_IDS.includes(name))
      : expectedComponents;
    const portedComponents = requiresPorted
      ? expectedComponents.filter((name) => HISTORICAL_PORTED_COMPONENT_IDS.includes(name))
      : [];
    if (coreComponents.length === 0 || (requiresPorted && portedComponents.length === 0)) {
      throw new Error(`${schemaName}/${framework}: generated source does not exercise its declared component subpaths.`);
    }
    const browser = await browserProof({
      framework,
      schemaName,
      rootId,
      distRoot,
      actions: artifact.actions,
      expectedComponents: mountedExpectedComponents,
      interaction,
      boundFieldProbe: deriveBoundFieldProbe(schema),
      sharedNativeFields: generation.composition ? deriveSharedNativeFieldProbes(schema) : [],
      valueProbes: generation.composition ? deriveValueProbes(schema, model) : [],
      cancellationFormIds: generation.composition ? schemaNodes(schema).filter((node) => node.component === 'CancellationForm').map((node) => node.id) : [],
      // Fresh User/detail has eight tabs. At 1280px the intentional overflow
      // effect removes tab buttons after attachment, outside this strict stable
      // DOM hydration probe. Keep this proof at an explicit wide desktop size.
      ...(generation.composition ? { viewport: { width: 1920, height: 1080 } } : {}),
      mountObligations,
      collectionControls: Object.fromEntries(artifact.actions.flatMap(action => { const control = collectionActionControl(schema, action); return control ? [[action.name, control]] : []; })),
      disabledActions: artifact.actions.filter(action => isDisabledScreenAction(schema, action)).map(action => action.name),
      screenshotPath: path.join(logRoot, 'mounted.png'),
    });
    await writeLog(path.join(logRoot, 'browser-proof.log'), canonicalJson(browser));
    const browserCss = browser.css as { primaryTextToken?: unknown; canvasToken?: unknown };
    if (!browserCss.primaryTextToken || !browserCss.canvasToken) {
      throw new Error(`${schemaName}/${framework}: browser did not resolve shared token CSS.`);
    }
    passGate(rows, activeGate, { ...css, browser: browserCss });

    activeGate = 'mount';
    const componentCounts = browser.componentCounts as Record<string, number>;
    const missingComponents = mountedExpectedComponents.filter((name) => (componentCounts[name] ?? 0) < 1);
    const labelVisibility = browser.labelVisibility as Array<{ passed: boolean }>;
    const boundValues = browser.boundValues as Array<{ passed: boolean }>;
    const requiredMounts = browser.requiredMounts as Array<{ passed: boolean }>;
    if (browser.mount !== 'passed' || missingComponents.length > 0 || labelVisibility.some(({ passed }) => !passed)
      || boundValues.some(({ passed }) => !passed) || requiredMounts.some(({ passed }) => !passed)) {
      throw new Error(`${schemaName}/${framework}: mount failed or omitted ${missingComponents.join(', ')}.`);
    }
    passGate(rows, activeGate, {
      rootId,
      componentCounts,
      mountedExpectedComponents,
      generatedCoreComponents: coreComponents,
      generatedPortedComponents: portedComponents,
      labelVisibility,
      boundValues,
      requiredMounts,
    });

    activeGate = 'hydration';
    const hydrationInvariant = browser.hydrationInvariant as { equal?: unknown };
    const runtimeErrors = browser.runtimeErrors as string[];
    if (browser.hydration !== 'passed' || hydrationInvariant.equal !== true || runtimeErrors.length > 0) {
      throw new Error(`${schemaName}/${framework}: hydration failed: ${JSON.stringify({ hydrationInvariant, runtimeErrors })}`);
    }
    passGate(rows, activeGate, { hydrationInvariant, runtimeErrors });

    activeGate = 'interaction-evidence';
    const selectorEvidence = browser.selectorEvidence as Array<{ action: string; count: number; clicked: boolean; disabled?: boolean; title?: string | null }>;
    const disabledActions = new Set(artifact.actions.filter(action => isDisabledScreenAction(schema, action)).map(action => action.name));
    const actionCounts = browser.actionCounts as Record<string, number>;
    const actionArgs = browser.actionArgs as Record<string, unknown[][]>;
    const expectedArguments = deriveActionArguments(schema, artifact.actions, model);
    const interactionEvidence = browser.interactionEvidence as { status: string; reason?: string };
    if (browser.actionsFrozen !== true
      || selectorEvidence.some(({ action, count, clicked, disabled, title }) => count < 1
        || (disabledActions.has(action) ? disabled !== true || title !== 'This action needs input from your application.' : !clicked))
      || artifact.actions.some(({ name }) => actionCounts[name] !== (disabledActions.has(name) ? 0 : 1))
      || canonicalize(actionArgs) !== canonicalize(expectedArguments)
      || interactionEvidence.status !== (interaction.kind === 'none' ? 'not-applicable' : 'passed')) {
      throw new Error(
        `${schemaName}/${framework}: generated interactions did not invoke each exact action once `
        + `with its schema-derived operands: ${JSON.stringify({ actionCounts, actionArgs, expectedArguments })}.`,
      );
    }
    const interactionDetail = {
      interactionEvidence,
      selectorEvidence,
      actionCounts,
      actionArgs,
      expectedArguments,
      sourceOwnership: ownership,
    };
    if (interaction.kind === 'none') {
      const row = rows.find(({ name }) => name === activeGate)!;
      row.status = 'not-applicable';
      row.reason = interaction.reason;
      row.detail = interactionDetail;
    } else passGate(rows, activeGate, interactionDetail);

    const gateAccounting = accounting(rows);
    const build = {
      client: await directoryDigest(path.join(consumerRoot, 'dist')),
      server: await directoryDigest(path.join(consumerRoot, 'dist-ssr')),
    };
    await writeJson(path.join(outputRoot, 'build-inventory.json'), build);
    const report = {
      schemaVersion: '1.0.0',
      mission,
      cellRelative,
      reportPath: toPosix(path.join(cellRelative, 'report.json')),
      schema: schemaName,
      schemaRef: generation.schemaRef,
      ...(generation.composition ? { composition: generation.composition } : {}),
    ...(generation.derivation ? { derivation: generation.derivation } : {}),
      framework,
      status: 'passed',
      selected: GATE_NAMES.length,
      passed: rows.filter(({ status }) => status === 'passed').length,
      notApplicable: rows.filter(({ status }) => status === 'not-applicable').length,
      failed: 0,
      skipped: 0,
      logPathBase: 'artifact-root',
      gates: rows,
      accounting: gateAccounting,
      generation: {
        sourcePath: generation.sourcePath,
        sourceSha256: generation.sourceSha256,
        artifactContentHash: artifact.contentHash,
        generationLog: generation.generationLog,
        fingerprint: generation.generationFingerprint,
      },
      sourceOwnership: ownership,
      isolation,
      localTarballs,
      manifest: normalizedManifest(manifest),
      browser,
      css,
      build,
    };
    if (mutation) {
      mutationMissed = true;
      throw new Error(`${mutation.id}: ${mutation.gate} mutation remained green.`);
    }
    await writeJson(path.join(outputRoot, 'report.json'), report);
    return report;
  } catch (error) {
    const reason = error instanceof Error ? redact(error.message, replacements) : String(error);
    failGate(rows, activeGate, reason);
    for (const row of rows) {
      if (row.status === 'unproven') row.reason = `Not reached after ${activeGate} failed.`;
    }
    const report = {
      schemaVersion: '1.0.0',
      mission,
      cellRelative,
      reportPath: toPosix(path.join(cellRelative, 'report.json')),
      schema: schemaName,
      schemaRef: generation.schemaRef,
      ...(generation.composition ? { composition: generation.composition } : {}),
    ...(generation.derivation ? { derivation: generation.derivation } : {}),
      framework,
      status: 'failed',
      selected: GATE_NAMES.length,
      passed: rows.filter(({ status }) => status === 'passed').length,
      notApplicable: rows.filter(({ status }) => status === 'not-applicable').length,
      failed: rows.filter(({ status }) => status === 'failed').length,
      skipped: 0,
      logPathBase: 'artifact-root',
      gates: rows,
      accounting: accounting(rows),
      reason,
      ...(appliedMutation ? { mutation: appliedMutation } : {}),
    };
    await retainActualGateLogs(artifactRoot, cellRelative, rows, reason);
    if (appliedMutation) {
      await writeJson(path.join(outputRoot, 'mutation.json'), appliedMutation);
      await writeLog(path.join(logRoot, 'mutation.log'), canonicalJson(appliedMutation));
      const observedFailedGates = rows
        .filter(({ status }) => status === 'failed')
        .map(({ name }) => name);
      const detected = !mutationMissed
        && activeGate === appliedMutation.gate
        && appliedMutation.operations.length > 0
        && observedFailedGates.length === 1
        && observedFailedGates[0] === appliedMutation.gate;
      const mutationReport = {
        ...report,
        status: detected ? 'detected' : 'failed',
        expectedFailedGate: appliedMutation.gate,
        observedFailedGates,
        mutation: appliedMutation,
        logs: [
          ...new Set([
            ...rows.flatMap(({ logs }) => logs),
            toPosix(path.join(cellRelative, 'logs/mutation.log')),
          ]),
        ],
      };
      await writeJson(path.join(outputRoot, 'report.json'), mutationReport);
      if (detected) return mutationReport;
      throw new Error(`${appliedMutation.id}: gate bite did not isolate ${appliedMutation.gate}: ${reason}`);
    }
    await writeJson(path.join(outputRoot, 'report.json'), report);
    throw new Error(reason);
  } finally {
    await fsp.rm(consumerRoot, { recursive: true, force: true });
  }
}

export async function runLiveWorkflowProof({
  artifactRoot,
  generate = codeGenerate,
  tarballs,
  schemaNames,
  freshInputs,
  mission = 's184-m06',
  schemaStore = SAVED_SCHEMA_STORE,
}: {
  artifactRoot: string;
  generate?: LiveGenerator;
  tarballs?: PackedPackageRecord[];
  schemaNames?: readonly S184M06SchemaName[];
  freshInputs?: readonly FreshCompositionInput[];
  mission?: string;
  schemaStore?: string;
}): Promise<{
  report: Record<string, unknown>;
  cells: Array<Record<string, unknown>>;
  generationCells: LiveGenerationCell[];
  tarballs: PackedPackageRecord[];
}> {
  if (!artifactRoot) throw new Error('artifactRoot is required.');
  if (freshInputs && (schemaNames || schemaStore !== SAVED_SCHEMA_STORE)) throw new Error('Fresh inputs and saved-store selection are mutually exclusive.');
  if (!freshInputs) assertSchemaSelection(schemaNames ?? SCHEMA_NAMES);
  const schemaCount = freshInputs?.length ?? (schemaNames ?? SCHEMA_NAMES).length;
  await mkdirAbsent(artifactRoot);
  const submittedTarballs = tarballs ?? await packFoundationPackages(artifactRoot) as PackedPackageRecord[];
  // Packing runs each package's prepack build. Generate only after that coherent
  // build boundary so target-readiness never observes a half-written dist tree.
  const generation = await runLiveGenerationOnly({ artifactRoot, generate, schemaNames, freshInputs, mission, schemaStore });
  const cellReports = [];
  for (const generationCell of generation.cells) {
    cellReports.push(await runLiveConsumerCell({
      artifactRoot,
      generation: generationCell,
      tarballs: submittedTarballs,
      mission,
      schemaStore,
    }));
  }
  const publicCells = cellReports.map((cell) => {
    const schema = cell.schema as S184M06SchemaName;
    const framework = cell.framework as S184M06Framework;
    const reportPath = toPosix(path.join('cells', schema, framework, 'report.json'));
    return {
      schema,
      schemaRef: cell.schemaRef,
      ...(cell.composition ? { composition: cell.composition } : {}),
      ...(cell.derivation ? { derivation: cell.derivation } : {}),
      framework,
      status: cell.status,
      selected: cell.selected,
      passed: cell.passed,
      notApplicable: cell.notApplicable,
      failed: cell.failed,
      skipped: cell.skipped,
      gates: cell.gates,
      accounting: cell.accounting,
      generation: cell.generation,
      sourceOwnership: cell.sourceOwnership,
      report: reportPath,
      reportSha256: sha256Urn(canonicalJson(cell)),
    };
  });
  const selected = publicCells.reduce((sum, cell) => sum + Number(cell.selected), 0);
  const passed = publicCells.reduce((sum, cell) => sum + Number(cell.passed), 0);
  const notApplicable = publicCells.reduce((sum, cell) => sum + Number(cell.notApplicable), 0);
  const report = {
    schemaVersion: '1.0.0',
    mission,
    schemaStore: freshInputs ? null : schemaStore,
    ...(freshInputs ? { freshInputs } : {}),
    kind: 'live-schema-workflow-clean-consumer-proof',
    status: passed + notApplicable === selected && selected === schemaCount * FRAMEWORKS.length * GATE_NAMES.length
      ? 'passed'
      : 'failed',
    selected,
    passed,
    notApplicable,
    applicable: selected - notApplicable,
    failed: selected - passed - notApplicable,
    skipped: 0,
    schemaCount: schemaCount,
    frameworkCount: FRAMEWORKS.length,
    cellCount: publicCells.length,
    expectedCellCount: schemaCount * FRAMEWORKS.length,
    equalityRule: 'Every selected unchanged saved or freshly composed schema runs the eight named gates in React and Vue. Non-applicable interaction gates require schema-derived reasons, remain named, and are excluded from the applicable denominator; they never count as passed.',
    generationPolicy: 'code.generate is invoked live once per schema/framework cell and only that in-run artifact is consumed.',
    consumerPolicy: 'Consumers are outside the workspace, begin without node_modules, use empty npm configs, and install OODS packages only from exact tarballs produced by npm pack after each package prepack build.',
    logPathPolicy: 'Every gate log path is relative to this report artifact root, including paths repeated in nested cell reports.',
    cells: publicCells,
  };
  await writeJson(path.join(artifactRoot, 'report.json'), report);
  if (report.status !== 'passed') throw new Error(`Live workflow proof is not green (${passed}/${selected}).`);
  return { report, cells: cellReports, generationCells: generation.cells, tarballs: submittedTarballs };
}

function cliArguments(argv: string[]): { artifactRoot: string; generationOnly: boolean } {
  let artifactRoot = DEFAULT_ARTIFACT_ROOT;
  let generationOnly = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (argument === '--generation-only') generationOnly = true;
    else if (argument === '--output') {
      const value = argv[index + 1];
      if (!value) throw new Error('--output requires a directory.');
      artifactRoot = path.resolve(value);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return { artifactRoot, generationOnly };
}

async function main(): Promise<void> {
  const { artifactRoot, generationOnly } = cliArguments(process.argv.slice(2));
  const result = generationOnly
    ? await runLiveGenerationOnly({ artifactRoot })
    : await runLiveWorkflowProof({ artifactRoot });
  process.stdout.write(`${canonicalJson(result.report)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

// Shared with the bounded Sprint 188 App proof; retain the same isolation and gate rules.
export { commandResult, requireGreen, prepareManifest, isolatedNpmEnvironment, assertInstalledIsolation, resolveImports, withStaticServer, cssProof };
