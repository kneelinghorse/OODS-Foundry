/** HTML browser measurements are separate from installed React/Vue runtime proof. */
import { BROWSER_IMAGE, OBJECTS, contextsForObject, supportsWorkflow } from './runtime-ledger.js';

export type HtmlMeasurementCell = {
  id: string;
  object: string;
  context: string;
  theme: string;
  status: 'pass' | 'fail';
  /** Failures remain visible; a named reason never converts a failure to a pass. */
  reasons: string[];
  receipt: string;
  sourceFingerprint: string;
};
export type HtmlMeasurementLedger = {
  schemaVersion: '1.0.0';
  framework: 'html';
  brand: 'A';
  browserImage: string;
  builderSelfCertified: false;
  reactReference: 'same-seed-ssr-text-only';
  receipts: Record<string, string>;
  semanticReview?: { receipt: string; sha256: string };
  rows: HtmlMeasurementCell[];
  summary: { cells: number; pass: number; fail: number };
};
export const htmlCellIdentities = () => OBJECTS.flatMap(object => [
  ...contextsForObject(object), ...(supportsWorkflow(object) ? ['workflow'] : []),
].flatMap(context => ['light', 'dark', 'hc'].map(theme => `${object}/${context}/${theme}`))).sort();

/** Incomplete populations, unnamed failures and unbound receipts cannot support claims. */
export function validateHtmlLedger(ledger: HtmlMeasurementLedger): string[] {
  const issues: string[] = [];
  if (ledger.schemaVersion !== '1.0.0' || ledger.framework !== 'html' || ledger.brand !== 'A') issues.push('HTML measurement schema or brand is invalid');
  if (ledger.browserImage !== BROWSER_IMAGE) issues.push('the pinned Linux browser image is required');
  if (ledger.builderSelfCertified !== false || ledger.reactReference !== 'same-seed-ssr-text-only') issues.push('HTML measurement must retain its review and React reference boundaries');
  if (JSON.stringify(ledger.rows.map(row => row.id).sort()) !== JSON.stringify(htmlCellIdentities())) issues.push(`population must contain exactly ${htmlCellIdentities().length} distinct supported object/context/theme cells`);
  for (const row of ledger.rows) {
    if (row.id !== `${row.object}/${row.context}/${row.theme}`) issues.push(`${row.id}: identity differs from dimensions`);
    if (!/^sha256:[a-f0-9]{64}$/.test(row.sourceFingerprint) || !/^sha256:[a-f0-9]{64}$/.test(ledger.receipts[row.receipt] ?? '')) issues.push(`${row.id}: unbound source or receipt`);
    if (row.status === 'pass' ? row.reasons.length !== 0 : row.status !== 'fail' || !row.reasons.length || row.reasons.some(reason => !reason.trim())) issues.push(`${row.id}: outcome and reasons disagree`);
  }
  const summary = { cells: ledger.rows.length, pass: ledger.rows.filter(row => row.status === 'pass').length, fail: ledger.rows.filter(row => row.status === 'fail').length };
  if (JSON.stringify(summary) !== JSON.stringify(ledger.summary)) issues.push('summary differs from measured rows');
  return issues;
}
