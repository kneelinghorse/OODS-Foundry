import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { isMap } from './source.js';

/** Canonical JSON in bounded chunks: a large hub must not require a single V8 string. */
function* chunks(value: unknown): Generator<string> {
  if (Array.isArray(value)) {
    yield '[';
    for (let i = 0; i < value.length; i++) { if (i) yield ','; yield* chunks(value[i] === undefined ? null : value[i]); }
    yield ']';
  } else if (isMap(value)) {
    yield '{'; let first = true;
    for (const key of Object.keys(Object.fromEntries(Object.keys(value).sort().map(key => [key, 0])))) {
      if (value[key] === undefined) continue;
      if (!first) yield ','; first = false;
      yield JSON.stringify(key); yield ':'; yield* chunks(value[key]);
    }
    yield '}';
  } else yield JSON.stringify(value);
}
export function writeCanonical(file: string, value: unknown): string {
  const fd = fs.openSync(file, 'wx', 0o600), digest = createHash('sha256');
  let pending = '';
  const flush = () => { if (pending) { const bytes = Buffer.from(pending); fs.writeFileSync(fd, bytes); digest.update(bytes); pending = ''; } };
  try { for (const chunk of chunks(value)) { pending += chunk; if (pending.length >= 64 * 1024) flush(); } flush(); }
  finally { fs.closeSync(fd); }
  return digest.digest('hex');
}
export function hashStagedFile(file: string): string {
  if (fs.lstatSync(file).isSymbolicLink()) throw new Error('staged content is a symbolic link');
  const fd = fs.openSync(file, 'r'), digest = createHash('sha256'), buffer = Buffer.alloc(64 * 1024);
  try { let count: number; while ((count = fs.readSync(fd, buffer, 0, buffer.length, null))) digest.update(buffer.subarray(0, count)); }
  finally { fs.closeSync(fd); }
  return digest.digest('hex');
}
