import { passedEvidence } from '../../test/helpers/release-evidence.js';
import { describe, expect, it } from 'vitest';

import type { UiSchema } from '../schemas/generated.js';
import { handle as codeGenerate } from '../tools/code.generate.js';
import type { CodegenValidationReceipt } from './types.js';
import {
  ALL_CHECKS,
  RELEASE_EVIDENCE_CLASSES,
  bindReleaseEvidence,
  createValidationReceipt,
  recordValidationChecks,
  validationReceiptIntegrityIssues,
} from './validation-profile.js';

const schema: UiSchema = {
  version: '2026.03',
  screens: [{
    id: 'root',
    component: 'Stack',
    children: [{ id: 'save', component: 'Button', props: { content: 'Save' } }],
  }],
};

const releaseChecks = ALL_CHECKS.filter((check) => check.endsWith('-evidence'));
const buildChecks = ALL_CHECKS.filter((check) => !check.endsWith('-evidence'));
const artifactContentHash = `sha256:${'a'.repeat(64)}`;

function completeBuildReceipt(): CodegenValidationReceipt {
  return bindReleaseEvidence(
    recordValidationChecks(
      createValidationReceipt('build', 'react'),
      ...buildChecks,
    ),
    undefined,
    artifactContentHash,
  ).receipt;
}

function completeReleaseReceipt(): CodegenValidationReceipt {
  const evidence = Object.fromEntries(RELEASE_EVIDENCE_CLASSES.map((evidenceClass) => [
    evidenceClass,
    passedEvidence(artifactContentHash, evidenceClass),
  ]));
  return bindReleaseEvidence(
    recordValidationChecks(
      createValidationReceipt('release', 'react'),
      ...buildChecks,
    ),
    evidence,
    artifactContentHash,
  ).receipt;
}

function expectCanonicalPartition(receipt: CodegenValidationReceipt): void {
  expect(receipt.checks).toEqual(ALL_CHECKS.filter((check) => receipt.checks.includes(check)));
  expect(receipt.notChecked).toEqual(
    ALL_CHECKS.filter((check) => receipt.notChecked.includes(check)),
  );
  expect(new Set([...receipt.checks, ...receipt.notChecked])).toEqual(new Set(ALL_CHECKS));
  expect(receipt.checks.filter((check) => receipt.notChecked.includes(check))).toEqual([]);
}

describe('validation receipt check universe', () => {
  it.each(['draft', 'build'] as const)(
    'successful %s keeps every release check visible in notChecked',
    async (profile) => {
      const result = await codeGenerate({ framework: 'react', profile, schema });

      expect(result.status).toBe('ok');
      expect(result.validationReceipt.checks).toEqual(buildChecks.filter(check => check !== 'fallback-policy'));
      expect(result.validationReceipt.notChecked).toEqual(['fallback-policy', ...releaseChecks]);
      expect(result.validationReceipt.evidence.required).toEqual([]);
      expect(result.validationReceipt.evidence.accepted).toEqual([]);
      expectCanonicalPartition(result.validationReceipt);
    },
  );

  it('successful release checks the entire universe and leaves nothing undisclosed', async () => {
    const build = await codeGenerate({ framework: 'react', profile: 'build', schema });
    expect(build.status).toBe('ok');
    const artifactContentHash = build.artifact!.contentHash;
    const passed = (reference: string) => passedEvidence(artifactContentHash, reference.split('/').pop()!.replace('.json', ''));

    const release = await codeGenerate({
      framework: 'react',
      profile: 'release',
      schema,
      releaseEvidence: {
        rendered: passed('reports/rendered.json'),
        interaction: passed('reports/interaction.json'),
        accessibility: passed('reports/accessibility.json'),
        theme: passed('reports/theme.json'),
        determinism: passed('reports/determinism.json'),
        performance: passed('reports/performance.json'),
      },
    });

    expect(release.status).toBe('ok');
    expect(release.validationReceipt.checks).toEqual(ALL_CHECKS.filter(check => check !== 'fallback-policy'));
    expect(release.validationReceipt.notChecked).toEqual(['fallback-policy']);
    expect(release.validationReceipt.evidence.required).toEqual([
      ...RELEASE_EVIDENCE_CLASSES,
    ]);
    expect(release.validationReceipt.evidence.accepted).toEqual(
      RELEASE_EVIDENCE_CLASSES.map((evidenceClass) => ({
        class: evidenceClass,
        ...passedEvidence(artifactContentHash, evidenceClass),
      })),
    );
    expectCanonicalPartition(release.validationReceipt);
  });
});

describe('validationReceiptIntegrityIssues', () => {
  it('accepts complete build and release receipts bound to their artifact', () => {
    expect(validationReceiptIntegrityIssues(completeBuildReceipt(), {
      profile: 'build',
      defaulted: false,
      target: { requested: 'react', resolved: 'react', source: 'explicit' },
      artifactContentHash,
    })).toEqual([]);
    expect(validationReceiptIntegrityIssues(completeReleaseReceipt(), {
      profile: 'release',
      defaulted: false,
      target: { requested: 'react', resolved: 'react', source: 'explicit' },
      artifactContentHash,
    })).toEqual([]);
  });

  it.each([
    {
      mutation: 'profile downgrade',
      mutate: (receipt: CodegenValidationReceipt) => ({
        ...receipt,
        profile: 'draft' as const,
      }),
      expected: /profile .* does not match/i,
    },
    {
      mutation: 'vacuous partition',
      mutate: (receipt: CodegenValidationReceipt) => ({
        ...receipt,
        checks: [],
        notChecked: [],
      }),
      expected: /canonical, complete, disjoint check partition/i,
    },
    {
      mutation: 'receipt artifact hash mismatch',
      mutate: (receipt: CodegenValidationReceipt) => ({
        ...receipt,
        evidence: {
          ...receipt.evidence,
          artifactContentHash: `sha256:${'b'.repeat(64)}`,
        },
      }),
      expected: /receipt artifact hash does not match/i,
    },
    {
      mutation: 'accepted evidence hash mismatch',
      mutate: (receipt: CodegenValidationReceipt) => ({
        ...receipt,
        evidence: {
          ...receipt.evidence,
          accepted: receipt.evidence.accepted.map((item, index) => (
            index === 0
              ? { ...item, artifactContentHash: `sha256:${'b'.repeat(64)}` }
              : item
          )),
        },
      }),
      expected: /accepted release evidence is not bound/i,
      release: true,
    },
  ])('rejects a $mutation', ({ mutate, expected, release }) => {
    const profile = release ? 'release' : 'build';
    const issues = validationReceiptIntegrityIssues(
      mutate(release ? completeReleaseReceipt() : completeBuildReceipt()),
      {
        profile,
        defaulted: false,
        target: { requested: 'react', resolved: 'react', source: 'explicit' },
        artifactContentHash,
      },
    );

    expect(issues.join('\n')).toMatch(expected);
  });
});
