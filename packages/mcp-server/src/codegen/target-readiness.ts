import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import type { UiElement } from '../schemas/generated.js';
import type { CodegenIssue, CodegenFramework } from './types.js';
import { READINESS_ATTESTATION_PATH, verifyReadinessAttestation } from './readiness-attestation.js';

type TargetFramework = Extract<CodegenFramework, 'react' | 'vue'>;

type CapabilityBaseline = {
  rows: Array<{
    id: string;
    surfaces?: Partial<Record<TargetFramework, { state?: string }>>;
  }>;
};

export const READINESS_EVIDENCE_CLASSES = [
  'versionedContract',
  'targetImplementation',
  'packageExport',
  'publicDeclaration',
  'dependencyClosure',
  'frameworkScenario',
] as const;

export type ReadinessEvidenceClass = typeof READINESS_EVIDENCE_CLASSES[number];
export type ReadinessReferenceClass = 'A' | 'B';

type ReadinessEvidence = {
  status?: string;
  refs?: string[];
};

export type TargetReadinessRow = {
  componentId: string;
  state: string;
  emissionEligible: boolean;
  evidence?: Partial<Record<ReadinessEvidenceClass, ReadinessEvidence>>;
};

export type TargetReadiness = {
  target: TargetFramework;
  rows: TargetReadinessRow[];
};

export type ReadinessReferenceFailure = {
  evidenceClass: ReadinessEvidenceClass;
  referenceClass: ReadinessReferenceClass;
  ref: string;
  reason: 'evidence-missing' | 'invalid-reference' | 'file-unavailable' | 'symbol-unavailable';
};

export type TargetCapabilityPreflightOptions = {
  repositoryRoot?: string;
  capabilityBaseline?: CapabilityBaseline;
  readiness?: Partial<Record<TargetFramework, TargetReadiness>>;
  readFile?: (absolutePath: string) => string;
};

const require = createRequire(import.meta.url);

// The evidence documents are package data. Their repo-relative references are
// resolved separately below so a truthy row cannot bypass physical evidence.
const defaultCapabilityBaseline = require(
  '@oods/component-contracts/registry/capabilities',
) as CapabilityBaseline;

export function mergeTargetReadiness(
  nucleus: TargetReadiness,
  ported: TargetReadiness,
): TargetReadiness {
  if (nucleus.target !== ported.target) {
    throw new Error(
      `Cannot merge readiness for ${nucleus.target} with readiness for ${ported.target}.`,
    );
  }
  const rows = [...nucleus.rows, ...ported.rows];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.componentId)) {
      throw new Error(
        `Duplicate ${nucleus.target} readiness row for ${row.componentId}.`,
      );
    }
    seen.add(row.componentId);
  }
  return { target: nucleus.target, rows };
}

const defaultReadiness: Readonly<Record<TargetFramework, TargetReadiness>> = {
  react: require('@oods/components-react/readiness') as TargetReadiness,
  vue: require('@oods/components-vue/readiness') as TargetReadiness,
};

// This relative shape is identical in source and built package layouts:
// packages/mcp-server/{src|dist}/codegen/target-readiness.{ts|js}.
export const DEFAULT_READINESS_REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasNamedExport(source: string, symbol: string): boolean {
  const escaped = escapeRegExp(symbol);
  const declaration = new RegExp(
    `\\bexport\\s+(?:declare\\s+)?(?:const|let|var|function|class)\\s+${escaped}\\b`,
  );
  const exportList = new RegExp(
    `\\bexport\\s*(?:type\\s*)?\\{[^}]*\\b${escaped}\\b(?:\\s+as\\s+[$\\w]+)?[^}]*\\}`,
    's',
  );
  return declaration.test(source) || exportList.test(source);
}

function hasVersionedContract(source: string, symbol: string): boolean {
  if (!/\bexport\s+const\s+(?:componentContracts|portedComponentContracts)\b/.test(source)) {
    return false;
  }
  const escaped = escapeRegExp(symbol);
  return new RegExp(`(?:^|\\n)\\s*${escaped}\\s*:`).test(source);
}

function referenceClass(evidenceClass: ReadinessEvidenceClass): ReadinessReferenceClass {
  return evidenceClass === 'publicDeclaration' ? 'B' : 'A';
}

function splitReference(ref: string): { relativePath: string; symbol: string } | null {
  const separator = ref.lastIndexOf('#');
  if (separator <= 0 || separator === ref.length - 1) return null;
  const relativePath = ref.slice(0, separator);
  const symbol = ref.slice(separator + 1);
  if (
    path.isAbsolute(relativePath)
    || relativePath.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    return null;
  }
  return { relativePath, symbol };
}

function resolveReference(
  repositoryRoot: string,
  evidenceClass: ReadinessEvidenceClass,
  ref: string,
  readFile: (absolutePath: string) => string,
  sourceCache: Map<string, string | null>,
): ReadinessReferenceFailure | null {
  const classified = referenceClass(evidenceClass);
  const split = splitReference(ref);
  if (!split) {
    return { evidenceClass, referenceClass: classified, ref, reason: 'invalid-reference' };
  }

  const absolutePath = path.resolve(repositoryRoot, split.relativePath);
  const relative = path.relative(repositoryRoot, absolutePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return { evidenceClass, referenceClass: classified, ref, reason: 'invalid-reference' };
  }

  let source = sourceCache.get(absolutePath);
  if (source === undefined) {
    try {
      source = readFile(absolutePath);
    } catch {
      source = null;
    }
    sourceCache.set(absolutePath, source);
  }
  if (source === null) {
    return { evidenceClass, referenceClass: classified, ref, reason: 'file-unavailable' };
  }

  // Scenario/dependency fragments are stable evidence labels inside executing
  // files, not JavaScript exports. File existence is their resolvable contract.
  if (evidenceClass === 'dependencyClosure' || evidenceClass === 'frameworkScenario') return null;
  const symbolExists = evidenceClass === 'versionedContract'
    ? hasVersionedContract(source, split.symbol)
    : hasNamedExport(source, split.symbol);
  return symbolExists
    ? null
    : { evidenceClass, referenceClass: classified, ref, reason: 'symbol-unavailable' };
}

export function resolveReadinessRowReferences(
  row: TargetReadinessRow,
  options: Pick<TargetCapabilityPreflightOptions, 'repositoryRoot' | 'readFile'> = {},
  sourceCache: Map<string, string | null> = new Map(),
): ReadinessReferenceFailure[] {
  const repositoryRoot = options.repositoryRoot ?? DEFAULT_READINESS_REPOSITORY_ROOT;
  const readFile = options.readFile ?? ((absolutePath: string) => readFileSync(absolutePath, 'utf8'));
  const failures: ReadinessReferenceFailure[] = [];

  for (const evidenceClass of READINESS_EVIDENCE_CLASSES) {
    const evidence = row.evidence && Object.hasOwn(row.evidence, evidenceClass)
      ? row.evidence[evidenceClass]
      : undefined;
    if (evidence?.status !== 'passed' || !Array.isArray(evidence.refs) || evidence.refs.length === 0) {
      failures.push({
        evidenceClass,
        referenceClass: referenceClass(evidenceClass),
        ref: `${row.componentId}:${evidenceClass}`,
        reason: 'evidence-missing',
      });
      continue;
    }
    for (const ref of evidence.refs) {
      if (typeof ref !== 'string') {
        failures.push({
          evidenceClass,
          referenceClass: referenceClass(evidenceClass),
          ref: String(ref),
          reason: 'invalid-reference',
        });
        continue;
      }
      const failure = resolveReference(repositoryRoot, evidenceClass, ref, readFile, sourceCache);
      if (failure) failures.push(failure);
    }
  }
  return failures;
}

function nodesInDocumentOrder(screens: readonly UiElement[]): UiElement[] {
  const ordered: UiElement[] = [];
  const stack = [...screens].reverse();

  while (stack.length > 0) {
    const node = stack.pop()!;
    ordered.push(node);
    if (node.children) stack.push(...node.children.slice().reverse());
  }

  return ordered;
}

/**
 * Construct a preflight over an explicit evidence view. Tests and evidence
 * probes use this seam to exercise missing rows/files/exports without editing
 * tracked package inputs; production calls use the package documents above.
 */
export function createTargetCapabilityPreflight(
  options: TargetCapabilityPreflightOptions = {},
): (screens: readonly UiElement[], framework: TargetFramework) => CodegenIssue[] {
  const capabilityBaseline = options.capabilityBaseline ?? defaultCapabilityBaseline;
  const readinessDocuments: Readonly<Record<TargetFramework, TargetReadiness>> = {
    react: options.readiness?.react ?? defaultReadiness.react,
    vue: options.readiness?.vue ?? defaultReadiness.vue,
  };
  const baselineByComponent = new Map(
    capabilityBaseline.rows.map((row) => [row.id, row] as const),
  );
  const repositoryRoot = options.repositoryRoot ?? DEFAULT_READINESS_REPOSITORY_ROOT;
  const hasAttestation = existsSync(path.join(repositoryRoot, READINESS_ATTESTATION_PATH));
  const sourceCache = new Map<string, string | null>();
  const resolvedRowsByTarget: Readonly<Record<
    TargetFramework,
    ReadonlyMap<string, { row: TargetReadinessRow; failures: ReadinessReferenceFailure[] }>
  >> = {
    react: new Map(readinessDocuments.react.rows.map((row) => [
      row.componentId,
      { row, failures: hasAttestation ? [] : resolveReadinessRowReferences(row, options, sourceCache) },
    ] as const)),
    vue: new Map(readinessDocuments.vue.rows.map((row) => [
      row.componentId,
      { row, failures: hasAttestation ? [] : resolveReadinessRowReferences(row, options, sourceCache) },
    ] as const)),
  };

  return (screens, framework) => {
    // Recheck the seal and package bytes per generation: an already-running
    // portable process must also refuse a subsequently damaged installation.
    const attestation = hasAttestation
      ? verifyReadinessAttestation(repositoryRoot, readinessDocuments, READINESS_EVIDENCE_CLASSES)
      : undefined;
    const invalidAttestation = attestation !== undefined && attestation.status !== 'verified';
    const readinessByComponent = resolvedRowsByTarget[framework];
    const issues: CodegenIssue[] = [];

    for (const node of nodesInDocumentOrder(screens)) {
      const baseline = baselineByComponent.get(node.component);
      const resolvedReadiness = readinessByComponent.get(node.component);
      const readiness = resolvedReadiness?.row;
      const referenceFailures = resolvedReadiness?.failures ?? [];

      // A target assertion is actionable only when the controlling baseline,
      // eligibility derivation, and every physical evidence ref all agree.
      if (baseline && readiness?.emissionEligible === true && referenceFailures.length === 0 && !invalidAttestation) {
        continue;
      }

      const missingDeclarationFile = referenceFailures.some((failure) => (
        failure.evidenceClass === 'publicDeclaration' && failure.reason === 'file-unavailable'
      ));
      const state = invalidAttestation
        ? 'attestation-invalid'
        : missingDeclarationFile
          ? 'declaration-unbuilt'
          : referenceFailures.length > 0
            ? 'reference-unresolved'
            : readiness?.state
              ?? baseline?.surfaces?.[framework]?.state
              ?? 'unavailable';
      issues.push({
        code: 'OODS-N015',
        message:
          `Component ${node.component} is not emission-eligible for ${framework}; `
          + `evidence state: ${state}.`,
        nodeId: node.id,
        component: node.component,
      });
    }

    return issues;
  };
}

const defaultPreflight = createTargetCapabilityPreflight();

export function isKnownComponentForCodegen(
  componentId: string,
  structuredRegistryNames: ReadonlySet<string>,
): boolean {
  if (structuredRegistryNames.size > 0) return structuredRegistryNames.has(componentId);
  return defaultCapabilityBaseline.rows.some((row) => row.id === componentId);
}

/** Check every requested component/target pair before an emitter runs. */
export function preflightTargetCapabilities(
  screens: readonly UiElement[],
  framework: TargetFramework,
): CodegenIssue[] {
  return defaultPreflight(screens, framework);
}
