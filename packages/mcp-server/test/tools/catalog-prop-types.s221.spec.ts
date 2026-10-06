/**
 * s221-m02 (#2482 ruling 5; the website's finding 4, message 16978d69): catalog_list says which target its propSchema
 * describes, and gives the React and Vue props from the published declarations.
 *
 * Why: the seven primitives' propSchema entries come from the static HTML renderer ("primitive-renderer": a Button's
 * label, text and type). An assistant reading them to write React or Vue code used names the components do not take;
 * React's Button takes content, intent, size, disabled and type.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { handle } from '../../src/tools/catalog.list.js';
import { getAjv } from '../../src/lib/ajv.js';

const root = path.resolve(import.meta.dirname, '../../../..');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'packages/mcp-server/src/schemas/catalog.list.output.json'), 'utf8'));
const full = async () => await handle({ detail: 'full', pageSize: 200 } as never) as any;

describe('s221-m02 catalog_list names the target of propSchema and gives the React and Vue props', () => {
  it('marks every full entry\'s propSchema as the HTML renderer\'s', async () => {
    const out = await full();
    // s222-m02 (#2502 ruling 11): Switch and Dialog join the 110.
    expect(out.components).toHaveLength(114);
    for (const entry of out.components) expect(entry.propSchemaTarget, entry.name).toBe('html');
    const validate = getAjv().compile(schema);
    expect(validate(out), JSON.stringify(validate.errors)).toBe(true);
  });

  it('gives Button the props React and Vue declare, not the HTML renderer\'s label', async () => {
    const button = (await full()).components.find((entry: any) => entry.name === 'Button');
    expect(Object.keys(button.propSchema)).toContain('label');
    expect(Object.keys(button.propTypes.react)).toEqual(expect.arrayContaining(['content', 'intent', 'size', 'disabled', 'type']));
    expect(button.propTypes.react).not.toHaveProperty('label');
    expect(button.propTypes.react.type).toEqual({ type: '"submit" | "reset" | "button"', optional: true });
    expect(Object.keys(button.propTypes.vue)).toEqual(['content', 'disabled', 'intent', 'size', 'type']);
  });

  it('gives every component both targets\' props, and each carries its contract props', async () => {
    const { componentContracts } = await import('@oods/component-contracts');
    for (const entry of (await full()).components) {
      const contract = (componentContracts as Record<string, { props: string[] }>)[entry.name]!;
      for (const target of ['react', 'vue'] as const) {
        expect(entry.propTypes?.[target], `${entry.name} ${target}`).toBeTruthy();
        const missing = contract.props.filter(prop => !(prop in entry.propTypes[target]) && !['id', 'className', 'style', 'children'].includes(prop));
        expect(missing, `${entry.name} ${target}`).toEqual([]);
      }
    }
  });
});
