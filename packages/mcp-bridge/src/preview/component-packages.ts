import { shadcnHash, type ShadcnClosure } from './shadcn.js';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import type { PreviewFramework } from './store.js';

export interface ComponentPackageRequest { framework: PreviewFramework; specifier: string; version: string; localPath?: string; shadcn?: ShadcnClosure }
export interface ComponentPackage { framework: PreviewFramework; name: string; version: string; directory: string; contentHash: string; shadcn?: ShadcnClosure }
export class ComponentPackageError extends Error {
  readonly code = 'OODS-V217';
  constructor(readonly packageName: string, message: string) { super(`Team package ${packageName}: ${message}`); this.name = 'ComponentPackageError'; }
}
export const packageName = (specifier: string): string => specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]!;

/** Fingerprint the package payload, not its development installation/cache. Compiled snapshots freeze resolved dependencies. */
export function packageContentHash(directory: string): string {
  const hash = createHash('sha256');
  let count = 0, bytes = 0;
  const visit = (relative: string) => {
    for (const entry of fs.readdirSync(path.join(directory, relative), { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      if (['node_modules', '.git', '.tmp', '.npm-cache'].includes(entry.name)) continue;
      const file = path.join(relative, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`payload contains an unsupported symlink: ${file}`);
      if (entry.isDirectory()) { visit(file); continue; }
      if (!entry.isFile()) continue;
      const contents = fs.readFileSync(path.join(directory, file));
      bytes += contents.length;
      if (++count > 10000 || bytes > 64 * 1024 * 1024) throw new Error('package payload exceeds 10,000 files or 64 MiB; point localPath at the built package root');
      hash.update(file.split(path.sep).join('/')).update('\0').update(createHash('sha256').update(contents).digest()).update('\0');
    }
  };
  visit('');
  return `sha256:${hash.digest('hex')}`;
}

/** Resolve an explicit package root or a regular installed package, without executing package code or install scripts. */
export function inspectComponentPackages(requests: ComponentPackageRequest[], resolveFrom = process.cwd()): ComponentPackage[] {
  if (!Array.isArray(requests) || requests.length > 256) throw new ComponentPackageError('(request)', 'expected at most 256 package references');
  const found = new Map<string, ComponentPackage>();
  for (const request of requests) {
    if (request?.shadcn) {
      const source = request.shadcn;
      try {
        if (!['react', 'vue'].includes(request.framework) || (source.framework ?? 'react') !== request.framework || request.specifier !== source.module || !path.isAbsolute(source.project)) throw new Error('invalid framework or shadcn source');
        const contentHash = shadcnHash(source);
        const key = `${request.framework}:${source.module}`;
        if (found.has(key) && found.get(key)!.directory !== source.project) throw new Error('one module cannot resolve from two shadcn projects');
        found.set(key, { framework: request.framework, name: source.module, version: contentHash, directory: source.project, contentHash, shadcn: { ...source, closureHash: contentHash } });
      } catch (error) { throw new ComponentPackageError(source.module, error instanceof Error ? error.message : String(error)); }
      continue;
    }
    if (!request || !['react', 'vue'].includes(request.framework) || typeof request.specifier !== 'string' || !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/.test(request.specifier)) throw new ComponentPackageError('(request)', 'invalid framework or package import');
    const name = packageName(request.specifier);
    try {
      const candidates = request.localPath
        ? [request.localPath]
        : (createRequire(path.join(resolveFrom, 'package.json')).resolve.paths(name) ?? []).map(directory => path.join(directory, name));
      if (request.localPath && !path.isAbsolute(request.localPath)) throw new Error('localPath must be an absolute package directory');
      const candidate = candidates.find(directory => fs.existsSync(path.join(directory, 'package.json')));
      if (!candidate) throw new Error('not found; install it or set the mapping localPath to its package directory');
      const directory = fs.realpathSync(candidate);
      const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
      if (manifest.name !== name || manifest.version !== request.version) throw new Error(`expected ${name}@${request.version}, found ${manifest.name}@${manifest.version}; update the mapping and recompose to change a version pin`);
      const key = `${request.framework}:${name}`;
      const previous = found.get(key);
      if (previous) {
        if (previous.directory !== directory || previous.version !== manifest.version) throw new Error('one framework cannot import this package from two different roots or versions');
        continue;
      }
      found.set(key, { framework: request.framework, name, version: manifest.version, directory, contentHash: packageContentHash(directory) });
    } catch (error) { throw new ComponentPackageError(name, error instanceof Error ? error.message : String(error)); }
  }
  return [...found.values()].sort((a, b) => `${a.framework}:${a.name}`.localeCompare(`${b.framework}:${b.name}`));
}
