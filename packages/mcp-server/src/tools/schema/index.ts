import { handle as saveHandle } from './save.js';
import { handle as loadHandle } from './load.js';
import { handle as listHandle } from './list.js';
import { handle as deleteHandle } from './delete.js';

/**
 * Grouped action-parameter tool for the schema family.
 *
 * Thin dispatcher over the retained per-action handlers (save, load, list,
 * delete). The framework validates `input` against schema.input.json before
 * this runs, so by the time we switch on `input.action` the action is already
 * a known enum member. The per-action handlers ignore the extra `action` key,
 * so `input` is passed straight through unchanged.
 *
 * The `default` branch is defensive only — AJV rejects unknown actions before
 * dispatch.
 */
export type SchemaAction = 'save' | 'load' | 'list' | 'delete';

export async function handle(input: any): Promise<any> {
  const action: SchemaAction = input?.action;
  switch (action) {
    case 'save':
      return saveHandle(input);
    case 'load':
      return loadHandle(input);
    case 'list':
      return listHandle(input);
    case 'delete':
      return deleteHandle(input);
    default: {
      // Exhaustiveness guard: if a new action is added to SchemaAction without
      // a case above, TypeScript flags `_exhaustive` as a type error here.
      const _exhaustive: never = action;
      throw new Error(`Unknown action: ${String(input?.action ?? _exhaustive)}`);
    }
  }
}
