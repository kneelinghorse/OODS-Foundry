/**
 * s221-m03 (#2482 ruling 9; the website's defect (d), message a232e944): the capture objects name no internal tool in
 * what they ship as their own content: sample values, descriptions, changelog prose, tags and the Provenanced source.
 * Earlier Run samples named internal deployments and a Railway host, and the map
 * schemas described a "raw Stage1 label". Values the runtime reads from a real capture keep naming what produced them.
 *
 * Stage1's field contract (the field lists in its message eff22ec8, which it adopted from these objects) is unchanged.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

const root = path.resolve(fileURLToPath(import.meta.url), '../../../../..');
// Private project names are guarded across the whole tree by the export scanner.
const INTERNAL = /railway|stage ?1/i;
const OBJECTS = ['Run', 'Finding', 'CapturedArtifact', 'Comparison', 'ComparisonSignal'] as const;
const read = (name: string) => yaml.load(fs.readFileSync(path.join(root, 'objects/capture', `${name}.object.yaml`), 'utf8')) as Record<string, any>;

/** Every string an object ships as its own content, with where it sits. */
function shippedStrings(document: Record<string, any>): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const walk = (node: unknown, where: string[]) => {
    if (typeof node === 'string') out.push([where.join('.'), node]);
    else if (Array.isArray(node)) node.forEach((item, index) => walk(item, [...where, String(index)]));
    else if (node && typeof node === 'object') for (const [key, value] of Object.entries(node)) walk(value, [...where, key]);
  };
  walk(document, []);
  return out;
}

// The objects' exact field lists at 618681a38, which Stage1's field contract (eff22ec8) was adopted from: a rename, an
// addition or a removal fails here. Where eff22ec8's own list differs, the difference predates this sprint
// (artifacts/product-reality/sprint-221/m03/capture/field-contract.json).
const CONTRACT: Record<(typeof OBJECTS)[number], string[]> = {
  Run: ["run_id", "target_name", "target_url", "mode", "auth_provenance_note", "capture_note", "auth_mechanisms", "auth_api_kind", "auth_redaction_applied", "needs_review_count", "accessibility_score", "auth_type", "page_count", "finding_count", "critical_count", "serious_count", "moderate_count", "minor_count", "unknown_count", "pass_count", "passes_failed", "artifact_count", "evidence_retained", "provenance_source", "provenance_record", "provenance_locator", "provenance_method", "provenance_at"],
  Finding: ["finding_id", "title", "description", "impact", "rule_id", "route", "page_url", "node_count", "selectors", "criteria", "help_url", "provenance_source", "provenance_record", "provenance_record_name", "provenance_locator", "provenance_method", "provenance_at", "reasons", "result_state"],
  CapturedArtifact: ["result_state", "result_note", "artifact_id", "path", "artifact_kind", "description", "sha256", "schema_version", "bytes", "provenance_source", "provenance_record", "provenance_record_name", "provenance_locator", "provenance_method", "provenance_at"],
  Comparison: ["comparison_id", "title", "description", "measurement_basis", "other_families", "explained_values", "colors", "radius", "font_size", "signals", "design_comparand", "result_state", "target_name", "source_capture_id", "captured_at", "source_manifest_at", "analyzed_at", "result_note", "copied_inputs", "execution_note", "provenance_source", "provenance_record", "provenance_method", "provenance_at", "provenance_locator"],
  ComparisonSignal: ["signal_id", "title", "description", "value_family", "live_value", "live_occurrences", "severity", "severity_basis", "tolerance", "measurement_limit", "result_state", "signal_class", "comparison_id", "source_capture_id", "live_comparand", "design_comparand", "kit_label", "provenance_source", "provenance_record", "provenance_method", "provenance_at", "provenance_locator"],
};

describe('the capture objects name no internal tool (s221-m03)', () => {
  it.each(OBJECTS)('%s: samples, descriptions, tags and the Provenanced source', name => {
    expect(shippedStrings(read(name)).filter(([, value]) => INTERNAL.test(value)).map(([where, value]) => `${where}: ${value.slice(0, 80)}`)).toEqual([]);
  });

  it('the capture objects\' README', () => {
    expect(fs.readFileSync(path.join(root, 'objects/capture/README.md'), 'utf8').split('\n').filter(line => INTERNAL.test(line))).toEqual([]);
  });

  it('the map schemas describe a raw captured label, not a raw Stage1 label', () => {
    for (const file of ['map.input.json', 'map.create.input.json', 'map.update.input.json']) {
      const text = fs.readFileSync(path.join(root, 'packages/mcp-server/src/schemas', file), 'utf8');
      expect(text, file).not.toContain('raw Stage1 label');
    }
  });

  it.each(OBJECTS)('%s retains its adopted fields and the reviewed optional comparison fields', name => {
    expect(Object.keys(read(name).schema)).toEqual(CONTRACT[name]);
  });
});
