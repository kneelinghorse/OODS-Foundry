import { readHandle } from './brand.intake.js';

export function handle(input: Parameters<typeof readHandle>[0]) {
  return readHandle(input);
}
