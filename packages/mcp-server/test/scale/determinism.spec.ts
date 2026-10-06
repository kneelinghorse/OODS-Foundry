/**
 * Q1 determinism gate (synthesizer half).
 *
 * Belt-and-suspenders for the seeded-determinism claim made by the synthesizer.
 * If this spec ever flakes, the scale-tier suite as a whole can't be trusted
 * for the 3-sprint determinism streak required by mission-graph V2 axis #7.
 */
import { describe, expect, it } from 'vitest';
import { synthesizeReconciliationReport, type ScaleTier } from './synth.js';

const TIERS: ScaleTier[] = [100, 500, 1000];

describe('synthesizer determinism', () => {
  for (const tier of TIERS) {
    it(`tier=${tier} same seed produces byte-identical reports`, () => {
      const first = synthesizeReconciliationReport({ tier, seed: 42 });
      const second = synthesizeReconciliationReport({ tier, seed: 42 });
      expect(JSON.stringify(first)).toEqual(JSON.stringify(second));
    });

    it(`tier=${tier} different seeds produce different reports`, () => {
      const a = synthesizeReconciliationReport({ tier, seed: 1 });
      const b = synthesizeReconciliationReport({ tier, seed: 2 });
      expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
    });

    it(`tier=${tier} produces exactly N candidates`, () => {
      const report = synthesizeReconciliationReport({ tier, seed: 7 });
      expect(report.candidate_objects).toHaveLength(tier);
    });
  }
});
