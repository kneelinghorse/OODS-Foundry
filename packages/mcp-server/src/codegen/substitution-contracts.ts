import { componentContracts, sharedScenarios, substitutionContractReport, type SubstitutionContractReport } from '@oods/component-contracts';
import { inspectShadcn } from '../tools/map.shadcn.js';
import { createHash } from 'node:crypto';
import type { UiSchema } from '../schemas/generated.js';
import type { CodegenResult } from './types.js';
import { activeSubstitutions, sourceSpecifier, sourceVersion, substituteGeneratedComponents, type EmittedSubstitution } from './component-substitutions.js';
import { bindSubstitutionPackages, buildGeneratedArtifact } from './artifact-envelope.js';
import type { ToolContext } from '../lib/tool-context.js';

const json = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c');

/** Exercise the actual generated adapter with the public shared scenario, not a second translation implementation. */
export function scenarioArtifact(framework: 'react' | 'vue', substitution: EmittedSubstitution, schema: UiSchema) {
  const scenario = sharedScenarios.find(row => row.oodsComponentId === substitution.component)!;
  const component = substitution.component;
  const contract = Object.values(componentContracts).find(row => row.id === component)!;
  const listeners = contract.events.map(event => {
    const prop = event === 'update' && component === 'Input' ? framework === 'react' ? 'onValueChange' : 'onUpdate:modelValue' : `on${event[0]!.toUpperCase()}${event.slice(1)}`;
    return `${json(prop)}: (value: any) => { const payload = value?.target && 'value' in value.target ? value.target.value : value?.nativeEvent || value?.type ? undefined : value; fixture.calls.push({ event: ${json(event)}, value: payload }); ${event === 'update' ? framework === 'react' ? 'setProps((old: any) => ({ ...old, value: payload }));' : 'props.value = payload;' : ''} }`;
  }).join(',\n');
  const shared = `const fixture = (globalThis as any).__oodsScenario = { calls: [] as any[], setProps: (_value: any) => {} };`;
  const code = framework === 'react'
    ? `import React from 'react';\nimport { ${component} } from '@oods/components-react';\n${shared}\nexport function GeneratedUI() { const [props, setProps] = React.useState<any>(${json(scenario.props)}); fixture.setProps = (value: any) => { fixture.calls = []; setProps(value); }; return <${component} {...props} {...{${listeners}}}>${scenario.slots.default === undefined ? '' : `{${json(scenario.slots.default)}}`}</${component}>; }`
    : `<script setup lang="ts">\nimport { reactive } from 'vue';\nimport { ${component} } from '@oods/components-vue';\n${shared}\nconst props = reactive<any>(${json(scenario.props)}); fixture.setProps = (value: any) => { fixture.calls = []; for (const key of Object.keys(props)) delete props[key]; Object.assign(props, value); };\nconst listeners = {${listeners}};\n</script>\n<template><${component} v-bind="{ ...props, ...listeners }">${scenario.slots.default === undefined ? '' : `{{ ${json(scenario.slots.default)} }}`}</${component}></template>`;
  const generated: CodegenResult = { status: 'ok', framework, code, fileExtension: framework === 'react' ? '.tsx' : '.vue', imports: [`@oods/components-${framework}`, framework], warnings: [] };
  const used = substituteGeneratedComponents(generated, schema, true);
  return buildGeneratedArtifact({ framework, code: generated.code, fileExtension: generated.fileExtension, imports: generated.imports, substitutions: used });
}

/** Report failures are advisory. Code generation never becomes a browser or package availability gate. */
export async function checkSubstitutionContracts(framework: 'react' | 'vue', substitutions: EmittedSubstitution[], schema: UiSchema, context?: ToolContext): Promise<SubstitutionContractReport[]> {
  const host = context?.previewHostUrl ?? process.env.OODS_PREVIEW_HOST_URL;
  const mappings = activeSubstitutions(schema);
  const reports: SubstitutionContractReport[] = [];
  const deadline = Date.now() + 45_000;
  for (const entry of substitutions) {
    const identity = { framework, mappingId: entry.mappingId, component: entry.component, source: { export: entry.source.export, ...(entry.source.shadcn ? { shadcn: { module: entry.source.shadcn.module, file: entry.source.shadcn.file, closureHash: entry.source.shadcn.closureHash } } : { package: entry.source.package, version: entry.source.version }) } };
    const absent = (reason: string) => substitutionContractReport(identity, reason);
    if (Date.now() >= deadline) { reports.push(absent('The 45-second contract-check budget was exhausted; this component was not checked.')); continue; }
    if (!host) { reports.push(absent('No preview host is configured for the real-browser contract check.')); continue; }
    try {
      let artifact = scenarioArtifact(framework, entry, schema);
      const source = mappings.find(mapping => mapping.mappingId === entry.mappingId)?.substitution[framework];
      const shadcn = source?.shadcn ? inspectShadcn(source.shadcn, source.export, framework) : undefined;
      const inspected = await fetch(`${host}/preview/component-packages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ packages: [{ framework, specifier: sourceSpecifier(entry.source), version: sourceVersion(entry.source), localPath: source?.localPath, shadcn }] }), signal: AbortSignal.timeout(Math.max(1, Math.min(30_000, deadline - Date.now()))) });
      if (!inspected.ok) throw new Error((await inspected.text()).slice(0, 500));
      const { packages } = await inspected.json() as { packages: Array<{ name: string; version: string; contentHash: string }> };
      artifact = bindSubstitutionPackages(artifact, packages);
      const contract = Object.values(componentContracts).find(row => row.id === entry.component)!;
      const scenario = sharedScenarios.find(row => row.oodsComponentId === entry.component)!;
      const contractContentHash = `sha256:${createHash('sha256').update(JSON.stringify({ contract, scenario })).digest('hex')}`;
      const response = await fetch(`${host}/preview/component-contracts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identity, artifact, contractContentHash, localPath: source?.localPath, shadcn }), signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())) });
      if (!response.ok) throw new Error(`Preview contract host returned HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
      reports.push(await response.json() as SubstitutionContractReport);
    } catch (error) { reports.push(absent(`Real-browser contract check unavailable: ${error instanceof Error ? error.message : String(error)}`)); }
  }
  return reports;
}
