import { promises as fs } from 'node:fs';
import path from 'node:path';

type ExportEntry = {
  target: string;
  context: string;
  isTypes: boolean;
};

type PackageManifest = {
  name: string;
  version: string;
  exports?: unknown;
  main?: string;
  module?: string;
  types?: string;
  files?: string[];
};

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function ensurePosix(relative: string): string {
  return relative.replace(/\\/g, '/');
}

function gatherExportEntries(value: unknown, context: string[] = []): ExportEntry[] {
  if (!value) return [];
  if (typeof value === 'string') {
    const pointer = context.join('.');
    const leaf = context[context.length - 1] ?? '';
    return [
      {
        target: value,
        context: pointer || '.',
        isTypes: leaf === 'types' || leaf === 'typings',
      },
    ];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, idx) => gatherExportEntries(entry, [...context, String(idx)]));
  }
  if (typeof value === 'object') {
    const entries: ExportEntry[] = [];
    for (const [key, nested] of Object.entries(value)) {
      entries.push(...gatherExportEntries(nested, [...context, key]));
    }
    return entries;
  }
  return [];
}

async function readManifest(packageDir: string): Promise<PackageManifest> {
  const manifestPath = path.join(packageDir, 'package.json');
  const raw = await fs.readFile(manifestPath, 'utf8');
  return JSON.parse(raw) as PackageManifest;
}

export type PackageSanityReport = {
  name: string;
  version: string;
  errors: string[];
  warnings: string[];
};

export async function analyzePackageSanity(packageDir: string): Promise<PackageSanityReport> {
  const dir = path.resolve(packageDir);
  const manifest = await readManifest(dir);
  if (!manifest.name || !manifest.version) {
    throw new Error(`Invalid package manifest at ${dir}`);
  }
  const errors: string[] = [];
  const warnings: string[] = [];

  const exportEntries = gatherExportEntries(manifest.exports ?? {});
  for (const entry of exportEntries) {
    const relative = entry.target.startsWith('./') ? entry.target : `./${entry.target}`;
    const targetPath = path.join(dir, relative);
    if (!(await pathExists(targetPath))) {
      errors.push(`Export target missing (${entry.context} -> ${ensurePosix(relative)})`);
    } else if (entry.isTypes && !relative.endsWith('.d.ts')) {
      warnings.push(`Export types target should reference a .d.ts file (${ensurePosix(relative)})`);
    }
  }

  const topLevelExports = manifest.exports && typeof manifest.exports === 'object' && !Array.isArray(manifest.exports)
    ? (manifest.exports as Record<string, unknown>)
    : {};
  for (const [subpath, definition] of Object.entries(topLevelExports)) {
    if (definition && typeof definition === 'object' && !Array.isArray(definition)) {
      if (!('types' in (definition as Record<string, unknown>))) {
        warnings.push(`Export "${subpath}" is missing a "types" entry.`);
      }
    }
  }

  if (manifest.main) {
    const target = path.join(dir, manifest.main);
    if (!(await pathExists(target))) {
      errors.push(`"main" entry points to missing file (${ensurePosix(manifest.main)})`);
    }
  }
  if (manifest.module) {
    const target = path.join(dir, manifest.module);
    if (!(await pathExists(target))) {
      errors.push(`"module" entry points to missing file (${ensurePosix(manifest.module)})`);
    }
  }
  if (manifest.types) {
    const target = path.join(dir, manifest.types);
    if (!(await pathExists(target))) {
      errors.push(`"types" entry points to missing file (${ensurePosix(manifest.types)})`);
    } else if (!manifest.types.endsWith('.d.ts')) {
      warnings.push(`"types" entry should reference a .d.ts file (${ensurePosix(manifest.types)})`);
    }
  }

  if (Array.isArray(manifest.files) && manifest.files.length > 0) {
    for (const entry of manifest.files) {
      const target = path.join(dir, entry);
      if (!(await pathExists(target))) {
        warnings.push(`Listed "files" entry does not exist (${ensurePosix(entry)})`);
      }
    }
  }

  return {
    name: manifest.name,
    version: manifest.version,
    errors,
    warnings,
  };
}
