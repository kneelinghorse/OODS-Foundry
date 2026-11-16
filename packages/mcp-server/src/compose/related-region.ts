/**
 * s249-m02: the region that draws an object's related lists (Interface 3). A detail page of an object that declares
 * `metadata.relatedLists` ends, after the record's own panels, with one `related` collection: the renderers draw from the
 * resolved lists the screen is given (`related`, worked out by the shared core, @oods/component-contracts
 * resolveRelatedListRows) one labelled section per list, in the declared order, each with its heading, count, rows and
 * its own note, and then, once for the page, what no list here can see and, in a generated app, that other objects'
 * records were copied. React, Vue and HTML write the same words. Lists go on the detail context, and so on a generated
 * app's detail screen, and on no other context.
 */
import type { UiElement, UiSchema } from '../schemas/generated.js';
import { loadObject } from '../objects/object-loader.js';
import type { RelatedList } from '../objects/types.js';
import { relatedListWarnings } from './related-records.js';

export const RELATED_LISTS_INTENT = 'related-lists';

/** The declared lists of an object, or none when it declares none or is no registered object. */
export function declaredRelatedLists(objectName: string | undefined): RelatedList[] {
  if (!objectName) return [];
  try { return (loadObject(objectName).metadata?.relatedLists ?? []) as RelatedList[]; } catch { return []; }
}

/** Place the object's related lists at the end of each detail screen; returns the warnings their declarations give. */
export function populateRelatedLists(schema: UiSchema, objectName: string): string[] {
  const lists = declaredRelatedLists(objectName);
  if (!lists.length) return [];
  for (const screen of schema.screens) {
    const region: UiElement = { id: `${screen.id}-related`, component: 'Stack', meta: { intent: RELATED_LISTS_INTENT }, collection: { source: 'related', keyField: 'key', labelField: 'title' } };
    screen.children = [...(screen.children ?? []), region];
  }
  return relatedListWarnings(objectName);
}
