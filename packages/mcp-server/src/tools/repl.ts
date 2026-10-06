import { handle as renderHandle } from './repl.render.js';
import { handle as validateHandle } from './repl.validate.js';
import type {
  ReplRenderInput,
  ReplRenderOutput,
  ReplValidateInput,
  ReplValidateOutput,
} from '../schemas/generated.js';

/**
 * Grouped action-parameter input for the consolidated `repl` tool.
 *
 * The framework validates this against src/schemas/repl.input.json (a oneof-by-
 * `action` if/then union over the exact per-action bodies) BEFORE we are called,
 * so by the time `handle` runs the payload is already a well-formed branch for
 * the selected action. We discriminate on `action` and forward the (still
 * fully-populated) input straight to the per-action handler, which ignores the
 * extra `action` key.
 */
export type ReplGroupedInput =
  | ({ action: 'render' } & ReplRenderInput)
  | ({ action: 'validate' } & ReplValidateInput);

export type ReplGroupedOutput = ReplRenderOutput | ReplValidateOutput;

export async function handle(input: any): Promise<any> {
  switch (input.action as ReplGroupedInput['action']) {
    case 'render':
      return renderHandle(input as ReplRenderInput);
    case 'validate':
      return validateHandle(input as ReplValidateInput);
    default: {
      // Defensive only: the registered input schema already rejects any action
      // outside the enum before this handler is reached. Kept for exhaustiveness.
      // TypeScript exhaustiveness check — if a new action is added to the union
      // above without a matching case, this `never` assignment fails compilation.
      const _exhaustive: never = input.action as never;
      throw new Error(`Unknown action: ${String(_exhaustive)}`);
    }
  }
}
