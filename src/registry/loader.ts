import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseObjectDefinitionFromFile } from '../parsers/object-parser.js';
import type { ParseError } from '../core/trait-definition.js';
import type { ObjectDefinition } from './object-definition.js';

export const DEFAULT_OBJECT_EXTENSIONS = ['.object.yaml', '.object.yml'] as const;
export const DEFAULT_IGNORED_DIRECTORIES = [
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  '.DS_Store',
  'dist',
  'coverage',
  'build',
] as const;

export interface ObjectLoaderOptions {
  roots: readonly string[];
  extensions?: readonly string[];
  ignoreDirectories?: readonly string[];
}

export interface ObjectFileSnapshot {
  filePath: string;
  mtimeMs: number;
  size: number;
}

export interface ObjectLoadSuccess extends ObjectFileSnapshot {
  type: 'success';
  definition: ObjectDefinition;
}

export interface ObjectLoadFailure extends ObjectFileSnapshot {
  type: 'error';
  errors: ParseError[];
}

export type ObjectLoadResult = ObjectLoadSuccess | ObjectLoadFailure;

export function scanObjectFiles(options: ObjectLoaderOptions): ObjectFileSnapshot[] {
  const { roots, extensions = DEFAULT_OBJECT_EXTENSIONS, ignoreDirectories = DEFAULT_IGNORED_DIRECTORIES } = options;
  const lowerExtensions = extensions.map((ext) => ext.toLowerCase());
  const ignored = new Set(ignoreDirectories);

  const snapshots: ObjectFileSnapshot[] = [];

  const visit = (target: string): void => {
    let stats: ReturnType<typeof statSync>;
    try {
      stats = statSync(target);
    } catch {
      return;
    }

    if (stats.isDirectory()) {
      let entries: ReturnType<typeof readdirSync>;
      try {
        entries = readdirSync(target, { withFileTypes: true, encoding: 'utf8' }) as any;
      } catch {
        return;
      }

      for (const entry of entries) {
        const entryName = entry.name.toString();
        if (entry.isSymbolicLink()) {
          continue;
        }

        const nextPath = join(target, entryName);
        if (entry.isDirectory()) {
          if (ignored.has(entryName)) {
            continue;
          }
          visit(nextPath);
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }

        const lowerName = entryName.toLowerCase();
        const matchesExtension = lowerExtensions.some((ext) => lowerName.endsWith(ext));
        if (!matchesExtension) {
          continue;
        }

        let fileStats: ReturnType<typeof statSync>;
        try {
          fileStats = statSync(nextPath);
        } catch {
          continue;
        }

        snapshots.push({
          filePath: nextPath,
          mtimeMs: fileStats.mtimeMs,
          size: fileStats.size,
        });
      }
      return;
    }

    if (!stats.isFile()) {
      return;
    }

    const lowerPath = target.toLowerCase();
    const matchesExtension = lowerExtensions.some((ext) => lowerPath.endsWith(ext));
    if (!matchesExtension) {
      return;
    }

    snapshots.push({
      filePath: target,
      mtimeMs: stats.mtimeMs,
      size: stats.size,
    });
  };

  roots.forEach((root) => {
    const absolute = resolve(root);
    visit(absolute);
  });

  return snapshots.sort((a, b) => a.filePath.localeCompare(b.filePath));
}

export function getObjectFileSnapshot(filePath: string): ObjectFileSnapshot | undefined {
  try {
    const stats = statSync(filePath);
    if (!stats.isFile()) {
      return undefined;
    }

    return {
      filePath,
      mtimeMs: stats.mtimeMs,
      size: stats.size,
    };
  } catch {
    return undefined;
  }
}

export function loadObjectFile(
  filePath: string,
  snapshot?: ObjectFileSnapshot
): ObjectLoadResult {
  const resolvedPath = resolve(filePath);
  const metadata = snapshot ?? getObjectFileSnapshot(resolvedPath);
  if (!metadata) {
    throw new Error(`Object definition not found: ${resolvedPath}`);
  }

  const parseResult = parseObjectDefinitionFromFile(resolvedPath);
  if (parseResult.success) {
    return {
      type: 'success',
      filePath: resolvedPath,
      mtimeMs: metadata.mtimeMs,
      size: metadata.size,
      definition: parseResult.data!,
    };
  }

  return {
    type: 'error',
    filePath: resolvedPath,
    mtimeMs: metadata.mtimeMs,
    size: metadata.size,
    errors: parseResult.errors ?? [],
  };
}

export function loadObjectDirectories(options: ObjectLoaderOptions): ObjectLoadResult[] {
  const snapshots = scanObjectFiles(options);
  return snapshots.map((snapshot) => loadObjectFile(snapshot.filePath, snapshot));
}
