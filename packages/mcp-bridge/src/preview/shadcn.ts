import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

/** Checked by the server's static inspector; all paths except project are project-relative. */
export interface ShadcnClosure {
  framework?: 'react' | 'vue'; base?: 'radix' | 'base' | 'reka'; style?: string;
  project: string; module: string; file: string; css: string; files: string[]; hashFiles: string[];
  paths: Record<string, string[]>; dependencies: Record<string, string>; imports: string[]; closureHash: string;
}
export function shadcnFile(source: ShadcnClosure, relative: string): string {
  const project = fs.realpathSync(source.project);
  const file = fs.realpathSync(path.resolve(project, relative));
  if (!file.startsWith(project + path.sep)) throw new Error(`${relative}: source must stay inside the shadcn project`);
  return file;
}
export function shadcnHash(source: ShadcnClosure): string {
  if (!Array.isArray(source.hashFiles) || source.hashFiles.length > 10000) throw new Error('Invalid shadcn closure');
  const hash = createHash('sha256'); let bytes = 0;
  for (const file of [...source.hashFiles].sort()) {
    const content = fs.readFileSync(shadcnFile(source, file)); bytes += content.length;
    if (bytes > 64 * 1024 * 1024) throw new Error('Shadcn closure exceeds 64 MiB');
    hash.update(file).update('\0').update(content).update('\0');
  }
  hash.update(JSON.stringify(Object.fromEntries(Object.entries(source.dependencies).sort(([a], [b]) => a.localeCompare(b)))));
  return `sha256:${hash.digest('hex')}`;
}
export function shadcnAlias(source: ShadcnClosure, specifier: string): string | undefined {
  for (const [key, targets] of Object.entries(source.paths).sort(([a], [b]) => b.length - a.length)) {
    const star = key.indexOf('*');
    if (!(star < 0 ? specifier === key : specifier.startsWith(key.slice(0, star)) && specifier.endsWith(key.slice(star + 1)))) continue;
    const capture = star < 0 ? '' : specifier.slice(star, specifier.length - (key.length - star - 1));
    for (const target of targets) {
      const base = target.replace('*', capture);
      const relative = [base, ...['.vue', '.tsx', '.ts', '.js', '.jsx', '.json', '/index.ts', '/index.tsx'].map(ext => base + ext)].find(file => source.files.includes(file));
      if (relative) return shadcnFile(source, relative);
    }
    throw new Error(`Shadcn alias '${specifier}' is outside its checked closure`);
  }
  return undefined;
}

// Use the installed project's compiler and scanner, in its own process. This executes no package script.
const compileScript = String.raw`
const fs = require('node:fs'), path = require('node:path'), { createRequire } = require('node:module');

let input = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', part => input += part);
process.stdin.on('end', async () => { try {
  const source = JSON.parse(input);
  const entry = path.join(process.cwd(), source.css);
  const projectRequire = createRequire(entry);
  const tailwindFile = projectRequire.resolve('tailwindcss');
  const tailwindRequire = createRequire(tailwindFile);
  const { compile } = projectRequire('tailwindcss');
  // In an isolated pnpm graph the compiler helpers belong to the Vite/PostCSS integration,
  // not to tailwindcss itself. Both lookups stay in this project's installed dependency graph.
  const integration = ['@tailwindcss/vite', '@tailwindcss/postcss'].find(name => source.dependencies[name]);
  const integrationRequire = integration ? createRequire(projectRequire.resolve(integration)) : tailwindRequire;
  const helper = name => { try { return tailwindRequire.resolve(name); } catch { return integrationRequire.resolve(name); } };
  const nodeFile = helper('@tailwindcss/node');
  const nodeRequire = createRequire(nodeFile);
  const { loadModule } = nodeRequire(nodeFile);
  const { ResolverFactory, CachedInputFileSystem } = nodeRequire('enhanced-resolve');
  const resolver = ResolverFactory.createResolver({ fileSystem: new CachedInputFileSystem(fs, 4000), extensions: ['.css'], mainFields: ['style'], conditionNames: ['style'], exportsFields: ['exports'] });
  const { Scanner } = integrationRequire(helper('@tailwindcss/oxide'));
  const dependencyRoot = name => {
    try { return path.dirname(fs.realpathSync(projectRequire.resolve(name + '/package.json'))); }
    catch (error) {
      const file = projectRequire.resolve.paths(name).map(directory => path.join(directory, name, 'package.json')).find(file => fs.existsSync(file));
      if (!file) throw error;
      return path.dirname(fs.realpathSync(file));
    }
  };
  // Tailwind leaves url() imports external. Normalize them at every CSS load, keeping the importing
  // directory for both nested imports and assets; no team file is edited.
  const prepare = (text, base) => text
    .replace(/@import\s+url\(\s*(?:["']([^"']+)["']|([^\s)]+))\s*\)/gi, (all, quoted, bare) => {
      const id = quoted || bare;
      return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(id) ? all : '@import ' + JSON.stringify(id);
    })
    .replace(/url\(([^)]+)\)/gi, (all, raw) => {
      const id = raw.trim().replace(/^["']|["']$/g, '');
      if (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(id)) return all;
      return 'url(' + JSON.stringify(path.relative(path.dirname(entry), path.resolve(base, id)).split(path.sep).join('/')) + ')';
    });
  const compiler = await compile(prepare(fs.readFileSync(entry, 'utf8'), path.dirname(entry)), {
    base: path.dirname(entry), from: entry,
    loadModule: (id, base) => loadModule(id, base, () => {}),
    loadStylesheet: async (id, base) => {
      const file = await new Promise((resolve, reject) => resolver.resolve({}, base, id, {}, (error, file) => error ? reject(error) : resolve(file)));
      return { path: file, base: path.dirname(file), content: prepare(fs.readFileSync(file, 'utf8'), path.dirname(file)) };
    },
  });
  const scanner = new Scanner({ sources: [] });
  const candidates = scanner.scanFiles([...source.files.filter(file => /\.(tsx?|jsx?|vue)$/.test(file)).map(file => ({ content: fs.readFileSync(path.join(process.cwd(), file), 'utf8'), extension: path.extname(file).slice(1) })), { content: source.screen, extension: 'tsx' }]);
  let css = compiler.build(candidates);
  css = css.replace(/url\(([^)]+)\)/gi, (all, raw) => {
    const url = raw.trim().replace(/^['"]|['"]$/g, '');
    if (/^(?:data:|#)/i.test(url)) return all;
    if (/^(?:[a-z]+:|\/\/|\/)/i.test(url)) throw new Error('External stylesheet URL is not supported: ' + url);
    const file = path.resolve(path.dirname(entry), url.split(/[?#]/)[0]);
    const real = fs.realpathSync(file);
    const roots = [fs.realpathSync(process.cwd()), ...Object.keys(source.dependencies).map(dependencyRoot)];
    if (!roots.some(root => real.startsWith(root + path.sep))) throw new Error('Stylesheet asset escapes the shadcn project and its declared dependencies: ' + url);
    const bytes = fs.readFileSync(real);
    if (bytes.length > 8 * 1024 * 1024) throw new Error('Stylesheet asset exceeds 8 MiB: ' + url);
    const mime = { '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' }[path.extname(file)] || 'application/octet-stream';
    return 'url("data:' + mime + ';base64,' + bytes.toString('base64') + '")';
  });
  process.stdout.write(css);
} catch(error) { process.stderr.write(error.stack || String(error)); process.exitCode = 1; } });
`;
export async function compileShadcnCss(source: ShadcnClosure, screen: string): Promise<string> {
  const css = await new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', compileScript], { cwd: source.project, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, NODE_OPTIONS: '' } });
    let out = '', err = ''; let settled = false;
    const finish = (error?: Error) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(out); };
    const timer = setTimeout(() => { child.kill('SIGKILL'); finish(new Error(`${source.css}:1: Tailwind compiler exceeded 30 seconds`)); }, 30_000);
    child.on('error', error => finish(error));
    child.stdout.on('data', data => { out += data; if (Buffer.byteLength(out) > 32 * 1024 * 1024) { child.kill('SIGKILL'); finish(new Error('Tailwind output exceeds 32 MiB')); } });
    child.stderr.on('data', data => { err = (err + data).slice(-12000); });
    child.on('close', code => finish(code === 0 ? undefined : new Error(`${source.css}:1: Tailwind compiler failed: ${err}`)));
    child.stdin.on('error', () => {}); child.stdin.end(JSON.stringify({ css: source.css, files: source.files, dependencies: source.dependencies, screen }));
  });
  if (/@import\b/i.test(css) || [...css.matchAll(/url\(([^)]+)\)/gi)].some(match => !/^(?:data:|#)/i.test(match[1]!.trim().replace(/^['"]|['"]$/g, '')))) throw new Error(`${source.css}: compiled Tailwind stylesheet must inline imports and assets`);
  return css;
}
