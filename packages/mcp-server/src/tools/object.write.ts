import { handle as register } from './object.register.js';
import { requireAction } from './action-moves.js';

export async function handle(input: { action: string; yaml: string; overwrite?: boolean }) {
  requireAction(input, ['register'], 'object_register');
  return register(input);
}
