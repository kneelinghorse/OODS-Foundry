/**
 * s213-m01 (Sprint 212 review finding 6): a generated screen imports the @oods/component-contracts helpers its code
 * calls, and no others. The imports used to follow schema predicates — "the object has a reference field", true of
 * almost every object because its id is a uuid — so nearly every React and Vue screen imported formatReferenceLabel and
 * formatRecordLabel unused, and a team project that forbids unused imports (noUnusedLocals) rejected the file.
 *
 * An emitter writes CONTRACT_HELPER_IMPORTS on its own line where the imports belong; once the whole file is written,
 * resolveContractHelperImports replaces that line with one import per helper group the file uses.
 */
export const CONTRACT_HELPER_IMPORTS = '/* @oods-contract-helper-imports */';

const HELPER_GROUPS: ReadonlyArray<readonly string[]> = [
  ['formatReferenceLabel', 'formatRecordLabel'],
  ['formatReadOnlyValue'],
  // s223-m02: a single screen's address panel summary (#2527 ruling 13i).
  ['addressCollectionSummary'],
  ['chronologicalEvents', 'formatDateTime', 'recordCollectionEvents'],
];

export function resolveContractHelperImports(code: string, typescript: boolean): { code: string; imported: boolean } {
  const lines = code.split('\n');
  const at = lines.indexOf(CONTRACT_HELPER_IMPORTS);
  if (at < 0) throw new Error('Generated code has no contract helper import position.');
  const body = lines.filter((_, index) => index !== at).join('\n');
  const uses = (name: string) => new RegExp(`\\b${name}\\b`).test(body);
  const statements = HELPER_GROUPS.map((group, index) => [
    ...group.filter(uses),
    ...(index === HELPER_GROUPS.length - 1 && typescript && uses('CollectionEvent') ? ['type CollectionEvent'] : []),
  ]).filter(names => names.length).map(names => `import { ${names.join(', ')} } from '@oods/component-contracts';`);
  lines.splice(at, 1, ...statements);
  return { code: lines.join('\n'), imported: statements.length > 0 };
}
