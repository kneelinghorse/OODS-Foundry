import { refuseMovedAction } from './action-moves.js';
/**
 * object — grouped action-parameter tool for the object registry.
 *
 * Thin dispatch layer over the per-action handlers: object.list and object.show read; object.validate checks a team's
 * object or trait definition, object.register keeps it in the team's folder and object.reload re-reads the folders
 * (s213-m03).
 * The framework validates `input` against object.input.json (a discriminated union keyed
 * on `action`) before this runs, and validates the returned result against
 * object.output.json after. We route on `input.action` and delegate unchanged — the extra
 * `action` key is ignored by the per-action handlers (their inputs only read named fields).
 *
 * Zero functionality loss: object.show's OODS-N005 did-you-mean (Levenshtein) lives in the
 * delegate and is preserved by delegation — it is not reimplemented here.
 */

import { handle as listHandle, type ObjectListInput, type ObjectListOutput } from './object.list.js';
import { handle as showHandle, type ObjectShowInput, type ObjectShowOutput } from './object.show.js';
import { handle as validateHandle, type ObjectValidateInput, type ObjectValidateOutput } from './object.validate.js';
import { handle as registerHandle, type ObjectRegisterInput, type ObjectRegisterOutput } from './object.register.js';
import { handle as reloadHandle, type ObjectReloadOutput } from './object.reload.js';

export type ObjectAction = 'list' | 'show' | 'validate' | 'register' | 'reload';

export type ObjectGroupedInput =
  | ({ action: 'list' } & ObjectListInput)
  | ({ action: 'show' } & ObjectShowInput)
  | ({ action: 'validate' } & ObjectValidateInput)
  | ({ action: 'register' } & ObjectRegisterInput)
  | { action: 'reload' };

export type ObjectGroupedOutput = ObjectListOutput | ObjectShowOutput | ObjectValidateOutput | ObjectRegisterOutput | ObjectReloadOutput;

export async function handle(input: any): Promise<ObjectGroupedOutput> {
  refuseMovedAction('object', input);
  const action = input?.action as ObjectAction;
  switch (action) {
    case 'list':
      // input carries the extra `action` key; object.list.handle ignores it.
      return listHandle(input as ObjectListInput);
    case 'show':
      return showHandle(input as ObjectShowInput);
    case 'validate':
      return validateHandle({ yaml: input.yaml });
    case 'register':
      return registerHandle({ yaml: input.yaml, ...(input.overwrite !== undefined ? { overwrite: input.overwrite } : {}) });
    case 'reload':
      return reloadHandle({});
    default: {
      // Defensive: AJV (object.input.json action enum) rejects unknown actions
      // before dispatch. This guards direct/programmatic callers and enforces
      // exhaustiveness — `never` errors at compile time if a case is unhandled.
      const _exhaustive: never = action;
      throw new Error(`Unknown action: ${String((_exhaustive as unknown) ?? input?.action)}`);
    }
  }
}
