import { readHandle } from './object.import.js';

export function handle(input: Parameters<typeof readHandle>[0]) {
  return readHandle(input);
}
