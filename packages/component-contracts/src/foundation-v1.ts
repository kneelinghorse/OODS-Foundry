import type { EvidenceResult } from './types.js';

export const EMISSION_ELIGIBILITY_EVIDENCE_CLASSES = [
  'versionedContract',
  'targetImplementation',
  'packageExport',
  'publicDeclaration',
  'dependencyClosure',
  'frameworkScenario',
] as const;

export type EmissionEligibilityEvidenceClass =
  (typeof EMISSION_ELIGIBILITY_EVIDENCE_CLASSES)[number];
export type EmissionEligibilityEvidence = Record<EmissionEligibilityEvidenceClass, EvidenceResult>;

export function evaluateEmissionEligibility(evidence: Partial<EmissionEligibilityEvidence>) {
  const incomplete = EMISSION_ELIGIBILITY_EVIDENCE_CLASSES.filter(
    (name) => evidence[name]?.status !== 'passed',
  );
  return {
    emissionEligible: incomplete.length === 0,
    incomplete,
  } as const;
}

export const FOUNDATION_V1_EVIDENCE_CLASSES = [
  'classificationContract',
  'packageExport',
  'scenarioBehavior',
  'accessibility',
  'visualThemes',
  'responsiveCraft',
  'serverRender',
  'packedImport',
  'codegenConsumer',
] as const;

export type FoundationV1EvidenceClass = (typeof FOUNDATION_V1_EVIDENCE_CLASSES)[number];
export type FoundationV1Evidence = Record<FoundationV1EvidenceClass, EvidenceResult>;

export function evaluateFoundationV1(
  evidence: Partial<FoundationV1Evidence>,
  options: { independentReviewApproved?: boolean } = {},
) {
  const incomplete = FOUNDATION_V1_EVIDENCE_CLASSES.filter((name) => evidence[name]?.status !== 'passed');
  const evidenceComplete = incomplete.length === 0;
  return {
    evidenceComplete,
    candidate: evidenceComplete,
    foundationV1: evidenceComplete && options.independentReviewApproved === true,
    incomplete,
  } as const;
}
