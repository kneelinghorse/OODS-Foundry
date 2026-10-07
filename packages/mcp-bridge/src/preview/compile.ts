import { compileShadcnCss, shadcnAlias, shadcnFile, shadcnHash } from './shadcn.js';
import { createHash } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { ComponentPackageError, packageContentHash, packageName, type ComponentPackage } from './component-packages.js';
import type { Plugin } from 'esbuild';
import { loadEsbuild } from './runtime.js';
import type { PreviewArtifact, PreviewFramework } from './store.js';

/** CSS the page already links (the prebuilt component-styles bundle), so the import is dropped. */
const DROPPED_IMPORTS = new Set(['@oods/component-styles/css']);
const LOADERS: Record<string, 'tsx' | 'ts' | 'js' | 'jsx' | 'json' | 'text' | 'css'> = { '.tsx': 'tsx', '.ts': 'ts', '.js': 'js', '.jsx': 'jsx', '.mjs': 'js', '.json': 'json', '.svg': 'text', '.css': 'css' };

export type CompileFormat = 'esm' | 'iife';

export interface CompiledModule {
  framework: PreviewFramework;
  entry: string;
  /** The artifact's content hash; the cache key with the format. */
  artifactContentHash: string;
  format: CompileFormat;
  code: string;
  sha256: string;
  bytes: number;
  /** Bare specifiers left for the page's import map (esm) or bound to the runtime globals (iife). */
  externals: string[];
  /** iife: the global the script assigns its exports to (`__oodsModules.<name>`). */
  globalName?: string;
  durationMs: number;
}

export { MODULES_GLOBAL, RUNTIME_GLOBAL, moduleGlobalName, moduleKey } from './module-globals.js';
import { RUNTIME_GLOBAL, moduleGlobalName } from './module-globals.js';

export class PreviewCompileError extends Error {
  constructor(message: string, readonly framework: PreviewFramework, readonly entry: string) { super(message); this.name = 'PreviewCompileError'; }
}

/** The mount entry: a workflow artifact carries its own main; a standalone one exports GeneratedUI. */
export function artifactEntry(artifact: PreviewArtifact): string {
  const paths = new Set(artifact.files.map(file => file.path));
  if (paths.has('package.json')) {
    const main = artifact.framework === 'react' ? 'src/main.tsx' : 'src/main.ts';
    if (!paths.has(main)) throw new PreviewCompileError(`Workflow artifact has no ${main}`, artifact.framework, main);
    return main;
  }
  const first = artifact.files[0]?.path;
  if (!first || !/\.(?:tsx|vue)$/.test(first)) throw new PreviewCompileError('Artifact has no framework source entry', artifact.framework, first ?? '');
  return first;
}

const cache = new Map<string, Promise<CompiledModule>>();

/**
 * Compile one generated artifact into one browser module. `esm` (the page): bare imports stay external for
 * the import map. `iife` (the MCP app under the default CSP, which allows inline scripts only): bare imports
 * bind to the inlined runtime's globals and the exports land on a per-artifact global, so the app injects
 * the text as an inline script and reads the component back.
 */
export function compileArtifact(artifact: PreviewArtifact, options: { format?: CompileFormat; componentPackages?: ComponentPackage[]; cacheDirectory?: string; runtimeImports?: string[] } = {}): Promise<CompiledModule> {
  const format = options.format ?? 'esm';
  if (options.componentPackages?.length && !/^sha256:[a-f0-9]{64}$/.test(artifact.contentHash)) throw new PreviewCompileError('Team artifact requires a valid content hash', artifact.framework, artifactEntry(artifact));
  const key = `${artifact.framework}:${format}:${artifact.contentHash}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = (async () => {
      const packages = (options.componentPackages ?? []).filter(entry => entry.framework === artifact.framework);
      const snapshot = packages.length && options.cacheDirectory ? path.join(options.cacheDirectory, `${artifact.contentHash.replace(/^sha256:/, '')}-${format}.json`) : undefined;
      if (snapshot && fs.existsSync(snapshot)) {
        const stored = JSON.parse(fs.readFileSync(snapshot, 'utf8')) as CompiledModule;
        if (stored.artifactContentHash !== artifact.contentHash || stored.format !== format || createHash('sha256').update(stored.code).digest('hex') !== stored.sha256) throw new PreviewCompileError('Stored team module snapshot failed its content hash', artifact.framework, artifactEntry(artifact));
        return stored;
      }
      for (const entry of packages) {
        try { if ((entry.shadcn ? shadcnHash(entry.shadcn) : packageContentHash(entry.directory)) !== entry.contentHash) throw new Error('changed after this preview version was recorded; open latest to record a new version'); }
        catch (error) { throw new ComponentPackageError(entry.name, error instanceof Error ? error.message : String(error)); }
      }
      const compiled = await compile(artifact, format, packages, options.runtimeImports);
      if (snapshot) {
        fs.mkdirSync(path.dirname(snapshot), { recursive: true });
        const temporary = `${snapshot}.${process.pid}.tmp`;
        fs.writeFileSync(temporary, JSON.stringify(compiled)); fs.renameSync(temporary, snapshot);
      }
      return compiled;
    })().catch(error => { cache.delete(key); throw error; });
    cache.set(key, pending);
  }
  return pending.then(compiled => {
    // The same bytes may have been compiled for another composition in this process. Persist this version too.
    if (options.componentPackages?.length && options.cacheDirectory) {
      const file = path.join(options.cacheDirectory, `${artifact.contentHash.slice(7)}-${format}.json`);
      if (!fs.existsSync(file)) { fs.mkdirSync(options.cacheDirectory, { recursive: true }); fs.writeFileSync(file, JSON.stringify(compiled), { flag: 'wx' }); }
    }
    return compiled;
  });
}

export function compiledCacheSize(): number { return cache.size; }

async function compile(artifact: PreviewArtifact, format: CompileFormat, packages: ComponentPackage[], runtimeImports = ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', 'vue', '@oods/components-react', '@oods/components-vue', '@oods/component-contracts', '@oods/component-styles']): Promise<CompiledModule> {
  const started = performance.now();
  const entry = artifactEntry(artifact);
  const files = new Map(artifact.files.map(file => [file.path, file.contents]));
  const externals = new Set<string>();
  const esbuild = await loadEsbuild();
  const sfc = artifact.framework === 'vue' ? await import('@vue/compiler-sfc') : undefined;
  const globalName = format === 'iife' ? moduleGlobalName(artifact.contentHash) : undefined;

  const styles: string[] = [];
  const projects = new Map<string, NonNullable<ComponentPackage['shadcn']>>();
  for (const entry of packages) if (entry.shadcn) {
    const prior = projects.get(entry.directory);
    projects.set(entry.directory, prior ? { ...prior, files: [...new Set([...prior.files, ...entry.shadcn.files])] } : entry.shadcn);
  }
  for (const source of projects.values()) {
    try { styles.push(await compileShadcnCss(source, [...files.values()].join('\n'))); }
    catch (error) { throw new ComponentPackageError(source.module, error instanceof Error ? error.message : String(error)); }
  }
  const plugin: Plugin = {
    name: 'oods-preview-artifact',
    setup(build) {
      build.onResolve({ filter: /.*/ }, async args => {
        if (args.pluginData?.resolvingTeam) return;
        if (args.namespace === 'oods-runtime-esm') return { path: args.path, external: true };
        if (args.kind === 'entry-point') return { path: args.path, namespace: 'artifact' };
        const shadcn = packages.find(entry => entry.shadcn && (entry.name === args.path || args.namespace === 'file' && entry.shadcn.files.includes(path.relative(entry.directory, args.importer).split(path.sep).join('/'))))?.shadcn;
        if (shadcn) {
          const mapped = args.path === shadcn.module;
          const resolved = mapped ? shadcnFile(shadcn, shadcn.file) : shadcnAlias(shadcn, args.path);
          if (resolved) {
            if (args.namespace === 'artifact' && !artifact.substitutions?.some(entry => entry.source.shadcn?.module === args.path && entry.packageContentHash === shadcn.closureHash)) return { errors: [{ text: `Shadcn import ${args.path} is not bound to this artifact's closure hash` }] };
            return { path: resolved, namespace: 'file' };
          }
        }
        const team = packages.find(entry => !entry.shadcn && entry.name === packageName(args.path));
        if (team) {
          const declared = artifact.substitutions?.find(entry => entry.source.package === args.path && entry.source.version === team.version && entry.packageContentHash === team.contentHash);
          if (args.namespace === 'artifact' && !declared) return { errors: [{ text: `Team import ${args.path} is not bound to this artifact's package hash` }] };
          const resolve = (specifier: string) => build.resolve(specifier, { resolveDir: team.directory, kind: 'import-statement', pluginData: { resolvingTeam: true } });
          let resolved = await resolve(args.path);
          // Local packages without an exports map cannot self-reference by name. Let esbuild honor their main/browser fields.
          if (resolved.errors.length && JSON.parse(fs.readFileSync(path.join(team.directory, 'package.json'), 'utf8')).exports === undefined) {
            resolved = await resolve(path.join(team.directory, args.path.slice(team.name.length)));
          }
          if (resolved.errors.length) return { errors: [{ text: `Team package ${team.name}: ${resolved.errors.map(error => error.text).join('; ')}` }] };
          return { path: resolved.path, namespace: 'file' };
        }
        if (args.namespace === 'file' && !runtimeImports.includes(args.path) && !DROPPED_IMPORTS.has(args.path)) return;
        if (args.namespace === 'artifact' && artifact.substitutions?.some(entry => entry.source.package === args.path)) return { errors: [{ text: `Team package ${args.path} has no recorded package snapshot` }] };
        if (args.path.startsWith('.') || args.path.startsWith('/')) {
          const base = path.posix.normalize(path.posix.join(path.posix.dirname(args.importer), args.path));
          const found = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.vue`, `${base}/index.ts`, `${base}/index.tsx`].find(candidate => files.has(candidate));
          if (!found) return { errors: [{ text: `Artifact import not found: ${args.path} (from ${args.importer})` }] };
          return { path: found, namespace: 'artifact' };
        }
        if (DROPPED_IMPORTS.has(args.path)) return { path: args.path, namespace: 'oods-dropped' };
        externals.add(args.path);
        // iife: the bare import becomes the runtime global (a CommonJS shim, so named and default imports both resolve through esbuild's interop).
        if (format === 'iife') return { path: args.path, namespace: 'oods-runtime' };
        // A CommonJS dependency cannot require an ESM external in the browser. Bind it to the same import-map namespace.
        if (args.kind === 'require-call' && runtimeImports.includes(args.path)) return { path: args.path, namespace: 'oods-runtime-esm' };
        return { path: args.path, external: true };
      });
      build.onLoad({ filter: /.*/, namespace: 'oods-runtime-esm' }, args => ({ contents: `import * as runtime from ${JSON.stringify(args.path)}; module.exports = runtime;`, loader: 'js' }));
      build.onLoad({ filter: /.*/, namespace: 'oods-dropped' }, () => ({ contents: 'export {};', loader: 'js' }));
      build.onLoad({ filter: /.*/, namespace: 'oods-runtime' }, args => ({ contents: `const runtime = globalThis.${RUNTIME_GLOBAL}; if (!runtime || !runtime[${JSON.stringify(args.path)}]) throw new Error(${JSON.stringify(`The preview app runtime does not provide ${args.path}`)}); module.exports = runtime[${JSON.stringify(args.path)}];`, loader: 'js' }));
      build.onLoad({ filter: /\.vue$/, namespace: 'file' }, args => {
        if (!sfc) return { errors: [{ text: `A Vue team component cannot be bundled into ${artifact.framework}` }] };
        const source = [...projects.values()].find(source => source.files.includes(path.relative(source.project, args.path).split(path.sep).join('/')));
        if (!source) return { errors: [{ text: `Vue source is outside its checked closure: ${args.path}` }] };
        const { descriptor, errors } = sfc.parse(fs.readFileSync(shadcnFile(source, path.relative(source.project, args.path)), 'utf8'), { filename: args.path });
        if (errors.length) return { errors: errors.map(error => ({ text: String(error) })) };
        if (descriptor.styles.length || descriptor.script?.src || descriptor.template?.src) return { errors: [{ text: 'Shadcn Vue sources must keep styles in tailwind.css and scripts/templates inline' }] };
        // Imported prop types require TypeScript's resolver from the accepted project's installation.
        sfc.registerTS(() => createRequire(path.join(source.project, 'package.json'))('typescript'));
        const id = `oods-${createHash('sha256').update(args.path).digest('hex').slice(0, 8)}`;
        if (!descriptor.script && !descriptor.scriptSetup) {
          const template = sfc.compileTemplate({ source: descriptor.template?.content ?? '', filename: args.path, id });
          if (template.errors.length) return { errors: template.errors.map(error => ({ text: String(error) })) };
          return { contents: `${template.code}\nexport default { render };`, loader: 'js', resolveDir: path.dirname(args.path) };
        }
        const script = sfc.compileScript(descriptor, { id, inlineTemplate: true, templateOptions: { compilerOptions: { mode: 'module' } }, fs: { fileExists: fs.existsSync, readFile: file => fs.readFileSync(file, 'utf8') } });
        return { contents: script.content, loader: script.lang === 'ts' ? 'ts' : 'js', resolveDir: path.dirname(args.path) };
      });
      build.onLoad({ filter: /\.css$/, namespace: 'file' }, args => {
        const css = fs.readFileSync(args.path, 'utf8');
        if (/@import\b/i.test(css) || [...css.matchAll(/url\(([^)]+)\)/gi)].some(match => !/^(?:data:|#)/i.test(match[1]!.trim().replace(/^['"]|['"]$/g, '')))) return { errors: [{ text: `Team stylesheet ${args.path} must inline its imported styles and assets before previewing` }] };
        return { contents: `const style = document.createElement('style'); style.textContent = ${JSON.stringify(css)}; document.head.appendChild(style);`, loader: 'js' };
      });
      build.onLoad({ filter: /.*/, namespace: 'artifact' }, args => {
        const contents = files.get(args.path)!;
        const extension = path.posix.extname(args.path);
        const resolveDir = path.posix.dirname(args.path);
        if (extension === '.vue') {
          if (!sfc) return { errors: [{ text: `A .vue file inside a ${artifact.framework} artifact: ${args.path}` }] };
          const { descriptor, errors } = sfc.parse(contents, { filename: args.path });
          if (errors.length) return { errors: errors.map(error => ({ text: `${args.path}: ${(error as Error).message ?? String(error)}` })) };
          const id = `oods-${createHash('sha256').update(args.path).digest('hex').slice(0, 8)}`;
          // A workflow component imports types from the artifact's own modules (s205-m02); the SFC compiler resolves them
          // through `fs`, answered from the artifact's files rather than the disk.
          const artifactPath = (file: string) => path.posix.normalize(file.replace(/^\/+/, ''));
          const script = sfc.compileScript(descriptor, { id, inlineTemplate: true, templateOptions: { compilerOptions: { mode: 'module' } },
            fs: { fileExists: file => files.has(artifactPath(file)), readFile: file => files.get(artifactPath(file)) } });
          let code = script.content;
          const css = descriptor.styles.map(style => sfc.compileStyle({ source: style.content, filename: args.path, id, scoped: style.scoped }).code).join('\n');
          if (css.trim()) code += `\n;(() => { const style = document.createElement('style'); style.dataset.oodsSfc = ${JSON.stringify(args.path)}; style.textContent = ${JSON.stringify(css)}; document.head.appendChild(style); })();\n`;
          return { contents: code, loader: script.lang === 'ts' ? 'ts' : 'js', resolveDir };
        }
        // s205-m02: a workflow app imports its own stylesheet (src/app.css). Bundled with no output file esbuild cannot
        // emit it, and the browser page links only the runtime's styles, so the sheet is applied the way a Vue SFC's
        // styles are above. Until s205-m01 a workflow preview recorded and showed its LIST screen, which is why no
        // workflow ever reached this line.
        if (extension === '.css') return { contents: `const style = document.createElement('style'); style.dataset.oodsArtifactCss = ${JSON.stringify(args.path)}; style.textContent = ${JSON.stringify(contents)}; document.head.appendChild(style);\nexport {};\n`, loader: 'js', resolveDir };
        const loader = LOADERS[extension];
        if (!loader) return { errors: [{ text: `No loader for ${args.path}` }] };
        return { contents, loader, resolveDir };
      });
    },
  };

  let result: Awaited<ReturnType<typeof esbuild.build>>;
  try {
    result = await esbuild.build({
      entryPoints: [entry], bundle: true, write: false, format, platform: 'browser', target: 'es2022',
      ...(globalName ? { globalName } : {}),
      jsx: 'automatic', tsconfigRaw: {}, plugins: [plugin], logLevel: 'silent', legalComments: 'none',
      define: { 'process.env.NODE_ENV': '"production"' },
    });
  } catch (error) {
    const failure = error as { errors?: Array<{ text: string; location?: { file?: string; line?: number } | null }> };
    const text = Array.isArray(failure.errors) && failure.errors.length
      ? failure.errors.map(item => `${(item.location?.file ?? entry).replace(/^artifact:/, '')}:${item.location?.line ?? 0}: ${item.text}`).join('\n')
      : error instanceof Error ? error.message : String(error);
    throw new PreviewCompileError(`${artifact.framework} artifact failed to compile:\n${text}`, artifact.framework, entry);
  }
  const output = result.outputFiles?.[0];
  if (!output) throw new PreviewCompileError('esbuild produced no output', artifact.framework, entry);
  const code = output.text + styles.map(css => `\n;(() => { const style = document.createElement('style'); style.dataset.oodsShadcn = 'true'; style.textContent = ${JSON.stringify(css)}; document.head.appendChild(style); })();`).join('');
  return {
    framework: artifact.framework, entry, artifactContentHash: artifact.contentHash, format, code,
    sha256: createHash('sha256').update(code).digest('hex'), bytes: Buffer.byteLength(code),
    externals: [...externals].sort(), ...(globalName ? { globalName } : {}), durationMs: performance.now() - started,
  };
}
