import { promises as fs } from 'node:fs';
import path from 'node:path';
// @ts-expect-error -- the canonical build scope loader is native ESM.
import { resolveScopeFiles } from '../../packages/tokens/scripts/collision-guard.mjs';
import type { DtcgToken } from '../../src/tooling/tokens/dtcg.js';

/** Use the build's ordered default scope; never merge dark/HC brand overrides into light. */
export async function loadCanonicalColorTokens(root: string, readSource = (file: string) => fs.readFile(file, 'utf8')): Promise<DtcgToken[]> {
  const packageRoot = path.join(root, 'packages/tokens');
  const tokens = new Map<string, DtcgToken>();
  for (const file of resolveScopeFiles({ brand: 'A', theme: 'base' }, packageRoot)) {
    const source = path.join(packageRoot, file);
    const visit = (node: any, trail: string[] = []) => {
      if (!node || typeof node !== 'object' || Array.isArray(node)) return;
      if ('$value' in node) {
        if (node.$type === 'color') tokens.set(trail.join('.'), {
          path: trail, type: 'color', value: node.$value, source,
        });
        return;
      }
      for (const [key, value] of Object.entries(node)) if (!key.startsWith('$')) visit(value, [...trail, key]);
    };
    visit(JSON.parse(await readSource(source)));
  }
  return [...tokens.values()];
}
