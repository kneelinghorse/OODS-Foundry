import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import type tokensBundle from '@oods/tokens';
import { RUNTIME_MANIFEST_FILE } from './runtime-bundle.js';
import { activeTokenRoot, buildUserBrands, canBuildUserBrands, shippedTokenRoot, userBrandIds } from './user-brands.js';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/**
 * The token build this server reads: a team's build under its brands folder when one is active (s213-m06,
 * lib/user-brands.ts), else the shipped token package (operator override MCP_BRAND_SOURCE_ROOT, never a wire operand).
 */
export function tokenPackageRoot(): string {
  return activeTokenRoot();
}

/** Whether the shipped token package can be rebuilt here: a source checkout. Portable runtimes never build their own. */
export function canRunTokenBuild(): boolean {
  return !fs.existsSync(path.join(REPO_ROOT, RUNTIME_MANIFEST_FILE)) &&
    ['build.mjs', 'build-entry.mjs'].every(script => fs.existsSync(path.join(shippedTokenRoot(), 'scripts', script)));
}

export interface TokenBuildReceipt {
  exitCode: number | null;
  commands: Array<{ command: string[]; exitCode: number | null; stdout: string; stderr: string }>;
  durationMs: number;
}

/**
 * The shipped token package's build, in a source checkout. Both stages are required: build.mjs emits CSS;
 * build-entry.mjs resolves scoped values. A team build made from that package is rebuilt after it, since its kit changed.
 */
export async function runTokenBuild(): Promise<TokenBuildReceipt> {
  const start = Date.now();
  const receipt: TokenBuildReceipt = { exitCode: 0, commands: [], durationMs: 0 };
  const root = shippedTokenRoot();
  for (const script of ['build.mjs', 'build-entry.mjs']) {
    const command = [process.execPath, path.join(root, 'scripts', script)];
    const result = await new Promise<TokenBuildReceipt['commands'][number]>((resolve) => {
      const result: TokenBuildReceipt['commands'][number] = { command, exitCode: null, stdout: '', stderr: '' };
      const child = spawn(command[0], command.slice(1), { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', chunk => { result.stdout += chunk.toString(); });
      child.stderr.on('data', chunk => { result.stderr += chunk.toString(); });
      child.on('error', error => { result.stderr += error.message; resolve(result); });
      child.on('close', code => { result.exitCode = code; resolve(result); });
    });
    receipt.commands.push(result);
    receipt.exitCode = result.exitCode;
    if (result.exitCode !== 0) break;
  }
  if (receipt.exitCode === 0 && userBrandIds().length > 0 && canBuildUserBrands()) {
    const team = await buildUserBrands();
    receipt.commands.push(...team.commands);
    receipt.exitCode = team.exitCode;
  }
  receipt.durationMs = Date.now() - start;
  return receipt;
}

export function readTokenScopes(): typeof tokensBundle.cssVariablesByScope {
  return JSON.parse(fs.readFileSync(path.join(tokenPackageRoot(), 'dist/css-variables-by-scope.json'), 'utf8'));
}

/** Refresh existing references held by long-lived MCP renderers after a successful build. */
export async function refreshTokenBundle(): Promise<void> {
  const { default: tokensBundle } = await import('@oods/tokens');
  // s213-m05: the build's scopes replace the held ones, so a brand removed from the folder and rebuilt is gone here too.
  const scopes = readTokenScopes();
  for (const brand of Object.keys(tokensBundle.cssVariablesByScope)) {
    if (!(brand in scopes)) delete (tokensBundle.cssVariablesByScope as Record<string, unknown>)[brand];
  }
  Object.assign(tokensBundle.cssVariablesByScope, scopes);
  const defaults = JSON.parse(fs.readFileSync(path.join(tokenPackageRoot(), 'dist/tailwind/tokens.json'), 'utf8'));
  for (const [target, source] of [[tokensBundle.tokens, defaults.tokens], [tokensBundle.flatTokens, defaults.flat], [tokensBundle.cssVariables, defaults.cssVariables]]) {
    for (const key of Object.keys(target)) delete target[key];
    Object.assign(target, source);
  }
}

/** Identity of the CSS actually served by this token build, including team brands. */
export function tokenCssHash(): string {
  return createHash('sha256').update(fs.readFileSync(path.join(tokenPackageRoot(), 'dist/css/tokens.css'))).digest('hex');
}
export function tokenCssReference(): string {
  return `tokens.build#sha256:${tokenCssHash()}`;
}
