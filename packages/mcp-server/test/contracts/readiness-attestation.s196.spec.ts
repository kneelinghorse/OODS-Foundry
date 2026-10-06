import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  READINESS_ATTESTATION_PATH,
  READINESS_DOCUMENT_PATHS,
  readinessAttestationClaims,
  readinessAttestationJson,
  readinessSha256,
  shippedReadinessPackageFiles,
  verifyReadinessAttestation,
  type AttestedReadinessDocuments,
  type ReadinessAttestation,
} from '../../src/codegen/readiness-attestation.js';
import { createTargetCapabilityPreflight, READINESS_EVIDENCE_CLASSES } from '../../src/codegen/target-readiness.js';
import { handle as createMapping } from '../../src/tools/map.create.js';
import { handle as generateCode } from '../../src/tools/code.generate.js';
import { RUNTIME_MANIFEST_FILE } from '../../src/lib/runtime-bundle.js';

let root: string;
let documents: AttestedReadinessDocuments;
let attestation: ReadinessAttestation;

function write(relative: string, bytes: string): void {
  const destination = path.join(root, relative);
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, bytes);
}

function seal(): void {
  const { sha256: _oldDigest, ...payload } = attestation;
  attestation.sha256 = readinessSha256(readinessAttestationJson(payload));
  write(READINESS_ATTESTATION_PATH, readinessAttestationJson(attestation));
}

function preflight() {
  return createTargetCapabilityPreflight({
    repositoryRoot: root,
    readiness: documents,
    capabilityBaseline: { rows: [{ id: 'Text' }] },
  });
}

function verify() {
  return verifyReadinessAttestation(root, documents, READINESS_EVIDENCE_CLASSES);
}

function expectRefusal(): void {
  expect(verify()).toMatchObject({ status: 'invalid' });
  for (const target of ['react', 'vue'] as const) {
    expect(preflight()([{ id: 'text', component: 'Text' }], target)).toMatchObject([{
      code: 'OODS-N015', component: 'Text', message: expect.stringContaining('attestation-invalid'),
    }]);
  }
}

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'forge-readiness-attestation-'));
  for (const packageName of ['component-contracts', 'components-react', 'components-vue', 'mcp-server']) {
    write(`packages/${packageName}/package.json`, JSON.stringify({ name: `@oods/${packageName}` }));
    write(`packages/${packageName}/dist/index.js`, 'export const Text = () => null;\n');
    write(`packages/${packageName}/dist/index.d.ts`, 'export declare const Text: unknown;\n');
  }
  documents = Object.fromEntries((['react', 'vue'] as const).map((target) => [target, {
    target,
    rows: [{
      componentId: 'Text', state: 'implemented-evidence-complete', emissionEligible: true,
      evidence: Object.fromEntries(READINESS_EVIDENCE_CLASSES.map((evidenceClass) => [evidenceClass, {
        status: 'passed',
        refs: [evidenceClass === 'publicDeclaration'
          ? `packages/components-${target}/dist/index.d.ts#Text`
          : `packages/components-${target}/${evidenceClass === 'frameworkScenario' ? 'test' : 'src'}/${evidenceClass}.ts#Text`],
      }])),
    }],
  }])) as AttestedReadinessDocuments;
  for (const target of ['react', 'vue'] as const) write(READINESS_DOCUMENT_PATHS[target], JSON.stringify(documents[target]));
  // Fixture seal represents host-resolved source bytes. The runtime contains
  // only compiled code, declarations and evidence JSON, as the real bundle does.
  attestation = {
    schemaVersion: 'forge-readiness-attestation/v1',
    generatedAt: '2026-09-12T00:00:00Z',
    sourceHead: '1'.repeat(40),
    targets: Object.fromEntries(Object.entries(readinessAttestationClaims(documents, READINESS_EVIDENCE_CLASSES)).map(([target, { rows }]) => [target, {
      rows: rows.map(({ references, ...row }) => ({
        ...row,
        references: references.map((reference) => ({
          ...reference,
          sha256: reference.class === 'publicDeclaration'
            ? readinessSha256(readFileSync(path.join(root, reference.ref.split('#')[0]!)))
            : readinessSha256('host-resolved evidence'),
        })),
      })),
    }])) as ReadinessAttestation['targets'],
    shippedPackageHashes: shippedReadinessPackageFiles(root),
    sha256: '',
  };
  seal();
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('portable readiness attestation', () => {
  it('s214 keeps attested runtime files byte-identical when a mapping is created in the user folder', async () => {
    const outside = mkdtempSync(path.join(os.tmpdir(), 'forge-user-mappings-'));
    const before = shippedReadinessPackageFiles(root);
    try {
      vi.stubEnv('MCP_MAPPINGS_PATH', ''); vi.stubEnv('OODS_MAPPINGS_DIR', outside);
      const result = await createMapping({ apply: true, externalSystem: 'team', externalComponent: 'Text', oodsTraits: ['Stateful'],
        substitution: { component: 'Text', react: { package: '@forge-test/team', export: 'Text' } } });
      expect(result.applied).toBe(true);
      expect(JSON.parse(readFileSync(path.join(outside, 'component-mappings.json'), 'utf8')).mappings).toHaveLength(1);
      expect(shippedReadinessPackageFiles(root)).toEqual(before);
      expect(verify()).toEqual({ status: 'verified' });
    } finally { vi.unstubAllEnvs(); rmSync(outside, { recursive: true, force: true }); }
  });

  it.each(['react', 'vue'] as const)('emits real %s code with source and test references absent', async (framework) => {
    expect(verify()).toEqual({ status: 'verified' });
    const result = await generateCode({
      framework, profile: 'build',
      schema: { version: '2026.09', screens: [{ id: 'text', component: 'Text', props: { content: 'Portable proof' } }] },
    }, { targetCapabilityPreflight: preflight() });
    expect(result.status).toBe('ok');
    expect(result.errors ?? []).toEqual([]);
    expect(result.code).toContain('Portable proof');
    expect(result.code).toContain(`@oods/components-${framework}`);
    expect(result.artifact?.files.length).toBeGreaterThan(0);
    expect(Object.keys(attestation.targets)).toEqual(['react', 'vue']);
    expect(Object.values(attestation.targets).flatMap(({ rows }) => rows.flatMap(({ references }) => references))).toHaveLength(12);
  });

  it('preserves false emission eligibility even with every reference and package hash intact', () => {
    documents.react.rows[0]!.emissionEligible = false;
    attestation.targets.react.rows[0]!.emissionEligible = false;
    seal();
    expect(verify()).toEqual({ status: 'verified' });
    expect(preflight()([{ id: 'text', component: 'Text' }], 'react')).toMatchObject([{ code: 'OODS-N015' }]);
    expect(preflight()([{ id: 'text', component: 'Text' }], 'vue')).toEqual([]);
  });

  it('does not admit a component that lacks a controlling capability baseline', () => {
    const check = createTargetCapabilityPreflight({ repositoryRoot: root, readiness: documents, capabilityBaseline: { rows: [] } });
    expect(check([{ id: 'text', component: 'Text' }], 'react')).toMatchObject([{ code: 'OODS-N015' }]);
  });

  it('binds the source head to the embedded release manifest', () => {
    // s211-m03: the release manifest is named from the product's archive base (oods-foundry-runtime.manifest.json).
    write(RUNTIME_MANIFEST_FILE, JSON.stringify({ commit: attestation.sourceHead }));
    expect(verify()).toEqual({ status: 'verified' });
    attestation.sourceHead = '2'.repeat(40);
    seal();
    expectRefusal();
  });

  it.each(['sourceHead', 'generatedAt'] as const)('rejects invalid %s provenance even with a recomputed digest', (field) => {
    attestation[field] = 'invalid';
    seal();
    expectRefusal();
  });

  it('keeps source-pruned installations without an attestation fail-closed', () => {
    rmSync(path.join(root, READINESS_ATTESTATION_PATH));
    expect(verify()).toEqual({ status: 'absent' });
    expect(preflight()([{ id: 'text', component: 'Text' }], 'react')).toMatchObject([{ code: 'OODS-N015' }]);
  });

  it.each(['reference hash', 'package hash', 'eligibility', 'malformed JSON'])(
    'refuses tampered %s with a typed readiness failure', (mutation) => {
      if (mutation === 'reference hash') attestation.targets.react.rows[0]!.references[0]!.sha256 = '0'.repeat(64);
      if (mutation === 'package hash') attestation.shippedPackageHashes[0]!.sha256 = '0'.repeat(64);
      if (mutation === 'eligibility') attestation.targets.react.rows[0]!.emissionEligible = false;
      write(READINESS_ATTESTATION_PATH, mutation === 'malformed JSON' ? '{broken' : readinessAttestationJson(attestation));
      expectRefusal();
    },
  );

  it.each(['changed code', 'missing declaration', 'added file', 'empty inventory', 'missing target', 'missing evidence', 'changed evidence class'])(
    'rejects %s even when the envelope digest is recomputed', (mutation) => {
      if (mutation === 'changed code') write('packages/components-vue/dist/index.js', 'export const Text = () => "changed";');
      if (mutation === 'missing declaration') rmSync(path.join(root, 'packages/components-react/dist/index.d.ts'));
      if (mutation === 'added file') write('packages/components-react/dist/extra.js', 'export const extra = true;');
      if (mutation === 'empty inventory') attestation.shippedPackageHashes = [];
      if (mutation === 'missing target') delete (attestation.targets as Partial<ReadinessAttestation['targets']>).vue;
      if (mutation === 'missing evidence') attestation.targets.react.rows[0]!.references.pop();
      if (mutation === 'changed evidence class') attestation.targets.react.rows[0]!.references[0]!.class = 'packageExport';
      seal();
      expectRefusal();
    },
  );

  it('keeps the server store beside the package as runtime state, not shipped bytes (s206-m03)', async () => {
    // A default install stores schemas, compositions and payloads in packages/mcp-server/.oods, and design.preview
    // stores its composition before it generates: counted as shipped, that store refused the very first preview.
    write('packages/mcp-server/.oods/compositions/cmp-0123456789ab/versions/1.json', '{"version":1}\n');
    write('packages/mcp-server/.oods/schemas/first_run.json', '{}\n');
    write('packages/mcp-server/.oods/payloads/code.generate-abc/artifact.json', '{}\n');
    expect(verify()).toEqual({ status: 'verified' });
    expect(preflight()([{ id: 'text', component: 'Text' }], 'react')).toEqual([]);
    const result = await generateCode({
      framework: 'react', profile: 'build',
      schema: { version: '2026.09', screens: [{ id: 'text', component: 'Text', props: { content: 'After the store' } }] },
    }, { targetCapabilityPreflight: preflight() });
    expect(result.status).toBe('ok');
    // Only the store is exempt: the same bytes anywhere else under packages/ are still an added file.
    write('packages/mcp-server/dist/.oods-lookalike/1.json', '{"version":1}\n');
    expectRefusal();
  });

  it('requires any available source evidence to still match the host receipt', () => {
    const reference = attestation.targets.react.rows[0]!.references[0]!;
    write(reference.ref.split('#')[0]!, 'different host evidence');
    attestation.shippedPackageHashes = shippedReadinessPackageFiles(root);
    seal();
    expectRefusal();
  });

  it.each([
    'packages/components-react/.oods/extra.js',
    'packages/mcp-server/dist/.oods/extra.js',
    'packages/mcp-server/.oods',
  ])('keeps %s bound: only the actual server store directory is runtime state (s206-m05)', (relative) => {
    write(relative, 'unattested package bytes');
    expectRefusal();
  });

  it('rejects symlinked first-party bytes instead of reading an external source tree', () => {
    const entry = path.join(root, 'packages/components-react/dist/index.js');
    rmSync(entry);
    symlinkSync(path.join(root, 'packages/components-vue/dist/index.js'), entry);
    expectRefusal();
  });

  it('rechecks the installation after a running preflight has already succeeded', () => {
    const check = preflight();
    const screens = [{ id: 'text', component: 'Text' }];
    expect(check(screens, 'react')).toEqual([]);
    write('packages/components-react/dist/index.js', 'corrupted after startup');
    expect(check(screens, 'react')).toMatchObject([{ code: 'OODS-N015' }]);
    rmSync(path.join(root, READINESS_ATTESTATION_PATH));
    expect(check(screens, 'react')).toMatchObject([{ code: 'OODS-N015' }]);
  });
});
