import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { NUCLEUS_COMPONENT_IDS } from '@oods/component-contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { handle } from '../../src/tools/code.generate.js';
import { FOUNDATION_V1_SHOWCASE_SCHEMA } from './foundation-fixture.s182.js';
import {
  packFoundationPackages,
  runGeneratedConsumerProof,
  runPackedExportProof,
} from '../../../../scripts/product-reality/s182-m04-consumer-harness.mjs';

const temporaryRoots: string[] = [];

async function evidenceRoot(name: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `oods-s182-${name}-`));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});
describe('Sprint 182 M04 packed generated consumers', () => {
  it(
    'B-12 installs and imports every required tarball and root export in isolation',
    async () => {
      const root = await evidenceRoot('b12');
      const tarballs = await packFoundationPackages(root);
      const result = await runPackedExportProof({ artifactRoot: root, tarballs });

      expect(result).toMatchObject({ status: 'passed', selected: 1, passed: 1, failed: 0, skipped: 0 });
      expect(result.tarballs.map((record: { name: string }) => record.name)).toEqual([
        '@oods/tokens',
        '@oods/component-contracts',
        '@oods/component-styles',
        '@oods/components-react',
        '@oods/components-vue',
      ]);
      expect(result.proof).toMatchObject({
        canonicalIds: expect.arrayContaining(['Badge', 'Textarea']),
        readiness: { react: NUCLEUS_COMPONENT_IDS.length, vue: NUCLEUS_COMPONENT_IDS.length },
        resolvedInsideConsumer: 5,
      });
    },
    900_000,
  );

  it(
    'B-13 resolves declared dependencies and shared CSS in a clean production build',
    async () => {
      const sources: Record<'react' | 'vue', string> = { react: '', vue: '' };
      for (const framework of ['react', 'vue'] as const) {
        const generated = await handle({
          framework,
          schema: FOUNDATION_V1_SHOWCASE_SCHEMA,
          options: { styling: 'tokens', typescript: true },
        });
        expect(generated.status, JSON.stringify(generated.errors ?? [])).toBe('ok');
        sources[framework] = generated.code;
      }

      const root = await evidenceRoot('b13');
      const tarballs = await packFoundationPackages(root);
      const { report, frameworkReports } = await runGeneratedConsumerProof({
        artifactRoot: root,
        sources,
        tarballs,
      });

      expect(report).toMatchObject({ status: 'passed', selected: 2, passed: 2, failed: 0, skipped: 0 });
      expect(frameworkReports).toHaveLength(2);
      for (const frameworkReport of frameworkReports) {
        expect(frameworkReport).toMatchObject({
          status: 'passed',
          selected: 8,
          passed: 8,
          failed: 0,
          skipped: 0,
          isolation: {
            outsidePnpmWorkspace: true,
            freshNodeModules: true,
            emptyVerifierOwnedNpmConfiguration: true,
            workspaceSymlinks: false,
            repositorySourceImports: false,
          },
          browser: {
            mount: 'passed',
            hydration: 'passed',
            browserRuntimeErrors: [],
            interactions: {
              emailValue: 'user@example.com',
              emailValidBeforeInput: false,
              emailValidAfterInput: true,
              planValue: 'basic',
              renewalValue: '2026-10-15',
              notesValue: 'Follow up tomorrow.',
              checkboxToggled: true,
              selectedTab: 'true',
              bannerVisibleAfterDismiss: false,
              domainActions: {
                primary: 1,
                secondary: 1,
                rowIds: ['sub-1'],
              },
            },
          },
        });
        expect(frameworkReport.browser.screenshots).toHaveLength(3);
        expect(frameworkReport.browser.screenshots.every(
          (screenshot: { horizontalOverflow: boolean }) => screenshot.horizontalOverflow === false,
        )).toBe(true);
      }
    },
    900_000,
  );
});
