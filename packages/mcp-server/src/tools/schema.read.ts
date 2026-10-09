import { handle as list } from './schema/list.js';
import { handle as load } from './schema/load.js';
import { requireAction } from './action-moves.js';

export async function handle(input: any) {
  requireAction(input, ['list', 'load'], 'schema_read');
  return input.action === 'list' ? list(input) : load(input);
}
