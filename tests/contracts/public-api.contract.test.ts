import { readFileSync, readdirSync } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const PUBLIC_DECLARATIONS_DIR = path.join(ROOT, 'dist', 'pkg');
const PACKAGE_OUTPUTS = ['index.js', 'index.cjs', 'index.d.ts', 'index.d.cts'];
const VIZ_CORE_EXTERNAL_REFERENCE =
  /\bfrom\s*["']@oods\/viz-core(?:\/[^"']*)?["']|\b(?:import|require)\s*\(\s*["']@oods\/viz-core(?:\/[^"']*)?["']\s*\)|\bimport\s*["']@oods\/viz-core(?:\/[^"']*)?["']/g;

function collectDeclarationFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectDeclarationFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('Public API declarations', () => {
  it('do not expose explicit `any` types', () => {
    const declarationFiles = collectDeclarationFiles(PUBLIC_DECLARATIONS_DIR);
    expect(
      declarationFiles.length,
      'Expected generated declaration files in dist/pkg/'
    ).toBeGreaterThan(0);

    const offenders: Array<{ file: string; matches: string[] }> = [];
    const pattern = /(?:[:<]\s*any\b|any\[\])/g;

    for (const file of declarationFiles) {
      const contents = readFileSync(file, 'utf8');
      const found = contents.match(pattern);
      if (found && found.length > 0) {
        offenders.push({
          file: path.relative(ROOT, file),
          matches: Array.from(new Set(found)),
        });
      }
    }

    expect(
      offenders,
      offenders
        .map(
          ({ file, matches }) =>
            `Explicit any usage detected in ${file}: ${matches.join(', ')}`
        )
        .join('\n')
    ).toEqual([]);
  });
});

describe('Installable package self-containment', () => {
  it('bundles viz-core runtime and types instead of leaking a workspace-only import', () => {
    const offenders = PACKAGE_OUTPUTS.flatMap((file) => {
      const outputPath = path.join(PUBLIC_DECLARATIONS_DIR, file);
      expect(existsSync(outputPath), `Expected pnpm pkg:build to emit dist/pkg/${file}`).toBe(true);
      const contents = readFileSync(outputPath, 'utf8');
      const matches = contents.match(VIZ_CORE_EXTERNAL_REFERENCE) ?? [];
      return matches.map((reference) => ({ file: `dist/pkg/${file}`, reference }));
    });

    expect(
      offenders,
      'The installable package must carry viz-core itself; an external reference makes clean installs depend on the monorepo.'
    ).toEqual([]);
  });

  it('keeps the source workspace dependency but publishes no workspace protocol', () => {
    const sourcePackage = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      peerDependenciesMeta?: Record<string, { optional?: boolean }>;
    };
    const distPackage = JSON.parse(
      readFileSync(path.join(PUBLIC_DECLARATIONS_DIR, 'package.json'), 'utf8')
    ) as {
      dependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      peerDependenciesMeta?: Record<string, { optional?: boolean }>;
    };

    expect(
      sourcePackage.devDependencies?.['@oods/viz-core'],
      'Source development must keep resolving the canonical viz-core workspace package.'
    ).toBe('workspace:*');
    expect(distPackage.dependencies).not.toHaveProperty('@oods/viz-core');
    expect(sourcePackage.peerDependencies?.['@oods/tokens']).toBe('^0.1.0');
    expect(distPackage.peerDependencies?.['@oods/tokens']).toBe('^0.1.0');
    expect(distPackage.peerDependencies).toMatchObject(sourcePackage.peerDependencies ?? {});
    expect(distPackage.peerDependenciesMeta).toEqual(sourcePackage.peerDependenciesMeta);
    expect(distPackage.peerDependenciesMeta?.['@oods/tokens']).toEqual({ optional: false });

    const workspaceDependencies = [
      ...Object.entries(distPackage.dependencies ?? {}),
      ...Object.entries(distPackage.optionalDependencies ?? {}),
      ...Object.entries(distPackage.peerDependencies ?? {}),
    ]
      .filter(([, version]) => version.startsWith('workspace:'))
      .map(([name, version]) => `${name}@${version}`);

    expect(
      workspaceDependencies,
      'dist/pkg is installed outside the pnpm workspace, so every workspace: range is invalid there.'
    ).toEqual([]);
  });
});
