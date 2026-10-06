import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type VisualProofSummary = { head: string | null; heads: string[]; cells: number; pass: number; fail: number; receipt: string; sha256: string; files?: number };
export function readVisualProofSummary(kind: 'html' | 'fidelity'): VisualProofSummary {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const source = path.resolve(directory, '../../registry/visual-proofs.v1.json');
  const shipped = path.resolve(directory, '../registry/visual-proofs.v1.json');
  const ledger = JSON.parse(fs.readFileSync(fs.existsSync(source) ? source : shipped, 'utf8'));
  const proof = ledger[kind];
  if (ledger.schemaVersion !== '1.0.0' || ledger.builderSelfCertified !== false || !Array.isArray(proof?.rows) || !proof.rows.length || !/^sha256:[a-f0-9]{64}$/.test(proof.sha256)) throw new Error('Visual proof identity missing');
  if (new Set(proof.rows.map((row: any) => row.id)).size !== proof.rows.length || proof.rows.some((row: any) => (row.head !== null && !/^[a-f0-9]{40}$/.test(row.head)) || !['pass', 'fail'].includes(row.status))) throw new Error('Invalid visual proof rows');
  const heads = [...new Set<string>(proof.rows.map((row: any) => row.head).filter(Boolean))].sort();
  return { head: heads.length === 1 && proof.rows.every((row: any) => row.head) ? heads[0]! : null, heads, cells: proof.rows.length, pass: proof.rows.filter((row: any) => row.status === 'pass').length, fail: proof.rows.filter((row: any) => row.status === 'fail').length, receipt: proof.receipt, sha256: proof.sha256, ...(kind === 'fidelity' ? { files: proof.files } : {}) };
}

/** Null means the caller has no build stamp; mixed proof heads cannot establish this build. */
export function proofMatchesBuild(head: string | null, buildHead?: string): boolean | null {
  return buildHead ? head === buildHead : null;
}
