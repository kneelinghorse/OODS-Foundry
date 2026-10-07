/** Confined, bounded, read-once sources for component and token intake. Never resolves node_modules or runs code. */
import fs from 'node:fs';
import path from 'node:path';
import { parseExpression } from '@babel/parser';
import { canonical, hash } from '../importer/source.js';

export class IntakeFiles {
  readonly root: string;
  readonly files = new Map<string, { file: string; text: string; bytes: number; sha256: string }>();
  private bytes = 0;
  constructor(root: string) {
    if (!path.isAbsolute(root)) throw new Error('source.project must be an absolute local folder');
    this.root = fs.realpathSync(root);
    if (!fs.statSync(this.root).isDirectory()) throw new Error('source.project must be a folder');
  }
  absolute(file: string, exists = true): string {
    if (/^[a-z][a-z0-9+.-]*:/i.test(file) || file.includes('\\') || file.includes('\0')) throw new Error(`Only local source paths are allowed: ${file}`);
    const full = path.resolve(this.root, file);
    if (full !== this.root && !full.startsWith(this.root + path.sep)) throw new Error(`Source escapes project: ${file}`);
    let current = this.root;
    for (const part of path.relative(this.root, full).split(path.sep).filter(Boolean)) {
      current = path.join(current, part);
      if (fs.existsSync(current)) { if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`Source symbolic links are refused: ${file}`); }
      else if (exists) throw new Error(`Source file is missing: ${file}`);
    }
    return full;
  }
  has(file: string): boolean { return fs.existsSync(this.absolute(file, false)); }
  read(file: string): string {
    const full = this.absolute(file), relative = path.relative(this.root, full).split(path.sep).join('/');
    const cached = this.files.get(relative); if (cached) return cached.text;
    const size = fs.statSync(full).size;
    if (size > 8 * 1024 * 1024 || this.bytes + size > 128 * 1024 * 1024 || this.files.size >= 10000) throw new Error('Intake exceeds 8 MiB/file, 128 MiB or 10,000 files');
    const text = fs.readFileSync(full, 'utf8'); this.bytes += Buffer.byteLength(text);
    this.files.set(relative, { file: relative, text, bytes: Buffer.byteLength(text), sha256: hash(text) }); return text;
  }
  json(file: string): any {
    const tree = parseExpression(this.read(file));
    const data = (node: any): any => {
      if (['StringLiteral', 'NumericLiteral', 'BooleanLiteral'].includes(node.type)) return node.value;
      if (node.type === 'NullLiteral') return null;
      if (node.type === 'ArrayExpression') return node.elements.map(data);
      if (node.type === 'ObjectExpression') return Object.fromEntries(node.properties.map((prop: any) => {
        if (prop.type !== 'ObjectProperty' || prop.computed) throw new Error(`Not JSON data: ${file}`);
        return [prop.key.name ?? prop.key.value, data(prop.value)];
      }));
      if (node.type === 'UnaryExpression' && node.operator === '-') return -data(node.argument);
      throw new Error(`Not JSON data: ${file}`);
    };
    return data(tree);
  }
  scan(folder: string): string[] {
    const result: string[] = [];
    const visit = (relative: string, depth: number) => {
      if (depth > 30 || result.length > 10000) throw new Error('Component tree exceeds intake limit');
      for (const entry of fs.readdirSync(this.absolute(relative), { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
        if (['node_modules', '.git', '.next', '.nuxt', 'dist'].includes(entry.name)) continue;
        const file = path.posix.join(relative, entry.name);
        if (entry.isSymbolicLink()) throw new Error(`Source symbolic links are refused: ${file}`);
        if (entry.isDirectory()) visit(file, depth + 1);
        else if (/\.(?:[cm]?[jt]sx?|vue)$/.test(file)) result.push(file);
      }
    };
    visit(folder, 0); return result;
  }
  receipts() { return [...this.files.values()].map(({text: _text, ...entry}) => entry).sort((a,b) => a.file.localeCompare(b.file)); }
  contentHash() { return `sha256:${hash(canonical(this.receipts()))}`; }
}

/** JSONC paths, including Vite references; configuration outside the supplied root is refused before reading. */
export function intakePaths(files: IntakeFiles): Record<string, string[]> {
  const seen = new Set<string>();
  const visit = (file: string): Record<string, string[]> => {
    if (seen.has(file)) return {}; seen.add(file);
    const config = files.json(file), result: Record<string, string[]> = {};
    if (config.extends) {
      if (typeof config.extends !== 'string' || !config.extends.startsWith('.')) throw new Error(`${file}: only project-relative extends is supported`);
      const target = path.posix.join(path.posix.dirname(file), config.extends);
      Object.assign(result, visit(files.has(target) ? target : target + '.json'));
    }
    for (const [key, targets] of Object.entries(config.compilerOptions?.paths ?? {})) {
      if (!Array.isArray(targets) || targets.some(target => typeof target !== 'string')) throw new Error(`${file}: invalid paths for ${key}`);
      result[key] = targets.map(target => path.relative(files.root, files.absolute(path.join(path.dirname(file), config.compilerOptions.baseUrl ?? '.', target), false)).split(path.sep).join('/'));
    }
    if (!Object.keys(result).length) for (const ref of config.references ?? []) {
      const target = path.posix.join(path.posix.dirname(file), ref.path);
      Object.assign(result, visit(files.has(target + '.json') ? target + '.json' : target.endsWith('.json') ? target : path.posix.join(target, 'tsconfig.json')));
    }
    return result;
  };
  return files.has('tsconfig.json') ? visit('tsconfig.json') : files.has('jsconfig.json') ? visit('jsconfig.json') : {};
}
export function intakeAlias(paths: Record<string,string[]>, specifier: string): string | undefined {
  for (const [key, values] of Object.entries(paths).sort(([a],[b]) => b.length-a.length)) {
    const star = key.indexOf('*');
    if (star < 0 ? key === specifier : specifier.startsWith(key.slice(0,star)) && specifier.endsWith(key.slice(star+1))) return values[0]?.replace('*', star < 0 ? '' : specifier.slice(star,specifier.length-(key.length-star-1)));
  }
  return undefined;
}
export function intakeModule(files: IntakeFiles, target: string): string {
  for (const suffix of ['', '.tsx','.ts','.jsx','.js','.vue','/index.ts','/index.tsx','/index.js']) {
    const file = target + suffix;
    if (files.has(file) && fs.statSync(files.absolute(file)).isFile()) return file;
  }
  throw new Error(`No component module at ${target}`);
}
