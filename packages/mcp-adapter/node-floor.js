// The Node floor, checked before anything else in the adapter runs (s206-m03).
//
// index.js imports this module first, and ES modules evaluate their imports in order, so a Node below the floor stops
// here with one plain sentence on stderr, which the MCP client shows in its log, instead of failing later inside a tool
// call. The floor is this package's own `engines.node`, the same floor the release manifest records.
import fs from 'node:fs';

const read = (file) => JSON.parse(fs.readFileSync(new URL(file, import.meta.url), 'utf8'));
// The product's name, rendered from configs/product/name.json by scripts/product/render-name.mjs (s211-m03).
const { product } = read('./product.json');

/**
 * What is wrong with running `version` under the `range` floor (">=x.y.z"), in one plain sentence, or null when it
 * is fine. A range this module cannot read is not its to police.
 */
export function nodeFloorProblem(version, range, execPath = process.execPath) {
  const floor = /^>=\s*(\d+)\.(\d+)\.(\d+)$/.exec(String(range ?? '').trim());
  if (!floor) return null;
  const need = floor.slice(1).map(Number);
  const have = String(version).replace(/^v/, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < 3; index += 1) {
    if ((have[index] ?? 0) > need[index]) return null;
    if ((have[index] ?? 0) < need[index]) {
      return `${product} needs Node.js ${need.join('.')} or newer, and this is Node.js ${have.slice(0, 3).join('.')} (${execPath}). `
        + 'Install a current Node.js LTS from https://nodejs.org, or point your MCP client\'s command at a newer node, '
        + 'then restart the client.';
    }
  }
  return null;
}

const manifest = read('./package.json');
const problem = nodeFloorProblem(process.versions.node, manifest.engines?.node);
if (problem) {
  console.error(`[oods-mcp-adapter] ${problem}`);
  process.exit(1);
}
