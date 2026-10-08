/**
 * Evidence a reader can follow. Receipts under artifacts/product-reality stay in the private build record, which
 * neither the npm package nor the public repository carries, so tool output names them by file and keeps their
 * hashes and versions instead of citing a path nobody outside can open (website audit PROD-22, 0.10.1).
 */
const UNSHIPPED = /^artifacts\/product-reality\/(?:[^#\s]*\/)?([^/#\s]+)\/([^/#\s]+)(#\S*)?$/;
/** File names that say nothing alone keep their folder: react-theme/report.json, not report.json. */
const GENERIC = /^(?:report|receipt|summary|index|manifest|ledger)\.json$/;

export function publicEvidenceReference(reference: string): string {
  const match = UNSHIPPED.exec(reference);
  if (!match) return reference;
  const [, folder, file, fragment = ''] = match;
  return `build record (not shipped): ${GENERIC.test(file) ? `${folder}/${file}` : file}${fragment}`;
}

/** A copy of value with every unshipped receipt path renamed; lists of references stay free of duplicates. */
export function withPublicEvidence<T>(value: T): T {
  if (typeof value === 'string') return publicEvidenceReference(value) as T;
  if (Array.isArray(value)) {
    const renamed = value.map(item => withPublicEvidence(item));
    return (renamed.every(item => typeof item === 'string') ? [...new Set(renamed)] : renamed) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, withPublicEvidence(item)])) as T;
  }
  return value;
}
