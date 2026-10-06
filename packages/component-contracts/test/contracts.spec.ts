import { describe, expect, it } from 'vitest';
import {
  FOUNDATION_V1_EVIDENCE_CLASSES,
  EMISSION_ELIGIBILITY_EVIDENCE_CLASSES,
  NUCLEUS_COMPONENT_IDS,
  componentCapabilityBaseline,
  componentContracts,
  componentIntake,
  componentReconciliationProposal,
  deriveStartingComponentCount,
  evaluateFoundationV1,
  evaluateEmissionEligibility,
  sharedScenarios,
  validateComponentIntakeDocument,
  type FoundationV1Evidence,
  type EmissionEligibilityEvidence,
} from '../src/index.js';

function passingEvidence(): FoundationV1Evidence {
  return Object.fromEntries(
    FOUNDATION_V1_EVIDENCE_CLASSES.map((name) => [name, { status: 'passed', refs: [`evidence/${name}.json`] }]),
  ) as FoundationV1Evidence;
}

function passingEmissionEvidence(): EmissionEligibilityEvidence {
  return Object.fromEntries(
    EMISSION_ELIGIBILITY_EVIDENCE_CLASSES.map((name) => [name, { status: 'passed', refs: [`evidence/${name}.json`] }]),
  ) as EmissionEligibilityEvidence;
}

describe('Sprint 182 canonical component truth plane', () => {
  it('derives the controlling 114-row denominator from unique sorted membership', () => {
    // s222-m02 (#2502 ruling 11): Switch and Dialog join the 110. s223-m02 (#2527 rulings 10-12): SegmentedControl and
    // Combobox join the 112.
    const ids = componentIntake.rows.map((row) => row.id);
    expect(ids).toHaveLength(114);
    expect(deriveStartingComponentCount()).toBe(114);
    expect(ids).toEqual([...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
    expect(new Set(ids).size).toBe(ids.length);
    expect(componentIntake.controllingObligationDenominator).toBe(114);
    expect(validateComponentIntakeDocument(componentIntake)).toEqual([]);
  });

  it('B-01 reds when one intake ID is dropped or duplicated', () => {
    const dropped = { ...componentIntake, rows: componentIntake.rows.slice(1) };
    const duplicated = { ...componentIntake, rows: [...componentIntake.rows, componentIntake.rows[0]] };
    expect(validateComponentIntakeDocument(dropped)).toContain('intake must contain exactly 114 rows; received 113');
    expect(validateComponentIntakeDocument(duplicated)).toContain('intake IDs must be unique');
  });

  it('B-02 rejects a restored independent 101 count instead of trusting it', () => {
    const mutated = { ...componentIntake, componentCount: 101 };
    expect(new Set(mutated.rows.map((row) => row.id)).size).toBe(114);
    expect(validateComponentIntakeDocument(mutated)).toContain('intake must not contain an independent componentCount');
  });

  it('classifies and reports target-specific evidence for every starting row without approving it', () => {
    expect(componentReconciliationProposal.rows).toHaveLength(114);
    expect(componentReconciliationProposal.approvedRuntimeCensus).toBeNull();
    // s211-m03: the state is served under its neutral name; the labels stay proposed (#1979).
    expect(componentReconciliationProposal.rows.every((row) => row.approvalState === 'pending-approval')).toBe(true);
    expect(componentCapabilityBaseline.rows).toHaveLength(114);
    for (const row of componentCapabilityBaseline.rows) {
      expect(row.surfaces).toEqual(expect.objectContaining({
        metadata: expect.any(Object), html: expect.any(Object), react: expect.any(Object),
        vue: expect.any(Object), generatedConsumer: expect.any(Object),
      }));
    }
  });

  it('versions every canonical nucleus contract and explicit nondegenerate scenario', () => {
    expect(Object.keys(componentContracts).sort()).toEqual([...NUCLEUS_COMPONENT_IDS].sort());
    expect(sharedScenarios.map((scenario) => scenario.oodsComponentId).sort()).toEqual([...NUCLEUS_COMPONENT_IDS].sort());
    for (const scenario of sharedScenarios) {
      expect(scenario.oodsComponentId).toBeTruthy();
      expect(Object.keys(scenario.props).length + Object.keys(scenario.slots).length).toBeGreaterThan(0);
      expect(scenario.renderExpectation.name).toBeTruthy();
      expect(scenario.renderExpectation.trigger).toBeTruthy();
      expect(scenario.assertions.length).toBeGreaterThan(0);
    }
  });

  it('B-03 blocks foundation-v1 independently for each of the nine evidence classes', () => {
    const frozenEvidenceClasses = [
      'classificationContract', 'packageExport', 'scenarioBehavior', 'accessibility', 'visualThemes',
      'responsiveCraft', 'serverRender', 'packedImport', 'codegenConsumer',
    ] as const;
    expect(FOUNDATION_V1_EVIDENCE_CLASSES).toEqual(frozenEvidenceClasses);
    const complete = passingEvidence();
    expect(evaluateFoundationV1(complete)).toEqual(expect.objectContaining({ candidate: true, foundationV1: false }));
    expect(evaluateFoundationV1(complete, { independentReviewApproved: true }).foundationV1).toBe(true);
    for (const missing of frozenEvidenceClasses) {
      const mutated = { ...complete };
      delete mutated[missing];
      expect(evaluateFoundationV1(mutated, { independentReviewApproved: true })).toEqual({
        evidenceComplete: false,
        candidate: false,
        foundationV1: false,
        incomplete: [missing],
      });
    }
  });

  it('B-03 blocks emission eligibility independently for incomplete target evidence', () => {
    const frozenEmissionClasses = [
      'versionedContract', 'targetImplementation', 'packageExport', 'publicDeclaration',
      'dependencyClosure', 'frameworkScenario',
    ] as const;
    expect(EMISSION_ELIGIBILITY_EVIDENCE_CLASSES).toEqual(frozenEmissionClasses);
    expect(evaluateEmissionEligibility(passingEmissionEvidence()).emissionEligible).toBe(true);
    for (const missing of frozenEmissionClasses) {
      const mutated = { ...passingEmissionEvidence() };
      delete mutated[missing];
      expect(evaluateEmissionEligibility(mutated)).toEqual({
        emissionEligible: false,
        incomplete: [missing],
      });
    }
  });
});
