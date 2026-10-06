import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle as brandApplyHandle } from '../../src/tools/brand.apply.js';
import { handle as tokensBuildHandle } from '../../src/tools/tokens.build.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../../../');
const baseTokensPath = path.join(repoRoot, 'packages', 'tokens', 'src', 'tokens', 'brands', 'A', 'base.json');

describe('preview compaction', () => {
  it('tokens.build preview returns a non-empty summary when apply=false', async () => {
    const result = await tokensBuildHandle({ brand: 'A', theme: 'dark', apply: false });

    expect(result.artifacts).toHaveLength(0);
    expect(result.preview?.summary).toBeTruthy();
    expect(result.preview?.notes?.length).toBeGreaterThan(0);
    expect(result.preview?.specimens?.length).toBeGreaterThan(0);
  });

  it('brand.apply compact preview omits structured payloads and specimens', async () => {
    const result = await brandApplyHandle({
      brand: 'A',
      strategy: 'alias',
      apply: false,
      preview: { verbosity: 'compact' },
      delta: { typography: { body: { fontSize: 15 } } },
    });

    expect(result.preview?.summary).toBeTruthy();
    expect(result.preview?.diffs?.length).toBeGreaterThan(0);
    for (const diff of result.preview?.diffs ?? []) {
      expect(diff.structured).toBeUndefined();
    }
    expect(result.preview?.specimens).toBeUndefined();
  });

  it('brand.apply full preview structured payloads include only changed tokens', async () => {
    const baseTokens = JSON.parse(fs.readFileSync(baseTokensPath, 'utf8')) as any;
    const originalValue = baseTokens.color.brand.A.surface.canvas.$value;
    const nextValue = 'oklch(0.5 0.05 86)';

    const result = await brandApplyHandle({
      brand: 'A',
      strategy: 'alias',
      apply: false,
      preview: { verbosity: 'full' },
      delta: {
        color: {
          brand: {
            A: {
              surface: {
                canvas: {
                  value: nextValue,
                },
              },
            },
          },
        },
      },
    });

    const baseDiff = result.preview?.diffs?.find((diff) => diff.path.endsWith('/A/base.json'));
    expect(baseDiff).toBeDefined();
    expect(baseDiff?.structured?.before).toEqual({
      color: {
        brand: {
          A: {
            surface: {
              canvas: {
                $value: originalValue,
              },
            },
          },
        },
      },
    });
    expect(baseDiff?.structured?.after).toEqual({
      color: {
        brand: {
          A: {
            surface: {
              canvas: {
                $value: nextValue,
              },
            },
          },
        },
      },
    });
  });
});
