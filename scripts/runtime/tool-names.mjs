// Public names come from the same table consumed by both MCP transports.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export function toolSurface(root = ROOT) {
  return JSON.parse(fs.readFileSync(path.join(root, 'packages/mcp-adapter/tool-surface.json'), 'utf8'));
}
export function advertisedName(name, root = ROOT) {
  const entry = toolSurface(root)[name];
  if (!entry) throw new Error(`No advertised name for ${name}`);
  return entry.name;
}

/** Detailed contracts are kept out of tools/list and reused by the generated references. */
export function toolReferences(root = ROOT) {
  const guide = fs.readFileSync(path.join(root, 'packages/foundry/TOOL-REFERENCE.md'), 'utf8');
  return Object.fromEntries(Object.entries(toolSurface(root)).map(([internal, { name }]) => {
    const text = guide.split(`## ${name}\n`)[1]?.split('\n## ')[0].trim();
    if (!text) throw new Error(`No full tool reference for ${name}`);
    return [internal, text];
  }));
}
