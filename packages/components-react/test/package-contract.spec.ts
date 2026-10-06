import { readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

import {
  NUCLEUS_COMPONENT_IDS,
  evaluateEmissionEligibility,
  type EmissionEligibilityEvidence,
} from '@oods/component-contracts';
import { describe, expect, it } from 'vitest';

import * as reactPackage from '../src/index.js';
import * as tablePackage from '../src/table.js';

const packageRoot = process.cwd();
const repositoryRoot = resolve(packageRoot, '../..');
const canonicalIds = [...NUCLEUS_COMPONENT_IDS];

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

function collectFiles(root: string, directory = root): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? collectFiles(root, path) : [relative(root, path)];
  });
}

function unresolvedPackedDeclarationImports(distRoot: string): Array<{
  file: string;
  specifier: string;
}> {
  const packedFiles = new Set(collectFiles(distRoot));
  const declarationFiles = [...packedFiles].filter(path => /\.d\.(?:ts|cts|mts)$/.test(path));
  const importPatterns = [
    /\b(?:import|export)\s+(?:type\s+)?[^'";]*?\sfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\breference\s+types=["']([^"']+)["']/g,
  ];
  const findings: Array<{ file: string; specifier: string }> = [];

  for (const file of declarationFiles) {
    const source = readFileSync(resolve(distRoot, file), 'utf8');
    const specifiers = new Set<string>();
    for (const pattern of importPatterns) {
      for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
    }
    for (const specifier of specifiers) {
      if (!specifier.startsWith('.')) continue;
      const target = relative(distRoot, resolve(distRoot, dirname(file), specifier));
      const candidates = [
        target,
        ...['.js', '.cjs', '.mjs', '.json', '.css', '.d.ts', '.d.cts', '.d.mts']
          .map(extension => `${target}${extension}`),
      ];
      if (!candidates.some(candidate => packedFiles.has(candidate))) {
        findings.push({ file, specifier });
      }
    }
  }

  return findings.sort((left, right) =>
    `${left.file}:${left.specifier}`.localeCompare(`${right.file}:${right.specifier}`)
  );
}

describe('@oods/components-react package contract', () => {
  it('B-05 exports the exact React nucleus with public declarations', () => {
    expect(Object.keys(reactPackage).sort()).toEqual([...canonicalIds].sort());

    const declarations = readFileSync(`${packageRoot}/dist/index.d.ts`, 'utf8');
    for (const componentId of canonicalIds) {
      expect(declarations, `${componentId} public value declaration`).toMatch(
        new RegExp(`export \\{[^;]*\\b${componentId}\\b[^;]*\\}(?: from [^;]+)?;`)
      );
    }
    const declaredCanonical = canonicalIds.filter(componentId =>
      new RegExp(`export \\{[^;]*\\b${componentId}\\b[^;]*\\}(?: from [^;]+)?;`).test(
        declarations
      )
    );
    expect(declaredCanonical).toEqual(canonicalIds);
    expect(Object.keys(reactPackage)).not.toContain('TextField');
    expect(Object.keys(reactPackage)).not.toContain('Popover');
    expect(Object.keys(reactPackage)).not.toContain('REACT_COMPONENT_PACKAGE_FOUNDATION');

    expect(reactPackage.Table).toEqual(
      expect.objectContaining({
        Head: expect.anything(),
        Body: expect.anything(),
        Caption: expect.anything(),
        Row: expect.anything(),
        HeaderCell: expect.anything(),
        Cell: expect.anything(),
      })
    );
    expect(Object.keys(tablePackage).sort()).toEqual([
      'Table',
      'TableBody',
      'TableCaption',
      'TableCell',
      'TableHead',
      'TableHeaderCell',
      'TableRow',
    ]);

    // Public declarations are useful only when every relative edge resolves inside the tarball.
    // This catches declaration chunks whose emitted .js/.cjs specifier has no packed counterpart.
    expect(unresolvedPackedDeclarationImports(`${packageRoot}/dist`)).toEqual([]);
  });

  it('pins the declared React and shared-style dependency closure', () => {
    const manifest = readJson(`${packageRoot}/package.json`) as {
      version: string;
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      exports?: Record<string, unknown>;
      files?: string[];
    };
    expect(manifest.dependencies).toEqual({
      '@radix-ui/react-slot': '^1.1.2',
      // s221-m01: the sibling packages are pinned exactly at this package's own version, as every release since 0.3.0
      // ships them (#2482 ruling a); the 0.1.0 literal predated the first publish.
      '@oods/component-contracts': manifest.version,
      '@oods/component-styles': manifest.version,
    });
    expect(manifest.peerDependencies).toEqual({
      react: '>=18 <20',
      'react-dom': '>=18 <20',
    });
    expect(manifest.files).toContain('evidence');
    expect(manifest.exports).toMatchObject({
      './readiness': { default: './evidence/react-readiness.v1.json' },
      './status': {
        types: './dist/status.d.ts',
        import: './dist/status.js',
        require: './dist/status.cjs',
      },
      './table': {
        types: './dist/table.d.ts',
        import: './dist/table.js',
        require: './dist/table.cjs',
      },
    });

    const stylesManifest = readJson(
      `${repositoryRoot}/packages/component-styles/package.json`
    ) as { exports?: Record<string, unknown> };
    expect(stylesManifest.exports).toMatchObject({
      './css': { default: './dist/components.css' },
    });
  });

  it('publishes one independently derived React emission-eligibility row per nucleus id', () => {
    const readiness = readJson(
      `${packageRoot}/evidence/react-readiness.v1.json`
    ) as {
      target: string;
      rows: Array<{
        componentId: string;
        state: string;
        emissionEligible: boolean;
        evidence: EmissionEligibilityEvidence;
      }>;
    };
    expect(readiness.target).toBe('react');
    expect(readiness.rows.map(row => row.componentId)).toEqual(canonicalIds);
    const scenarioSource = readFileSync(
      `${packageRoot}/test/scenarios.spec.tsx`,
      'utf8'
    );
    for (const row of readiness.rows) {
      expect(row.state).toBe('implemented-evidence-complete');
      expect(evaluateEmissionEligibility(row.evidence)).toEqual({
        emissionEligible: true,
        incomplete: [],
      });
      expect(row.emissionEligible).toBe(true);
      for (const evidence of Object.values(row.evidence)) {
        expect(evidence.status).toBe('passed');
        expect(evidence.refs.length).toBeGreaterThan(0);
      }
      const [scenarioPath, scenarioId] = row.evidence.frameworkScenario.refs[0].split('#');
      expect(scenarioPath).toBe('packages/components-react/test/scenarios.spec.tsx');
      expect(scenarioId).toBeTruthy();
      expect(scenarioSource).toContain(`case '${scenarioId}'`);
    }
  });
});
