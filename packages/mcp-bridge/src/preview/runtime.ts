import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Written by scripts/build-preview-runtime.mjs at package build time; shipped in dist. */
export interface PreviewRuntimeManifest {
  version: 1;
  builtAt: string;
  esbuild: string;
  react: string;
  vue: string;
  /** axe-core version bundled as axe.js, absent when the runtime was built without it. */
  axe?: string;
  /** Bare specifier → file name under the runtime directory. */
  importMap: Record<string, string>;
  styles: string;
  files: Record<string, { bytes: number; sha256: string }>;
}

export interface PreviewRuntime {
  directory: string;
  manifest: PreviewRuntimeManifest;
  manifestSha256: string;
}

export const RUNTIME_DIRECTORY_NAME = 'preview-runtime';
export const RUNTIME_MANIFEST_FILE = 'manifest.json';
const SUPPORTED_ESBUILD_PLATFORMS = new Set(['darwin-arm64', 'darwin-x64', 'linux-x64', 'linux-arm64']);

/** dist/preview-runtime next to the compiled bridge; a tsx run from src/ falls back to the built dist copy. */
export function defaultRuntimeDirectory(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(here, '..', RUNTIME_DIRECTORY_NAME), path.resolve(here, '..', '..', 'dist', RUNTIME_DIRECTORY_NAME)];
  return candidates.find(candidate => fs.existsSync(path.join(candidate, RUNTIME_MANIFEST_FILE))) ?? candidates[0]!;
}

export function loadPreviewRuntime(directory = defaultRuntimeDirectory()): PreviewRuntime {
  const manifestPath = path.join(directory, RUNTIME_MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Preview host runtime is missing: ${manifestPath}. Build @oods/mcp-bridge (pnpm --filter @oods/mcp-bridge run build) to generate it.`);
  }
  const bytes = fs.readFileSync(manifestPath);
  const manifest = JSON.parse(bytes.toString('utf8')) as PreviewRuntimeManifest;
  if (manifest.version !== 1 || !manifest.importMap || !manifest.files || typeof manifest.styles !== 'string') throw new Error(`Malformed preview runtime manifest: ${manifestPath}`);
  for (const [file, meta] of Object.entries(manifest.files)) {
    const full = path.join(directory, file);
    if (!fs.existsSync(full)) throw new Error(`Preview host runtime file is missing: ${full}`);
    if (fs.statSync(full).size !== meta.bytes) throw new Error(`Preview host runtime file size differs from its manifest: ${full}`);
  }
  for (const file of [...Object.values(manifest.importMap), manifest.styles]) {
    if (!manifest.files[file]) throw new Error(`Preview host runtime manifest names an unlisted file: ${file}`);
  }
  const { createHash } = require_crypto();
  return { directory, manifest, manifestSha256: createHash('sha256').update(bytes).digest('hex') };
}

function require_crypto(): typeof import('node:crypto') {
  return createRequire(import.meta.url)('node:crypto') as typeof import('node:crypto');
}

export interface PlatformSupport {
  supported: boolean; os: string; arch: string; binary?: string; reason?: string;
  /** Why not (s206-m03): no binary is shipped for this platform, or the one shipped is missing from this install. */
  gap?: 'unshipped' | 'incomplete';
}

/**
 * The bundle ships four esbuild platform packages as plain dependencies of this package (the
 * assembler installs without optional dependencies), so the binary is resolved from here and
 * handed to esbuild through ESBUILD_BINARY_PATH before it loads.
 */
export function resolveEsbuildPlatform(env: NodeJS.ProcessEnv = process.env, platform = `${process.platform}-${process.arch}`): PlatformSupport {
  const [os, arch] = platform.split('-') as [string, string];
  if (env.ESBUILD_BINARY_PATH && fs.existsSync(env.ESBUILD_BINARY_PATH)) return { supported: true, os, arch, binary: env.ESBUILD_BINARY_PATH };
  if (!SUPPORTED_ESBUILD_PLATFORMS.has(platform)) return { supported: false, os, arch, gap: 'unshipped', reason: `no esbuild binary is shipped for ${platform}; the preview compiles on ${[...SUPPORTED_ESBUILD_PLATFORMS].join(', ')}` };
  const require = createRequire(import.meta.url);
  try {
    const packageJson = require.resolve(`@esbuild/${platform}/package.json`);
    const binary = path.join(path.dirname(packageJson), 'bin', 'esbuild');
    if (!fs.existsSync(binary)) return { supported: false, os, arch, gap: 'incomplete', reason: `@esbuild/${platform} is installed without its binary at ${binary}` };
    return { supported: true, os, arch, binary };
  } catch {
    return { supported: false, os, arch, gap: 'incomplete', reason: `@esbuild/${platform} is not installed beside @oods/mcp-bridge` };
  }
}

let esbuildModule: Promise<typeof import('esbuild')> | undefined;
/** Load esbuild once, with the shipped platform binary pinned first. */
export function loadEsbuild(): Promise<typeof import('esbuild')> {
  esbuildModule ??= (async () => {
    const platform = resolveEsbuildPlatform();
    if (!platform.supported) throw new Error(`Preview host cannot compile: ${platform.reason}`);
    if (!process.env.ESBUILD_BINARY_PATH) process.env.ESBUILD_BINARY_PATH = platform.binary;
    return import('esbuild');
  })();
  return esbuildModule;
}
