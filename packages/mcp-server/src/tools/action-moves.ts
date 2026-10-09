import { ToolError } from '../errors/tool-error.js';

/** Migration refusals happen before validation and never dispatch the requested action. */
export const movedActions: Record<string, Record<string, string>> = {
  object: { register: 'object_register' },
  schema: { list: 'schema_read', load: 'schema_read' },
  map: { list: 'component_map_read', resolve: 'component_map_read', show: 'component_map_read' },
  'brand.intake': { template: 'brand_read', validate: 'brand_read', derive: 'brand_read', show: 'brand_read' },
  'object.import': { show: 'object_import_read' },
  'design.preview': { versions: 'design_versions' },
};

export function refuseMovedAction(tool: string, input: unknown): void {
  const action = (input as { action?: string } | null)?.action;
  const replacement = action && movedActions[tool]?.[action];
  if (replacement) throw new ToolError('OODS-V001', `The ${action} action moved. Call ${replacement} with the same arguments. Nothing was changed.`, { action, replacementTool: replacement });
}

export function requireAction(input: { action?: string }, actions: readonly string[], tool: string): void {
  if (!actions.includes(input?.action ?? '')) throw new ToolError('OODS-V001', `${tool} accepts ${actions.join(', ')}. Nothing was changed.`, { field: 'action' });
}
