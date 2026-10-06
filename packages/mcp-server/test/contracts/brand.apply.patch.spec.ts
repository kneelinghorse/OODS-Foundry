import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle as brandApplyHandle } from '../../src/tools/brand.apply.js';

type BrandTokens = Record<string, any>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../../../');
const baseTokensPath = path.join(repoRoot, 'packages', 'tokens', 'src', 'tokens', 'brands', 'A', 'base.json');

describe('brand.apply patch strategy', () => {
  it('accepts RFC 6902 patch arrays and returns preview diffs', async () => {
    const baseTokens = JSON.parse(fs.readFileSync(baseTokensPath, 'utf8')) as BrandTokens;
    const original = baseTokens.color.brand.A.text.primary.$value as string;
    const nextValue = original === 'oklch(0.5 0.05 86)' ? 'oklch(0.55 0.05 86)' : 'oklch(0.5 0.05 86)';

    const result = await brandApplyHandle({
      brand: 'A',
      strategy: 'patch',
      apply: false,
      delta: [
        {
          op: 'replace',
          path: '/color/brand/A/text/primary/value',
          value: nextValue,
        },
      ],
    });

    expect(result.preview?.summary).toMatch(/Updated/);
    expect(result.preview?.diffs?.length ?? 0).toBeGreaterThan(0);
  });
});
