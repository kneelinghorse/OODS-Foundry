import fs from 'node:fs/promises';
import path from 'node:path';
import { outputDirectory, validateReceipt, writeJson } from './common.js';

/** Compare observations and source identity, excluding timing and receipt locations. */
export function compareReceipts(before: any, after: any) {
  const differences: Array<{ field: string; before: unknown; after: unknown }> = [];
  const compare = (field: string, a: unknown, b: unknown) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) differences.push({ field, before: a, after: b });
  };
  for (const key of ['framework', 'theme', 'brand', 'schemaHash', 'artifactContentHash', 'errors']) compare(key, before[key], after[key]);
  const files = (receipt: any) => Object.fromEntries(receipt.files.map((file: any) => [file.path, file.contentHash]));
  const a = files(before), b = files(after);
  for (const file of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) compare(`files.${file}`, a[file] ?? null, b[file] ?? null);
  const widths = [...new Set([...before.views, ...after.views].map(view => view.width))].sort((x, y) => x - y);
  for (const width of widths) {
    const left = before.views.find((view: any) => view.width === width), right = after.views.find((view: any) => view.width === width);
    for (const key of ['accessibility', 'visibleText', 'values', 'measurements', 'regions']) compare(`views.${width}.${key}`, left?.[key] ?? null, right?.[key] ?? null);
  }
  return { differenceCount: differences.length, differences };
}
export async function diff(beforeFile: string, afterFile: string, output: string) {
  const before = JSON.parse(await fs.readFile(beforeFile, 'utf8')), after = JSON.parse(await fs.readFile(afterFile, 'utf8'));
  await validateReceipt(before); await validateReceipt(after);
  const result = compareReceipts(before, after);
  const directory = await outputDirectory(output);
  await writeJson(path.join(directory, 'diff.json'), result);
  const lines = [`# Render receipt diff`, '', `${result.differenceCount} differences.`, ''];
  for (const row of result.differences) lines.push(`## ${row.field}`, '', 'Before:', '```json', JSON.stringify(row.before, null, 2), '```', 'After:', '```json', JSON.stringify(row.after, null, 2), '```', '');
  await fs.writeFile(path.join(directory, 'diff.md'), lines.join('\n'));
  return result;
}
