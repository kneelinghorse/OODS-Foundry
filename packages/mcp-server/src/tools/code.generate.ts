import { renderSeed } from '../codegen/render-seed.js';
import { screenApp } from '../codegen/screen-app.js';
import { checkSubstitutionContracts } from '../codegen/substitution-contracts.js';
import type { ToolContext } from '../lib/tool-context.js';
import { substituteGeneratedComponents, type EmittedSubstitution } from '../codegen/component-substitutions.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preflightCollections } from '../codegen/collection-emitter.js';
import { prepareChartAssets } from '../codegen/chart-assets.js';
import { chartNodes } from '../codegen/chart-declaration.js';
import { loadComponentRegistry, validateSchema } from './repl.utils.js';
import { emit as emitHtml } from '../codegen/html-emitter.js';
import { emit as emitReact } from '../codegen/react-emitter.js';
import { emit as emitVue } from '../codegen/vue-emitter.js';
import type { UiSchema } from '../schemas/generated.js';
import type { CodeGenerateInput, CodeGenerateOutput } from './types.js';
import type { Emitter, CodegenOptions, CodegenIssue, CodegenInstall, GeneratedDependency } from '../codegen/types.js';
import { resolveSchemaRef, unavailableSchemaRef } from './schema-ref.js';
import { loadOodsrc } from '../lib/oodsrc.js';
import {
  isKnownComponentForCodegen,
  preflightTargetCapabilities,
} from '../codegen/target-readiness.js';
import { preflightCodegenSyntax } from '../codegen/syntax-preflight.js';
import { buildGeneratedArtifact } from '../codegen/artifact-envelope.js';
import { preflightTargetContracts } from '../codegen/target-contracts.js';
import { preflightNormalizationSafety } from '../codegen/normalization-safety.js';
import { preflightStateContract } from '../codegen/state-contract.js';
import { writePayload } from '../lib/payload-store.js';
import { brandStylesheet } from '../lib/user-brands.js';
import { hasMappedRenderer } from '../render/component-map.js';
import {
  bindReleaseEvidence,
  createValidationReceipt,
  enforceValidationProfile,
  recordValidationChecks,
} from '../codegen/validation-profile.js';

const emitters: Record<string, Emitter> = {
  html: emitHtml,
  react: emitReact,
  vue: emitVue,
};

export type CodeGenerateDependencies = ToolContext & {
  targetCapabilityPreflight?: typeof preflightTargetCapabilities;
  /** The seed record the caller shows a standalone screen with (design.preview); its placed chart is drawn from it. */
  shownRecord?: Record<string, unknown>;
};

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../');

/**
 * The @oods packages generated React or Vue code imports, their own @oods dependencies included, at the exact versions
 * the generated artifact requests, and the npm commands that install them. The libraries are published, so npm is the only install
 * path (s220-m03, lock ruling #2463b); the runtime-repack steps of s211-m01 are retired, because a directory repacked
 * from the runtime lacks files the published package carries. An application's package.json pins every @oods package
 * its code imports (s222-m03, F5b), and npm install brings the @oods packages those depend on (s224-m01, #2542 ruling 7:
 * @oods/tokens arrives through @oods/component-styles), so it needs only `npm install`. A mapped team package installs
 * at its declared version; one that is not on a registry installs from its own tarball or folder.
 */
function installFor(dependencies: readonly GeneratedDependency[], substitutions: readonly EmittedSubstitution[] = [], application = false): CodegenInstall | undefined {
  const packages = new Map<string, CodegenInstall['packages'][number]>();
  const visit = (name: string, version: string) => {
    if (packages.has(name)) return;
    const manifestPath = path.join(REPO_ROOT, 'packages', name.slice('@oods/'.length), 'package.json');
    const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { version: string; dependencies?: Record<string, string> } : { version };
    packages.set(name, { name, version });
    // The published OODS libraries use exact same-release cross-pins. When a discovery-only
    // release retains older generated artifacts, their transitive pins stay with that release too.
    for (const [dependency, range] of Object.entries(manifest.dependencies ?? {})) if (dependency.startsWith('@oods/')) {
      visit(dependency, range === manifest.version ? version : range);
    }
  };
  for (const dependency of dependencies) if (dependency.name.startsWith('@oods/')) visit(dependency.name, dependency.version);
  const team = dependencies.filter(dependency => substitutions.some(entry => entry.source.package === dependency.name || entry.source.package?.startsWith(dependency.name + '/')));
  if (packages.size === 0 && team.length === 0) return undefined;
  const listed = [...packages.values()].sort((left, right) => left.name.localeCompare(right.name));
  const names = listed.map(entry => entry.name);
  const note = [
    ...(names.length ? [`${names.slice(0, -1).join(', ')}${names.length > 1 ? ' and ' : ''}${names.at(-1)} install from npm at the exact versions listed.`] : []),
    ...(application ? ["The app's package.json pins each package the app imports, and npm install fetches those and the @oods packages they depend on."] : []),
    ...(team.length ? ['Mapped team packages install at their declared versions; one that is not on a registry installs from its own tarball or folder.'] : []),
  ].join(' ');
  return {
    note,
    packages: listed,
    steps: application ? ['npm install', 'npm run build'] : [`npm install ${[...listed, ...team].map(entry => `${entry.name}@${entry.version}`).join(' ')}`],
  };
}

function countNodes(screens: UiSchema['screens']): number {
  let count = 0;
  const stack = [...screens];
  while (stack.length > 0) {
    const node = stack.pop()!;
    count += 1;
    if (node.children) {
      stack.push(...node.children);
    }
  }
  return count;
}

function collectComponents(screens: UiSchema['screens']): Set<string> {
  const components = new Set<string>();
  const stack = [...screens];
  while (stack.length > 0) {
    const node = stack.pop()!;
    components.add(node.component);
    if (node.children) {
      stack.push(...node.children);
    }
  }
  return components;
}

function preflightHtmlTarget(screens: UiSchema['screens']): CodegenIssue[] {
  const issues: CodegenIssue[] = [];
  const stack = [...screens].reverse();
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (!hasMappedRenderer(node.component)) {
      issues.push({
        code: 'OODS-N013',
        message: `Component ${node.component} has no mapped HTML renderer; fallback output is forbidden at build or release confidence.`,
        nodeId: node.id,
        component: node.component,
      });
    }
    if (node.children) stack.push(...node.children.slice().reverse());
  }
  return issues;
}

export async function handle(
  input: CodeGenerateInput,
  dependencies: CodeGenerateDependencies = {},
): Promise<CodeGenerateOutput> {
  const { framework } = input;
  const warnings: CodegenIssue[] = [];
  let validationReceipt = createValidationReceipt(input.profile, framework);
  let schema: UiSchema | undefined = input.schema;

  if (!schema && input.schemaRef) {
    const resolved = resolveSchemaRef(input.schemaRef);
    if (resolved.ok) {
      schema = resolved.schema;
    } else {
      const unavailable = unavailableSchemaRef(input.schemaRef, resolved.reason);
      return {
        status: 'error',
        framework,
        code: '',
        fileExtension: '',
        imports: [],
        warnings,
        validationReceipt,
        errors: [{ code: unavailable.code, message: `${unavailable.message} ${unavailable.hint}` }],
      };
    }
  }

  if (!schema) {
    return {
      status: 'error',
      framework,
      code: '',
      fileExtension: '',
      imports: [],
      warnings,
      validationReceipt,
      errors: [
        {
          code: 'OODS-V009',
          message: 'schema is required for code generation. Provide schema or schemaRef.',
        },
      ],
    };
  }

  // Validate the input schema structurally
  const schemaErrors = validateSchema(schema);
  validationReceipt = recordValidationChecks(validationReceipt, 'schema-structure');
  if (schemaErrors.length > 0) {
    return {
      status: 'error',
      framework,
      code: '',
      fileExtension: '',
      imports: [],
      warnings: [],
      validationReceipt,
      errors: schemaErrors.map((issue) => ({
        code: issue.code,
        message: issue.message,
        nodeId: issue.nodeId,
        component: issue.component,
      })),
    };
  }

  // Check component registry for unknown components
  const registry = loadComponentRegistry();
  const allComponents = collectComponents(schema.screens);
  const unknownComponents = Array.from(allComponents)
    .filter((componentName) => (
      registry.names.size > 0
        ? !registry.names.has(componentName)
        : framework !== 'html' && !isKnownComponentForCodegen(componentName, registry.names)
    ))
    .sort();
  const meta: CodeGenerateOutput['meta'] = {
    nodeCount: countNodes(schema.screens),
    componentCount: allComponents.size,
    ...(unknownComponents.length > 0 ? { unknownComponents } : {}),
  };

  // Resolve emitter
  const emitter = emitters[framework];
  if (!emitter) {
    return {
      status: 'error',
      framework,
      code: '',
      fileExtension: '',
      imports: [],
      warnings,
      validationReceipt,
      meta,
      errors: [{ code: 'OODS-V005', message: `No emitter registered for framework '${framework}'` }],
    };
  }

  validationReceipt = recordValidationChecks(
    validationReceipt,
    'component-registry',
  );
  const registryIssues: CodegenIssue[] = unknownComponents.length > 0
    ? [{
      code: 'OODS-V119',
      message:
        `Schema contains unregistered component${unknownComponents.length === 1 ? '' : 's'}: `
        + `${unknownComponents.join(', ')}. Fix the schema or run repl.validate before code generation.`,
    }]
    : [];

  const readinessErrors = framework === 'html'
    ? preflightHtmlTarget(schema.screens)
    : (dependencies.targetCapabilityPreflight ?? preflightTargetCapabilities)(
      schema.screens,
      framework,
    );
  const stateContractIssues = preflightStateContract(schema.screens, framework);
  validationReceipt = recordValidationChecks(
    validationReceipt,
    'state-contract',
    'target-readiness',
  );
  const earlyContractIssues = [
    ...registryIssues,
    ...preflightCollections(schema.screens, schema.objectSchema),
    ...stateContractIssues,
    ...readinessErrors,
  ];
  if (earlyContractIssues.length > 0) {
    // Evaluate these together: registry, state-vocabulary, and target gaps are
    // independent. Returning after the first would conceal actionable issues.
    const profiled = enforceValidationProfile(
      validationReceipt,
      earlyContractIssues,
    );
    warnings.push(...profiled.warnings);
    if (profiled.errors.length > 0) {
      return {
        status: 'error',
        framework,
        code: '',
        fileExtension: '',
        imports: [],
        warnings,
        validationReceipt,
        errors: profiled.errors,
        meta,
      };
    }
  }

  // Build codegen options (.oodsrc fallbacks between explicit and hardcoded defaults)
  const rc = loadOodsrc();
  const composedTheme = schema.theme === 'light' || schema.theme === 'dark' || schema.theme === 'hc'
    ? schema.theme : undefined;
  const options: CodegenOptions = {
    typescript: input.options?.typescript ?? rc.typescript ?? true,
    styling: input.options?.styling ?? rc.styling ?? 'tokens',
    // Explicit options win; composed app scopes survive the handoff to code generation.
    theme: input.options?.theme ?? composedTheme ?? (framework === 'html' ? undefined : 'light'),
    brand: input.options?.brand ?? (framework === 'html' ? undefined : 'A'),
  };
  // s213-m06: an app for a brand its @oods/tokens does not carry (a team's brand) carries that brand's stylesheet.
  const stylesheet = options.brand ? brandStylesheet(options.brand) : null;
  if (stylesheet) { options.brandStylesheet = stylesheet.file; if (framework === 'html') options.documentCss = stylesheet.contents; }

  if (framework === 'html' && options.styling === 'tailwind') {
    const profiled = enforceValidationProfile(validationReceipt, [{
      code: 'OODS-N018',
      message: 'HTML Tailwind styling is unavailable; the HTML target emits document CSS. Use tokens or inline, or choose React or Vue for Tailwind output.',
    }]);
    warnings.push(...profiled.warnings);
    if (profiled.errors.length > 0) {
      return {
        status: 'error',
        framework,
        code: '',
        fileExtension: '',
        imports: [],
        warnings,
        validationReceipt,
        errors: profiled.errors,
        meta,
      };
    }
  }

  const normalizationErrors = preflightNormalizationSafety(schema.screens, framework);
  validationReceipt = recordValidationChecks(validationReceipt, 'normalization-fidelity');
  if (normalizationErrors.length > 0) {
    const profiled = enforceValidationProfile(validationReceipt, normalizationErrors);
    warnings.push(...profiled.warnings);
    if (profiled.errors.length > 0) {
      return {
        status: 'error',
        framework,
        code: '',
        fileExtension: '',
        imports: [],
        warnings,
        validationReceipt,
        errors: profiled.errors,
        meta,
      };
    }
  }

  if (framework === 'react' || framework === 'vue') {
    const syntaxErrors = preflightCodegenSyntax(schema, framework, options.styling);
    validationReceipt = recordValidationChecks(
      validationReceipt,
      'binding-contract',
      'events-contract',
    );
    if (syntaxErrors.length > 0) {
      return {
        status: 'error',
        framework,
        code: '',
        fileExtension: '',
        imports: [],
        warnings,
        validationReceipt,
        errors: syntaxErrors,
        meta: {
          nodeCount: meta.nodeCount,
          componentCount: meta.componentCount,
        },
      };
    }
  }

  const contractResult = preflightTargetContracts(schema, framework);
  // A display's onChange that names no writer is inert: the display renders
  // its field, and the binding is reported, never discarded silently.
  for (const inert of contractResult.inertSubscriptions) {
    warnings.push({
      code: 'OODS-V007',
      message: `Binding ${inert.component}.onChange to ${inert.handlerName} ${inert.reason}.`,
      nodeId: inert.nodeId,
      component: inert.component,
    });
  }
  validationReceipt = recordValidationChecks(
    validationReceipt,
    ...(framework === 'html' ? ['binding-contract' as const] : []),
    ...contractResult.checks,
  );
  if (framework === 'html' && contractResult.bindingSafetyIssues.length > 0) {
    return {
      status: 'error',
      framework,
      code: '',
      fileExtension: '',
      imports: [],
      warnings,
      validationReceipt,
      errors: contractResult.bindingSafetyIssues,
      meta,
    };
  }
  if (contractResult.issues.length > 0) {
    const profiled = enforceValidationProfile(validationReceipt, contractResult.issues);
    warnings.push(...profiled.warnings);
    if (profiled.errors.length > 0) {
      return {
        status: 'error',
        framework,
        code: '',
        fileExtension: '',
        imports: [],
        warnings,
        validationReceipt,
        errors: profiled.errors,
        meta,
      };
    }
  }

  const application = input.options?.output === 'application';
  if (application && framework !== 'html' && !options.typescript) return { status: 'error', framework, code: '', fileExtension: '', imports: [], warnings, validationReceipt, meta, errors: [{ code: 'OODS-N016', message: 'Runnable applications require React or Vue and options.typescript=true.' }] };
  // A standalone payment chart uses the same authored record as its preview and sample app.
  const seed = framework === 'html' || !schema.workflow && (application || chartNodes(schema.screens).some(node => node.chart?.source === 'payment-events')) ? await renderSeed(schema) : undefined;
  const sample = seed?.record;
  if (seed) { options.sampleModel = seed.model; options.sampleRecords = seed.records; options.documentTitle = seed.title; }

  // Dispatch to framework emitter
  let prepared: Awaited<ReturnType<typeof prepareChartAssets>>;
  try {
    prepared = await prepareChartAssets(schema, options, dependencies.shownRecord ?? sample);
  } catch (error) {
    return { status: 'error', framework, code: '', fileExtension: '', imports: [], warnings, validationReceipt, meta,
      errors: [{ code: 'OODS-N016', message: error instanceof Error ? error.message : String(error) }] };
  }
  const result = emitter(prepared.schema, options);
  if (application && framework !== 'html' && !schema.workflow && result.status === 'ok') screenApp(result, prepared.schema, options, sample!);
  let substitutions: EmittedSubstitution[] = [];
  try { substitutions = substituteGeneratedComponents(result, prepared.schema, options.typescript); }
  catch (error) {
    return { status: 'error', framework, code: '', fileExtension: '', imports: [], warnings, validationReceipt, meta,
      errors: [{ code: 'OODS-N016', message: error instanceof Error ? error.message : String(error) }] };
  }
  const carried = [...prepared.files, ...(stylesheet ? [{ path: `src/${stylesheet.file}`, contents: stylesheet.contents }] : [])];
  if (carried.length && result.status === 'ok') {
    result.files = [...(result.files ?? [{ path: framework === 'html' ? 'index.html' : `src/GeneratedUI${result.fileExtension}`, contents: result.code }]), ...carried];
  }

  // Merge warnings
  const allWarnings = [...warnings, ...result.warnings];
  if (framework === 'html') validationReceipt = recordValidationChecks(validationReceipt, 'fallback-policy');
  if (framework === 'html' && result.code.includes('data-oods-fallback="true"')) {
    const profiled = enforceValidationProfile(validationReceipt, [{
      code: 'OODS-N013',
      message: 'Generated HTML contains a component fallback marker and is not runnable at build or release confidence.',
    }]);
    allWarnings.push(...profiled.warnings);
    if (profiled.errors.length > 0) {
      return {
        status: 'error',
        framework: result.framework,
        code: '',
        fileExtension: '',
        imports: [],
        warnings: allWarnings,
        validationReceipt,
        errors: profiled.errors,
        meta,
      };
    }
  }

  if (result.status !== 'ok') {
    return {
      status: result.status,
      framework: result.framework,
      code: result.code,
      fileExtension: result.fileExtension,
      imports: result.imports,
      warnings: allWarnings,
      validationReceipt,
      ...(result.errors?.length ? { errors: result.errors } : {}),
      meta,
    };
  }

  let artifact: NonNullable<CodeGenerateOutput['artifact']>;
  try {
    artifact = buildGeneratedArtifact(result.files
      ? { framework: result.framework, imports: result.imports, actions: result.actions, substitutions, files: result.files }
      : { framework: result.framework, imports: result.imports, actions: result.actions, substitutions, code: result.code, fileExtension: result.fileExtension });
  } catch (error) {
    validationReceipt = recordValidationChecks(validationReceipt, 'dependency-closure');
    return {
      status: 'error',
      framework: result.framework,
      code: '',
      fileExtension: '',
      imports: [],
      warnings: allWarnings,
      validationReceipt,
      errors: [{
        code: 'OODS-N016',
        message: error instanceof Error ? error.message : String(error),
      }],
      meta,
    };
  }

  validationReceipt = recordValidationChecks(validationReceipt, 'dependency-closure');
  const evidenceResult = bindReleaseEvidence(
    validationReceipt,
    input.releaseEvidence,
    artifact.contentHash,
  );
  validationReceipt = evidenceResult.receipt;
  if (evidenceResult.errors.length > 0) {
    return {
      status: 'error',
      framework: result.framework,
      code: '',
      fileExtension: '',
      imports: [],
      warnings: allWarnings,
      validationReceipt,
      errors: evidenceResult.errors,
      meta,
    };
  }

  const componentContracts = artifact.substitutions?.length && (framework === 'react' || framework === 'vue')
    ? await checkSubstitutionContracts(framework, artifact.substitutions, schema, dependencies) : undefined;
  for (const report of componentContracts ?? []) {
    if (report.summary.unmet) allWarnings.push({ code: 'OODS-V218', component: report.component, message: `Team ${report.component}: ${report.summary.unmet} unmet contract obligations (${report.obligations.filter(row => row.status === 'unmet').map(row => row.id).join(', ')}). Generation remains available.` });
  }

  if (input.options?.payloadMode === 'file') {
    // The artifact and its files go to disk beside the saved-schema store; the response keeps the receipt and the references.
    try {
      const payload = writePayload(`code.generate-${artifact.contentHash.replace(/^sha256:/, '').slice(0, 12)}`, [
        ...artifact.files,
        { path: 'artifact.json', contents: JSON.stringify(artifact, null, 2) + '\n' },
        ...(componentContracts ? [{ path: 'component-contracts.json', contents: JSON.stringify(componentContracts, null, 2) + '\n' }] : []),
      ]);
      const install = installFor(artifact.dependencies, artifact.substitutions, artifact.files.some(file => file.path === 'package.json'));
      return {
        status: result.status,
        framework: result.framework,
        payload,
        ...(componentContracts ? { componentContracts } : {}),
        code: '',
        fileExtension: result.fileExtension,
        imports: result.imports,
        warnings: allWarnings,
        validationReceipt,
        ...(result.errors?.length ? { errors: result.errors } : {}),
        ...(install ? { install } : {}),
        meta,
      };
    } catch (error) {
      return {
        status: 'error',
        framework: result.framework,
        code: '',
        fileExtension: '',
        imports: [],
        warnings: allWarnings,
        validationReceipt,
        errors: [{ code: 'OODS-S020', message: `Payload directory is not writable: ${error instanceof Error ? error.message : String(error)}` }],
        meta,
      };
    }
  }

  const install = installFor(artifact.dependencies, artifact.substitutions, artifact.files.some(file => file.path === 'package.json'));
  return {
    status: result.status,
    framework: result.framework,
    artifact,
    ...(componentContracts ? { componentContracts } : {}),
    code: result.code,
    fileExtension: result.fileExtension,
    imports: result.imports,
    warnings: allWarnings,
    validationReceipt,
    ...(result.errors?.length ? { errors: result.errors } : {}),
    ...(install ? { install } : {}),
    meta,
  };
}
