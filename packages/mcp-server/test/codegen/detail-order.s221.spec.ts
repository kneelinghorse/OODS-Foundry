/**
 * s221-m02 (#2482 ruling 7; the website's Warehouse, message dfc707d1, and the Sprint 219 review): a record's details
 * open with the fields its object declares, in the order its team wrote them, and end with the record's times.
 *
 * Why: the quickstart's Warehouse is the website's first screen. At 0.3.2 its Details tab opened with "Updated at" and
 * put "Code", the site code printed on shipping labels, ninth, below three timestamps: the composer listed the rows a
 * layout slot placed first and the object's own fields after the fields its traits add.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearObjectCache } from '../../src/objects/object-loader.js';
import { clearTraitCache } from '../../src/objects/trait-loader.js';
import { handle as compose } from '../../src/tools/design.compose.js';

const root = path.resolve(import.meta.dirname, '../../../..');
const QUICKSTART = path.join(root, 'packages/foundry/quickstart');
type Node = { id: string; component: string; props?: Record<string, unknown>; children?: Node[] };

let home: string;
beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s221-m02-'));
  process.env.OODS_OBJECTS_DIR = path.join(home, 'objects');
  process.env.OODS_TRAITS_DIR = path.join(home, 'traits');
  process.env.MCP_SCHEMA_STORE_ROOT = home;
  process.env.MCP_MAPPINGS_PATH = path.join(home, 'absent-mappings.json');
  for (const [kind, name] of [['objects', 'Warehouse.object.yaml'], ['traits', 'Stockable.trait.yaml']] as const) {
    fs.mkdirSync(path.join(home, kind), { recursive: true });
    fs.copyFileSync(path.join(QUICKSTART, name), path.join(home, kind, name));
  }
  clearObjectCache(); clearTraitCache();
});
afterEach(() => {
  for (const name of ['OODS_OBJECTS_DIR', 'OODS_TRAITS_DIR', 'MCP_SCHEMA_STORE_ROOT', 'MCP_MAPPINGS_PATH']) delete process.env[name];
  clearObjectCache(); clearTraitCache();
  fs.rmSync(home, { recursive: true, force: true });
});

const walk = (node: Node, visit: (node: Node) => void): void => { visit(node); node.children?.forEach(child => walk(child, visit)); };
/** The field each read-only row of the Details tab shows, top to bottom. */
function detailsRows(schema: { screens: Node[] }): string[] {
  let details: Node | undefined;
  for (const screen of schema.screens) walk(screen, node => { if (!details && node.props?.label === 'Details') details = node; });
  const fields: string[] = [];
  walk(details!, node => {
    if (!node.id.endsWith('-read-field')) return;
    let bound: string | undefined;
    walk(node, child => { for (const key of ['field', 'amountField', 'statusField']) if (!bound && typeof child.props?.[key] === 'string') bound = child.props[key] as string; });
    fields.push(bound!);
  });
  return fields;
}

describe('s221-m02 the Warehouse detail reads identity first and its times last', () => {
  for (const context of ['detail', 'workflow'] as const) {
    it(`${context}: Code opens the Details tab, the object's own fields follow in the order they were written, and the record's times close it`, async () => {
      const composed = await compose({ object: 'Warehouse', context, options: { transient: true } } as never) as { status: string; schema: { screens: Node[] } };
      expect(composed.status).toBe('ok');
      const rows = detailsRows(composed.schema);
      expect(rows[0]).toBe('code');
      expect(rows.slice(0, 6)).toEqual(['code', 'city', 'manager_email', 'monthly_rent', 'currency', 'organization_id']);
      expect(rows.slice(-4)).toEqual(['created_at', 'updated_at', 'last_event', 'last_event_at']);
      expect(rows).toEqual(expect.arrayContaining(['stock_level', 'units_on_hand', 'capacity_units']));
      expect(new Set(rows).size).toBe(rows.length);
    });
  }
});
