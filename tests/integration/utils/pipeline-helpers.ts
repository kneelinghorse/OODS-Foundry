import type { TraitDefinition } from '../../../src/core/trait-definition.js';
import {
  TraitCompositor,
  type BaseObjectDefinition,
} from '../../../src/core/compositor.js';
import {
  parseTraitsSuccessful,
  type ParseResult,
} from '../../../src/parsers/index.js';
import {
  CompositionValidator,
  ParameterValidator,
  type ValidationIssue,
  type ValidationResult,
  ValidationPipeline,
} from '../../../src/validation/index.js';
import type { TraitStackFixture, TraitParameterSet } from '../fixtures/universal-quintet.js';

export interface LoadedTraitStack {
  stack: TraitStackFixture;
  traits: TraitDefinition[];
}

export interface PipelineBundle {
  pipeline: ValidationPipeline;
  parameterValidator: ParameterValidator;
  compositor: TraitCompositor;
}

export async function loadTraitStack(
  stack: TraitStackFixture
): Promise<LoadedTraitStack> {
  const parseErrors: Array<{ file: string; errors: ParseResult<TraitDefinition>['errors'] }> =
    [];

  const traits = await parseTraitsSuccessful(stack.traitPaths, (file, errors) => {
    parseErrors.push({ file, errors });
  });

  if (parseErrors.length > 0) {
    const messages = parseErrors
      .map((entry) => {
        const details = (entry.errors ?? [])
          .map((error) => `  - ${error?.message ?? 'Unknown error'}`)
          .join('\n');
        return `${entry.file}\n${details}`;
      })
      .join('\n');

    throw new Error(`Failed to parse trait stack "${stack.title}":\n${messages}`);
  }

  return { stack, traits };
}

export function buildPipelineBundle(): PipelineBundle {
  return {
    pipeline: new ValidationPipeline({
      compositionValidator: new CompositionValidator({
        performanceTargetMs: 50,
      }),
    }),
    parameterValidator: new ParameterValidator(),
    compositor: new TraitCompositor({
      trackProvenance: true,
      trackPerformance: true,
    }),
  };
}

export function validateParameterSets(
  validator: ParameterValidator,
  sets: TraitParameterSet[]
): ValidationResult[] {
  return sets.map((set) =>
    validator.validate(set.trait, set.values, {
      filePath: `parameters://${set.trait}`,
    })
  );
}

export function composeWithBase(
  compositor: TraitCompositor,
  traits: TraitDefinition[],
  base: BaseObjectDefinition
) {
  return compositor.compose(traits, base);
}

export function summarizeIssues(result: ValidationResult): string[] {
  return result.issues.map(formatIssue);
}

export function formatIssue(issue: ValidationIssue): string {
  const location = issue.location?.path ?? '/';
  return `[${issue.severity}] ${issue.code}: ${issue.message} (${location})`;
}

