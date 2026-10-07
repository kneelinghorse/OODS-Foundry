import type { FieldSchemaEntry, UiElement, UiSchema } from '../schemas/generated.js';
import type { CodegenOptions } from './types.js';
import { listObjects } from '../objects/object-loader.js';
import { cancellableStates } from '../objects/cancellation-mode.js';
import { javascriptSingleQuotedString } from './emission-safety.js';

/**
 * The shell of a standalone generated screen (Sprint 202 m01): one `main` landmark around the screen and one
 * level-one heading. The composer names every screen root (`meta.label`) after its object and context; a
 * screen that places its own level-one heading (a detail's record title) keeps it, any other screen's shell
 * renders the label as its `h1`. Workflow screens are embedded in the workflow app, which owns both.
 */
export interface ScreenShell {
  screenId: string;
  /** The heading the shell renders; undefined when the screen tree already carries a level-one heading or has no label. */
  heading?: string;
}

/** "Subscription" from "Subscription", "Address Entry" from "AddressEntry". */
export function objectLabel(object: string): string {
  return object.replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim();
}

/** The plural the workflow app also uses for its list heading, with the common English endings. */
export function pluralLabel(label: string): string {
  if (/s$/i.test(label) && !/(?:ss|us)$/i.test(label)) return label;
  if (/(?:s|x|z|ch|sh)$/i.test(label)) return `${label}es`;
  if (/[^aeiou]y$/i.test(label)) return `${label.slice(0, -1)}ies`;
  return `${label}s`;
}

/** The page title of one screen: the object's plural for a list, the object with its context otherwise. */
export function screenTitle(object: string, context: string | undefined): string {
  const label = objectLabel(object);
  switch (context) {
    case 'list': return pluralLabel(label);
    case 'form': return `${label} form`;
    case 'timeline': return `${label} timeline`;
    default: return label;
  }
}

const contextFromId = (id: string): string | undefined => /^screen-([a-z]+)-\d+$/.exec(id)?.[1];

/**
 * s219-m01: the object a composition's records belong to. A workflow names it; a standalone screen carries its object's
 * title as its label (labelScreens). A label that is no object's title names no object.
 */
export function compositionObject(schema: UiSchema): string | undefined {
  if (schema.workflow?.object) return schema.workflow.object;
  for (const screen of schema.screens) {
    const label = screen.meta?.label;
    if (typeof label !== 'string') continue;
    const object = listObjects().find(name => screenTitle(name, contextFromId(screen.id)) === label);
    if (object) return object;
  }
  return undefined;
}

/**
 * s219-m01: every renderer names cancellation by the record's object ("Cancel subscription"). React said "Cancel record"
 * where Vue and HTML said "Cancel subscription", because only they guessed the object from a subscription_id field.
 */
export function cancelActionLabel(object: string | undefined): string {
  return object ? `Cancel ${objectLabel(object).toLowerCase()}` : 'Cancel record';
}

/** Name every screen root after its object and context; an authored label is kept. */
export function labelScreens(schema: UiSchema, object: string | undefined, context: string | undefined): void {
  if (!object) return;
  for (const screen of schema.screens) {
    if (screen.meta?.label) continue;
    const screenContext = context && context !== 'workflow' ? context : contextFromId(screen.id);
    screen.meta = { ...(screen.meta ?? {}), label: screenTitle(object, screenContext) };
  }
}

const level = (value: unknown): number | undefined => typeof value === 'number' ? value : typeof value === 'string' && /^h[1-6]$/.test(value) ? Number(value.slice(1)) : undefined;

/** Whether a node renders a level-one heading: a DetailHeader or CardHeader at level 1, a Text or Heading as h1. */
export function isLevelOneHeading(node: UiElement): boolean {
  const props = node.props ?? {};
  if (node.component === 'DetailHeader' || node.component === 'CardHeader') return level(props.headingLevel) === 1 || level(props.level) === 1 || level(props.as) === 1;
  if (node.component === 'Text' || node.component === 'Heading') return level(props.as) === 1 || level(props.level) === 1;
  return false;
}

export function hasLevelOneHeading(nodes: readonly UiElement[]): boolean {
  return nodes.some(node => isLevelOneHeading(node) || hasLevelOneHeading(node.children ?? []));
}

/** The shell a standalone emission wraps its screens in; none for a workflow screen (the app is the shell). */
export function screenShell(schema: Pick<UiSchema, 'screens'>, options: Pick<CodegenOptions, 'workflowCollections'>): ScreenShell | undefined {
  if (options.workflowCollections) return undefined;
  const first = schema.screens[0];
  if (!first) return undefined;
  const label = typeof first.meta?.label === 'string' && first.meta.label.trim() ? first.meta.label.trim() : undefined;
  return { screenId: first.id, ...(label && !hasLevelOneHeading(schema.screens) ? { heading: label } : {}) };
}

/** The intent the composer gives the row of badges (status, price) it places under a record's title. */
export const RECORD_SUMMARY_INTENT = 'record-summary';

/**
 * Where a screen's actions render (s211-m02): after the record summary under the title when the composer placed one,
 * else after the level-one record title, else after the screen's content, as before. Each emitter marks the two anchors
 * as it writes them and puts the action bar at the first that the screen root's code carries.
 */
export type ScreenActionAnchor = 'summary' | 'title';

export function screenActionAnchor(node: UiElement): ScreenActionAnchor | undefined {
  if (node.state !== undefined) return undefined;
  if (node.meta?.intent === RECORD_SUMMARY_INTENT) return 'summary';
  return node.component === 'DetailHeader' && isLevelOneHeading(node) ? 'title' : undefined;
}

/** A screen action's design-system Button intent: Edit leads, a destructive Delete is the danger intent. */
export function screenActionIntent(event: string): 'primary' | 'secondary' | 'danger' {
  return event === 'onEdit' ? 'primary' : event === 'onDelete' ? 'danger' : 'secondary';
}

/**
 * s221-m01 (#2479, learning #781): what a screen action's button says. Inside a workflow app the Delete binding archives
 * the record (the store's archive), so it says Archive; the relabel the workflow once made in its output stopped matching
 * when the bar became the design system's Button (s211-m02), and the app said Delete for an archive. A standalone screen's
 * host decides what Delete does.
 */
export function screenActionLabel(event: string, objectName: string | undefined, workflow: boolean, labels: Readonly<Record<string, string>>): string {
  if (event === 'onCancel') return cancelActionLabel(objectName);
  if (event === 'onDelete' && workflow) return 'Archive';
  return labels[event] ?? event;
}

/**
 * s221-m01 (#2479, learning #781): the record state a screen action needs, read from the object's own fields, or undefined
 * when no state governs it. Cancel needs a status its lifecycle can still cancel from (cancellableStates, the rule the
 * generated store enforces) and a record that is not archived; inside a workflow app the archiving action needs a record
 * not archived yet. `never` means no status allows the action, so it is not rendered.
 */
export interface ScreenActionGate { statuses?: readonly string[]; notArchived?: boolean; never?: boolean }

export function screenActionGate(event: string, objectSchema: Record<string, FieldSchemaEntry> | undefined, workflow: boolean): ScreenActionGate | undefined {
  const archivable = objectSchema?.is_archived?.type === 'boolean';
  if (event === 'onCancel') {
    const states = objectSchema?.status?.enum?.map(String);
    const statuses = states?.length ? cancellableStates(states) : undefined;
    if (statuses?.length === 0) return { never: true };
    if (!statuses && !archivable) return undefined;
    return { ...(statuses ? { statuses } : {}), ...(archivable ? { notArchived: true } : {}) };
  }
  if (event === 'onDelete' && workflow && archivable) return { notArchived: true };
  return undefined;
}

/** The expression a gated action renders under, over the screen's record props (`status`, `isArchived`). */
export function screenActionCondition(gate: ScreenActionGate): string {
  return [
    ...(gate.statuses ? [`[${gate.statuses.map(javascriptSingleQuotedString).join(', ')}].includes(String(status))`] : []),
    ...(gate.notArchived ? ['!isArchived'] : []),
  ].join(' && ');
}

/** The leading action first and the destructive one last; the rest keep their binding order. */
export function orderScreenActions<T extends { event: string }>(occurrences: readonly T[]): T[] {
  const rank = { primary: 0, secondary: 1, danger: 2 } as const;
  return [...occurrences].sort((a, b) => rank[screenActionIntent(a.event)] - rank[screenActionIntent(b.event)]);
}

/**
 * Put `surface` where the first anchor marker sits in `code` (the summary's before the title's), indented as the marker
 * was. Undefined when the code carries neither marker.
 */
export function placeAtAnchor(code: string, markers: Readonly<Record<ScreenActionAnchor, string>>, surface: string): string | undefined {
  for (const anchor of ['summary', 'title'] as const) {
    const at = code.indexOf(markers[anchor]);
    if (at < 0) continue;
    const lineStart = code.lastIndexOf('\n', at) + 1;
    const pad = code.slice(lineStart, at);
    return code.slice(0, lineStart) + surface.split('\n').map(line => pad + line).join('\n') + code.slice(at + markers[anchor].length);
  }
  return undefined;
}

/** Drop the anchor markers no action bar took. */
export function stripAnchors(code: string, markers: Readonly<Record<ScreenActionAnchor, string>>): string {
  const pattern = Object.values(markers).map(marker => marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return code.replace(new RegExp(`^[ \\t]*(?:${pattern})\\n?`, 'gm'), '');
}
