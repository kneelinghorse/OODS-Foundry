import { describe, expect, it } from 'vitest';

import { generateComposedTypes } from '../../src/generators/composer.js';
import {
  buildPipelineBundle,
  composeWithBase,
  loadTraitStack,
  summarizeIssues,
  validateParameterSets,
} from './utils/pipeline-helpers.js';
import { UNIVERSAL_QUINTET_STACKS } from './fixtures/universal-quintet.js';

describe('Universal Quintet integration pipeline', () => {
  for (const fixture of UNIVERSAL_QUINTET_STACKS) {
    it(`composes and validates the ${fixture.title} stack`, async () => {
      const { compositor, parameterValidator, pipeline } = buildPipelineBundle();
      const loaded = await loadTraitStack(fixture);

      const parameterResults = validateParameterSets(
        parameterValidator,
        fixture.parameters
      );

      for (const result of parameterResults) {
        expect(
          result.valid,
          `Parameter validation failed:\n${summarizeIssues(result).join('\n')}`
        ).toBe(true);
      }

      const composition = composeWithBase(
        compositor,
        loaded.traits,
        fixture.base
      );

      expect(composition.success).toBe(true);
      const composed = composition.data!;

      expect(composed.id).toBe(fixture.base.id);
      expect(composed.traits).toHaveLength(fixture.traitPaths.length);
      expect(composed.metadata.traitCount).toBe(fixture.traitPaths.length);

      const statusProvenance = composed.metadata.provenance.get('status');
      expect(statusProvenance?.source).toBe('Stateful');

      const compositionValidation = pipeline.validateComposition(composed);
      expect(
        compositionValidation.valid,
        `Composition validation issues:\n${summarizeIssues(compositionValidation).join('\n')}`
      ).toBe(true);

      const traitOrder = composed.metadata.traitOrder;
      const statefulIndex = traitOrder.indexOf('Stateful');
      expect(statefulIndex).toBeGreaterThanOrEqual(0);

      if (traitOrder.includes('Colorized')) {
        expect(statefulIndex).toBeLessThan(traitOrder.indexOf('Colorized'));
      }

      const generation = generateComposedTypes(loaded.traits, {
        formatted: false,
      });

      expect(generation.code).toContain('Composed types for');
      expect(generation.code).toContain('DO NOT EDIT');

      expect(composed.metadata.performance?.durationMs).toBeGreaterThanOrEqual(0);
      expect(composed.metadata.traitOrder.length).toBe(composed.traits.length);
      expect(Object.keys(composed.schema)).toContain('status');
    });
  }
});

