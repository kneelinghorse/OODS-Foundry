import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  NUCLEUS_COMPONENT_IDS,
  evaluateEmissionEligibility,
  type EmissionEligibilityEvidence,
} from '@oods/component-contracts';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import * as vuePackage from '../src/index.js';

const packageRoot = process.cwd();
const repositoryRoot = resolve(packageRoot, '../..');
const canonicalIds = [...NUCLEUS_COMPONENT_IDS];
const tableSubparts = [
  'TableBody',
  'TableCaption',
  'TableCell',
  'TableHead',
  'TableHeaderCell',
  'TableRow',
] as const;

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

function declarationValueExports(source: string): Set<string> {
  const file = ts.createSourceFile('index.d.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const names = new Set<string>();
  for (const statement of file.statements) {
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      if (statement.isTypeOnly) continue;
      for (const element of statement.exportClause.elements) {
        if (!element.isTypeOnly) names.add(element.name.text);
      }
      continue;
    }
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    if (!modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text);
      }
    } else if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement))
      && statement.name
    ) {
      names.add(statement.name.text);
    }
  }
  return names;
}

describe('@oods/components-vue package contract', () => {
  it('B-08 exports the exact Vue nucleus with public declarations', () => {
    const runtimeCanonical = canonicalIds.filter((name) => name in vuePackage);
    expect(runtimeCanonical).toEqual(canonicalIds);

    const declarations = declarationValueExports(readFileSync(`${packageRoot}/dist/index.d.ts`, 'utf8'));
    const declaredCanonical = canonicalIds.filter((name) => declarations.has(name));
    expect(declaredCanonical).toEqual(canonicalIds);

    expect(tableSubparts.every((name) => name in vuePackage)).toBe(true);
    expect(tableSubparts.every((name) => declarations.has(name))).toBe(true);

    expect(Object.keys(vuePackage)).not.toContain('TextField');
    expect(Object.keys(vuePackage)).not.toContain('Popover');
    expect(Object.keys(vuePackage)).not.toContain('VUE_COMPONENT_PACKAGE_FOUNDATION');
  });

  it('declares only Vue and the two frozen package dependencies at runtime', () => {
    const manifest = readJson(`${packageRoot}/package.json`);
    expect(manifest.dependencies).toEqual({
      // s221-m01: the sibling packages are pinned exactly at this package's own version, as every release since 0.3.0
      // ships them (#2482 ruling a); the 0.1.0 literal predated the first publish.
      '@oods/component-contracts': manifest.version,
      '@oods/component-styles': manifest.version,
    });
    expect(manifest.peerDependencies).toEqual({ vue: '^3.5.0' });
    expect(JSON.stringify({
      dependencies: manifest.dependencies,
      peerDependencies: manifest.peerDependencies,
    })).not.toMatch(/react|radix|rjsf/i);

    const distributableText = [
      'dist/index.js',
      'dist/index.cjs',
      'dist/index.d.ts',
      'package.json',
    ].map((path) => readFileSync(`${packageRoot}/${path}`, 'utf8')).join('\n');
    expect(distributableText).not.toMatch(/(?:from|require\()\s*["'](?:react|@radix-ui|@rjsf)/i);
    expect(distributableText).not.toMatch(/\b(?:workspace|file|link):/i);
    expect(distributableText).not.toContain(repositoryRoot);

    const stylesManifest = readJson(`${repositoryRoot}/packages/component-styles/package.json`);
    expect(stylesManifest.exports).toMatchObject({
      './css': { default: './dist/components.css' },
    });
  });

  it('publishes one independently derived Vue emission-eligibility row per nucleus id', () => {
    const manifest = readJson(`${packageRoot}/package.json`);
    expect(manifest.files).toContain('evidence');
    expect(manifest.exports).toMatchObject({
      './readiness': { default: './evidence/vue-readiness.v1.json' },
    });

    const readiness = readJson(`${packageRoot}/evidence/vue-readiness.v1.json`) as {
      target: string;
      rows: Array<{
        componentId: string;
        state: string;
        emissionEligible: boolean;
        evidence: EmissionEligibilityEvidence;
      }>;
    };
    expect(readiness.target).toBe('vue');
    expect(readiness.rows.map((row) => row.componentId)).toEqual(canonicalIds);
    for (const row of readiness.rows) {
      expect(row.state).toBe('implemented-evidence-complete');
      expect(evaluateEmissionEligibility(row.evidence)).toEqual({ emissionEligible: true, incomplete: [] });
      expect(row.emissionEligible).toBe(true);
      for (const evidence of Object.values(row.evidence)) {
        expect(evidence.status).toBe('passed');
        expect(evidence.refs.length).toBeGreaterThan(0);
      }
    }
  });
});
