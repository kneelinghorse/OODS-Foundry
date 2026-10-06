/**
 * The run view (s205-m04): a Stage1 run's real records, read ONLY through structuredData.fetch's admitted run-view
 * kinds, shaped as the capture objects' records (objects/capture/Run, Finding, CapturedArtifact).
 *
 * Forge reads a run from disk and never calls Stage1; every file used is under the run manifest's sha256
 * attestation (structuredData.fetch refuses one that is not). Nothing here proposes, applies or queues anything: a
 * person reads the view and decides outside Forge.
 *
 * Refusals write nothing, and are thrown before any version is composed or touched:
 *   OODS-V212  the path is not a Stage1 run — no run manifest, or one without the shape a run view reads
 *   OODS-V213  an artifact the view needs is outside the admitted contract — its version, its kind, or its
 *              attestation
 *   OODS-V214  the run does not match the composition — the object is not a capture object, or the version
 *              already shows a run of a different target
 */
import { ToolError } from '../errors/tool-error.js';
import { handle as fetchStructured } from '../tools/structuredData.fetch.js';

export const RUN_VIEW_OBJECTS = ['Run', 'Finding', 'CapturedArtifact'] as const;
export type RunViewObject = (typeof RUN_VIEW_OBJECTS)[number];
type Row = Record<string, unknown>;

export type RunView = {
  runId: string;
  target: string;
  runPath: string;
  records: Record<RunViewObject, Row[]>;
  manifestSha256: string;
  attestations: Record<string, string>;
  coverage: { findings: number; pages: number; pagesWithFindings: number; evidenceRefs: number; artifacts: number; attestedFiles: number; readMs: number };
  kinds: Record<string, string>;
};

/** What a version stores about the run it shows. */
export type StoredRunView = Omit<RunView, 'records' | 'attestations'> & { readAt: string; recordId?: string; presentation?: 'stage1-inspection'; evidence?: Array<{ locator: string; sha256: string }>; limits?: Array<{ kind: string; state: string; note: string }> };

async function fetchKind(kind: 'run_manifest' | 'a11y_report' | 'report_index' | 'a11y_evidence', runPath: string) {
  try {
    return await fetchStructured({ kind, runPath });
  } catch (error) {
    if (error instanceof ToolError && error.opiCode === 'OODS-N007') {
      const message = error.message;
      if (kind === 'run_manifest' && /No Stage1 run manifest|does not have the shape|runPath does not exist/.test(message)) {
        // s206-m03: a path that does not exist says so; a directory that is not a run says what one looks like.
        const cause = /runPath does not exist/.test(message) ? `runPath ${runPath} does not exist.` : `${runPath} is not a Stage1 run: ${message}`;
        throw new ToolError('OODS-V212', `design.preview: ${cause} Point runPath at one Stage1 run, the directory that holds the run's manifest.json. Nothing was written.`, { runPath, kind, reason: message });
      }
      throw new ToolError('OODS-V213', `design.preview: the run's ${kind} is outside the admitted contract — ${message} Nothing was written.`, { runPath, kind, reason: message, detail: error.details ?? null });
    }
    throw error;
  }
}

/** Record only capture facts the manifest carries; older runs cannot acquire a newer build's provenance. */
function captureNote(manifest: Record<string, any>): string {
  const environment = manifest.environment;
  const passes = Object.entries(environment.capture?.passes ?? {}) as Array<[string, Record<string, any>]>;
  const browsers = new Map<string, string[]>();
  for (const [pass, record] of passes) {
    const browser = record.browser;
    const label = browser ? `${browser.version ?? 'unknown'} (${browser.color_scheme ?? 'unknown'} colour scheme)` : 'unknown';
    browsers.set(label, [...(browsers.get(label) ?? []), pass]);
  }
  const browser = browsers.size === 1 ? [...browsers.keys()][0] : [...browsers].map(([label, names]) => `${label} for ${names.join(', ')}`).join('; ');
  const tiers = [...new Set(passes.map(([, record]) => record.tier).filter(Boolean))];
  return `Stage: ${environment.stage ?? 'unknown'}; sampling: ${environment.sampling ?? 'unknown'}; Stage1 build: ${environment.stage1_version ?? 'unknown'}. Browser: ${browser || 'unknown'}. Capture tiers: ${tiers.join(', ') || 'unknown'}. Authentication is shown as recorded.`;
}

export async function readRunView(runPath: string): Promise<RunView> {
  const started = performance.now();
  const manifestRead = await fetchKind('run_manifest', runPath);
  const manifestSha256 = String((manifestRead.meta as Record<string, unknown>).manifestSha256);
  const manifest = manifestRead.payload as Record<string, any>;
  const a11yRead = await fetchKind('a11y_report', runPath);
  const indexRead = await fetchKind('report_index', runPath);
  const a11y = a11yRead.payload as Record<string, any>;
  const index = indexRead.payload as Record<string, any>;
  const evidenceRead = await fetchKind('a11y_evidence', runPath);
  for (const read of [a11yRead, indexRead, evidenceRead]) if ((read.meta as Record<string, unknown>).manifestSha256 !== manifestSha256 || read.runId !== manifest.run_id) throw new ToolError('OODS-V213', 'Capture manifest changed while reading; open a fresh run view. Nothing was written.');
  const evidence = evidenceRead.payload as { pages: Array<{ route: string; url: string; evidencePath: string; evidence: Record<string, any> }> };

  const target = manifest.targets[0] as { name: string; url: string };
  const severity = a11y.rollup?.by_severity ?? {};
  const run: Row = {
    run_id: manifest.run_id, target_name: target.name, target_url: target.url, mode: manifest.mode, auth_type: manifest.auth?.type ?? 'unknown',
    auth_mechanisms: manifest.auth?.mechanisms?.join(', '), auth_api_kind: manifest.auth?.api_auth_kind,
    auth_redaction_applied: manifest.auth?.redaction?.applied,
    // Keep the historical record key for existing readers; the unavailable field is never placed in a view.
    auth_provenance_note: captureNote(manifest),
    capture_note: captureNote(manifest),
    page_count: a11y.pages.length, finding_count: a11y.rollup?.violation_count,
    needs_review_count: a11y.rollup?.needs_review_count, accessibility_score: a11y.rollup?.accessibility_score,
    critical_count: severity.critical, serious_count: severity.serious, moderate_count: severity.moderate, minor_count: severity.minor, unknown_count: severity.unknown,
    pass_count: manifest.passes.length, passes_failed: manifest.passes.filter((pass: { status: string }) => pass.status !== 'ok').length,
    artifact_count: index.artifacts.length, evidence_retained: manifest.evidence_retention?.retained ?? null,
    provenance_source: 'Stage1', provenance_record: manifest.project_id, provenance_locator: 'manifest.json',
    provenance_method: `Stage1 ${manifest.mode} capture, ${manifest.passes.length} passes`, provenance_at: manifest.environment.timestamp,
  };
  const findings: Row[] = evidence.pages.flatMap(page => [
    ['violation', page.evidence.violations ?? []],
    ['needs_review', page.evidence.incomplete ?? []],
  ].flatMap(([state, items]) => (items as Array<Record<string, any>>).map(item => ({
    // Retain historical violation IDs; a review of the same rule/page has its own stable identity.
    finding_id: `${page.route}#${item.id}${state === 'needs_review' ? '#needs_review' : ''}`,
    title: item.help, description: item.description, impact: item.impact ?? 'unknown',
    rule_id: item.id, route: page.route, page_url: page.url, node_count: item.node_count, selectors: item.selectors, criteria: item.tags,
    reasons: item.reasons?.join('\n'), help_url: item.help_url, provenance_source: 'Stage1', provenance_record: manifest.run_id, provenance_locator: page.evidencePath,
    provenance_method: `${page.evidence.test_engine?.name} ${page.evidence.test_engine?.version}`, provenance_at: page.evidence.timestamp,
    result_state: state,
  }))));
  const artifacts: Row[] = index.artifacts.map((entry: Record<string, any>) => ({
    artifact_id: `${manifest.run_id}:${entry.path}`, path: entry.path, artifact_kind: entry.type, description: entry.description,
    // The index may omit the artifact's version. Explicit absence must override the sample record's version.
    schema_version: entry.schema_version ?? null,
    sha256: manifest.hashes[`artifacts/${entry.path}`] ?? null, bytes: entry.metadata?.bytes ?? null,
    result_state: entry.result_state ?? 'unknown', result_note: entry.result_note,
    provenance_source: 'Stage1', provenance_record: manifest.run_id, provenance_locator: `artifacts/${entry.path}`,
    provenance_method: manifest.hashes[`artifacts/${entry.path}`] ? 'sha256 attested by the run manifest' : 'not attested by the run manifest',
    provenance_at: entry.metadata?.modified_at ?? manifest.environment.timestamp,
  }));
  return {
    runId: manifest.run_id, target: target.name, runPath, manifestSha256, attestations: { ...manifest.hashes, "manifest.json": manifestSha256 },
    records: { Run: [run], Finding: findings, CapturedArtifact: artifacts },
    coverage: {
      findings: findings.length, pages: evidence.pages.length, pagesWithFindings: new Set(findings.map(finding => finding.route)).size,
      evidenceRefs: new Set(findings.map(finding => finding.provenance_locator)).size, artifacts: artifacts.length,
      attestedFiles: Number((evidenceRead.meta as { attestedFiles?: number } | undefined)?.attestedFiles ?? 0), readMs: Math.round(performance.now() - started),
    },
    kinds: { run_manifest: manifestRead.schemaVersion!, a11y_report: a11y.schema_version, report_index: index.schema_version, a11y_evidence: evidenceRead.schemaVersion! },
  };
}

/** OODS-V214: the run must match the composition it is shown in. */
export function assertRunMatches(object: string, view: RunView, bound: StoredRunView | undefined): void {
  if (!(RUN_VIEW_OBJECTS as readonly string[]).includes(object)) {
    throw new ToolError('OODS-V214', `design.preview: this composition shows ${JSON.stringify(object || null)}, and a run view shows only ${RUN_VIEW_OBJECTS.join(', ')}. Nothing was written.`, { object: object || null, runId: view.runId });
  }
  if (bound && (bound.target !== view.target || bound.runId !== view.runId || (bound.manifestSha256 && bound.manifestSha256 !== view.manifestSha256))) {
    throw new ToolError('OODS-V214', `design.preview: this version shows run ${bound.runId} of ${bound.target}; ${view.runId} is a run of ${view.target}. A version's records never change subject underneath it — compose a new one. Nothing was written.`, { bound: { runId: bound.runId, target: bound.target }, requested: { runId: view.runId, target: view.target } });
  }
}

/** Select before composing so a typo cannot create an apparently valid first-record detail. */
export function selectRunRecord(view: RunView, object: RunViewObject, recordId?: string): Row | undefined {
  const key = { Run: 'run_id', Finding: 'finding_id', CapturedArtifact: 'artifact_id' }[object];
  const row = recordId === undefined ? view.records[object][0] : view.records[object].find(row => row[key] === recordId);
  if (recordId !== undefined && !row) throw new ToolError('OODS-V214', `design.preview: no ${object} record ${JSON.stringify(recordId)} in run ${view.runId}. Nothing was written.`, { recordId, runId: view.runId });
  return row;
}
