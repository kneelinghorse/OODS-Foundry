import { refuseMovedAction } from './action-moves.js';
/**
 * map grouped MCP tool handler.
 *
 * Thin action-parameter dispatcher over the component-mapping registry family.
 * The framework binds ONE input/output schema per registered tool name; this
 * grouped tool reproduces every per-action body under an `action` discriminator
 * (src/schemas/map.input.json) and routes the validated payload to the
 * unchanged per-action handler. Zero functionality is added or removed here —
 * the per-action handlers and their schemas remain the source of truth.
 */
import { handle as intakeHandle, type MapIntakeInput } from './map.intake.js';
import { handle as applyHandle } from './map.apply.js';
import { handle as createHandle } from './map.create.js';
import { handle as listHandle } from './map.list.js';
import { handle as resolveHandle } from './map.resolve.js';
import { handle as updateHandle } from './map.update.js';
import { handle as deleteHandle } from './map.delete.js';
import type {
  MapApplyInput,
  MapApplyOutput,
  MapCreateInput,
  MapCreateOutput,
  MapCreateBatchInput,
  MapCreateBatchOutput,
  MapDeleteInput,
  MapDeleteOutput,
  MapListInput,
  MapListOutput,
  MapResolveInput,
  MapResolveOutput,
  MapUpdateInput,
  MapUpdateOutput,
} from './types.js';

type MapAction = 'draft' | 'show' | 'apply' | 'create' | 'list' | 'resolve' | 'update' | 'delete';

type MapGroupInput =
  | MapIntakeInput
  | ({ action: 'apply' } & MapApplyInput)
  | ({ action: 'create' } & (MapCreateInput | MapCreateBatchInput))
  | ({ action: 'list' } & MapListInput)
  | ({ action: 'resolve' } & MapResolveInput)
  | ({ action: 'update' } & MapUpdateInput)
  | ({ action: 'delete' } & MapDeleteInput);

type MapGroupOutput =
  | Awaited<ReturnType<typeof intakeHandle>>
  | MapApplyOutput
  | MapCreateOutput
  | MapCreateBatchOutput
  | MapListOutput
  | MapResolveOutput
  | MapUpdateOutput
  | MapDeleteOutput;

/**
 * Route a grouped `map` payload to the per-action handler named by `input.action`.
 * The framework validates `input` against map.input.json BEFORE this runs, so a
 * bad/missing action is already rejected; the default branch is purely defensive.
 * The extra `action` key is ignored by each per-action handler.
 */
export async function handle(input: MapGroupInput): Promise<MapGroupOutput> {
  refuseMovedAction('map', input);
  const action = (input as { action?: MapAction }).action;
  switch (action) {
    case 'draft':
    case 'show':
      return intakeHandle(input as MapIntakeInput);
    case 'apply':
      if ('draftId' in input) return intakeHandle(input as MapIntakeInput);
      return applyHandle(input as MapApplyInput);
    case 'create':
      return createHandle(input as MapCreateInput | MapCreateBatchInput);
    case 'list':
      return listHandle(input as MapListInput);
    case 'resolve':
      return resolveHandle(input as MapResolveInput);
    case 'update':
      return updateHandle(input as MapUpdateInput);
    case 'delete':
      return deleteHandle(input as MapDeleteInput);
    default: {
      // Exhaustiveness: every MapAction is handled above. If TypeScript stops
      // flagging this assignment, a new action was added without a case here.
      const _exhaustive: never = action as never;
      throw new Error(`Unknown action: ${String(_exhaustive)}`);
    }
  }
}
