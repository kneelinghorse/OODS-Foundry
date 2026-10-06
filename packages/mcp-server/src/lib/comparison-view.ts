import { readDerivedAnalysis, type AdmittedAnalysis, type AnalysisRef } from './derived-analysis.js';
import { ToolError } from '../errors/tool-error.js';

export const COMPARISON_OBJECTS = ['Comparison', 'ComparisonSignal'] as const;
export type ComparisonObject = typeof COMPARISON_OBJECTS[number];
type Row = Record<string, unknown>;
export type ComparisonEvidence = { locator: string; sha256: string; jsonPointer: string; label: string };
export type StoredComparisonView = {
  analysisId: string; sourceRunId: string; analysisPath: string; manifestSha256: string; target: string;
  capturedAt: string; sourceManifestAt: string; analyzedAt: string; recordId?: string;
  attestations: Record<string, string>; evidence: ComparisonEvidence[];
};
export type ComparisonView = { admitted: AdmittedAnalysis; records: Record<ComparisonObject, Row[]> };

// s210-m01: every row says what was compared and what came of it in a person's words, and keeps the identifiers,
// digests and paths a reader may need behind the detail's "Identity and provenance" tab
// (objects/capture/Comparison*.object.yaml). Each sentence is a projection of Stage1's retained bytes: the numbers are
// the report's own value join; nothing is recomputed, graded or rewritten. The type limitation Sprint 209 fixed stands:
// the face-specific design comparand is incomplete, so no type conformance ratio is ever stated. s211-m02 (#2292): that
// caveat is one sentence wherever it is shown, beside the state Stage1 recorded, which Forge never re-judges.
const typeLimit = 'The face-specific type comparand is incomplete, so no type conformance ratio exists and font sizes need review.';
const FAMILY_NOUN: Record<string, [string, string]> = { color: ['color', 'colors'], font_size: ['font size', 'font sizes'], radius: ['radius', 'radii'] };
const familyWords = (family: string) => family.replaceAll('_', ' ');
const noun = (family: string, count: number) => (FAMILY_NOUN[family] ?? [`${familyWords(family)} value`, `${familyWords(family)} values`])[count === 1 ? 0 : 1];
const humanize = (value: string) => familyWords(value).replace(/^./, letter => letter.toUpperCase());
/** The day a retained instant falls on, in UTC, so the same words render in every host timezone (Sprint 196). */
export const dayLabel = (iso: string) => { const date = new Date(iso); return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }); };
type Family = { family: string; verdict?: string; conformant?: number; off_system?: number; live_distinct_values?: number; ds_token_values?: number; excluded_by_alpha_policy?: { live?: number; ds?: number }; resolutions?: Array<{ live_value?: string }>; live_basis?: string; explained_values?: number; excluded_values?: number; empty_reason?: string; occurrences?: { total: number; compared: number; not_painted: number | null; third_party: number | null; browser_default: number | null }; by_typeface?: Array<{ typeface: string; comparand: string; conformant: number; explained_values: number; off_system: number; no_comparand_values: number }> };
/** The live sizes a font-size join counted but neither matched nor signalled, and the typefaces they are set in when the retained bytes say. */
export type Uncompared = { count: number; families: string[] };
const listWords = (items: string[]) => items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
const notJoined = 'Not measured; no completed value join was recorded.';
/**
 * One family's result as a sentence: the report's counts, the off-system values named, the alpha exclusions stated.
 * s221-m03 (Stage1's note, eff22ec8): the font-size join runs per typeface, so a size set in a typeface the design
 * declares no size for has nothing to compare with; it is neither matched nor off-system, and it has no design match.
 */
export function familySentence(row: Family | undefined, family: string, offValues: string[], uncompared: Uncompared = { count: 0, families: [] }): string {
  if (row?.live_basis) {
    const basis = row.live_basis === 'raw_values' ? 'raw' : 'cluster-median';
    if (row.verdict === 'empty_comparand') return `${row.live_distinct_values ?? 0} live ${noun(family, row.live_distinct_values ?? 0)} have no comparable design values. No conformance result: ${row.empty_reason ?? 'the comparand is empty'}`;
    if (!['joined', 'disjoint'].includes(row.verdict ?? '')) return notJoined;
    const counts = `${row.conformant ?? 0} of ${row.live_distinct_values ?? 0} compared ${basis} ${noun(family, row.live_distinct_values ?? 0)} are exact token matches; ${row.explained_values ?? 0} ${row.explained_values === 1 ? 'is' : 'are'} explained separately; ${row.off_system ?? 0} ${row.off_system === 1 ? 'is' : 'are'} off-system${offValues.length ? ` (${offValues.join(', ')})` : ''}. ${row.excluded_values ?? 0} values are excluded by occurrence category.`;
    const alpha = row.excluded_by_alpha_policy;
    const alphaNote = alpha && (alpha.live || alpha.ds) ? ` ${alpha.live ?? 0} live and ${alpha.ds ?? 0} design alpha values are excluded by the alpha policy.` : '';
    const occurrences = row.occurrences;
    const categories = occurrences ? ` Occurrences: ${occurrences.compared} compared of ${occurrences.total} sampled; not painted ${occurrences.not_painted ?? 'not recorded'}; third party ${occurrences.third_party ?? 'not recorded'}; browser default ${occurrences.browser_default ?? 'not recorded'}.` : '';
    const faces = family === 'font_size' && row.by_typeface?.length ? ` By typeface: ${row.by_typeface.map(face => `${face.typeface} (${familyWords(face.comparand)}): ${face.conformant} exact, ${face.explained_values} explained, ${face.off_system} off-system, ${face.no_comparand_values} without a comparand`).join('; ')}.` : '';
    return counts + alphaNote + categories + faces;
  }
  if (!row || row.verdict !== 'joined') return notJoined;
  const live = row.live_distinct_values ?? 0, ok = row.conformant ?? 0, off = row.off_system ?? 0, ds = row.ds_token_values ?? 0;
  if (family === 'font_size') {
    const none = live - ok;
    const lead = `${none} of ${live} live ${noun(family, live)} ${none === 1 ? 'has' : 'have'} no design match`;
    if (!uncompared.count) return `${lead}. ${typeLimit}`;
    const set = uncompared.families.length ? `the ${uncompared.count} set in ${listWords(uncompared.families)}` : String(uncompared.count);
    return `${lead}: ${off} ${off === 1 ? 'matches' : 'match'} no size the design declares for ${off === 1 ? 'its' : 'their'} typeface, and ${set} had no design size to compare with. ${typeLimit}`;
  }
  const match = off === 0
    ? `All ${live} live ${noun(family, live)} match the ${ds} design values; none is off-system.`
    : `${ok} of ${live} live ${noun(family, live)} match the ${ds} design values; ${off} ${off === 1 ? 'is' : 'are'} off-system${offValues.length ? ` (${offValues.join(', ')})` : ''}.`;
  const alpha = row.excluded_by_alpha_policy;
  return alpha && (alpha.live || alpha.ds) ? `${match} ${alpha.live ?? 0} live and ${alpha.ds ?? 0} design alpha values were excluded from the comparison.` : match;
}
/** The same result in a clause for the one-line description. */
export function familyClause(row: Family, family: string): string {
  const live = row.live_distinct_values ?? 0, ok = row.conformant ?? 0, off = row.off_system ?? 0;
  if (row.live_basis) return `${ok} of ${live} compared ${noun(family, live)} match exactly, ${row.explained_values ?? 0} explained and ${off} off-system`;
  if (family === 'font_size') return `${off} ${noun(family, off)} ${off === 1 ? 'needs' : 'need'} review (type comparand incomplete)`;
  return off === 0 ? `all ${live} ${noun(family, live)} match` : `${ok} of ${live} ${noun(family, live)} match`;
}
const describeTolerance = (tolerance: any): string => {
  const effective = tolerance?.effective ?? {};
  const kind = effective.kind === 'exact_value' ? 'Exact value match' : humanize(String(effective.kind ?? 'unspecified'));
  return `${kind}; ${effective.case_sensitive ? 'case-sensitive' : 'case-insensitive'}; alpha forms ${effective.include_alpha_forms ? 'included' : 'excluded'}${tolerance?.source ? ` (${familyWords(String(tolerance.source))})` : ''}.`;
};
export function readComparisonView(analysisPath: string): ComparisonView {
  const admitted = readDerivedAnalysis(analysisPath);
  const { analysis, report, figTokens, manifest } = admitted;
  const target = manifest.targets[0].name;
  const rawContract = report.schema_version === '1.4.0';
  const rerunFingerprint = (analysis.passes_rerun as readonly string[]).includes('style.fingerprint');
  const provenance = { provenance_source: 'Stage1', provenance_record: analysis.analysis_run_id, provenance_method: `${analysis.passes_rerun.join(', ')}; ${rerunFingerprint ? 'fingerprint recomputed from retained evidence' : 'retained capture inputs copied, not rerun'}`, provenance_at: analysis.analyzed_at };
  const families: Family[] = Array.isArray(report.value_join?.families) ? report.value_join.families : [];
  const join = (family: string) => families.find(entry => entry.family === family);
  const signalsOf = (family: string) => (report.signals as any[]).filter(signal => signal.value_family === family);
  const offValues = (family: string) => signalsOf(family).map(signal => String(signal.live_value ?? signal.live_label ?? '')).filter(Boolean);
  // The font sizes the join counted but neither matched nor signalled. A typeface is named only when every size the
  // retained style fingerprint records for it is one of them and no signal points at it, and the sizes add up.
  const uncomparedFontSizes = (): Uncompared => {
    const row = join('font_size');
    const count = row ? (row.live_distinct_values ?? 0) - (row.conformant ?? 0) - (row.off_system ?? 0) : 0;
    const families = (admitted.comparands['artifacts/style_fingerprint.json'] as any)?.type_scale?.font_sizes_by_family;
    if (count <= 0 || !Array.isArray(families)) return { count: Math.max(count, 0), families: [] };
    const signalled = new Set(signalsOf('font_size').flatMap(signal => (signal.comparands as any[]).filter(item => item.surface === 'live' && item.ref.artifact_ref === 'style_fingerprint.json').map(item => /^\/type_scale\/font_sizes_by_family\/(\d+)\//.exec(String(item.ref.json_pointer))?.[1])));
    const matched = new Set((row!.resolutions ?? []).map(resolution => resolution.live_value));
    const candidates = families.map((entry: any, index: number) => ({ entry, index })).filter(({ entry, index }: any) => !signalled.has(String(index)) && Array.isArray(entry.sizes) && entry.sizes.every((size: any) => !matched.has(`${size.px}px`)));
    const sizes = candidates.reduce((sum: number, { entry }: any) => sum + entry.sizes.length, 0);
    return { count, families: sizes === count ? candidates.map(({ entry }: any) => String(entry.family)) : [] };
  };
  const kit = figTokens?.source.file_label;
  const designSource = analysis.inputs.some(input => input.path === 'artifacts/design_source_tokens.json');
  const joined = ['color', 'radius', 'font_size'].map(family => ({ family, row: join(family) })).filter((entry): entry is { family: string; row: Family } => entry.row?.verdict === 'joined');
  const byFamily = new Map<string, number>();
  for (const signal of report.signals as any[]) { const key = signal.value_family ? familyWords(String(signal.value_family)) : familyWords(String(signal.class)); byFamily.set(key, (byFamily.get(key) ?? 0) + 1); }
  const count = report.signals.length;
  const summary: Row = { comparison_id: analysis.analysis_run_id, title: `Comparison · ${target}`,
    // s211-m02: the capture and analysis days are the page header's line; the description does not repeat them.
    description: `Stage1 compared the live ${target} site with its design values${kit ? ` (${kit})` : ''}: ${joined.length ? joined.map(entry => familyClause(entry.row, entry.family)).join('; ') : 'no completed value join was recorded'}. ${count} signal${count === 1 ? '' : 's'}.`,
    measurement_basis: rawContract ? 'Drift report 1.4.0: raw values where recorded, cluster medians only when the report says so. Exact token matches remain conformant; explained values are separate. Ratios from 1.3.0 and 1.4.0 are different measurements and are not compared here.' : `Drift report ${report.schema_version}: historical value comparison; its ratios are not comparable with 1.4.0 raw-value ratios.`,
    other_families: ['spacing', 'border_color', 'shadow', 'font_weight'].filter(family => join(family)).map(family => `${humanize(family)}: ${familySentence(join(family), family, offValues(family))}`).join('\n') || 'Not recorded on this analysis.',
    explained_values: rawContract ? [...new Set((report.value_join?.explained ?? []).map((entry: any) => familyWords(String(entry.category))))].join(', ') || 'No separately explained values recorded.' : 'Not recorded on this analysis.',
    colors: familySentence(join('color'), 'color', offValues('color')), radius: familySentence(join('radius'), 'radius', offValues('radius')), font_size: familySentence(join('font_size'), 'font_size', offValues('font_size'), uncomparedFontSizes()),
    signals: count ? `${count} signal${count === 1 ? '' : 's'}: ${[...byFamily.entries()].map(([family, n]) => `${n} ${family}`).join(', ')}.` : 'No signals were recorded.',
    design_comparand: kit ? `${kit} (Figma local tokens); ${rerunFingerprint ? 'live fingerprint recomputed from retained capture evidence' : 'retained capture inputs were copied, not rerun'}.` : designSource ? 'Design-source tokens retained; see each signal’s design comparand.' : 'No design comparand retained',
    result_state: admitted.resultState, target_name: target, source_capture_id: analysis.source.run_id, captured_at: analysis.source.captured_at, source_manifest_at: admitted.sourceManifest.environment.timestamp, analyzed_at: analysis.analyzed_at,
    result_note: admitted.resultNote, copied_inputs: analysis.inputs.filter(input => input.origin === 'source_capture').length,
    execution_note: `Only ${analysis.passes_rerun.join(' and ')} reran${analysis.stage1_version ? ` with Stage1 ${analysis.stage1_version}` : ''}. Capture, authentication and redaction were not performed.`, ...provenance, provenance_locator: 'manifest.json#/analysis',
  };
  const signals: Row[] = report.signals.map((signal: any, n: number) => {
    const operand = (surface: 'live' | 'design') => signal.comparands.find((item: any) => surface === 'live' ? item.surface === 'live' : item.surface !== 'live');
    const describe = (surface: 'live' | 'design') => { const item = operand(surface); if (!item) return 'Not recorded'; const key = `artifacts/${item.ref.artifact_ref}`; const input = analysis.inputs.find(input => input.path === key); return `${item.surface}: ${key}#${item.ref.json_pointer}\nSHA-256 ${admitted.attestations[key]}\n${input?.origin === 'source_capture' ? 'Copied source capture; not rerun' : rerunFingerprint && key === 'artifacts/style_fingerprint.json' ? 'Recomputed fingerprint; source digests checked against the retained source manifest' : 'Injected design comparand'}`; };
    const family: string | undefined = signal.value_family;
    const value = signal.live_value ?? signal.live_label ?? signal.normalized_identifier ?? signal.entity_kind ?? 'Not recorded';
    const occurrences: number | null = signal.live_occurrences ?? null;
    const uses = occurrences === null ? 'Recorded on the live site' : rawContract ? `${occurrences} unexplained compared ${occurrences === 1 ? 'occurrence' : 'occurrences'} on the captured site` : `Used ${occurrences} ${occurrences === 1 ? 'time' : 'times'} on the live site`;
    const row = family ? join(family) : undefined;
    // The row states the caveat beside its state; the measurement limit gives it in full.
    const description = rawContract
      ? `${uses}; no exact design ${family ? noun(family, 1) : 'value'} matches it${signal.typeface ? ` in ${signal.typeface}` : ''}. Explained values are listed separately.`
      : family === 'font_size'
      ? `${uses}; no design size matches it; the face-specific type comparand is incomplete, so it needs review.`
      : family && row?.verdict === 'joined'
        ? `${uses}; no design ${noun(family, 1)} matches it (${row.conformant ?? 0} of ${row.live_distinct_values ?? 0} live ${noun(family, row.live_distinct_values ?? 0)} do).`
        : `${uses}; ${humanize(String(signal.class))} recorded without a design match.`;
    return { signal_id: `${analysis.analysis_run_id}#/signals/${n}`, title: `${humanize(family ?? String(signal.class))} ${value}`, description,
      value_family: family ?? 'Not applicable', live_value: signal.live_value ?? signal.live_label ?? 'Not recorded', live_occurrences: occurrences,
      // s211-m02 (#2292, superseding #2289): every signal shows the state Stage1 recorded; a font-size signal carries the
      // type caveat in its description and measurement limit instead of a state Forge assigned.
      result_state: admitted.resultState,
      severity: humanize(String(signal.severity_level)), severity_basis: (signal.severity_basis as string[]).map(humanize).join(', '), tolerance: describeTolerance(signal.tolerance),
      measurement_limit: rawContract ? 'Drift report 1.4.0: raw values where retained, with separately explained occurrences; exact matches alone are conformant. Not comparable with 1.3.0 ratios.' : family === 'font_size' ? typeLimit : 'Exact recorded comparison; sampled occurrences are weight, not proof of broader coverage.',
      signal_class: humanize(String(signal.class)), comparison_id: analysis.analysis_run_id, source_capture_id: analysis.source.run_id,
      live_comparand: describe('live'), design_comparand: describe('design'), kit_label: kit ?? 'No design comparand retained', ...provenance, provenance_locator: `artifacts/drift_report.json#/signals/${n}`,
    };
  });
  return { admitted, records: { Comparison: [summary], ComparisonSignal: signals } };
}
export function selectComparisonRecord(view: ComparisonView, object: ComparisonObject, recordId?: string): Row | undefined {
  if (!(COMPARISON_OBJECTS as readonly string[]).includes(object)) throw new ToolError('OODS-V214', 'Derived analyses compose only Comparison or ComparisonSignal. Nothing was written.');
  const key = object === 'Comparison' ? 'comparison_id' : 'signal_id';
  const row = recordId === undefined ? view.records[object][0] : view.records[object].find(row => row[key] === recordId);
  if (recordId !== undefined && !row) throw new ToolError('OODS-V214', `Unknown ${object} record ${JSON.stringify(recordId)}. Nothing was written.`);
  return row;
}
export function assertComparisonMatches(view: ComparisonView, bound?: StoredComparisonView): void {
  if (bound && (bound.analysisId !== view.admitted.analysis.analysis_run_id || bound.sourceRunId !== view.admitted.analysis.source.run_id || bound.manifestSha256 !== view.admitted.manifestSha256)) throw new ToolError('OODS-V214', 'Analysis identity or manifest changed; compose a fresh Comparison. Nothing was written.');
}
export function storeComparisonView(view: ComparisonView, object: ComparisonObject, context: string, recordId?: string): StoredComparisonView {
  const { analysis, manifest, manifestSha256, attestations } = view.admitted;
  const evidence: ComparisonEvidence[] = [];
  if (context !== 'list') {
    const row = selectComparisonRecord(view, object, recordId);
    if (object === 'Comparison') evidence.push({ locator: 'manifest.json', sha256: manifestSha256, jsonPointer: '/analysis', label: 'Analysis provenance' });
    else if (row) {
      const n = view.records.ComparisonSignal.indexOf(row), signal = view.admitted.report.signals[n];
      for (const item of signal.comparands as Array<{ surface: string; ref: AnalysisRef }>) {
        const locator = `artifacts/${item.ref.artifact_ref}`;
        evidence.push({ locator, sha256: attestations[locator], jsonPointer: item.ref.json_pointer, label: item.surface === 'live' ? 'Live comparand' : 'Design comparand' });
      }
    }
  }
  return { analysisId: analysis.analysis_run_id, sourceRunId: analysis.source.run_id, analysisPath: view.admitted.runPath, manifestSha256, target: manifest.targets[0].name,
    capturedAt: analysis.source.captured_at, sourceManifestAt: view.admitted.sourceManifest.environment.timestamp, analyzedAt: analysis.analyzed_at, recordId, attestations, evidence };
}
