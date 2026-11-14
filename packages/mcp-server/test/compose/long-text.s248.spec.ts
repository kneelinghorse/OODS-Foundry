/**
 * s248-m01 (next step 1865): a long-text field keeps its text area. A form kept a text area only for a field whose name
 * said description, reason, notes, body, content, instructions or comment, so a probe object's required 4,000-character
 * message and summary were one-line inputs. The form's last word is now keepsTextArea: a long-text name (summary, message,
 * details, bio and the rest), a multiline hint, or room for more than one long line (a length above 240). These checks
 * encode why each part matters:
 * - a field that holds paragraphs is read and written in a text area that keeps its lines;
 * - a record's own name or title is one line whatever its length, so a 200-character title is never a text area, and a
 *   word in a field's description ("detail") says nothing about its length;
 * - every shipped form composes as it did: none had a long-text field the name list turned back into an input.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { keepsTextArea } from '../../src/compose/long-text.js';
import { clearObjectCache } from '../../src/objects/object-loader.js';
import { clearTraitCache } from '../../src/objects/trait-loader.js';
import { schemaNodes } from '../../src/codegen/preview-model.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import type { UiSchema } from '../../src/schemas/generated.js';

describe('keepsTextArea: long text by its name, its hint or its room, never a name or a title', () => {
  const text = (maxLength?: number, description = 'A field.') => ({ type: 'string', required: false, description, ...(maxLength ? { validation: { maxLength } } : {}) });
  it('keeps a text area for a long-text name, a multiline hint and more than one long line', () => {
    for (const name of ['message', 'summary', 'details', 'bio', 'notes', 'note', 'explanation', 'description', 'reason', 'body', 'content', 'instructions', 'comment', 'release_notes']) {
      expect(keepsTextArea(name, text() as never), name).toBe(true);
    }
    expect(keepsTextArea('text', text() as never, { text: { semantic_type: 'x', token_mapping: 'x', ui_hints: { multiline: true } } } as never)).toBe(true);
    expect(keepsTextArea('value', text(4000) as never)).toBe(true);
    expect(keepsTextArea('value', text(241) as never)).toBe(true);
  });
  it('gives one line to a name, a title or a label at any length, a short field, and a description\'s words', () => {
    for (const name of ['name', 'title', 'label', 'plan_name', 'lead_title', 'display_label']) expect(keepsTextArea(name, text(4000) as never), name).toBe(false);
    expect(keepsTextArea('subject', text(4000) as never, { subject: { semantic_type: 'text.label', token_mapping: 'x' } } as never)).toBe(false);
    expect(keepsTextArea('code', text(240) as never)).toBe(false);
    // A field that says it is one line is one line, whatever its name says (Mandate's ended_reason).
    expect(keepsTextArea('ended_reason', text(240) as never, { ended_reason: { semantic_type: 'x', token_mapping: 'x', ui_hints: { multiline: false } } } as never)).toBe(false);
    expect(keepsTextArea('ended_reason', text(240) as never)).toBe(true);
    expect(keepsTextArea('collection_state', text(undefined, 'Dunning phase or retry program detail presented to success teams.') as never)).toBe(false);
    expect(keepsTextArea('count', { type: 'integer', required: false, description: 'A summary count.' } as never)).toBe(false);
  });
});

describe('a probe object\'s long-text fields keep their text areas on its form', () => {
  let home: string;
  const previous = { objects: process.env.OODS_OBJECTS_DIR, store: process.env.MCP_SCHEMA_STORE_ROOT };
  beforeAll(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s248-1865-'));
    fs.mkdirSync(path.join(home, 'objects'));
    const long = (name: string, extra = '') => `  ${name}: { type: string, required: true, description: The ${name.replace('_', ' ')} in the writer's words.${extra}, validation: { maxLength: 4000 } }`;
    fs.writeFileSync(path.join(home, 'objects', 'Ticket.object.yaml'), [
      'object: { name: Ticket, version: 1.0.0, domain: test, description: A probe ticket with long text fields. }',
      'schema:',
      '  ticket_id: { type: string, required: true, description: The record\'s own id. }',
      '  title: { type: string, required: true, description: What the ticket is called., validation: { maxLength: 200 } }',
      long('message'), long('summary'), long('description'), long('body'),
      '  steps: { type: string, required: true, description: How to reproduce it., validation: { maxLength: 2000 } }',
      '  code: { type: string, required: true, description: A short reference code., validation: { maxLength: 120 } }',
      'semantics:',
      '  title: { semantic_type: text.label, token_mapping: tokenMap(text.body.*) }',
    ].join('\n') + '\n');
    Object.assign(process.env, { OODS_OBJECTS_DIR: path.join(home, 'objects'), MCP_SCHEMA_STORE_ROOT: home });
    clearTraitCache(); clearObjectCache();
  });
  afterAll(() => {
    for (const [key, value] of [['OODS_OBJECTS_DIR', previous.objects], ['MCP_SCHEMA_STORE_ROOT', previous.store]] as const) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    clearTraitCache(); clearObjectCache();
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('writes message, summary, description, body and the steps in text areas, and the title and the code in inputs', async () => {
    const result = await compose({ object: 'Ticket', context: 'form', options: { transient: true } } as never) as { status: string; schema: UiSchema };
    expect(result.status).toBe('ok');
    const control = (field: string) => schemaNodes(result.schema).filter(node => node.props?.field === field && ['Input', 'Textarea'].includes(node.component)).map(node => node.component);
    for (const field of ['message', 'summary', 'description', 'body', 'steps']) expect(control(field), field).toEqual(['Textarea']);
    for (const field of ['title', 'code']) expect(control(field), field).toEqual(['Input']);
  });
});
