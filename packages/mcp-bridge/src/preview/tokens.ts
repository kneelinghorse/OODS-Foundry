import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

/**
 * s213-m04 — the preview's brands and token CSS, read from the token build on each use instead of copied into the
 * preview runtime when the bridge is built. The token build reads the brands folder and writes `dist/brands.json` and
 * `dist/css/tokens.css`; a brand added and built, or a token value changed and built, reaches the brand switcher and
 * the running app without rebuilding the bridge. Each file is re-read only when it changes on disk.
 */
export interface PreviewTokens {
  /** The token package root the files are read from now (a team's build when one is active, s213-m06). */
  readonly root: string;
  /** The brands the token build produced, in its order. */
  brands(): string[];
  isBrand(value: unknown): value is string;
  /** The design system's token CSS: the bare `:root` block and one block per brand and theme. */
  css(): { text: string; sha256: string };
}

/** The token package this bridge's @oods/tokens dependency resolves to. */
export function defaultTokenPackageRoot(): string {
  return path.dirname(createRequire(import.meta.url).resolve('@oods/tokens/package.json'));
}

type Cached<T> = { mtimeMs: number; size: number; value: T } | null;

function reader<T>(file: string, parse: (bytes: Buffer) => T): () => T {
  let cached: Cached<T> = null;
  return () => {
    const stat = fs.statSync(file);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached.value;
    const value = parse(fs.readFileSync(file));
    cached = { mtimeMs: stat.mtimeMs, size: stat.size, value };
    return value;
  };
}

/** One token build's readers. */
function readers(root: string): { brands: () => string[]; css: () => { text: string; sha256: string } } {
  const brandsFile = path.join(root, 'dist', 'brands.json');
  const cssFile = path.join(root, 'dist', 'css', 'tokens.css');
  const brands = reader(brandsFile, bytes => {
    const list = (JSON.parse(bytes.toString('utf8')) as { brands?: unknown }).brands;
    if (!Array.isArray(list) || list.length === 0 || !list.every(item => typeof item === 'string')) {
      throw new Error(`${brandsFile} lists no brands; run the token build.`);
    }
    return list as string[];
  });
  const css = reader(cssFile, bytes => ({ text: bytes.toString('utf8'), sha256: createHash('sha256').update(bytes).digest('hex') }));
  return { brands, css };
}

/**
 * `root` is a token package root, or a function naming the one in use now: the server can switch to a team's build
 * (s213-m06) while this host runs, and the host follows it on its next read.
 */
export function previewTokens(root: string | (() => string) = defaultTokenPackageRoot()): PreviewTokens {
  const current = typeof root === 'function' ? root : () => root;
  const byRoot = new Map<string, ReturnType<typeof readers>>();
  const use = () => {
    const where = current();
    let found = byRoot.get(where);
    if (!found) { found = readers(where); byRoot.set(where, found); }
    return found;
  };
  return {
    get root() { return current(); },
    brands: () => [...use().brands()],
    isBrand: (value: unknown): value is string => typeof value === 'string' && use().brands().includes(value),
    css: () => use().css(),
  };
}
