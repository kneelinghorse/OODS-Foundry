/** Portable, read-only Stage1 redrift admission. Source paths are provenance, never fetch targets. */
import fs from 'node:fs';
import type { ErrorObject } from 'ajv';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { getAjv } from './ajv.js';
import { ToolError } from '../errors/tool-error.js';

type Doc = Record<string, any>;
export type AnalysisRef = { artifact_ref: string; json_pointer: string; run_id: string; manifest_hash?: string };
export type AnalysisInput = { path: string; sha256: string; origin: 'source_capture' | 'injected_comparand'; source_path?: string };
export type DerivedAnalysis = {
  kind: 'redrift'; schema_version: '1.0.0' | '1.1.0'; stage1_version?: string; analysis_run_id: string; analyzed_at: string;
  capture_performed: false; authentication_performed: false; redaction_performed: false;
  passes_rerun: ['semantic.drift_compare'] | ['style.fingerprint', 'semantic.drift_compare'];
  source: { run_id: string; run_path: string; manifest_path: string; manifest_sha256: string; captured_at: string; capture_time_ref?: string; target_id: string | null };
  inputs: AnalysisInput[]; outputs: ['artifacts/drift_report.json', 'artifacts/report-index.json'] | ['artifacts/drift_report.json', 'artifacts/report-index.json', 'artifacts/style_fingerprint.json'];
  recomputed_from?: Array<{ source_path: string; sha256: string }>;
};
export type AdmittedAnalysis = {
  runPath: string; manifestSha256: string; manifest: Doc; analysis: DerivedAnalysis; sourceManifest: Doc;
  report: Doc; index: Doc; figTokens?: Doc; resultState: string; resultNote: string;
  /** s221-m03: the retained documents the signals' comparands point into, each parsed once and pointer-checked above. */
  comparands: Record<string, Doc>;
  attestations: Record<string, string>; checked: string[]; notChecked: string[];
};
const string = { type: 'string', minLength: 1 };
const date = { type: 'string', format: 'date-time' };
const digest = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const relative = { type: 'string', pattern: '^(?!/)(?!.*\\\\)(?!.*(?:^|/)[.]{1,2}(?:/|$))[^/]+(?:/[^/]+)*$' };
const object = (properties: Doc, required = Object.keys(properties)) => ({ type: 'object', properties, required });
const analysisSchema = object({
  kind: { const: 'redrift' }, schema_version: { const: '1.0.0' }, analysis_run_id: { type: 'string', format: 'uuid' }, analyzed_at: date,
  capture_performed: { const: false }, authentication_performed: { const: false }, redaction_performed: { const: false },
  passes_rerun: { const: ['semantic.drift_compare'] },
  source: object({ run_id: string, run_path: string, manifest_path: relative, manifest_sha256: digest, captured_at: date, capture_time_ref: relative, target_id: { type: ['string', 'null'] } }, ['run_id', 'run_path', 'manifest_path', 'manifest_sha256', 'captured_at', 'target_id']),
  inputs: { type: 'array', minItems: 1, items: object({ path: relative, sha256: digest, origin: { enum: ['source_capture', 'injected_comparand'] }, source_path: relative }, ['path', 'sha256', 'origin']) },
  outputs: { const: ['artifacts/drift_report.json', 'artifacts/report-index.json'] },
});
// Stage1 sprint-98 contract §3/§6 at eeacc095: the analyzing build and recomputed fingerprint are explicit.
const analysisV11Schema = {
  ...analysisSchema,
  required: [...analysisSchema.required, 'stage1_version'],
  properties: {
    ...analysisSchema.properties, schema_version: { const: '1.1.0' }, stage1_version: string,
    passes_rerun: { enum: [['semantic.drift_compare'], ['style.fingerprint', 'semantic.drift_compare']] },
    outputs: { enum: [['artifacts/drift_report.json', 'artifacts/report-index.json'], ['artifacts/drift_report.json', 'artifacts/report-index.json', 'artifacts/style_fingerprint.json']] },
    recomputed_from: { type: 'array', minItems: 1, items: { ...object({ source_path: relative, sha256: digest }), additionalProperties: false } },
  },
};
const manifestSchema = object({
  schema_version: { enum: ['1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0', '1.5.0', '1.6.0', '1.7.0', '1.8.0'] }, run_id: string, mode: string, project_id: string,
  targets: { type: 'array', minItems: 1, items: object({ name: string, url: string }) },
  environment: object({ timestamp: date }),
  auth: object({ type: { const: 'none' }, redaction: object({ applied: { const: false } }) }),
  passes: { type: 'array', minItems: 1, maxItems: 1, items: object({ id: { const: 'semantic.drift_compare' }, status: { const: 'ok' }, version: string }) },
  hashes: { type: 'object', additionalProperties: digest }, analysis: { anyOf: [analysisSchema, analysisV11Schema] },
});
const refSchema = object({ artifact_ref: relative, json_pointer: { type: 'string', pattern: '^(?:/(?:[^~]|~[01])*)?$' }, run_id: string, manifest_hash: digest }, ['artifact_ref', 'json_pointer', 'run_id']);
const severityBases: Record<string, string[]> = {
  presence_drift: ['component_missing', 'unexpected_component', 'cross_page_repetition'],
  naming_drift: ['label_mismatch', 'case_only_drift', 'alias_attempted', 'brand_role_change', 'cross_page_repetition'],
  token_drift: ['token_swap', 'value_divergence', 'token_missing', 'unresolved_alias', 'cross_page_repetition'],
  value_drift: ['off_system_value'],
};
const signalSchema = {
  ...object({
    evidence_ref: refSchema, comparands: { type: 'array', minItems: 2, items: object({ surface: { enum: ['figma', 'live', 'oods', 'fig_local', 'design_source'] }, ref: refSchema }) },
    severity_level: { enum: ['low', 'medium', 'high', 'critical'] }, severity_basis: { type: 'array', minItems: 1, uniqueItems: true, items: string },
    tolerance: object({ source: { enum: ['registry_default', 'resolution_override'] }, effective: { type: 'object' } }), class: { enum: Object.keys(severityBases) },
  }),
  allOf: [
    ['value_drift', { value_family: { enum: ['color', 'font_size', 'radius', 'spacing', 'border_color', 'shadow', 'font_weight'] }, live_value: string, live_occurrences: { type: 'integer', minimum: 0 } }, object({ kind: { const: 'exact_value' }, case_sensitive: { type: 'boolean' }, include_alpha_forms: { type: 'boolean' } })],
    ['token_drift', { token_path: string, figma_value: string, live_value: string }, object({ kind: { const: 'token_value' }, discrete_match: { const: 'exact' }, numeric_epsilon_px: { type: 'number', minimum: 0 }, numeric_unit: { const: 'px' } })],
    ['naming_drift', { figma_name: string, live_label: string, normalization_applied: { type: 'array', minItems: 1, items: { enum: ['exact_match', 'case_fold', 'trim_whitespace', 'ignore_punctuation', 'locale_compare'] } } }, object({ kind: { const: 'normalized_string' }, case_sensitive: { type: 'boolean' }, trim_whitespace: { type: 'boolean' }, ignore_punctuation: { type: 'boolean' } })],
    ['presence_drift', { side: { enum: ['figma_only', 'live_only', 'oods_only'] }, entity_kind: string }, object({ kind: { const: 'normalized_identifier' }, case_sensitive: { type: 'boolean' }, trim_whitespace: { type: 'boolean' }, strip_non_alphanumeric: { type: 'boolean' } })],
  ].map(([kind, fields, tolerance]) => ({ if: { properties: { class: { const: kind } } }, then: { ...object(fields as Doc), properties: { ...fields as Doc, severity_basis: { items: { enum: severityBases[kind as string] } }, tolerance: { properties: { effective: tolerance } } } } })),
};
const states = ['measured', 'measured_zero', 'not_measured', 'not_applicable', 'needs_review'];
const validators = {
  manifest: getAjv().compile(manifestSchema),
  report: getAjv().compile(object({ kind: { const: 'drift_report' }, schema_version: { enum: ['1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0', '2.0.0'] }, generated_at: date, current_run: object({ id: string }), signals: { type: 'array', items: signalSchema } })),
  index: getAjv().compile(object({ kind: { const: 'report_index' }, schema_version: { const: '1.1.0' }, run_id: string, generated_at: date, artifacts: { type: 'array', items: object({ type: string, path: relative, result_state: { enum: states }, result_note: string }, ['type', 'path']) } })),
  // 1.6.0 retains mode-aware references, collections, scopes and soft-deleted entries as source facts.
  tokens: getAjv().compile(object({ kind: { const: 'fig_local_tokens' }, version: { enum: ['1.0.0', '1.3.0', '1.5.0', '1.6.0'] }, source: object({ file_label: string, fig_version: { type: 'integer', minimum: 0 } }), tokens: { type: 'array', items: { type: 'object' } } })),
};
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
function refuse(message: string): never { throw new ToolError('OODS-N007', `Derived analysis refused: ${message}. Nothing was written.`); }
function validate(kind: keyof typeof validators, data: unknown): void {
  const validator = validators[kind];
  if (!validator(data)) {
    const versionError = validator.errors?.find((error: ErrorObject) => error.keyword === 'enum' && /(?:schema_version|version)$/.test(error.instancePath));
    if (versionError) refuse(`${kind} unsupported ${versionError.instancePath.slice(1)} ${JSON.stringify((data as Doc)?.[versionError.instancePath.slice(1)])}; accepted: ${versionError.params.allowedValues.join(', ')}`);
    refuse(`${kind} contract ${JSON.stringify(validator.errors)}`);
  }
}
function safePath(key: string): void {
  if (!key || path.isAbsolute(key) || key.includes('\\') || key.includes('\0') || key.split('/').some(part => !part || part === '.' || part === '..')) refuse(`unsafe path ${key}`);
}

/** Resolve only own JSON properties; malformed escapes and array pseudo-indices are not RFC 6901 operands. */
export function resolveAnalysisPointer(value: unknown, pointer: string): unknown {
  if (typeof pointer !== 'string' || (pointer !== '' && !pointer.startsWith('/')) || /~(?![01])/.test(pointer)) refuse('invalid JSON pointer');
  for (const token of pointer === '' ? [] : pointer.slice(1).split('/')) {
    const part = token.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!value || typeof value !== 'object' || (Array.isArray(value) && !/^(0|[1-9][0-9]*)$/.test(part)) || !Object.hasOwn(value, part)) refuse(`unresolved JSON pointer ${pointer}`);
    value = (value as Doc)[part];
  }
  return value;
}

export function readDerivedAnalysis(runPath: string): AdmittedAnalysis {
  try {
    const root = fs.realpathSync(runPath);
    const readConfined = (key: string): Buffer => {
      safePath(key);
      const file = fs.realpathSync(path.join(root, key));
      if (!file.startsWith(root + path.sep)) refuse(`escaped path ${key}`);
      return fs.readFileSync(file);
    };
    const manifestBytes = readConfined('manifest.json');
    const manifest = JSON.parse(manifestBytes.toString('utf8')) as Doc;
    validate('manifest', manifest);
    const analysis = manifest.analysis as DerivedAnalysis;
    const outputPaths: readonly string[] = analysis.outputs;
    const manifestSha256 = hash(manifestBytes);
    if (manifest.run_id !== analysis.analysis_run_id || manifest.run_id === analysis.source.run_id) refuse('analysis/source identity collision or mismatch');
    const retained = new Map<string, Buffer>();
    const readAttested = (key: string, expected?: string): Buffer => {
      const bytes = readConfined(key);
      if (!Object.hasOwn(manifest.hashes, key) || hash(bytes) !== manifest.hashes[key] || (expected !== undefined && hash(bytes) !== expected)) refuse(`attestation mismatch for ${key}`);
      retained.set(key, bytes);
      return bytes;
    };
    const sourceManifest = JSON.parse(readAttested(analysis.source.manifest_path, analysis.source.manifest_sha256).toString('utf8')) as Doc;
    if (sourceManifest.run_id !== analysis.source.run_id || sourceManifest.environment?.timestamp !== manifest.environment.timestamp || Object.hasOwn(sourceManifest, 'analysis') || !sourceManifest.hashes) refuse('source manifest identity/time disagrees with lineage');
    const inputs = new Map<string, AnalysisInput>();
    for (const input of analysis.inputs) {
      if (inputs.has(input.path) || outputPaths.includes(input.path) || input.path === analysis.source.manifest_path || input.path === 'manifest.json') refuse(`duplicate or output masquerading as input ${input.path}`);
      inputs.set(input.path, input);
      readAttested(input.path, input.sha256);
      if (input.origin === 'source_capture' && (!input.source_path || !Object.hasOwn(sourceManifest.hashes, input.source_path) || sourceManifest.hashes[input.source_path] !== input.sha256)) refuse(`source input lineage mismatch ${input.path}`);
    }
    for (const output of analysis.outputs) readAttested(output);
    const recomputed = analysis.schema_version === '1.1.0' ? analysis.recomputed_from : undefined;
    const rerunFingerprint = (analysis.passes_rerun as readonly string[]).includes('style.fingerprint');
    const fingerprintPath = 'artifacts/style_fingerprint.json';
    if (rerunFingerprint !== outputPaths.includes(fingerprintPath) || rerunFingerprint !== Boolean(recomputed)) refuse('a recomputed fingerprint requires its rerun pass, output and source evidence together');
    const recomputedPaths = new Set<string>();
    for (const entry of recomputed ?? []) {
      if (recomputedPaths.has(entry.source_path) || sourceManifest.hashes[entry.source_path] !== entry.sha256) refuse(`recomputation lineage mismatch ${entry.source_path}`);
      recomputedPaths.add(entry.source_path);
    }
    if (rerunFingerprint) {
      const fingerprint = JSON.parse(retained.get(fingerprintPath)!.toString('utf8'));
      if (fingerprint.kind !== 'style_fingerprint' || !['1.3.0', '1.4.0'].includes(fingerprint.schema_version)) refuse(`unsupported recomputed style_fingerprint ${String(fingerprint.schema_version)}; accepted: 1.3.0, 1.4.0`);
    }
    // Hash every declared retained file, not just the two comparands used by the current screen.
    for (const key of Object.keys(manifest.hashes)) readAttested(key);
    const timeRef = analysis.source.capture_time_ref;
    if (timeRef && inputs.get(timeRef)?.origin !== 'source_capture') refuse('unresolved capture time lineage');
    const capturedAt = timeRef ? JSON.parse(retained.get(timeRef)!.toString('utf8')).captured_at : sourceManifest.environment.timestamp;
    if (capturedAt !== analysis.source.captured_at || Date.parse(analysis.analyzed_at) < Date.parse(capturedAt) || Date.parse(capturedAt) < Date.parse(sourceManifest.environment.timestamp)) refuse('capture/analysis timestamp mismatch or order');
    const report = JSON.parse(retained.get(analysis.outputs[0])!.toString('utf8')) as Doc;
    const index = JSON.parse(retained.get(analysis.outputs[1])!.toString('utf8')) as Doc;
    validate('report', report); validate('index', index);
    if (report.current_run.id !== manifest.run_id || index.run_id !== manifest.run_id) refuse('output identity mismatch');
    if (Date.parse(report.generated_at) < Date.parse(analysis.analyzed_at) || Date.parse(index.generated_at) < Date.parse(analysis.analyzed_at)) refuse('output timestamp precedes analysis');
    const figBytes = retained.get('artifacts/fig_local_tokens.json');
    const figTokens = figBytes ? JSON.parse(figBytes.toString('utf8')) as Doc : undefined;
    if (figTokens) validate('tokens', figTokens);
    const documents = new Map<string, Doc>([[analysis.outputs[0], report]]);
    for (const signal of report.signals as Doc[]) {
      const seen = new Set<string>();
      for (const comparand of signal.comparands) {
        const key = JSON.stringify([comparand.surface, comparand.ref.run_id, comparand.ref.artifact_ref, comparand.ref.json_pointer]);
        if (seen.has(key)) refuse('duplicate comparand');
        seen.add(key);
        if (!inputs.has(`artifacts/${comparand.ref.artifact_ref}`) && !(rerunFingerprint && `artifacts/${comparand.ref.artifact_ref}` === fingerprintPath)) refuse('comparand is not a retained input or admitted recomputed fingerprint');
      }
      for (const ref of [signal.evidence_ref, ...signal.comparands.map((item: Doc) => item.ref)] as AnalysisRef[]) {
        const key = `artifacts/${ref.artifact_ref}`;
        safePath(key);
        if (key !== analysis.outputs[0] && !inputs.has(key) && !(rerunFingerprint && key === fingerprintPath)) refuse(`unresolved operand ${key}`);
        if (ref.run_id !== manifest.run_id && ref.run_id !== analysis.source.run_id) refuse('unresolved operand run identity');
        if (ref.run_id === analysis.source.run_id && (inputs.get(key)?.origin !== 'source_capture' || inputs.get(key)?.source_path !== key)) refuse('operand falsely attributed to source capture');
        if (ref.manifest_hash && ref.manifest_hash !== (ref.run_id === manifest.run_id ? manifestSha256 : analysis.source.manifest_sha256)) refuse('operand manifest hash mismatch');
        if (!documents.has(key)) documents.set(key, JSON.parse(retained.get(key)!.toString('utf8')));
        resolveAnalysisPointer(documents.get(key), ref.json_pointer);
      }
    }
    const entries = index.artifacts.filter((entry: Doc) => entry.type === 'drift_report' && entry.path === 'drift_report.json');
    if (entries.length !== 1) refuse('missing or duplicate drift result');
    const resultState = entries[0].result_state ?? 'unknown';
    // Stage1 2.0 can measure declared family presence while emitting no value-drift signals.
    const measuredPresence = report.schema_version === '2.0.0' && report.declared_presence?.state === 'measured';
    if ((resultState === 'measured' && report.signals.length === 0 && !measuredPresence) || (['measured_zero', 'not_measured', 'not_applicable'].includes(resultState) && report.signals.length !== 0)) refuse('result state contradicts signal count');
    if (hash(readConfined('manifest.json')) !== manifestSha256) refuse('manifest changed during admission');
    return { runPath: root, manifestSha256, manifest, analysis, sourceManifest, report, index, figTokens, comparands: Object.fromEntries(documents), resultState, resultNote: entries[0].result_note ?? 'No measurement state was recorded; absence is not evidence of conformance.',
      attestations: { ...manifest.hashes, 'manifest.json': manifestSha256 },
      checked: ['admitted consumed contracts', 'separate source/analysis identities and times', 'declared analysis passes; no capture/authentication/redaction', 'all retained SHA-256 and confined realpaths', 'source input and recomputed-fingerprint lineage', 'output identity and result state', 'signal comparands and RFC 6901 pointers', 'unchanged manifest during read'],
      notChecked: ['Producer measurement correctness is not recomputed.', 'Copied inputs are byte-attested, not rerun or fully schema-validated.', 'No source capture path is opened; its retained manifest and crawl establish lineage.', 'No human acceptance, rendering or public-distribution claim.'],
    };
  } catch (error) {
    if (error instanceof ToolError) throw error;
    refuse(error instanceof Error ? error.message : String(error));
  }
}
