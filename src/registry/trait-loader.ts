import { accessSync, constants } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseTrait } from '../parsers/index.js';
import type { TraitDefinition, ParseResult } from '../core/trait-definition.js';

export type TraitFileExtension = '.trait.yaml' | '.trait.yml' | '.trait.ts' | '.trait.json';

export interface TraitLoaderOptions {
  readonly roots: readonly string[];
  readonly extensions?: readonly TraitFileExtension[];
}

export interface TraitRequest {
  readonly name: string;
  readonly namespace?: string;
  readonly version?: string;
}

export interface TraitLoadResult {
  readonly definition: TraitDefinition;
  readonly path: string;
}

export class TraitNotFoundError extends Error {
  constructor(readonly traitName: string, readonly attemptedPaths: readonly string[]) {
    super(
      `Trait "${traitName}" could not be located. Checked paths:\n` +
        attemptedPaths.map((path) => ` - ${path}`).join('\n')
    );
    this.name = 'TraitNotFoundError';
  }
}

export class TraitLoaderError extends Error {
  constructor(readonly traitName: string, readonly path: string, readonly parseResult: ParseResult<TraitDefinition>) {
    const details =
      parseResult.errors?.map((error) => `  - ${error.message}${error.field ? ` (${error.field})` : ''}`).join('\n') ??
      '  - Unknown parse failure';

    super(`Failed to parse trait "${traitName}" at ${path}:\n${details}`);
    this.name = 'TraitLoaderError';
  }
}

const DEFAULT_EXTENSIONS: readonly TraitFileExtension[] = [
  '.trait.ts',
  '.trait.yaml',
  '.trait.yml',
  '.trait.json',
];

function normalizeSegments(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(/[\\/]/g)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function buildSearchSegments(request: TraitRequest): {
  readonly directory: readonly string[];
  readonly traitName: string;
} {
  const nameSegments = normalizeSegments(request.name);
  if (nameSegments.length === 0) {
    throw new Error('Trait name must be a non-empty string.');
  }

  const traitName = nameSegments[nameSegments.length - 1]!;
  const directorySegments = [
    ...normalizeSegments(request.namespace),
    ...nameSegments.slice(0, nameSegments.length - 1),
  ];

  return {
    directory: directorySegments,
    traitName,
  };
}

function candidatePaths(
  roots: readonly string[],
  segments: readonly string[],
  traitName: string,
  extensions: readonly TraitFileExtension[]
): string[] {
  const paths: string[] = [];
  roots.forEach((root) => {
    const baseDir = resolve(root, ...segments);
    extensions.forEach((extension) => {
      paths.push(join(baseDir, `${traitName}${extension}`));
    });
  });
  return paths;
}

export class TraitLoader {
  private readonly roots: readonly string[];
  private readonly extensions: readonly TraitFileExtension[];
  private readonly cache = new Map<string, Promise<TraitLoadResult>>();

  constructor(options: TraitLoaderOptions) {
    if (!options.roots || options.roots.length === 0) {
      throw new Error('TraitLoader requires at least one root directory.');
    }

    this.roots = options.roots.map((root) => resolve(root));
    this.extensions = options.extensions ?? DEFAULT_EXTENSIONS;
  }

  clearCache(): void {
    this.cache.clear();
  }

  async load(request: TraitRequest): Promise<TraitLoadResult> {
    const cacheKey = this.createCacheKey(request);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const promise = this.loadInternal(request);
    this.cache.set(cacheKey, promise);
    return promise;
  }

  private async loadInternal(request: TraitRequest): Promise<TraitLoadResult> {
    const { directory, traitName } = buildSearchSegments(request);
    const candidates = candidatePaths(this.roots, directory, traitName, this.extensions);

    const accessiblePaths = candidates.filter((candidate) => this.fileExists(candidate));
    if (accessiblePaths.length === 0) {
      throw new TraitNotFoundError(traitName, candidates);
    }

    for (const path of accessiblePaths) {
      const result = await parseTrait(path);
      if (result.success && result.data) {
        return {
          definition: result.data,
          path,
        };
      }

      throw new TraitLoaderError(traitName, path, result);
    }

    throw new TraitNotFoundError(traitName, accessiblePaths);
  }

  private createCacheKey(request: TraitRequest): string {
    const namespace = request.namespace ? normalizeSegments(request.namespace).join('/') : '';
    const normalizedName = normalizeSegments(request.name).join('/');
    const version = request.version ?? '';
    return [namespace, normalizedName, version].filter((part) => part.length > 0).join('::');
  }

  private fileExists(path: string): boolean {
    try {
      accessSync(path, constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }
}
