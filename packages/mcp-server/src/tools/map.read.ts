import { handle as list } from './map.list.js';
import { handle as resolve } from './map.resolve.js';
import { handle as intake } from './map.intake.js';
import { requireAction } from './action-moves.js';

export async function handle(input: any) {
  requireAction(input, ['list', 'resolve', 'show'], 'component_map_read');
  if (input.action === 'list') return list(input);
  if (input.action === 'resolve') return resolve(input);
  return intake(input);
}
