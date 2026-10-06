import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { SchemaStore } from '../schema-store/index.js';

/**
 * Payload-to-file (Sprint 201 m06, the Sprint 200 residue on large `code.generate` and rendered-document
 * payloads): a tool asked for `payloadMode: 'file'` writes its large output beside the saved-schema store
 * (`<store>/../payloads/<tool>-<digest>/`) and returns file references instead of the bytes. The store
 * root follows the same env as schemas and compositions, so the files land where the caller's other
 * Forge state already lives and never inside the runtime bundle.
 */
export type PayloadMode = 'inline' | 'file';
export interface PayloadFileRef { path: string; bytes: number; sha256: string }
export interface PayloadReceipt { mode: 'file'; directory: string; bytes: number; files: PayloadFileRef[] }

const SAFE_SEGMENT = /^(?!\.\.?$)[A-Za-z0-9._-]+$/;

export function resolvePayloadsDir(env: NodeJS.ProcessEnv = process.env): string {
  const store = new SchemaStore({
    ...(env.MCP_SCHEMA_STORE_ROOT ? { projectRoot: env.MCP_SCHEMA_STORE_ROOT } : {}),
    ...(env.MCP_SCHEMA_STORE_DIR ? { storeDir: env.MCP_SCHEMA_STORE_DIR } : {}),
  });
  return path.resolve(store.storeDir, '..', 'payloads');
}

export const payloadDigest = (value: string): string => createHash('sha256').update(value).digest('hex').slice(0, 12);

/** Write one payload directory; every file path must be a safe relative POSIX path. Overwrites an identical earlier write. */
export function writePayload(name: string, files: ReadonlyArray<{ path: string; contents: string; encoding?: 'base64' }>, env: NodeJS.ProcessEnv = process.env): PayloadReceipt {
  if (!SAFE_SEGMENT.test(name)) throw new Error(`Unsafe payload name: ${name}`);
  const directory = path.join(resolvePayloadsDir(env), name);
  const refs: PayloadFileRef[] = [];
  fs.mkdirSync(directory, { recursive: true });
  for (const file of files) {
    const segments = file.path.split('/');
    if (!segments.length || segments.some(segment => !SAFE_SEGMENT.test(segment))) throw new Error(`Unsafe payload path: ${file.path}`);
    const target = path.join(directory, ...segments);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const bytes = Buffer.from(file.contents, file.encoding ?? 'utf8');
    fs.writeFileSync(target, bytes);
    refs.push({ path: file.path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  return { mode: 'file', directory, bytes: refs.reduce((sum, ref) => sum + ref.bytes, 0), files: refs };
}
