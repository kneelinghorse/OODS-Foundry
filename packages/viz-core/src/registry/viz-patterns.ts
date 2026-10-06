export type VizPatternScope = {
  theme: 'light' | 'dark';
  /** The brand this recorded cell was measured in (a brand in the token build's registry). */
  brand: string;
  status: 'public' | 'authoring-only' | 'retired';
  svgHash?: string;
  normalizedSpecSha256?: string;
  a11yDescription?: string;
  certify?: {
    coverage: 'certified' | 'uncertified';
    conformant: boolean | null;
    pillars: { a11yEquivalence: string; determinism: string; contrast: string; accuracy: string };
    stable: boolean;
    renderHash: string;
  };
  errors?: Array<{ code: string; message: string }>;
};
export type VizPatternCapability = {
  id: string;
  family: string;
  baseChartType: string;
  specPath: string;
  specSha256: string;
  portability: unknown;
  publicSvg: boolean;
  status: 'public' | 'authoring-only' | 'retired';
  reasons?: string[];
  scopes: VizPatternScope[];
};
export type VizPatternProvenance = { id: string; specPath: string; specSha256: string; baseChartType: string; portability?: unknown };

export function canonicalPatternValue(value: unknown): string {
  const sort = (item: unknown): unknown => Array.isArray(item) ? item.map(sort)
    : item && typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().map(key => [key, sort((item as Record<string, unknown>)[key])])) : item;
  return JSON.stringify(sort(value));
}

/** The measured sibling registry may promote only the exact source identity and four proved scopes. */
export function validateVizPatternRegistry(
  value: unknown,
  sources: readonly VizPatternProvenance[],
  assignments: readonly { id: string; family: string }[],
  chartTypes: readonly string[],
): VizPatternCapability[] {
  function reject(reason: string): never { throw new Error(`Viz pattern registry rejected: ${reason}`); }
  const hash = (input: unknown): input is string => typeof input === 'string' && /^[a-f0-9]{64}$/.test(input);
  const text = (input: unknown): input is string => typeof input === 'string' && input.trim().length > 0;
  if (!Array.isArray(value) || value.length !== sources.length) reject('exact source population required');
  const rows = value as VizPatternCapability[];
  const sourceById = new Map(sources.map(source => [source.id, source]));
  const familyById = new Map(assignments.map(assignment => [assignment.id, assignment.family]));
  if (sourceById.size !== sources.length || new Set(rows.map(row => row?.id)).size !== sources.length) reject('duplicate source or registry identity');
  for (const row of rows) {
    const source = sourceById.get(row?.id);
    if (!source || row.family !== familyById.get(row.id) || !text(row.family)) reject(`${row?.id}: unknown identity or family`);
    if (row.specPath !== source.specPath || !hash(row.specSha256) || row.specSha256 !== source.specSha256
      || canonicalPatternValue(row.portability) !== canonicalPatternValue(source.portability)) reject(`${row.id}: source provenance mismatch`);
    if (!chartTypes.includes(row.baseChartType) || row.baseChartType !== source.baseChartType) reject(`${row.id}: base chart type differs from source`);
    if (!Array.isArray(row.scopes) || row.scopes.length !== 4) reject(`${row.id}: four measured scopes required`);
    const scopeIds = row.scopes.map(scope => `${scope?.theme}/${scope?.brand}`).sort();
    if (JSON.stringify(scopeIds) !== JSON.stringify(['dark/A', 'dark/B', 'light/A', 'light/B'])) reject(`${row.id}: exact light/dark and A/B scopes required`);
    const allPublic = row.scopes.every(scope => scope.status === 'public');
    const allAuthoring = row.scopes.every(scope => scope.status === 'authoring-only');
    const allRetired = row.scopes.every(scope => scope.status === 'retired');
    if ((!allPublic && !allAuthoring && !allRetired) || row.publicSvg !== allPublic || row.status !== (allPublic ? 'public' : allRetired ? 'retired' : 'authoring-only')) reject(`${row.id}: status differs from scope proof`);
    if (allPublic && row.reasons !== undefined) reject(`${row.id}: public identity cannot retain an authoring-only reason`);
    const measuredReasons = [...new Set(row.scopes.flatMap(scope => scope.errors?.map(error => error.message) ?? []))];
    if ((allAuthoring || allRetired) && (!Array.isArray(row.reasons) || !row.reasons.length || row.reasons.some(reason => !text(reason))
      || canonicalPatternValue(row.reasons) !== canonicalPatternValue(measuredReasons))) reject(`${row.id}: exact measured unavailable reasons required`);
    for (const scope of row.scopes) {
      if (scope.status === 'public') {
        const grade = scope.certify;
        if (!hash(scope.svgHash) || !hash(scope.normalizedSpecSha256) || !text(scope.a11yDescription) || scope.errors !== undefined) reject(`${row.id}: incomplete public pixel proof`);
        if (!grade || !['certified', 'uncertified'].includes(grade.coverage) || (grade.coverage === 'certified' ? typeof grade.conformant !== 'boolean' : grade.conformant !== null)
          || grade.stable !== true || grade.renderHash !== scope.svgHash) reject(`${row.id}: incomplete or different certification operand`);
        if (!grade.pillars || !['pass', 'fail', 'unchecked'].includes(grade.pillars.a11yEquivalence)
          || grade.pillars.determinism !== 'pass' || !['pass', 'fail', 'exempt', 'ungradeable', 'unchecked'].includes(grade.pillars.contrast)
          || !['pass', 'fail', 'ungradeable', 'unchecked'].includes(grade.pillars.accuracy)) reject(`${row.id}: invalid certification pillars`);
      } else if (!Array.isArray(scope.errors) || !scope.errors.length || scope.errors.some(error => error.code !== (scope.status === 'retired' ? 'OODS-V174' : 'OODS-V167') || !text(error.message))
        || scope.svgHash !== undefined || scope.normalizedSpecSha256 !== undefined || scope.certify !== undefined || scope.a11yDescription !== undefined) {
        reject(`${row.id}: authoring-only scope lacks its public rejection`);
      }
    }
  }
  return rows;
}
