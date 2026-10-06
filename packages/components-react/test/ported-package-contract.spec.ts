import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import {
  NUCLEUS_COMPONENT_IDS,
  PORTED_COMPONENT_IDS,
  evaluateEmissionEligibility,
  portedScenarios,
  type EmissionEligibilityEvidence,
} from '@oods/component-contracts';
import { describe, expect, it } from 'vitest';

import * as portedPackage from '../src/ported.js';

const packageRoot = process.cwd();
const repositoryRoot = resolve(packageRoot, '../..');
const packageRequire = createRequire(`${packageRoot}/package.json`);
// Sprint 200 m04 retired the compatibility subpaths with no migration window (#2062).
const RETIRED_SUBPATHS = [
  '@oods/components-react/ported',
  '@oods/components-react/readiness-ported',
  '@oods/component-styles/css-ported',
  '@oods/component-styles/ported',
];
const expectedPortedIds = [
  'AuditTimeline',
  'CancellationSummary',
  'PaginationBar',
  'PriceBadge',
  'RelativeTimestamp',
  'SearchInput',
  'StatusBadge',
  'StatusTimeline',
] as const;
const portedIds = [...PORTED_COMPONENT_IDS];

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

describe('@oods/components-react ported package contract', () => {
  it('exports the historical eight implementation exports with public declarations', () => {
    expect(portedIds).toEqual(expectedPortedIds);
    expect(Object.keys(portedPackage).sort()).toEqual([...portedIds]);

    const declarations = readFileSync(`${packageRoot}/dist/ported.d.ts`, 'utf8');
    for (const componentId of portedIds) {
      expect(declarations, `${componentId} public value declaration`).toMatch(
        new RegExp(`export \\{[^;]*\\b${componentId}\\b[^;]*\\};`)
      );
    }
  });

  it('no longer publishes the retired compatibility subpaths', () => {
    const manifest = readJson(`${packageRoot}/package.json`) as {
      exports: Record<string, unknown>;
    };
    expect(Object.keys(manifest.exports)).toEqual(['.', './readiness', './status', './table', './package.json']);

    const stylesManifest = readJson(
      `${repositoryRoot}/packages/component-styles/package.json`
    ) as { exports: Record<string, unknown> };
    expect(Object.keys(stylesManifest.exports)).toEqual(['.', './css', './package.json']);

    for (const specifier of RETIRED_SUBPATHS) {
      expect(() => packageRequire.resolve(specifier), specifier).toThrow(/not defined by "exports"/);
    }
    expect(packageRequire.resolve('@oods/components-react')).toMatch(/\/dist\/index\.cjs$/);
    expect(packageRequire.resolve('@oods/component-styles/css')).toMatch(/\/dist\/components\.css$/);
  });

  it('publishes exactly eight historical ported readiness rows', () => {
    const readiness = readJson(
      `${packageRoot}/evidence/react-ported-readiness.v1.json`
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
    expect(readiness.rows.map(row => row.componentId)).toEqual(portedIds);
    expect(portedScenarios.map(scenario => scenario.oodsComponentId)).toEqual(portedIds);
    const scenarioSource = readFileSync(
      `${packageRoot}/test/ported-scenarios.spec.tsx`,
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
      const scenarioId = portedScenarios.find(
        scenario => scenario.oodsComponentId === row.componentId
      )?.id;
      expect(scenarioId).toBeTruthy();
      expect(scenarioSource).toContain(`'${scenarioId}`);
    }
  });

  it('includes every compatibility family in the root export and root readiness', () => {
    const rootSource = readFileSync(`${packageRoot}/src/index.ts`, 'utf8');
    for (const componentId of portedIds) {
      expect(rootSource).toMatch(new RegExp(`\\b${componentId}\\b`));
    }

    const mainReadiness = readJson(`${packageRoot}/evidence/react-readiness.v1.json`) as {
      rows: Array<{ componentId: string }>;
    };
    expect(mainReadiness.rows.map(row => row.componentId)).toEqual([...NUCLEUS_COMPONENT_IDS]);
    expect(mainReadiness.rows.map(row => row.componentId)).toEqual(
      expect.arrayContaining([...portedIds])
    );
  });
});
