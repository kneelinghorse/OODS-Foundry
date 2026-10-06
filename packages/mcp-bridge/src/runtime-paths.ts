import fs from 'node:fs';
import path from 'node:path';

/**
 * s213-m04: the token package the native server reads (its tokenPackageRoot: MCP_BRAND_SOURCE_ROOT under the repository
 * or bundle root, else packages/tokens), so the preview's brands and token CSS are the server's.
 */
export function resolveTokenPackageRoot(serverCwd: string): string {
  return path.resolve(serverCwd, '../..', process.env.MCP_BRAND_SOURCE_ROOT || 'packages/tokens');
}

/**
 * s213-m06: the token build the server reads now. With a team brands folder (OODS_BRANDS_DIR) holding a brand, the
 * server builds the team's brands beside the shipped ones under `<folder>/.build/` and names that build in
 * `.build/active.json` (packages/mcp-server/src/lib/user-brands.ts); otherwise the shipped token package.
 */
export function activeTokenPackageRoot(shipped: string): string {
  const folder = process.env.OODS_BRANDS_DIR?.trim();
  if (!folder) return shipped;
  const dir = path.resolve(folder);
  try {
    const team = fs.readdirSync(dir, { withFileTypes: true }).some(entry => entry.isDirectory() && !entry.name.startsWith('.'));
    if (!team) return shipped;
    const active = JSON.parse(fs.readFileSync(path.join(dir, '.build', 'active.json'), 'utf8')) as { root?: unknown };
    if (typeof active.root === 'string' && fs.existsSync(path.join(active.root, 'dist', 'css', 'tokens.css'))) return active.root;
  } catch {
    // No folder or no build yet: the shipped tokens.
  }
  return shipped;
}

/** Match the server's policy resolution from either a checkout or an extracted bundle. */
export function resolveBridgeArtifacts(serverCwd: string): { artifactsRoot: string; artifactsBase: string } {
  const builtPolicy = path.join(serverCwd, 'dist/security/policy.json');
  const policyPath = fs.existsSync(builtPolicy) ? builtPolicy : path.join(serverCwd, 'src/security/policy.json');
  const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8')) as { artifactsBase?: string };
  const target = policy.artifactsBase?.trim() || 'artifacts/current-state';
  const artifactsBase = path.isAbsolute(target) ? target : path.resolve(serverCwd, '../..', target);
  return { artifactsRoot: path.dirname(artifactsBase), artifactsBase };
}
