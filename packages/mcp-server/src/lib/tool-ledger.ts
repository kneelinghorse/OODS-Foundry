import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import registry from '../tools/registry.json' with { type: 'json' };

/** Where the specs that import a tool's handler live (s213-m02): a location, never an execution result. */
const LOCATIONS = ['test/product-reality', 'test/contracts', 'other-spec', 'none'] as const;
type Location = typeof LOCATIONS[number];
type ImportRef = { path: string; line: number; handler: string };
type PortableOutcome = { outcome: 'pass' | 'typed'; code?: string; retryable?: boolean; receiptSha256: string; bundleHead?: string };
type ReceiptBinding = { path: string; sha256: string; bundleHead: string };
type PortableLimit = { tool: string; status: string; kind: string; source: 'e2e' | 'limits-probe'; code?: string; retryable?: boolean; receipt: ReceiptBinding };
type PortableExecution = { path: string; sha256: string; bundleHead: string; dirty: boolean; tools: number; pass: number; typed: number };
type LimitsProbe = { path: string; sha256: string; bundleHead: string; payloadTreeSha256: string; archiveSha256: string; probes: number };
type CertifiedReceipt = { path: string; sha256: string; kind: string; certifiedBy: number; outcome: string };
type ToolRow = { portableE2E: boolean; portableOutcome?: PortableOutcome; portableLimits?: PortableLimit[]; caveats: Array<{ kind: string; observed?: { receiptSha256: string; probes: string[] } }>; certifiedReceipts: CertifiedReceipt[]; name: string; registration: 'auto' | 'on-demand'; testImportLocation: Location; testImports: Record<Exclude<Location, 'none'>, ImportRef[]>; advertisedClaim: { description: string; inputSchemaDescription: string }; claimHash: string };
type ToolLedger = { mode?: 'latest' | 's194' | 's196' | 's200' | 's201' | 's202' | 's203' | 's204' | 's205' | 's206' | 's207' | 's211' | 's212' | 's213'; portableExecution?: PortableExecution; limitsProbe?: LimitsProbe; schemaVersion: string; head: string; builderSelfCertified: false; rows: ToolRow[]; summary: { entries: number; auto: number; onDemand: number; byTestImportLocation: Record<Location, number>; autoByTestImportLocation: Record<Location, number>; onDemandByTestImportLocation: Record<Location, number>; portableE2E: number; caveats: number; portableLimits: number } };
export type ToolSummary = { entries: number; byTestImportLocation: Record<Location, number>; head: string; sourceHead: string; portable: PortableExecution | null };
/** One retained extracted-runtime receipt per bound mode; s200 ships the brand source (design.preview stays typed), s201 ships the preview host (nothing typed), s202 adds the MCP Apps resources to the same E2E (nothing typed), s203 keeps both with 23 objects in the archive (nothing typed), s204 keeps all of it with health's trait count live (nothing typed), s205 keeps all of it with 26 objects and 49 traits in the archive and the run view (nothing typed), s206 binds the hardened bundle with the same counts and no typed outcomes, s207 the tester-ready one, s211 the controlled package's archive (bound at m03's freeze). */
const PORTABLE_RECEIPTS = { s196: 'artifacts/product-reality/sprint-196/m02/e2e-host.json', s200: 'artifacts/product-reality/sprint-200/m04/e2e-host.json', s201: 'artifacts/product-reality/sprint-201/m07/pre-freeze/e2e-host.json', s202: 'artifacts/product-reality/sprint-202/m06/pre-freeze/e2e-host.json', s203: 'artifacts/product-reality/sprint-203/m06/pre-freeze/e2e-host.json', s204: 'artifacts/product-reality/sprint-204/m06/pre-freeze/e2e-host.json', s205: 'artifacts/product-reality/sprint-205/m06/pre-freeze/e2e-host.json', s206: 'artifacts/product-reality/sprint-206/m05/pre-freeze/e2e-host.json', s207: 'artifacts/product-reality/sprint-207/m04/pre-freeze/e2e-host.json', s211: 'artifacts/product-reality/sprint-211/m03/pre-freeze/e2e-host.json', s212: 'artifacts/product-reality/sprint-212/m06/pre-freeze/e2e-host.json', s213: 'artifacts/product-reality/sprint-213/m01/pre-freeze/e2e-host.json' } as const;
const PORTABLE_TYPED_CODES: Record<keyof typeof PORTABLE_RECEIPTS, Record<string, string>> = { s196: { 'brand.apply': 'OODS-N020', 'design.preview': 'OODS-N019' }, s200: { 'design.preview': 'OODS-N019' }, s201: {}, s202: {}, s203: {}, s204: {}, s205: {}, s206: {}, s207: {}, s211: {}, s212: {}, s213: {} };
const counts = (rows: ToolRow[]) => Object.fromEntries(LOCATIONS.map(location => [location, rows.filter(row => row.testImportLocation === location).length])) as Record<Location, number>;

/** Validate the finite roster, its evidence bindings and the derived locations before serving any count. */
export function projectToolSummary(value: unknown): ToolSummary {
  const ledger = value as ToolLedger;
  const reject = (reason: string): never => { throw new Error(`Tool ledger rejected: ${reason}`); };
  if (!ledger || ledger.schemaVersion !== '2.0.0' || !/^[0-9a-f]{40}$/.test(ledger.head ?? '') || ledger.builderSelfCertified !== false || !Array.isArray(ledger.rows)) reject('invalid identity or approval state');
  if (ledger.mode !== undefined && ledger.mode !== 'latest' && ledger.mode !== 's194' && ledger.mode !== 's196' && ledger.mode !== 's200' && ledger.mode !== 's201' && ledger.mode !== 's202' && ledger.mode !== 's203' && ledger.mode !== 's204' && ledger.mode !== 's205' && ledger.mode !== 's206' && ledger.mode !== 's207' && ledger.mode !== 's211' && ledger.mode !== 's212' && ledger.mode !== 's213') reject('unknown mode');
  const bound = ledger.mode === 'latest' || ledger.mode === 's196' || ledger.mode === 's200' || ledger.mode === 's201' || ledger.mode === 's202' || ledger.mode === 's203' || ledger.mode === 's204' || ledger.mode === 's205' || ledger.mode === 's206' || ledger.mode === 's207' || ledger.mode === 's211' || ledger.mode === 's212' || ledger.mode === 's213' ? ledger.mode : undefined;
  const typedCodes = bound && bound !== 'latest' ? PORTABLE_TYPED_CODES[bound] : {};
  const typedCount = Object.keys(typedCodes).length;
  const execution = ledger.portableExecution;
  const probe = ledger.limitsProbe;
  if (probe !== undefined && (!/^sha256:[0-9a-f]{64}$/.test(probe.sha256) || !/^[0-9a-f]{40}$/.test(probe.bundleHead) || typeof probe.path !== 'string')) reject('limits probe malformed');
  if (bound && (!execution || (bound === 'latest' ? typeof execution.path !== 'string' || !execution.path.startsWith('artifacts/product-reality/') || execution.path.split('/').includes('..') : execution.path !== PORTABLE_RECEIPTS[bound]) || !/^sha256:[0-9a-f]{64}$/.test(execution.sha256) || !/^[0-9a-f]{40}$/.test(execution.bundleHead) || typeof execution.dirty !== 'boolean' || execution.tools !== registry.auto.length || execution.pass !== registry.auto.length - typedCount || execution.typed !== typedCount)) reject('portable execution proof missing or malformed');
  const expected = [...registry.auto, ...registry.onDemand];
  if (JSON.stringify(ledger.rows.map(row => row?.name)) !== JSON.stringify(expected)) reject('exact registered population required');
  for (const row of ledger.rows) {
    if (row.registration !== (registry.auto.includes(row.name) ? 'auto' : 'on-demand')) reject(`${row.name}: registration mismatch`);
    for (const location of LOCATIONS.slice(0, 3) as Exclude<Location, 'none'>[]) {
      const refs = row.testImports?.[location];
      if (!Array.isArray(refs) || refs.some(ref => typeof ref.path !== 'string' || !ref.path || !Number.isInteger(ref.line) || ref.line < 1 || typeof ref.handler !== 'string' || !ref.handler)) reject(`${row.name}: malformed test imports`);
    }
    const derived = LOCATIONS.find(location => location !== 'none' && row.testImports[location].length) ?? 'none';
    if (derived !== row.testImportLocation) reject(`${row.name}: location differs from test imports`);
    if (!Array.isArray(row.certifiedReceipts) || row.certifiedReceipts.some(ref => typeof ref.path !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(ref.sha256) || !Number.isInteger(ref.certifiedBy) || typeof ref.outcome !== 'string')) reject(`${row.name}: certified receipt not hash-bound to its certification`);
    if (ledger.mode === 's194' || bound) {
      if (!Array.isArray(row.caveats) || row.caveats.some(caveat => caveat.kind !== 'documented-limit' || (caveat.observed !== undefined && !/^sha256:[0-9a-f]{64}$/.test(caveat.observed.receiptSha256)))) reject(`${row.name}: unresolved claim`);
      if (row.registration === 'auto' && (row.testImportLocation !== 'test/product-reality' || row.portableE2E !== true)) reject(`${row.name}: advertised boundary coverage missing`);
      if (row.registration === 'on-demand' && !['test/contracts', 'test/product-reality'].includes(row.testImportLocation)) reject(`${row.name}: on-demand boundary coverage missing`);
    }
    if (bound) {
      const outcome = row.portableOutcome;
      const limits = row.portableLimits;
      if (!Array.isArray(limits)) reject(`${row.name}: portable limits missing`);
      // A runtime limit is either the E2E's typed outcome or what the limits probe observed on the same archive.
      const typed = limits!.filter(limit => limit.source === 'e2e');
      const probed = limits!.filter(limit => limit.source === 'limits-probe');
      if (typed.length + probed.length !== limits!.length) reject(`${row.name}: portable limit without a source`);
      if (probed.length && (!probe || probe.bundleHead !== execution!.bundleHead)) reject(`${row.name}: runtime limit without the probe of this archive`);
      if (probed.some(limit => limit.tool !== row.name || limit.status !== 'observed' || limit.kind !== 'documented-limit' || limit.receipt?.path !== probe!.path || limit.receipt.sha256 !== probe!.sha256 || limit.receipt.bundleHead !== probe!.bundleHead)) reject(`${row.name}: runtime limit not bound to the probe receipt`);
      if (row.registration === 'auto') {
        if (!outcome || !['pass', 'typed'].includes(outcome.outcome) || outcome.receiptSha256 !== execution!.sha256 || (bound === 'latest' && outcome.bundleHead !== execution!.bundleHead)) reject(`${row.name}: portable outcome not bound to receipt`);
        const expectedCode = typedCodes[row.name];
        if (expectedCode) {
          if (outcome!.outcome !== 'typed' || outcome!.code !== expectedCode || outcome!.retryable !== (row.name === 'design.preview')) reject(`${row.name}: typed portable dependency code missing`);
          const limit = typed[0];
          if (typed.length !== 1 || limit?.tool !== row.name || limit.status !== 'typed' || limit.kind !== 'documented-limit' || limit.code !== expectedCode || limit.retryable !== outcome!.retryable || limit.receipt?.path !== execution!.path || limit.receipt.sha256 !== execution!.sha256 || limit.receipt.bundleHead !== execution!.bundleHead) reject(`${row.name}: portable limit not bound to typed outcome`);
        } else if (outcome!.outcome !== 'pass' || outcome!.code !== undefined || typed.length !== 0) reject(`${row.name}: successful portable execution required`);
      } else if (outcome !== undefined || typed.length !== 0) reject(`${row.name}: unexecuted on-demand portable claim`);
    }
    const claim = row.advertisedClaim;
    if (!claim || typeof claim.description !== 'string' || typeof claim.inputSchemaDescription !== 'string') reject(`${row.name}: missing claim`);
    const hash = `sha256:${createHash('sha256').update(JSON.stringify(claim, null, 2) + '\n').digest('hex')}`;
    if (hash !== row.claimHash) reject(`${row.name}: claim hash mismatch`);
  }
  const byTestImportLocation = counts(ledger.rows);
  const summary = ledger.summary;
  if (!summary || summary.entries !== expected.length || summary.auto !== registry.auto.length || summary.onDemand !== registry.onDemand.length || JSON.stringify(summary.byTestImportLocation) !== JSON.stringify(byTestImportLocation) || JSON.stringify(summary.autoByTestImportLocation) !== JSON.stringify(counts(ledger.rows.filter(row => row.registration === 'auto'))) || JSON.stringify(summary.onDemandByTestImportLocation) !== JSON.stringify(counts(ledger.rows.filter(row => row.registration === 'on-demand')))) reject('summary differs from registered rows');
  if (summary.portableE2E !== ledger.rows.filter(row => row.portableE2E).length) reject('portable summary differs from rows');
  if (summary.caveats !== ledger.rows.reduce((sum, row) => sum + row.caveats.length, 0) || summary.portableLimits !== ledger.rows.reduce((sum, row) => sum + (row.portableLimits?.length ?? 0), 0)) reject('limit summary differs from rows');
  return { entries: ledger.rows.length, byTestImportLocation, head: execution?.bundleHead ?? ledger.head, sourceHead: ledger.head, portable: execution ?? null };
}

export function readToolSummary(): ToolSummary {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  // The build ships the same canonical ledger inside dist; source runs read registry/.
  const bundled = path.resolve(directory, '../registry/tool-capability-ledger.v1.json');
  const source = path.resolve(directory, '../../registry/tool-capability-ledger.v1.json');
  return projectToolSummary(JSON.parse(fs.readFileSync(process.env.MCP_TOOL_LEDGER_PATH ?? (fs.existsSync(bundled) ? bundled : source), 'utf8')));
}
