/**
 * s249-m03 (Interfaces 6 and 8): what a declared ending (a grant's Revoke, objects/state-actions.ts) changes on its
 * object's own pages, alike in React, Vue and HTML.
 *
 * - On the detail page, a record the ending moved to (a revoked grant) whose ending seat names no one says so: "Ended by:
 *   This app was not told who ended it." A record is never silently nameless, and the words avoid the three a generated
 *   detail page must not show («Not recorded», «unavailable», «not resolved»). A record that names its ender, or one
 *   that ended another way (expired), reads as before.
 * - On the form, once a record is final, why it ended and who ended it are facts, not inputs: the store refuses a change
 *   to them then (codegen/workflow-data-emitter.ts). While the record is open, why it ended stays an input, for the person
 *   who ends it on the form.
 *
 * Three props say when a place is drawn, read by every renderer and never drawn as attributes (codegen/binding-utils.ts):
 * STATUSES_PROP (the record's state), OPENED_STATUSES_PROP (the state the record was in when the form opened, since the
 * form's own select may already show another) and WHEN_UNSET_PROP (the record holds no value for a field).
 */
import type { UiElement, UiSchema } from '../schemas/generated.js';
import { OMIT_EMPTY_PROP, OPENED_STATUSES_PROP, STATUSES_PROP, WHEN_UNSET_PROP } from '../codegen/binding-utils.js';
import { loadObject } from '../objects/object-loader.js';
import { declaredActions, declaredOrder, endsRecord } from '../objects/state-actions.js';
import { fieldLabel } from './label-generator.js';

/** The words a detail page says where an ended record's ending seat names no one. */
export const UNTOLD_ENDER = 'This app was not told who ended it.';

const valueField = (row: UiElement): string | undefined => {
  const value = row.children?.find(child => child.meta?.intent === 'read-only-field')?.props?.field;
  return typeof value === 'string' ? value : undefined;
};

/** Every node under a root, with its parent. */
function walk(node: UiElement, visit: (node: UiElement, parent?: UiElement) => void, parent?: UiElement): void {
  visit(node, parent);
  for (const child of node.children ?? []) walk(child, visit, node);
}

export function placeEndingFields(schema: UiSchema, objectName: string, context: string): void {
  let definition: ReturnType<typeof loadObject>;
  try { definition = loadObject(objectName); } catch { return; }
  const order = declaredOrder(definition);
  if (!order) return;
  const endings = declaredActions(definition).filter(action => endsRecord(action, order));
  if (!endings.length) return;
  const fields = schema.objectSchema ?? {};
  const label = (name: string) => fields[name]?.displayLabel ?? fieldLabel(name);
  const finals = Object.keys(order).filter(state => order[state]!.length === 0);
  const open = Object.keys(order).filter(state => order[state]!.length > 0);
  for (const screen of schema.screens) {
    if (context === 'detail') {
      for (const action of endings) {
        const name = action.bySeat ? `${action.bySeat}_name` : undefined;
        if (!name || !fields[name]) continue;
        walk(screen, (node, parent) => {
          // The row is a read-only row like its neighbours (its id ends -read-field, which the shared styles lay out).
          const base = node.id.replace(/-read-field$/, '');
          if (!parent || !node.id.endsWith('-read-field') || valueField(node) !== name || parent.children?.some(child => child.id === `${base}-untold-read-field`)) return;
          const heading = node.children?.find(child => child.meta?.intent !== 'read-only-field');
          const untold: UiElement = { id: `${base}-untold-read-field`, component: 'Stack', props: { [STATUSES_PROP]: action.to, [WHEN_UNSET_PROP]: name }, children: [
            { id: `${base}-untold-label`, component: 'Text', props: { ...(heading?.props ?? { as: 'strong', content: label(name) }) } },
            { id: `${base}-untold-value`, component: 'Text', props: { content: UNTOLD_ENDER } },
          ] };
          parent.children!.splice(parent.children!.indexOf(node) + 1, 0, untold);
        });
      }
    }
    if (context === 'form') {
      const reasons = [...new Set(endings.map(action => action.reasonField).filter((name): name is string => typeof name === 'string' && Boolean(fields[name])))];
      const seats = [...new Set(endings.map(action => action.bySeat ? `${action.bySeat}_name` : '').filter(name => name && fields[name]))];
      // Why it ended stays an input while the record is open.
      walk(screen, node => {
        const field = node.props?.field;
        if (typeof field === 'string' && reasons.includes(field) && node.meta?.intent !== 'read-only-field' && !node.id.endsWith('-read-field')) node.props = { ...node.props, [OPENED_STATUSES_PROP]: open.join(' ') };
      });
      // Once final, it and who ended it are facts, after the form's last fact (or first, where it has none).
      let host: UiElement | undefined;
      let after = -1;
      walk(screen, (node, parent) => { if (parent && node.meta?.intent === 'form-fact') { host = parent; after = parent.children!.indexOf(node); } });
      const facts: UiElement[] = [...reasons, ...seats].map(field => ({
        id: `${screen.id}-ended-${field}-read-field`, component: 'Stack', meta: { intent: 'form-fact' }, props: { [OMIT_EMPTY_PROP]: true, [OPENED_STATUSES_PROP]: finals.join(' ') },
        children: [
          { id: `${screen.id}-ended-${field}-label`, component: 'Text', props: { as: 'strong', content: label(field) } },
          { id: `${screen.id}-ended-${field}`, meta: { intent: 'read-only-field' }, component: 'Text', props: { field } },
        ],
      }));
      if (!facts.length) continue;
      const target: UiElement = host ?? screen;
      target.children = target.children ?? [];
      target.children.splice(host ? after + 1 : 0, 0, ...facts);
    }
  }
}
