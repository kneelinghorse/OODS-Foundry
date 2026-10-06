import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { fieldPairPattern } from '../../src/compose/slot-patterns.js';
import { fieldLabel } from '../../src/compose/label-generator.js';
import { resolveFieldProps } from '../../src/codegen/binding-utils.js';
import { unitFieldLabel } from '../../src/compose/unit-field-label.js';
const root = path.resolve(import.meta.dirname, '../../../..');
const pairLabel = (field: string) => fieldPairPattern(field, { type: 'number' }).element.children![0]!.meta!.label;
const codeLabel = (field: string) => resolveFieldProps({ id: 'field', component: 'Badge', props: { field } }, { [field]: { type: 'boolean' } })?.label;
function files(dir: string): string[] { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : /\.(?:object|trait)\.yaml$/.test(entry.name) ? [path.join(dir, entry.name)] : []); }

describe('only a declared trailing unit changes field wording (s226-m01)', () => {
  it.each(['c', 'f', 'kg', 'lb', 'km', 'cm', 'mm', 'px', 'ms'])('agrees in composition, codegen and the visible label for %s', unit => {
    const field = `target_temperature_${unit}`, label = `Target temperature (${unit === 'c' ? '°C' : unit === 'f' ? '°F' : unit})`;
    expect(pairLabel(field)).toBe(`${label} label`);
    expect(codeLabel(field)).toBe(label);
    expect(fieldLabel(field)).toBe(label);
  });
  it.each(['target_temperature_k', 'file_size_bytes', 'duration_seconds', 'px_width', 'width_PX', 'width-px', 'widthPx'])('does not infer a unit for %s', field => {
    expect(unitFieldLabel(field)).toBeUndefined();
  });
  it.each([['temperature_c', 'Temperature (°C)'], ['temp_f', 'Temp (°F)'], ['target_temp_c', 'Target temp (°C)'], ['option_c', 'Option c'], ['grade_f', 'Grade f'], ['vitamin_c', 'Vitamin c']])('keeps all three callers honest for %s', (field, label) => {
    expect(fieldLabel(field)).toBe(label);
    expect(pairLabel(field)?.toLowerCase()).toBe(`${label} label`.toLowerCase());
    expect(codeLabel(field)?.toLowerCase()).toBe(label.toLowerCase());
    if (!/temperature|temp_/.test(field)) expect(unitFieldLabel(field)).toBeUndefined();
  });
  it('moves only Media width/height across every shipped object and trait field', () => {
    const changed: string[] = [];
    for (const file of ['objects', 'traits', 'domains/saas-billing/objects'].flatMap(dir => files(path.join(root, dir)))) {
      const definition = yaml.load(fs.readFileSync(file, 'utf8')) as { schema?: Record<string, unknown> };
      for (const field of Object.keys(definition.schema ?? {})) {
        const oldWords = field.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
        const oldLabel = oldWords.charAt(0).toUpperCase() + oldWords.slice(1);
        if (unitFieldLabel(field) && fieldLabel(field) !== oldLabel) changed.push(`${path.relative(root, file)}:${field}`);
      }
    }
    expect(changed.sort()).toEqual(['objects/content/Media.object.yaml:height_px', 'objects/content/Media.object.yaml:width_px']);
    expect(fieldLabel('provenance_source')).toBe('Source');
    expect(pairLabel('created_at')).toBe('Created At label');
    expect(codeLabel('created_at')).toBe('Created At');
  });
  it('keeps the legacy Run field available to readers but out of every view', () => {
    const run = yaml.load(fs.readFileSync(path.join(root, 'objects/capture/Run.object.yaml'), 'utf8')) as any;
    expect(run.schema.auth_provenance_note.unavailable).toBe(true);
    expect(run.schema.capture_note.unavailable).toBeUndefined();
    expect(run.semantics.capture_note.token_mapping).toBe('tokenMap(text.body.*)');
    expect(fieldLabel('capture_note')).toBe('Capture note');
  });
});
