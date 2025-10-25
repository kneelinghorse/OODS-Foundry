import TimeService from '../services/time/index.js';
import type { TraitDefinition } from '../core/trait-definition.js';
import type {
  ObjectDefinition,
  TraitParameterMap,
  TraitParameterValue,
  TraitReference,
} from './object-definition.js';
import {
  applyTraitParameters,
  type ParameterApplicationOptions,
} from './parameter-applier.js';
import {
  TraitLoader,
  type TraitLoadResult,
  type TraitRequest,
} from './trait-loader.js';
import type { ParameterValidator } from '../validation/parameter-validator.js';

export interface ResolveContext {
  readonly objectName: string;
  readonly objectFilePath?: string;
}

export interface TraitResolverOptions {
  readonly loader: TraitLoader;
  readonly validator?: ParameterValidator;
  readonly validateParameters?: boolean;
}

export interface ResolvedTrait {
  readonly reference: TraitReference;
  readonly definition: TraitDefinition;
  readonly parameters: Readonly<Record<string, TraitParameterValue>>;
  readonly sourcePath: string;
  readonly resolvedAt: Date;
}

export class TraitResolutionError extends Error {
  constructor(
    readonly reference: TraitReference,
    readonly cause: unknown,
    readonly context?: ResolveContext
  ) {
    const alias = reference.alias ? ` (alias: ${reference.alias})` : '';
    const namespace = reference.namespace ? ` in namespace "${reference.namespace}"` : '';
    const contextHint = formatResolveContext(context);
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    super(
      `Failed to resolve trait "${reference.name}"${alias}${namespace}${contextHint}: ${causeMessage}`
    );
    this.name = 'TraitResolutionError';
  }
}

function buildTraitRequest(reference: TraitReference): TraitRequest {
  return {
    name: reference.name,
    namespace: reference.namespace,
    version: reference.version,
  };
}

function buildParameterOptions(
  reference: TraitReference,
  context: ResolveContext | undefined,
  validator: ParameterValidator | undefined,
  validate: boolean
): ParameterApplicationOptions {
  return {
    validator,
    validate,
    traitLabel: reference.alias ?? reference.name,
    filePath: context?.objectFilePath,
  };
}

function formatResolveContext(context: ResolveContext | undefined): string {
  if (!context) {
    return '';
  }

  const { objectName, objectFilePath } = context;
  if (objectName && objectFilePath) {
    return ` for object "${objectName}" at ${objectFilePath}`;
  }

  if (objectName) {
    return ` for object "${objectName}"`;
  }

  if (objectFilePath) {
    return ` for definition at ${objectFilePath}`;
  }

  return '';
}

/**
 * TraitResolver orchestrates trait lookup, parameter application, and validation.
 */
export class TraitResolver {
  private readonly loader: TraitLoader;
  private readonly validator?: ParameterValidator;
  private readonly validateParameters: boolean;

  constructor(options: TraitResolverOptions) {
    this.loader = options.loader;
    this.validator = options.validator;
    this.validateParameters = options.validateParameters ?? true;
  }

  async resolveObject(
    definition: ObjectDefinition,
    context?: ResolveContext
  ): Promise<ResolvedTrait[]> {
    return this.resolveReferences(definition.traits, context);
  }

  async resolveReferences(
    references: readonly TraitReference[],
    context?: ResolveContext
  ): Promise<ResolvedTrait[]> {
    const activeReferences = references.filter((reference) => !reference.disabled);

    const resolved = await Promise.all(
      activeReferences.map(async (reference) => {
        const request = buildTraitRequest(reference);
        const loadResult = await this.loadTrait(reference, request, context);

        const parameterOverrides: TraitParameterMap | undefined = reference.parameters;
        const parameterOptions = buildParameterOptions(
          reference,
          context,
          this.validator,
          this.validateParameters
        );

        const applied = this.applyParameters(
          loadResult,
          parameterOverrides,
          parameterOptions,
          reference,
          context
        );

        return {
          reference,
          definition: applied.definition,
          parameters: applied.parameters,
          sourcePath: loadResult.path,
          resolvedAt: TimeService.nowSystem().toJSDate(),
        };
      })
    );

    return resolved;
  }

  private async loadTrait(
    reference: TraitReference,
    request: TraitRequest,
    context: ResolveContext | undefined
  ): Promise<TraitLoadResult> {
    try {
      return await this.loader.load(request);
    } catch (error) {
      if (error instanceof TraitResolutionError) {
        throw error;
      }
      throw new TraitResolutionError(reference, error, context);
    }
  }

  private applyParameters(
    loadResult: TraitLoadResult,
    overrides: TraitParameterMap | undefined,
    options: ParameterApplicationOptions,
    reference: TraitReference,
    context: ResolveContext | undefined
  ): {
    definition: TraitDefinition;
    parameters: Readonly<Record<string, TraitParameterValue>>;
  } {
    try {
      return applyTraitParameters(loadResult.definition, overrides, options);
    } catch (error) {
      if (error instanceof TraitResolutionError) {
        throw error;
      }
      throw new TraitResolutionError(reference, error, context);
    }
  }
}
