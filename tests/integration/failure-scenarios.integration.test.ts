import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DependencyGraph,
  DependencyValidator,
  TraitCompositor,
} from '../../src/core/index.js';
import {
  ErrorCodes,
  ParameterValidator,
  ValidationPipeline,
} from '../../src/validation/index.js';
import {
  composeWithBase,
  loadTraitStack,
  summarizeIssues,
} from './utils/pipeline-helpers.js';
import { UNIVERSAL_QUINTET_STACKS } from './fixtures/universal-quintet.js';
import { parseTrait, parseTraitsSuccessful } from '../../src/parsers/index.js';

describe('Integration failure scenarios', () => {
  it('surfaces parser failures for malformed trait definitions', async () => {
    const invalidTraitPath = path.resolve(
      'traits/examples/invalid-trait.yaml'
    );
    const result = await parseTrait(invalidTraitPath);

    expect(result.success).toBe(false);
    expect(result.errors?.[0]?.message ?? '').toMatch(/missing required field/i);
  });

  it('rejects invalid parameter configurations via AJV', () => {
    const validator = new ParameterValidator();

    const result = validator.validate(
      'Stateful',
      {
        states: ['draft', 'active'],
        initialState: 'archived',
      },
      { filePath: 'parameters://Stateful-invalid' }
    );

    expect(result.valid).toBe(false);
    expect(result.summary.errors).toBeGreaterThan(0);
    expect(result.issues[0].code).toBe(ErrorCodes.INVALID_PARAMETER_VALUE);
  });

  it('emits collision warnings when base schemas conflict with trait contributions', async () => {
    const taggableStack = UNIVERSAL_QUINTET_STACKS.find(
      (stack) => stack.id === 'user'
    );
    expect(taggableStack).toBeDefined();

    const { traits } = await loadTraitStack(taggableStack!);

    const compositor = new TraitCompositor({ trackProvenance: true });
    const pipeline = new ValidationPipeline();

    const baseWithCollision = {
      ...taggableStack!.base,
      schema: {
        ...taggableStack!.base.schema,
        tags: { type: 'string[]', required: true },
      },
    };

    const composition = composeWithBase(
      compositor,
      traits,
      baseWithCollision
    );

    expect(composition.success).toBe(true);
    const composed = composition.data!;

    const validationResult = pipeline.validateComposition(composed);
    const issues = validationResult.issues.filter(
      (issue) => issue.code === ErrorCodes.PROPERTY_COLLISION
    );

    expect(validationResult.summary.warnings).toBeGreaterThan(0);
    expect(issues).not.toHaveLength(0);
    expect(issues[0].message).toContain('Field "tags"');
  });

  it('detects circular dependencies through the dependency validator', async () => {
    const [stateful, colorized] = await parseTraitsSuccessful([
      path.resolve('traits/lifecycle/Stateful.trait.yaml'),
      path.resolve('traits/visual/Colorized.trait.yaml'),
    ]);

    const statefulWithCycle = JSON.parse(JSON.stringify(stateful));
    statefulWithCycle.dependencies = [...(stateful.dependencies ?? []), 'Colorized'];

    const graph = new DependencyGraph();
    graph.addTrait(statefulWithCycle);
    graph.addTrait(colorized);

    const validator = new DependencyValidator(graph);
    const result = validator.validate();

    const circularErrors = result.errors.filter(
      (error) => error.type === 'circular_dependency'
    );

    expect(result.success).toBe(false);
    expect(circularErrors).not.toHaveLength(0);
    expect(circularErrors[0].message.toLowerCase()).toContain('circular');
  });
});
