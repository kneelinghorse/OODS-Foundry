import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { compileCss, loadDtcgTokens } from '../../src/tooling/tokens/dtcg.js';

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) {
      continue;
    }
    await fs.rm(dir, { recursive: true, force: true });
  }
});

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dtcg-'));
  tempDirs.push(dir);
  return dir;
}

describe('loadDtcgTokens', () => {
  it('loads DTCG tokens and builds CSS variables', async () => {
    const dir = await createTempDir();
    const root = {
      ref: {
        color: {
          brand: {
            '$type': 'color',
            '$value': '#ff00aa',
            '$description': 'Brand accent colour.',
          },
        },
      },
      theme: {
        color: {
          brand: {
            '$type': 'color',
            '$value': '{ref.color.brand}',
          },
        },
      },
    };

    await fs.writeFile(path.join(dir, 'tokens.json'), JSON.stringify(root, null, 2));

    const tokens = await loadDtcgTokens(dir);
    expect(tokens).toHaveLength(2);

    const { css } = compileCss(tokens);
    expect(css).toContain('--ref-color-brand: #ff00aa;');
    expect(css).toContain('--theme-color-brand: var(--ref-color-brand);');
  });

  it('throws when a token leaf misses a $value', async () => {
    const dir = await createTempDir();
    const broken = {
      ref: {
        color: {
          bad: {
            '$type': 'color',
          },
        },
      },
    };

    await fs.writeFile(path.join(dir, 'broken.json'), JSON.stringify(broken, null, 2));
    await expect(loadDtcgTokens(dir)).rejects.toThrow(/missing a "\$value"/i);
  });

  it('throws when a token reference cannot be resolved', async () => {
    const dir = await createTempDir();
    const dangling = {
      theme: {
        color: {
          brand: {
            '$type': 'color',
            '$value': '{ref.color.missing}',
          },
        },
      },
    };

    await fs.writeFile(path.join(dir, 'dangling.json'), JSON.stringify(dangling, null, 2));
    const tokens = await loadDtcgTokens(dir);
    expect(() => compileCss(tokens)).toThrow(/Unresolved token reference "ref\.color\.missing"/);
  });
});
