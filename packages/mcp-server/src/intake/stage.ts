/** Immutable reviewed drafts shared by component and brand intake, separate from their active stores. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { canonical, hash } from '../importer/source.js';
const root = () => path.join(path.resolve(process.env.OODS_FOUNDRY_HOME || path.join(os.homedir(), '.oods-foundry')), 'intake');
export function stageIntake(kind: 'components'|'brand', value: unknown) {
  const text = canonical({ kind, version: 1, value }), draftId = `${kind}-${hash(text)}`;
  fs.mkdirSync(root(), { recursive:true, mode:0o700 });
  const file = path.join(root(), draftId + '.json');
  if (fs.existsSync(file)) readIntake(kind, draftId);
  else fs.writeFileSync(file, text, { flag:'wx', mode:0o600 });
  return { draftId, file };
}
export function readIntake<T>(kind: 'components'|'brand', draftId: string): T {
  if (!new RegExp(`^${kind}-[a-f0-9]{64}$`).test(draftId)) throw new Error('Invalid draftId; use the id returned by draft');
  const file = path.join(root(), draftId + '.json');
  if (fs.lstatSync(file).isSymbolicLink()) throw new Error('Staged symbolic links are refused');
  const text = fs.readFileSync(file, 'utf8');
  if (`${kind}-${hash(text)}` !== draftId) throw new Error('Draft hash mismatch; draft again before accepting');
  return JSON.parse(text).value;
}
