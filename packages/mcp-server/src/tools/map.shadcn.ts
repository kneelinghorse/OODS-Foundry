/** Inspect copied shadcn source without executing a project module or package script. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { transformSync } from 'esbuild';
import { parse } from 'acorn';
import postcss from 'postcss';
import { exportsName } from './map.local-package.js';

export interface ShadcnSource { project: string; module: string }
export interface ShadcnClosure {
  base?: 'radix' | 'base'; style?: string; themeRequirement?: string;
  module: string; file: string; css: string; files: string[]; hashFiles: string[];
  paths: Record<string, string[]>; dependencies: Record<string, string>; imports: string[]; closureHash: string;
}
export interface InspectedShadcn extends ShadcnClosure { project: string }
const posix = (value: string) => value.split(path.sep).join('/');
const fail = (file: string, message: string, line = 1): never => { throw new Error(`${file}:${line}: ${message}`); };
const nameOf = (specifier: string) => specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]!;

function readJson(file: string, comments = false): any {
  try {
    const text = fs.readFileSync(file, 'utf8');
    // Parse JSONC as syntax, then accept data nodes only; this never evaluates a config.
    if (!comments) return JSON.parse(text);
    const tree = parse('(' + text + ')', { ecmaVersion: 'latest', locations: true }) as any;
    const data = (node: any): any => node.type === 'Literal' ? node.value : node.type === 'ArrayExpression' ? node.elements.map(data) : node.type === 'ObjectExpression' ? Object.fromEntries(node.properties.map((prop: any) => [prop.key.name ?? prop.key.value, data(prop.value)])) : node.type === 'UnaryExpression' && node.operator === '-' ? -data(node.argument) : fail(file, 'invalid JSON data');
    return data(tree.body[0].expression);
  } catch (error) { return fail(file, error instanceof Error ? error.message : String(error)); }
}
function within(project: string, file: string): string {
  if (!file.startsWith(project + path.sep)) fail(file, 'source must stay inside the shadcn project');
  return file;
}
function resolveFile(project: string, target: string, importer: string, line = 1): string {
  const file = [target, ...['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json', '.css'].map(ext => target + ext), ...['index.tsx', 'index.ts', 'index.js'].map(name => path.join(target, name))]
    .find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!file) return fail(importer, `module does not exist: ${target}`, line);
  try { return within(project, fs.realpathSync(file)); } catch (error) { return fail(importer, error instanceof Error ? error.message : String(error), line); }
}
export function resolveShadcnAlias(project: string, paths: Record<string, string[]>, specifier: string): string | undefined {
  for (const [key, targets] of Object.entries(paths).sort(([a], [b]) => b.length - a.length)) {
    const star = key.indexOf('*');
    const match = star < 0 ? specifier === key : specifier.startsWith(key.slice(0, star)) && specifier.endsWith(key.slice(star + 1));
    if (!match) continue;
    const capture = star < 0 ? '' : specifier.slice(star, specifier.length - (key.length - star - 1));
    for (const target of targets) {
      const candidate = path.resolve(project, target.replace('*', capture));
      if ([candidate, ...['.tsx', '.ts', '.jsx', '.js', '.json', '/index.tsx', '/index.ts'].map(ext => candidate + ext)].some(file => fs.existsSync(file) && fs.statSync(file).isFile())) return candidate;
    }
    return path.resolve(project, targets[0]!.replace('*', capture));
  }
  return undefined;
}
function readPaths(project: string, hashFiles: Set<string>): Record<string, string[]> {
  const seen = new Set<string>();
  const visit = (file: string): Record<string, string[]> => {
    file = resolveFile(project, file, file);
    if (seen.has(file)) return {};
    seen.add(file); hashFiles.add(posix(path.relative(project, file)));
    const config = readJson(file, true);
    let inherited: Record<string, string[]> = {};
    if (config.extends) {
      if (typeof config.extends !== 'string' || !config.extends.startsWith('.')) fail(file, 'only project-relative tsconfig extends is supported');
      const target = path.resolve(path.dirname(file), config.extends);
      inherited = visit(fs.existsSync(target) ? target : target + '.json');
    }
    if (config.compilerOptions?.paths) {
      const base = path.resolve(path.dirname(file), config.compilerOptions.baseUrl ?? '.');
      for (const [key, values] of Object.entries(config.compilerOptions.paths)) {
        if (!Array.isArray(values) || !values.length || values.some(value => typeof value !== 'string')) fail(file, `invalid TypeScript paths for ${key}`);
        inherited[key] = (values as string[]).map(value => posix(path.relative(project, within(project, path.resolve(base, value)))));
      }
    }
    if (Object.keys(inherited).length) return inherited;
    for (const reference of config.references ?? []) {
      const target = path.resolve(path.dirname(file), reference.path);
      Object.assign(inherited, visit(fs.existsSync(target) && fs.statSync(target).isFile() ? target : fs.existsSync(target + '.json') ? target + '.json' : path.join(target, 'tsconfig.json')));
    }
    return inherited;
  };
  return visit(path.join(project, 'tsconfig.json'));
}
function installed(_project: string, specifier: string, importer: string, line = 1): { name: string; version: string; file: string } {
  const name = nameOf(specifier);
  const require = createRequire(importer);
  let manifestPath: string;
  try { manifestPath = require.resolve(`${name}/package.json`); }
  catch (error) {
    // Many packages hide package.json behind exports, including CSS-only packages. Search only
    // the importing file's Node lookup paths, preserving pnpm links and workspace hoisting.
    const hidden = (error as NodeJS.ErrnoException).code === 'ERR_PACKAGE_PATH_NOT_EXPORTED';
    const found = hidden ? require.resolve.paths(name)?.map(directory => path.join(directory, name, 'package.json')).find(file => fs.existsSync(file)) : undefined;
    if (!found) return fail(importer, `cannot resolve dependency '${name}' for closure import '${specifier}' from the importing file's node_modules: ${error instanceof Error ? error.message : String(error)}`, line);
    manifestPath = found;
  }
  manifestPath = fs.realpathSync(manifestPath);
  const manifest = readJson(manifestPath);
  if (!/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(manifest.version)) fail(importer, `installed ${name} at ${manifestPath} has no exact version`, line);
  try { return { name, version: manifest.version, file: require.resolve(specifier) }; }
  catch (error) {
    if (importer.endsWith('.css')) {
      const subpath = specifier.slice(name.length);
      const entry = manifest.exports?.[subpath ? '.' + subpath : '.'];
      const target = typeof entry === 'string' ? entry : entry?.style ?? entry?.default ?? (!subpath ? manifest.style ?? manifest.main : undefined);
      const file = typeof target === 'string' ? path.resolve(path.dirname(manifestPath), target) : undefined;
      if (file && fs.existsSync(file)) return { name, version: manifest.version, file };
    }
    return fail(importer, `cannot resolve '${specifier}': ${error instanceof Error ? error.message : String(error)}`, line);
  }
}
export function shadcnClosureHash(project: string, files: string[], dependencies: Record<string, string>): string {
  const hash = createHash('sha256');
  for (const file of [...files].sort()) hash.update(file).update('\0').update(fs.readFileSync(within(project, fs.realpathSync(path.join(project, file))))).update('\0');
  hash.update(JSON.stringify(Object.fromEntries(Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b)))));
  return `sha256:${hash.digest('hex')}`;
}
export function inspectShadcn(source: ShadcnSource, exported: string): InspectedShadcn {
  const project = fs.existsSync(source.project) ? fs.realpathSync(source.project) : fail(path.join(source.project, 'components.json'), 'project does not exist');
  const configFile = path.join(project, 'components.json');
  const config = readJson(configFile);
  const style = config.style;
  const base = typeof style === 'string' && /^base-[a-z0-9-]+$/.test(style) ? 'base'
    : typeof style === 'string' && (/^radix-[a-z0-9-]+$/.test(style) || ['new-york', 'default'].includes(style)) ? 'radix' : undefined;
  if (!base) fail(configFile, `unsupported shadcn style '${String(style)}'; supported bases: Radix (radix-*, new-york, default) and Base UI (base-*). React Aria is not supported.`);
  if (!/^[A-Za-z@#_$][A-Za-z0-9@#_$./-]*$/.test(source.module)) fail(configFile, 'module must be a portable project alias import, without absolute paths or executable syntax');
  if (config.tsx !== true) fail(configFile, 'shadcn source requires tsx: true');
  if (typeof config.tailwind?.css !== 'string') fail(configFile, 'tailwind.css must name the project CSS entry');
  const css = resolveFile(project, path.resolve(project, config.tailwind.css), configFile);
  const aliases = Object.values(config.aliases ?? {}).filter((value): value is string => typeof value === 'string');
  if (!aliases.some(alias => source.module === alias || source.module.startsWith(alias + '/'))) fail(configFile, `module '${source.module}' must start with an alias declared in components.json`);
  const hashFiles = new Set<string>(['components.json']);
  const paths = readPaths(project, hashFiles);
  const target = resolveShadcnAlias(project, paths, source.module);
  if (!target) fail(path.join(project, 'tsconfig.json'), `no TypeScript paths alias resolves '${source.module}'`);
  const file = resolveFile(project, target!, configFile);
  if (!/\.(tsx|ts)$/.test(file)) fail(file, 'mapped shadcn module must be a .tsx or .ts file');
  const dependencies: Record<string, string> = {};
  const imports = new Set<string>();
  const tailwind = installed(project, 'tailwindcss', css);
  dependencies.tailwindcss = tailwind.version;
  if (!tailwind.version.startsWith('4.')) fail(css, `Tailwind 4 is required; found ${tailwind.version}`);
  const integrations = ['@tailwindcss/vite', '@tailwindcss/postcss'];
  const failures: string[] = [];
  for (const name of integrations) {
    try { dependencies[name] = installed(project, name, configFile).version; break; }
    catch (error) { failures.push(error instanceof Error ? error.message : String(error)); }
  }
  if (!integrations.some(name => dependencies[name])) fail(configFile, `Tailwind 4 requires @tailwindcss/vite or @tailwindcss/postcss; ${failures.join('; ')}`);
  const files = new Set<string>(); let bytes = 0;
  const resolve = (specifier: string, importer: string, line = 1): string | undefined => {
    const alias = resolveShadcnAlias(project, paths, specifier);
    if (alias || specifier.startsWith('.') || path.isAbsolute(specifier)) { if (alias) imports.add(specifier); return resolveFile(project, alias ?? path.resolve(path.dirname(importer), specifier), importer, line); }
    const dep = installed(project, specifier, importer, line); dependencies[dep.name] = dep.version; imports.add(specifier); return undefined;
  };
  const visit = (absolute: string) => {
    const relative = posix(path.relative(project, absolute));
    if (files.has(relative)) return;
    files.add(relative); hashFiles.add(relative);
    const contents = fs.readFileSync(absolute); bytes += contents.length;
    const raw = contents.toString('utf8');
    if (files.size > 10000 || bytes > 64 * 1024 * 1024) fail(absolute, 'source closure exceeds 10,000 files or 64 MiB');
    if (!/\.(?:[cm]?[jt]sx?|css)$/.test(absolute)) return;
    if (absolute.endsWith('.css')) {
      const sheet = postcss.parse(raw, { from: absolute });
      const remote = (value: string) => /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value);
      sheet.walkAtRules('import', rule => {
        const match = /^(?:url\(\s*(?:["']([^"']+)["']|([^\s)]+))\s*\)|["']([^"']+)["'])/i.exec(rule.params);
        const specifier = match?.[1] ?? match?.[2] ?? match?.[3];
        if (!specifier || remote(specifier)) return;
        const local = resolve(specifier, absolute, rule.source?.start?.line);
        if (local) visit(local);
      });
      sheet.walkDecls(declaration => {
        for (const match of declaration.value.matchAll(/url\(\s*(?:["']([^"']+)["']|([^\s)]+))\s*\)/gi)) {
          const url = match[1] ?? match[2]!;
          if (remote(url)) continue;
          const asset = url.split(/[?#]/)[0]!;
          if (!asset) continue;
          visit(resolveFile(project, path.resolve(path.dirname(absolute), asset), absolute, declaration.source?.start?.line));
        }
      });
      return;
    }
    try {
      const inspectionSource = raw.replace(/\bimport\s+type\b/g, 'import').replace(/\bexport\s+type(?=\s*[{*])/g, 'export');
      const code = transformSync(inspectionSource, { loader: absolute.endsWith('.tsx') ? 'tsx' : absolute.endsWith('.ts') ? 'ts' : 'jsx', sourcefile: absolute, jsx: 'preserve', tsconfigRaw: { compilerOptions: { verbatimModuleSyntax: true } } }).code;
      // JSX is lowered only for static inspection; no evaluated import or project hook.
      const stripped = transformSync(code, { loader: 'jsx', sourcefile: absolute, jsx: 'transform' }).code;
      const tree = parse(stripped, { ecmaVersion: 'latest', sourceType: 'module', locations: true }) as any;
      const walk = (node: any) => {
        if (!node || typeof node !== 'object') return;
        const value = ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) ? node.source?.value : node.type === 'ImportExpression' ? node.source?.value : node.type === 'CallExpression' && node.callee?.name === 'require' ? node.arguments[0]?.value : undefined;
        if (typeof value === 'string') { const local = resolve(value, absolute, raw.split('\n').findIndex(line => line.includes(value)) + 1 || 1); if (local) visit(local); }
        if ((node.type === 'ImportExpression' || node.type === 'CallExpression' && node.callee?.name === 'require') && typeof value !== 'string') fail(absolute, 'dynamic imports must name a literal module so the closure can be frozen', node.loc?.start.line);
        for (const item of Object.values(node)) if (Array.isArray(item)) item.forEach(walk); else if (item && typeof item === 'object') walk(item);
      };
      walk(tree);
    } catch (error) { fail(absolute, error instanceof Error ? error.message : String(error)); }
  };
  visit(file); visit(css);
  if (dependencies.react) dependencies['react-dom'] = installed(project, 'react-dom', configFile).version;
  if (!exportsName(file, exported, new Set(), (entry) => transformSync(fs.readFileSync(entry, 'utf8'), { loader: entry.endsWith('.tsx') ? 'tsx' : 'ts', jsx: 'transform', sourcefile: entry }).code, (specifier, importer) => resolve(specifier, importer) ?? installed(project, specifier, importer).file)) fail(file, `module does not statically export '${exported}'`);
  const sorted = [...hashFiles].sort();
  return { project, base, style, themeRequirement: 'Dark component output needs an ancestor with both data-theme="dark" and class="dark"; shadcn parts retain their light palette in hc.', module: source.module, file: posix(path.relative(project, file)), css: posix(path.relative(project, css)), files: [...files].sort(), hashFiles: sorted, paths, dependencies, imports: [...imports].sort(), closureHash: shadcnClosureHash(project, sorted, dependencies) };
}
