import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { load, JSON_SCHEMA } from 'js-yaml';

export type MapValue = Record<string, any>;
export const isMap = (value: unknown): value is MapValue => value !== null && typeof value === 'object' && !Array.isArray(value);
export const escapePointer = (value: string) => value.replace(/~/g, '~0').replace(/\//g, '~1');
export const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, entry) => isMap(entry) ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);
}
export type Origin = { file: string; pointer: string };
export type SourceInput = { path?: string; content?: string; name?: string };
export const MAX_SOURCE_BYTES = 128 * 1024 * 1024;
const MAX_INLINE_BYTES = 1024 * 1024;
const forbiddenPath = (value: string) => /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//') || value.includes('\\') || value.includes('\0');
export class ImportProblem extends Error {
  constructor(public readonly code: 'input' | 'reference' | 'unresolved' | 'size' | 'schema', message: string, public readonly origin?: Origin) {
    super(`${origin ? `${origin.file}#${origin.pointer}: ` : ''}${message}`);
  }
}
export type Document = { file: string; value: MapValue; bytes: number; sha256: string };

/** Files are read once, after containment and byte checks. There is no network resolver. */
export class Sources {
  readonly documents = new Map<string, Document>();
  readonly entries: string[];
  private readonly root: string | undefined;
  private bytes = 0;

  constructor(input: SourceInput) {
    if ((input.path === undefined) === (input.content === undefined)) throw new ImportProblem('input', 'Supply exactly one local path or inline content.');
    if (input.content !== undefined) {
      const bytes = Buffer.byteLength(input.content, 'utf8');
      if (bytes > MAX_INLINE_BYTES) throw new ImportProblem('size', 'Inline input exceeds 1 MiB; use a local file.');
      const name = input.name ?? 'Inline';
      if (forbiddenPath(name) || path.basename(name) !== name) throw new ImportProblem('input', 'An inline name must be a file name, without a path or URL.');
      this.entries = [name];
      this.parse(name, input.content, bytes);
    } else {
      if (!input.path || forbiddenPath(input.path)) throw new ImportProblem('input', 'Only local files or folders are accepted; URLs are refused.');
      const file = fs.realpathSync(input.path);
      const directory = fs.statSync(file).isDirectory();
      this.root = directory ? file : path.dirname(file);
      const files: string[] = [];
      const scan = (folder: string) => {
        for (const item of fs.readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
          const candidate = path.join(folder, item.name);
          // Do not follow directory symlinks or import arbitrary team code.
          if (item.isSymbolicLink()) throw new ImportProblem('reference', 'Symbolic links in source folders are refused.', { file: path.relative(this.root!, candidate), pointer: '' });
          if (item.isDirectory()) scan(candidate);
          else if (/\.(json|ya?ml)$/i.test(item.name)) files.push(path.relative(this.root!, candidate).split(path.sep).join('/'));
        }
      };
      if (directory) scan(file); else files.push(path.basename(file));
      if (!files.length) throw new ImportProblem('input', 'The folder contains no JSON or YAML files.');
      this.entries = files.sort();
      for (const name of this.entries) this.read(name);
    }
  }

  private parse(file: string, text: string, bytes: number): Document {
    let value: unknown;
    try { value = text.trimStart().startsWith('{') ? JSON.parse(text) : load(text, { schema: JSON_SCHEMA, json: false }); }
    catch (error) { throw new ImportProblem('input', `Invalid JSON/YAML: ${(error as Error).message}`, { file, pointer: '' }); }
    if (!isMap(value)) throw new ImportProblem('schema', 'The document must be a schema mapping.', { file, pointer: '' });
    const document = { file, value, bytes, sha256: hash(text) };
    this.documents.set(file, document);
    return document;
  }

  read(file: string, from?: Origin): Document {
    const cached = this.documents.get(file);
    if (cached) return cached;
    if (!this.root) throw new ImportProblem('reference', 'Inline input cannot reference another file; use a local source file.', from);
    if (forbiddenPath(file) || path.isAbsolute(file)) throw new ImportProblem('reference', 'Only relative references inside the source folder are accepted.', from);
    const candidate = path.resolve(this.root, file);
    const relative = path.relative(this.root, candidate);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new ImportProblem('reference', 'Reference leaves the source folder.', from);
    let real: string;
    try { real = fs.realpathSync(candidate); }
    catch { throw new ImportProblem('reference', `Referenced file does not exist: ${file}`, from); }
    const realRelative = path.relative(this.root, real);
    if (realRelative === '..' || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) throw new ImportProblem('reference', 'Reference follows a symbolic link outside the source folder.', from);
    const stat = fs.statSync(real);
    if (!stat.isFile()) throw new ImportProblem('reference', 'Reference must name a regular file.', from);
    if (stat.size + this.bytes > MAX_SOURCE_BYTES) throw new ImportProblem('size', 'Source files exceed the 128 MiB aggregate limit (checked before reading).', from ?? { file, pointer: '' });
    this.bytes += stat.size;
    const text = fs.readFileSync(real, 'utf8');
    if (Buffer.byteLength(text, 'utf8') > stat.size) throw new ImportProblem('size', 'Source changed size while being read.', from);
    return this.parse(file, text, stat.size);
  }

  ref(reference: string, from: Origin): { value: unknown; origin: Origin } {
    if (forbiddenPath(reference) || path.isAbsolute(reference)) throw new ImportProblem('reference', `Network and absolute references are refused: ${reference}`, from);
    const split = reference.indexOf('#');
    const rawFile = split < 0 ? reference : reference.slice(0, split);
    let fragment: string, decoded: string;
    try { decoded = decodeURIComponent(rawFile); fragment = split < 0 ? '' : decodeURIComponent(reference.slice(split + 1)); }
    catch { throw new ImportProblem('reference', `Malformed reference: ${reference}`, from); }
    if (forbiddenPath(decoded) || path.isAbsolute(decoded) || decoded.includes('?')) throw new ImportProblem('reference', `Only local relative file references are accepted: ${reference}`, from);
    const file = rawFile ? path.posix.normalize(path.posix.join(path.posix.dirname(from.file), decoded)) : from.file;
    let value: unknown = this.read(file, from).value;
    if (fragment && !fragment.startsWith('/')) throw new ImportProblem('reference', `Only JSON Pointer fragments are supported; named anchor "${fragment}" was not resolved.`, from);
    for (const part of fragment.split('/').slice(1)) {
      const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
      if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) throw new ImportProblem('unresolved', `Unresolved reference: ${reference}`, from);
      value = (value as MapValue)[key];
    }
    return { value, origin: { file, pointer: fragment } };
  }
}

/** Bounded traversal also refuses cyclic YAML aliases, while ordinary JSON $ref cycles remain valid. */
export function walk(value: unknown, visit: (value: unknown, pointer: string) => void, pointer = '', active = new Set<object>(), depth = 0, budget = { remaining: 10_000_000 }): void {
  if (--budget.remaining < 0) throw new ImportProblem('size', 'Document traversal exceeds ten million values (including YAML alias expansion).');
  if (depth > 160) throw new ImportProblem('size', `Document nesting exceeds 160 at ${pointer}.`);
  visit(value, pointer);
  if (value && typeof value === 'object') {
    if (active.has(value)) throw new ImportProblem('schema', `Cyclic YAML aliases are not JSON at ${pointer}; use $ref.`);
    active.add(value);
    for (const key of Object.keys(value).sort()) walk((value as MapValue)[key], visit, `${pointer}/${escapePointer(key)}`, active, depth + 1, budget);
    active.delete(value);
  }
}
