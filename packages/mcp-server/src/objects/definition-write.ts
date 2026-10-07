import fs from 'node:fs';
import path from 'node:path';
import { ToolError } from '../errors/tool-error.js';
import { userObjectsFolder } from './object-loader.js';
import { userTraitsFolder } from './trait-loader.js';

/** Register and import share a filesystem lock, including across server processes using the same object folder. */
export async function withDefinitionWrite<T>(write: () => Promise<T>): Promise<T> {
  const folder = userObjectsFolder() ?? userTraitsFolder();
  if (!folder) return write(); // The operation returns its existing missing-folder diagnosis.
  fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, '.definition-write.lock');
  let fd: number;
  try { fd = fs.openSync(file, 'wx', 0o600); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new ToolError('OODS-C004', `Another definition write owns ${file}. Retry after it finishes; remove a stale lock only after confirming its server stopped.`);
    throw error;
  }
  try { fs.writeFileSync(fd, String(process.pid)); return await write(); }
  finally { fs.closeSync(fd); fs.rmSync(file, { force: true }); }
}
