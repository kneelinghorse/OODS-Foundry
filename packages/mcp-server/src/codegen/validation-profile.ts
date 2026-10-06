import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type {
  CodegenFramework,
  CodegenAcceptedReleaseEvidence,
  CodegenIssue,
  CodegenReleaseEvidence,
  CodegenReleaseEvidenceClass,
  CodegenTargetResolution,
  CodegenValidationCheck,
  CodegenValidationProfile,
  CodegenValidationReceipt,
} from './types.js';

export const RELEASE_EVIDENCE_LIMIT = 'Local JSON evidence files are opened and SHA-256, passed status and artifact binding are verified; evidence is not re-executed.';

export const RELEASE_EVIDENCE_CLASSES = [
  'rendered',
  'interaction',
  'accessibility',
  'theme',
  'determinism',
  'performance',
] as const satisfies readonly CodegenReleaseEvidenceClass[];

const RELEASE_CHECKS = [
  ...RELEASE_EVIDENCE_CLASSES.map(
    (evidenceClass) => `${evidenceClass}-evidence` as CodegenValidationCheck,
  ),
  'certification-evidence',
] as const satisfies readonly CodegenValidationCheck[];

const BUILD_CHECKS = [
  'schema-structure',
  'component-registry',
  'state-contract',
  'target-readiness',
  'normalization-fidelity',
  'binding-contract',
  'props-contract',
  'slots-contract',
  'events-contract',
  'dependency-closure',
  'fallback-policy',
] as const satisfies readonly CodegenValidationCheck[];

/** Canonical receipt universe. Every check appears in exactly one receipt partition. */
export const ALL_CHECKS = [
  ...BUILD_CHECKS,
  ...RELEASE_CHECKS,
] as const satisfies readonly CodegenValidationCheck[];

export const CODEGEN_VALIDATION_PROFILES = {
  draft: {
    scope: 'structural',
    enforcement: 'advisory',
    fallback: 'visible',
    rationale: 'Draft reports target and fallback gaps without claiming a runnable artifact.',
  },
  build: {
    scope: 'generated-artifact',
    enforcement: 'blocking',
    fallback: 'forbidden',
    rationale: 'Build is the default blocking gate: target, bindings, dependencies and fallbacks must resolve under static checks; the static gate does not install or run the generated application.',
  },
  release: {
    scope: 'release-evidence',
    enforcement: 'blocking',
    fallback: 'forbidden',
    rationale: 'Release adds six local JSON evidence files with verified byte hashes, passed status and artifact binding to the build gate, and records server-owned certification as not applicable for generated UI targets.',
  },
} as const;

export function createValidationReceipt(
  requestedProfile: CodegenValidationProfile | undefined,
  target: CodegenFramework,
  targetResolution: CodegenTargetResolution = {
    requested: target,
    resolved: target,
    source: 'explicit',
  },
): CodegenValidationReceipt {
  const profile = requestedProfile ?? 'build';
  const policy = CODEGEN_VALIDATION_PROFILES[profile];
  return {
    profile,
    ...(profile === 'release' ? { evidenceVerification: 'file-verified-not-re-executed' as const } : {}),
    defaulted: requestedProfile === undefined,
    rationale: policy.rationale,
    axes: {
      scope: policy.scope,
      enforcement: policy.enforcement,
      fallback: policy.fallback,
      target: targetResolution,
    },
    checks: [],
    notChecked: [...ALL_CHECKS],
    evidence: {
      required: profile === 'release' ? [...RELEASE_EVIDENCE_CLASSES] : [],
      provided: [],
      missing: [],
      mismatched: [],
      accepted: [],
      notApplicable: [],
    },
  };
}

export function withTargetResolution(
  receipt: CodegenValidationReceipt,
  target: CodegenTargetResolution,
): CodegenValidationReceipt {
  return {
    ...receipt,
    axes: { ...receipt.axes, target },
  };
}

export function recordValidationChecks(
  receipt: CodegenValidationReceipt,
  ...checks: CodegenValidationCheck[]
): CodegenValidationReceipt {
  const completed = new Set([...receipt.checks, ...checks]);
  return {
    ...receipt,
    checks: ALL_CHECKS.filter((check) => completed.has(check)),
    notChecked: ALL_CHECKS.filter((check) => !completed.has(check)),
  };
}

/** Pure enforcement seam: draft surfaces non-structural gaps; build/release block them. */
export function enforceValidationProfile(
  receipt: CodegenValidationReceipt,
  issues: readonly CodegenIssue[],
): { warnings: CodegenIssue[]; errors: CodegenIssue[] } {
  return receipt.axes.enforcement === 'blocking'
    ? { warnings: [], errors: [...issues] }
    : { warnings: [...issues], errors: [] };
}

export function bindReleaseEvidence(
  receipt: CodegenValidationReceipt,
  releaseEvidence: CodegenReleaseEvidence | undefined,
  artifactContentHash: string,
): { receipt: CodegenValidationReceipt; errors: CodegenIssue[] } {
  let nextReceipt = recordValidationChecks(
    receipt,
    ...(receipt.profile === 'release' ? RELEASE_CHECKS : []),
  );

  if (receipt.profile !== 'release') {
    return {
      receipt: {
        ...nextReceipt,
        evidence: { ...nextReceipt.evidence, artifactContentHash },
      },
      errors: [],
    };
  }

  const provided: CodegenReleaseEvidenceClass[] = [];
  const missing: CodegenReleaseEvidenceClass[] = [];
  const mismatched: CodegenReleaseEvidenceClass[] = [];
  const accepted: CodegenAcceptedReleaseEvidence[] = [];
  const notApplicable = [{
    class: 'certification' as const,
    rationale: 'No artifact certification adapter applies to generated UI code targets.',
  }];

  for (const evidenceClass of RELEASE_EVIDENCE_CLASSES) {
    const item = releaseEvidence?.[evidenceClass];
    if (!item || item.status !== 'passed' || !item.reference || !item.artifactContentHash || !item.contentHash) {
      missing.push(evidenceClass);
      continue;
    }
    provided.push(evidenceClass);
    let bytes: Buffer;
    try { bytes = readFileSync(item.reference); }
    catch { missing.push(evidenceClass); provided.pop(); continue; }
    try {
      const document = JSON.parse(bytes.toString('utf8'));
      const contentHash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
      if (contentHash !== item.contentHash || document.status !== 'passed'
        || document.artifactContentHash !== artifactContentHash || item.artifactContentHash !== artifactContentHash) {
        mismatched.push(evidenceClass);
        continue;
      }
      accepted.push({ class: evidenceClass, status: 'passed', artifactContentHash, reference: item.reference, contentHash });
    } catch { mismatched.push(evidenceClass); }

  }

  nextReceipt = {
    ...nextReceipt,
    evidence: {
      ...nextReceipt.evidence,
      provided,
      missing,
      mismatched,
      accepted,
      notApplicable,
      artifactContentHash,
    },
  };

  const errors: CodegenIssue[] = [];
  if (missing.length > 0) {
    errors.push({
      code: 'OODS-V162',
      message: `Release profile is missing required evidence: ${missing.join(', ')}. ${RELEASE_EVIDENCE_LIMIT}`,
    });
  }
  if (mismatched.length > 0) {
    errors.push({
      code: 'OODS-V163',
      message:
        `Release evidence has invalid JSON, hash, status or binding to generated artifact ${artifactContentHash}: `
        + `${mismatched.join(', ')}. ${RELEASE_EVIDENCE_LIMIT}`,
    });
  }

  return { receipt: nextReceipt, errors };
}

export type ValidationReceiptExpectation = {
  profile: CodegenValidationProfile;
  defaulted: boolean;
  target: CodegenTargetResolution;
  artifactContentHash?: string;
};

function sameValues(left: readonly unknown[], right: readonly unknown[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function canonicalEvidenceClasses(values: readonly unknown[]): CodegenReleaseEvidenceClass[] {
  const selected = new Set(values);
  return [...RELEASE_EVIDENCE_CLASSES, 'certification' as const]
    .filter((evidenceClass) => selected.has(evidenceClass));
}

/**
 * Validate a child tool's receipt before a pipeline adopts it. This is a
 * runtime trust boundary: mocked, bridged, or future handlers must not be able
 * to downgrade the requested profile or relabel a different target.
 */
export function validationReceiptIntegrityIssues(
  receipt: CodegenValidationReceipt,
  expected: ValidationReceiptExpectation,
): string[] {
  const issues: string[] = [];
  const policy = CODEGEN_VALIDATION_PROFILES[expected.profile];

  if (receipt.profile !== expected.profile) {
    issues.push(`profile ${JSON.stringify(receipt.profile)} does not match ${JSON.stringify(expected.profile)}`);
  }
  if (expected.profile === 'release' && receipt.evidenceVerification !== 'file-verified-not-re-executed') issues.push('release evidence verification limit is missing');
  if (receipt.defaulted !== expected.defaulted) {
    issues.push(`defaulted=${String(receipt.defaulted)} does not match ${String(expected.defaulted)}`);
  }
  if (
    receipt.rationale !== policy.rationale
    || receipt.axes?.scope !== policy.scope
    || receipt.axes?.enforcement !== policy.enforcement
    || receipt.axes?.fallback !== policy.fallback
  ) {
    issues.push('policy axes or rationale do not match the selected profile');
  }
  if (
    receipt.axes?.target?.requested !== expected.target.requested
    || receipt.axes?.target?.resolved !== expected.target.resolved
    || receipt.axes?.target?.source !== expected.target.source
  ) {
    issues.push('target resolution does not match the invoked code-generation target');
  }

  const checks = Array.isArray(receipt.checks) ? receipt.checks : [];
  const notChecked = Array.isArray(receipt.notChecked) ? receipt.notChecked : [];
  const expectedChecks = ALL_CHECKS.filter((check) => checks.includes(check));
  const expectedNotChecked = ALL_CHECKS.filter((check) => !checks.includes(check));
  if (
    !sameValues(checks, expectedChecks)
    || !sameValues(notChecked, expectedNotChecked)
  ) {
    issues.push('checks and notChecked are not a canonical, complete, disjoint check partition');
  }

  const evidence = receipt.evidence;
  if (!evidence) {
    issues.push('evidence disclosure is missing');
    return issues;
  }
  const required = Array.isArray(evidence.required) ? evidence.required : [];
  const expectedRequired = expected.profile === 'release' ? [...RELEASE_EVIDENCE_CLASSES] : [];
  if (!sameValues(required, expectedRequired)) {
    issues.push('required evidence classes do not match the selected profile');
  }

  for (const [name, values] of [
    ['provided', evidence.provided],
    ['missing', evidence.missing],
    ['mismatched', evidence.mismatched],
  ] as const) {
    const list = Array.isArray(values) ? values : [];
    if (!sameValues(list, canonicalEvidenceClasses(list))) {
      issues.push(`${name} evidence classes are not unique and canonically ordered`);
    }
  }

  const accepted = Array.isArray(evidence.accepted) ? evidence.accepted : [];
  const acceptedClasses = accepted.map((item) => item.class);
  if (!sameValues(acceptedClasses, canonicalEvidenceClasses(acceptedClasses))) {
    issues.push('accepted evidence envelopes are not unique and canonically ordered');
  }
  if (!sameValues(evidence.provided.filter(name => !evidence.mismatched.includes(name)), acceptedClasses)) {
    issues.push('provided evidence classes do not match the accepted evidence envelopes');
  }
  for (const item of accepted) {
    if (
      item.status !== 'passed'
      || typeof item.reference !== 'string'
      || item.reference.length === 0
      || !/^sha256:[a-f0-9]{64}$/.test(item.contentHash ?? '')
      || typeof item.artifactContentHash !== 'string'
      || item.artifactContentHash.length === 0
    ) {
      issues.push(`accepted ${String(item.class)} evidence envelope is malformed`);
    }
  }

  const releaseChecks = RELEASE_CHECKS.filter((check) => checks.includes(check));
  if (expected.profile !== 'release' && releaseChecks.length > 0) {
    issues.push('non-release profile claims release-only evidence checks');
  }
  if (expected.profile === 'release' && releaseChecks.length !== 0 && releaseChecks.length !== RELEASE_CHECKS.length) {
    issues.push('release evidence checks are only partially disclosed');
  }
  if (releaseChecks.length === RELEASE_CHECKS.length) {
    const disclosed = new Set([...evidence.provided, ...evidence.missing]);
    if (
      RELEASE_EVIDENCE_CLASSES.some((evidenceClass) => !disclosed.has(evidenceClass))
      || evidence.provided.some((evidenceClass) => evidence.missing.includes(evidenceClass))
    ) {
      issues.push('provided and missing evidence do not partition the required release classes');
    }
    if (
      evidence.notApplicable.length !== 1
      || evidence.notApplicable[0]?.class !== 'certification'
      || !evidence.notApplicable[0].rationale
    ) {
      issues.push('server-owned certification applicability is not disclosed');
    }
  } else if (
    evidence.provided.length > 0
    || evidence.missing.length > 0
    || evidence.mismatched.length > 0
    || accepted.length > 0
    || evidence.notApplicable.length > 0
  ) {
    issues.push('receipt claims evidence outcomes before evidence checks were reached');
  }

  if (evidence.mismatched.some((evidenceClass) => !evidence.provided.includes(evidenceClass))) {
    issues.push('mismatched evidence is not a subset of provided evidence');
  }
  if (
    expected.artifactContentHash !== undefined
    && evidence.artifactContentHash !== expected.artifactContentHash
  ) {
    issues.push('receipt artifact hash does not match the generated artifact');
  }
  if (expected.artifactContentHash !== undefined) {
    if (BUILD_CHECKS.some((check) => (check !== 'fallback-policy' || expected.target.resolved === 'html') && !checks.includes(check))) {
      issues.push('successful artifact receipt omits one or more build checks');
    }
    if (expected.profile === 'release') {
      if (RELEASE_CHECKS.some((check) => !checks.includes(check))) {
        issues.push('successful release artifact receipt omits one or more release checks');
      }
      if (
        !sameValues(evidence.provided, RELEASE_EVIDENCE_CLASSES)
        || evidence.missing.length > 0
        || evidence.mismatched.length > 0
        || accepted.length !== RELEASE_EVIDENCE_CLASSES.length
      ) {
        issues.push('successful release artifact does not disclose six satisfied evidence classes');
      }
      if (accepted.some((item) => item.artifactContentHash !== expected.artifactContentHash)) {
        issues.push('accepted release evidence is not bound to the generated artifact');
      }
    }
  }

  return issues;
}
