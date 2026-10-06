import { promises as fs } from 'node:fs';
import path from 'node:path';

export function tokenKeys(node: unknown, trail: string[] = []): string[] {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return [];
  if ('$value' in node) return [trail.join('.')];
  return Object.entries(node).filter(([key]) => !key.startsWith('$'))
    .flatMap(([key, value]) => tokenKeys(value, [...trail, key])).sort();
}

export async function readSemanticKeySets(root: string): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};
  const visit = async (relative: string): Promise<void> => {
    const absolute = path.join(root, relative);
    const stat = await fs.stat(absolute);
    if (stat.isDirectory()) {
      for (const entry of (await fs.readdir(absolute)).sort()) await visit(`${relative}/${entry}`);
    } else if (relative.endsWith('.json')) {
      result[relative] = tokenKeys(JSON.parse(await fs.readFile(absolute, 'utf8')));
    }
  };
  for (const source of ['themes', 'brands', 'aliases']) await visit(`packages/tokens/src/tokens/${source}`);
  await visit('packages/tokens/src/viz-scales.json');
  return result;
}

export function semanticKeyChanges(before: Record<string, string[]>, after: Record<string, string[]>): string[] {
  const changes: string[] = [];
  const vizKeys = new Set(before['packages/tokens/src/viz-scales.json']);
  for (const file of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (!before[file] || !after[file]) { changes.push(`File added/removed: ${file}`); continue; }
    const oldKeys = new Set(before[file]);
    const newKeys = new Set(after[file]);
    for (const key of oldKeys) if (!newKeys.has(key)) changes.push(`Removed ${file}:${key}`);
    for (const key of newKeys) {
      // m04 explicitly adds dark/HC declarations of EXISTING viz names. Such an
      // override adds no public semantic name; removal of an old declaration fails.
      const existingVizOverride = /\/brands\/[AB]\/(dark|hc)\.json$/.test(file) && vizKeys.has(key);
      if (!oldKeys.has(key) && !existingVizOverride) changes.push(`Added ${file}:${key}`);
    }
  }
  return changes.sort();
}
