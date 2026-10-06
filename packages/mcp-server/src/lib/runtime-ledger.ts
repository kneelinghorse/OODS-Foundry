import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Every object the runtime sweep proves. Sprint 203 adds five born from real stores: Decision,
 * Sprint and Session from CMOS's record (m02) and Person and Cluster from Hive's cohort (m03).
 */
// s205-m06: + CapturedArtifact, Finding and Run, born from real Stage1 runs in s205-m02 (swept once here).
// s211-m03: + Comparison and ComparisonSignal, the derived Stage1 comparison of Sprint 209, which no sweep had proved.
// s233-m02: the measured public population excludes repository-only integrations. Retained rows keep their original run identity.
export const OBJECTS = ['Article', 'CapturedArtifact', 'Comparison', 'ComparisonSignal', 'Finding', 'Invoice', 'Media', 'Organization', 'Plan', 'Product', 'Relationship', 'Run', 'Subscription', 'Transaction', 'Usage', 'User'] as const;
export const CONTEXTS = ['card', 'detail', 'form', 'inline', 'list', 'timeline'] as const;
export const FRAMEWORKS = ['react', 'vue'] as const;
export const BROWSER_IMAGE = 'mcr.microsoft.com/playwright@sha256:f1e7e01021efd65dd1a2c56064be399f3e4de00fd021ac561325f2bfbb2b837a';
export type Context = typeof CONTEXTS[number];
export type Framework = typeof FRAMEWORKS[number];
/**
 * Shipped proof remains verifiable without the authoring registry on disk, so the authored restrictions
 * (`metadata.supportedContexts`) are restated here and runtime-cells.s193 holds the two equal.
 * s206-m01: + the three read-only capture objects, which compose no form and so no workflow.
 * s211-m03: + the two read-only comparison objects, which compose no form and no timeline.
 */
const RESTRICTED_CONTEXTS: Readonly<Record<string, readonly Context[]>> = {
  Chunk: ['inline'],
  CapturedArtifact: ['card', 'detail', 'inline', 'list', 'timeline'],
  Comparison: ['card', 'detail', 'inline', 'list'],
  ComparisonSignal: ['card', 'detail', 'inline', 'list'],
  Finding: ['card', 'detail', 'inline', 'list', 'timeline'],
  Run: ['card', 'detail', 'inline', 'list', 'timeline'],
};
export function contextsForObject(object: string): Context[] {
  return [...(RESTRICTED_CONTEXTS[object] ?? CONTEXTS)];
}
export function supportsWorkflow(object: string): boolean {
  const contexts = contextsForObject(object);
  return (['list', 'detail', 'form', 'timeline'] as const).every(context => contexts.includes(context));
}
export type Gate = { name: string; status: 'pass' | 'fail'; detail?: unknown; reason?: string };
export type RuntimeCell = {
  object: string; context: Context | 'workflow'; framework: Framework; head: string; runId: string;
  status: 'pass' | 'typed-gap' | 'fail'; gates: Gate[]; artifactHash: string | null;
  components: string[]; gap?: { code: string; components: string[]; reason: string };
  report: string;
};
export type RuntimeLedger = {
  schemaVersion: '1.0.0'; head: string; runId: string; historicalReceiptsUnioned: false;
  packCount: number; browserImage: string; rows: RuntimeCell[];
  /** Repository-relative receipt directory; historical ledgers predate canonical storage. */
  receiptRoot?: string;
  summary: { cells: number; pass: number; typedGap: number; fail: number };
  /** The runtime archive a runtime-scope run executed, and the head that built it (s193 runner). */
  archive?: { sha256: string; bundleHead: string; version?: string };
};
const identity = (row: Pick<RuntimeCell, 'object' | 'context' | 'framework'>) => `${row.object}/${row.context}/${row.framework}`;

/** A missing, duplicate, failed, or older cell cannot inflate the runtime ratio. */
export function validateRuntimeLedger(ledger: RuntimeLedger, workflows = false, scopedIdentities?: readonly string[]): string[] {
  const issues: string[] = [];
  const expected = [...(scopedIdentities ?? OBJECTS.flatMap(object => [
    ...contextsForObject(object), ...(workflows && supportsWorkflow(object) ? ['workflow'] : []),
  ].flatMap(context => FRAMEWORKS.map(framework => `${object}/${context}/${framework}`))))].sort();
  if (!expected.length || new Set(expected).size !== expected.length) issues.push('a scoped population must declare nonempty distinct identities');
  if (JSON.stringify(ledger.rows.map(identity).sort()) !== JSON.stringify(expected)) issues.push(`population must contain exactly ${expected.length} distinct current cells`);
  if (!ledger.head || !ledger.runId || ledger.historicalReceiptsUnioned !== false || ledger.rows.some(row => row.head !== ledger.head || row.runId !== ledger.runId)) issues.push('historical or mixed-run receipts are forbidden');
  if (ledger.packCount !== 1) issues.push('exactly one package pack sweep is required');
  if (ledger.browserImage !== BROWSER_IMAGE) issues.push('the pinned Linux browser image is required');
  for (const row of ledger.rows) {
    if (row.status === 'fail') issues.push(`${identity(row)} failed`);
    else if (row.status === 'typed-gap') {
      if (row.gap?.code !== 'OODS-N015' || !row.gap.components.length || !row.gap.reason) issues.push(`${identity(row)} has an untyped gap`);
    } else if (row.status !== 'pass' || !row.artifactHash || !row.gates.length || row.gates.some(gate => gate.status !== 'pass')) issues.push(`${identity(row)} lacks passing proof`);
    if (row.status === 'pass') {
      for (const name of ['generation', 'fresh-exact-tarball-install', 'strict-typecheck', 'production-build', 'mount', 'accessibility-tree', 'screenshots', 'context-states',
        ...(row.context === 'workflow' ? ['server-render', 'hydration', 'shared-css-resolution', 'interaction-evidence'] : [])]) {
        if (row.gates.filter(gate => gate.name === name && gate.status === 'pass').length !== 1) issues.push(`${identity(row)} lacks ${name}`);
      }
      if (row.context === 'workflow') {
        const detail = row.gates.find(gate => gate.name === 'context-states')?.detail as { observations?: Array<{ screen: string; state: string }> } | undefined;
        const states = detail?.observations?.map(value => `${value.screen}/${value.state}`).sort();
        const expectedStates = ['list', 'detail', 'form', 'timeline'].flatMap(screen => ['loading', 'empty', 'error', 'success'].map(state => `${screen}/${state}`)).sort();
        if (JSON.stringify(states) !== JSON.stringify(expectedStates)) issues.push(`${identity(row)} lacks the sixteen declared workflow states`);
      }
    }
  }
  const summary = summarize(ledger.rows);
  if (JSON.stringify(summary) !== JSON.stringify(ledger.summary)) issues.push('summary differs from the measured rows');
  return issues;
}
export function summarize(rows: RuntimeCell[]): RuntimeLedger['summary'] {
  return { cells: rows.length, pass: rows.filter(row => row.status === 'pass').length, typedGap: rows.filter(row => row.status === 'typed-gap').length, fail: rows.filter(row => row.status === 'fail').length };
}

/** s223-m03 (#2527 ruling 17): the runtime block also exposes the archive it ran from (null when not recorded). */
export type RuntimeSummary = RuntimeLedger['summary'] & { head: string; archiveSha256: string | null };

function runtimeLedgerPath(): string {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
  const source = path.join(root, 'packages/mcp-server/registry/runtime-cells.v1.json');
  const shipped = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../registry/runtime-cells.v1.json');
  return process.env.MCP_RUNTIME_CELLS_PATH ?? (fs.existsSync(source) ? source : shipped);
}

/** The ledger's identity on disk: a different file, or the same file rewritten, produces a
 * different key, so the memo below can never serve a stale or swapped ledger. */
function ledgerIdentity(file: string): string {
  const stat = fs.statSync(file);
  return `${file}\u0000${stat.dev}\u0000${stat.ino}\u0000${stat.size}\u0000${stat.mtimeMs}`;
}

/** s204-m01: the ledger is ~3.8 MB and its validation walks 310 cells, and `catalog.list` — which
 * every `design.compose` call loads its catalog from — read and revalidated it on EVERY call. The
 * viz census makes 88 compositions, so one gate paid that cost 88 times; measured at 496 ms per
 * composition, 47% of the census. Both the summary and the rejection are memoized against the
 * file's identity, so an invalid ledger still throws on every call and a rewritten one is re-read. */
let ledgerMemo: { identity: string; summary?: RuntimeSummary; components?: Record<string, string[]>; rejection?: string } | null = null;

export function readRuntimeSummary(): RuntimeSummary {
  const file = runtimeLedgerPath();
  const identity = ledgerIdentity(file);
  if (ledgerMemo?.identity !== identity) {
    const ledger = JSON.parse(fs.readFileSync(file, 'utf8')) as RuntimeLedger;
    const issues = validateRuntimeLedger(ledger, true);
    ledgerMemo = issues.length
      ? { identity, rejection: `Runtime ledger rejected: ${issues.join('; ')}` }
      : { identity, summary: { ...summarize(ledger.rows), head: ledger.head, archiveSha256: ledger.archive?.sha256 ?? null }, components: Object.fromEntries([...new Set(ledger.rows.flatMap(row => row.components))].map(name => [name, [...new Set(ledger.rows.filter(row => row.status === 'pass' && row.components.includes(name)).map(row => row.framework))]])) };
  }
  if (ledgerMemo.rejection) throw new Error(ledgerMemo.rejection);
  return { ...ledgerMemo.summary! };
}

/** Drop the memo. For tests that rewrite a ledger in place faster than the filesystem's mtime
 * resolution can distinguish; ordinary callers never need it. */
export function clearRuntimeLedgerMemo(): void {
  ledgerMemo = null;
}

/** Both frameworks must import the component in the currently validated complete sweep. */
export function hasCurrentRuntimeComponent(name: string): boolean {
  try { readRuntimeSummary(); return FRAMEWORKS.every(framework => ledgerMemo?.components?.[name]?.includes(framework)); }
  catch { return false; }
}
