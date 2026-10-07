import { activeSubstitutions, annotateSubstitutions, sourceSpecifier, sourceVersion, substitutionPackage } from '../codegen/component-substitutions.js';
import { bindSubstitutionPackages } from '../codegen/artifact-envelope.js';
import { carryContextForward } from './preview-context.js';
import { carryObservationForward } from './preview-observation.js';
import { ToolError } from '../errors/tool-error.js';
import { inspectShadcn } from '../tools/map.shadcn.js';
import { createHash } from 'node:crypto';
import { nextVersion, type CompositionVersion, type ComponentPackage, type PreviewFramework } from './composition-store.js';

/** Resolve only imports this version actually emits. Explicit versions retain their frozen package identity. */
export async function preparePreviewComponents(hostUrl: string, directory: string, record: CompositionVersion, artifacts: CompositionVersion['artifacts'], explicit: boolean): Promise<{ record: CompositionVersion; artifacts: CompositionVersion['artifacts']; packages?: ComponentPackage[]; newVersion?: boolean }> {
  const combined = { ...record.artifacts, ...artifacts };
  const mappings = activeSubstitutions(record.schema);
  const requests = Object.entries(combined).flatMap(([framework, entry]) => (entry?.artifact.substitutions ?? []).map(substitution => {
    const source = mappings.find(mapping => mapping.mappingId === substitution.mappingId)?.substitution[framework as PreviewFramework];
    let shadcn;
    // A newly composed version has no frozen preview yet, even when the caller supplies its version number.
    if ((!explicit || !record.componentPackages) && source?.shadcn) {
      try { shadcn = inspectShadcn(source.shadcn, source.export, framework as PreviewFramework); }
      catch (error) { throw new ToolError('OODS-V217', error instanceof Error ? error.message : String(error)); }
    }
    return { framework, specifier: sourceSpecifier(substitution.source), version: sourceVersion(substitution.source), ...(source?.localPath ? { localPath: source.localPath } : {}), isShadcn: Boolean(substitution.source.shadcn), ...(shadcn ? { shadcn } : {}) };
  }));
  if (!requests.length) return { record, artifacts };
  let packages: ComponentPackage[];
  if (explicit && record.componentPackages) {
    packages = record.componentPackages;
    for (const request of requests) if (!packages.some(pkg => pkg.framework === request.framework && pkg.name === (request.isShadcn ? request.specifier : substitutionPackage(request.specifier)) && pkg.version === request.version)) {
      throw new ToolError('OODS-V217', `Team package ${request.specifier} has no frozen ${request.framework} preview in version ${record.version}; open the latest version without an explicit version to add it.`, { package: request.specifier });
    }
  } else {
    const response = await fetch(`${hostUrl}/preview/component-packages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ packages: requests }), signal: AbortSignal.timeout(60_000) });
    const body = await response.json() as { packages: ComponentPackage[]; message?: string; package?: string };
    if (!response.ok) throw new ToolError('OODS-V217', body.message ?? 'The preview host could not resolve the mapped packages.', { package: body.package });
    packages = body.packages;
  }
  const changed = record.componentPackages && JSON.stringify(packages) !== JSON.stringify(record.componentPackages);
  if (changed) {
    const next = await nextVersion(directory, record.compositionId, record.version);
    // Browser/acceptance/chart measurements belong to the previous bytes. Static generation is rebound below.
    record = { ...record, ...next, operation: 'recompose', createdAt: new Date().toISOString(), artifacts: {}, scopes: undefined, measurements: {}, componentPackages: packages, ...(record.context ? { context: carryContextForward(record.context, next.version) } : {}), ...(record.observation ? { observation: carryObservationForward(record.observation, next.version) } : {}) };
  }
  const bound: CompositionVersion['artifacts'] = {};
  for (const [framework, entry] of Object.entries(combined)) {
    if (!entry) continue;
    bound[framework as PreviewFramework] = { ...entry, artifact: bindSubstitutionPackages(entry.artifact, packages.filter(pkg => pkg.framework === framework)) };
  }
  return { record, artifacts: bound, packages, newVersion: Boolean(changed) };
}

/** Latest follows the current mapping set; an explicit historical version retains its pinned mapping and bytes. */
export async function refreshPreviewMappings(directory: string, record: CompositionVersion): Promise<{ record: CompositionVersion; changed: boolean }> {
  const schema = structuredClone(record.schema);
  const clear = (node: typeof schema.screens[number]) => { if (node.meta) delete node.meta.substitution; node.children?.forEach(clear); };
  schema.screens.forEach(clear);
  annotateSubstitutions(schema);
  const digest = (value: typeof schema) => {
    const rows: unknown[] = [];
    const visit = (node: typeof schema.screens[number]) => { if (node.meta?.substitution) rows.push([node.id, node.meta.substitution]); node.children?.forEach(visit); };
    value.screens.forEach(visit); return JSON.stringify(rows);
  };
  if (digest(schema) === digest(record.schema)) return { record, changed: false };
  const next = await nextVersion(directory, record.compositionId, record.version);
  return { changed: true, record: { ...record, ...next, operation: 'recompose', createdAt: new Date().toISOString(), schema, schemaHash: `sha256:${createHash('sha256').update(JSON.stringify(schema)).digest('hex')}`, artifacts: {}, scopes: undefined, componentPackages: undefined, measurements: {}, ...(record.context ? { context: carryContextForward(record.context, next.version) } : {}), ...(record.observation ? { observation: carryObservationForward(record.observation, next.version) } : {}) } };
}
