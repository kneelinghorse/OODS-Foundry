import { fileURLToPath } from 'node:url';

export function managerEntries(entries = []) {
  return [...entries, fileURLToPath(new URL('./register.tsx', import.meta.url))];
}
