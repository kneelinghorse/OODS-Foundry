import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VIZ_PATTERN_SOURCES, VIZ_RECIPES, validateVizPatternRegistry } from '@oods/viz-core';

type Assignment = { id: string; family: string; role: 'core' | 'extension'; coreCell: string | null };
type CellDefinition = { cell: string; definition: string; gapReason: string };
type RetiredCell = { family: string; cell: string; definition: string; reason: string };
type Classification = { schemaVersion: 1; families: Array<{ id: string; definition: string; coreCells: CellDefinition[] }>; assignments: Assignment[]; retiredCells: RetiredCell[] };
type VizIdentity = Assignment & { kind: 'type' | 'pattern'; publicSvg: boolean; specPath?: string; specSha256?: string };
type CoreCell = { family: string; cell: string; definition: string; status: 'surface-complete' | 'typed-gap'; identities: string[]; reason?: string };
/** patterns counts the patterns viz.render offers; s222-m02 (#2502 ruling 12, I47) counts the retired ones apart. */
export type VizSummary = { types: number; patterns: number; retiredPatterns: number; families: number; classified: number; coreCells: number; coreSurfaceComplete: number; typedGaps: number; retiredCells: number };
export type VizTaxonomy = { schemaVersion: 1; families: Array<{ id: string; definition: string }>; identities: VizIdentity[]; coreCells: CoreCell[]; retiredCells: RetiredCell[]; summary: VizSummary };

const directory = path.dirname(fileURLToPath(import.meta.url));
const cellKey = (family: string, cell: string) => `${family}/${cell}`;
const same = (left: string[], right: string[]) => JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const reject = (reason: string): never => { throw new Error(`Viz taxonomy rejected: ${reason}`); };

function readRegistry(name: string, override?: string): unknown {
  const bundled = path.resolve(directory, '../registry', name);
  const source = path.resolve(directory, '../../../viz-core/src/registry', name);
  return JSON.parse(fs.readFileSync(override ?? (fs.existsSync(bundled) ? bundled : source), 'utf8'));
}

/** Reconcile the complete declared profile and measured type population before serving counts. */
export function projectVizSummary(value: unknown, classificationValue: unknown, patternRegistryValue: unknown): VizSummary {
  const taxonomy = value as VizTaxonomy;
  const classification = classificationValue as Classification;
  if (!taxonomy || taxonomy.schemaVersion !== 1 || !Array.isArray(taxonomy.families) || !Array.isArray(taxonomy.identities) || !Array.isArray(taxonomy.coreCells)) reject('invalid version or population');
  if (!classification || classification.schemaVersion !== 1 || !Array.isArray(classification.families) || !classification.families.length || !Array.isArray(classification.assignments)) reject('invalid classification authority');

  const recipes = new Map(VIZ_RECIPES.map(recipe => [recipe.chartType, recipe]));
  const patterns = new Map(VIZ_PATTERN_SOURCES.map(source => [source.id, source]));
  const expectedIds = [...recipes.keys(), ...patterns.keys()];
  if (!same(classification.assignments.map(row => row?.id), expectedIds)) reject('classification differs from registered identities');
  if (!same(taxonomy.identities.map(row => row?.id), expectedIds)) reject('exact distinct registered identities required');
  let measuredPatterns;
  try { measuredPatterns = validateVizPatternRegistry(patternRegistryValue, VIZ_PATTERN_SOURCES, classification.assignments, [...recipes.keys()]); }
  catch (error) { reject((error as Error).message); }
  const patternProof = new Map(measuredPatterns!.map(pattern => [pattern.id, pattern]));
  const families = new Map(classification.families.map(family => [family.id, family]));
  if (families.size !== classification.families.length || !same(taxonomy.families.map(family => family?.id), [...families.keys()])) reject('exact distinct declared families required');
  for (const family of taxonomy.families) {
    const authored = families.get(family.id)!;
    if (!text(authored.definition) || !Array.isArray(authored.coreCells) || !authored.coreCells.length || family.definition !== authored.definition) reject(`${family.id}: invalid family definition`);
  }

  const assignments = new Map(classification.assignments.map(row => [row.id, row]));
  const declaredCells = new Map(classification.families.flatMap(family => family.coreCells.map(cell => [cellKey(family.id, cell.cell), cell] as const)));
  if (declaredCells.size !== classification.families.reduce((count, family) => count + family.coreCells.length, 0)) reject('duplicate declared core cell');
  for (const identity of taxonomy.identities) {
    const assignment = assignments.get(identity.id)!;
    const recipe = recipes.get(identity.id);
    if (!families.has(identity.family) || identity.family !== assignment.family || identity.role !== assignment.role || identity.coreCell !== assignment.coreCell) reject(`${identity.id}: classification mismatch`);
    if (!['core', 'extension'].includes(identity.role) || (identity.role === 'core' && identity.coreCell === null) || (identity.coreCell !== null && !declaredCells.has(cellKey(identity.family, identity.coreCell)))) reject(`${identity.id}: invalid core assignment`);
    if (identity.kind !== (recipe ? 'type' : 'pattern') || typeof identity.publicSvg !== 'boolean') reject(`${identity.id}: invalid identity kind or public SVG proof`);
    if (recipe) {
      if (identity.publicSvg !== recipe.publicSvg) reject(`${identity.id}: public SVG differs from measured recipe`);
    } else {
      const source = patterns.get(identity.id)!;
      if (identity.specPath !== source.specPath || identity.specSha256 !== source.specSha256) reject(`${identity.id}: invalid pattern provenance`);
      if (identity.publicSvg !== patternProof.get(identity.id)!.publicSvg) reject(`${identity.id}: public SVG differs from exact measured pattern`);
    }
  }

  if (!same(taxonomy.coreCells.map(cell => cellKey(cell?.family, cell?.cell)), [...declaredCells.keys()])) reject('exact distinct declared core cells required');
  for (const cell of taxonomy.coreCells) {
    const declared = declaredCells.get(cellKey(cell.family, cell.cell))!;
    const backing = taxonomy.identities.filter(identity => identity.family === cell.family && identity.coreCell === cell.cell);
    if (!text(declared.definition) || cell.definition !== declared.definition || !Array.isArray(cell.identities) || !same(cell.identities, backing.map(identity => identity.id))) reject(`${cell.family}/${cell.cell}: invalid cell definition or backing`);
    const complete = backing.some(identity => identity.publicSvg);
    if (cell.status !== (complete ? 'surface-complete' : 'typed-gap')) reject(`${cell.family}/${cell.cell}: status differs from public SVG backing`);
    if (!complete && (!text(declared.gapReason) || cell.reason !== declared.gapReason)) reject(`${cell.family}/${cell.cell}: gap requires its declared reason`);
    if (complete && cell.reason !== undefined) reject(`${cell.family}/${cell.cell}: complete cell cannot retain a gap reason`);
  }
  if (!Array.isArray(taxonomy.retiredCells) || !Array.isArray(classification.retiredCells)) reject('Retired cells require an explicit population');
  const retiredKeys = taxonomy.retiredCells.map(row => cellKey(row.family, row.cell));
  if (new Set(retiredKeys).size !== retiredKeys.length || !same(retiredKeys, classification.retiredCells.map(row => cellKey(row.family, row.cell)))) reject('Retired cell population differs');
  for (const cell of taxonomy.retiredCells) {
    const declared = classification.retiredCells.find(row => row.family === cell.family && row.cell === cell.cell)!;
    if (!families.has(cell.family) || declaredCells.has(cellKey(cell.family, cell.cell))) reject('Retired cells must be disjoint from the active profile');
    if (!text(cell.definition) || !text(cell.reason) || cell.definition !== declared.definition || cell.reason !== declared.reason) reject('Retired cell requires its declared definition and reason');
  }
  const retired = new Set(measuredPatterns!.filter(pattern => pattern.status === 'retired').map(pattern => pattern.id));
  const summary: VizSummary = {
    types: taxonomy.identities.filter(identity => identity.kind === 'type').length,
    patterns: taxonomy.identities.filter(identity => identity.kind === 'pattern' && !retired.has(identity.id)).length,
    retiredPatterns: retired.size,
    families: taxonomy.families.length,
    classified: taxonomy.identities.length,
    coreCells: taxonomy.coreCells.length,
    coreSurfaceComplete: taxonomy.coreCells.filter(cell => cell.status === 'surface-complete').length,
    typedGaps: taxonomy.coreCells.filter(cell => cell.status === 'typed-gap').length,
    retiredCells: taxonomy.retiredCells.length,
  };
  if (!taxonomy.summary || !same(Object.keys(taxonomy.summary), Object.keys(summary)) || (Object.keys(summary) as Array<keyof VizSummary>).some(key => taxonomy.summary[key] !== summary[key])) reject('summary differs from classified identities and core cells');
  return summary;
}

export function readVizSummary(): VizSummary {
  return projectVizSummary(
    readRegistry('viz-taxonomy.v1.json', process.env.MCP_VIZ_TAXONOMY_PATH),
    readRegistry('viz-classification.v1.json', process.env.MCP_VIZ_CLASSIFICATION_PATH),
    readRegistry('viz-patterns.v1.json', process.env.MCP_VIZ_PATTERN_REGISTRY_PATH),
  );
}
