import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export interface ComparisonInspection {
  analysisId: string; sourceRunId: string; analysisPath: string; manifestSha256: string; target: string;
  capturedAt: string; sourceManifestAt: string; analyzedAt: string; recordId?: string;
  attestations: Record<string, string>;
  evidence: Array<{ locator: string; sha256: string; jsonPointer: string; label: string }>;
}
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
/** Cached navigation is a cost optimization, never permission to use changed evidence. */
export async function verifyComparison(view: ComparisonInspection): Promise<Map<string, Buffer>> {
  const root = await fs.realpath(view.analysisPath);
  const bytes = new Map<string, Buffer>();
  for (const [locator, expected] of Object.entries(view.attestations)) {
    if (!locator || path.isAbsolute(locator) || locator.includes('\\') || locator.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Unsafe analysis operand.');
    const file = await fs.realpath(path.join(root, locator));
    if (!file.startsWith(root + path.sep)) throw new Error('Analysis operand escaped its root.');
    const buffer = await fs.readFile(file);
    if (hash(buffer) !== expected) throw new Error('Analysis operand SHA-256 changed; open a fresh Comparison.');
    bytes.set(locator, buffer);
  }
  const manifestBytes = bytes.get('manifest.json');
  if (!manifestBytes || hash(manifestBytes) !== view.manifestSha256) throw new Error('Analysis manifest changed.');
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (manifest.run_id !== view.analysisId || manifest.analysis?.analysis_run_id !== view.analysisId || manifest.analysis?.source?.run_id !== view.sourceRunId) throw new Error('Analysis identity changed.');
  // Re-read the root after verifying the operands; a replacement mid-read is not a coherent snapshot.
  const manifestFile = await fs.realpath(path.join(root, 'manifest.json'));
  if (!manifestFile.startsWith(root + path.sep) || hash(await fs.readFile(manifestFile)) !== view.manifestSha256) throw new Error('Analysis manifest changed during verification.');
  return bytes;
}
export async function readComparisonEvidence(view: ComparisonInspection | undefined, locator: string, pointer: string): Promise<Buffer> {
  const evidence = view?.evidence.find(item => item.locator === locator && item.jsonPointer === pointer);
  if (!view || !evidence) throw new Error('Operand is not attested for this selected signal.');
  const bytes = (await verifyComparison(view)).get(locator);
  if (!bytes || hash(bytes) !== evidence.sha256) throw new Error('Selected operand attestation changed.');
  // The pointer is pinned by admission; checking it again also guards corrupted stored metadata.
  let value: unknown = JSON.parse(bytes.toString('utf8'));
  if ((pointer !== '' && !pointer.startsWith('/')) || /~(?![01])/.test(pointer)) throw new Error('Invalid operand pointer.');
  for (const token of pointer === '' ? [] : pointer.slice(1).split('/')) {
    const key = token.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key) || (Array.isArray(value) && !/^(0|[1-9][0-9]*)$/.test(key))) throw new Error('Unresolved operand pointer.');
    value = (value as Record<string, unknown>)[key];
  }
  return bytes;
}
