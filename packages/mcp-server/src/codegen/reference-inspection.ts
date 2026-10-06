import type { UiSchema } from '../schemas/generated.js';
import { isReferenceField, snakeToCamel } from './binding-utils.js';
import { fieldLabel } from '../compose/label-generator.js';
import { escapeHtml } from '../render/escape-html.js';

/** A native closed disclosure is keyboard accessible and never changes reference values. */
export function referenceInspection(schema: UiSchema, framework: 'react' | 'vue' | 'html', model: Record<string, unknown> = {}): string {
  if (!schema.screens.some(screen => /^screen-(?:detail|dashboard)-/.test(screen.id) || /^(?:detail|dashboard)-screen$/.test(screen.id))) return '';
  // A reference the object's contract never supplies has no value to inspect (s213-m01).
  const fields = Object.entries(schema.objectSchema ?? {}).filter(([, entry]) => isReferenceField(entry) && !entry.unavailable);
  if (!fields.length) return '';
  const rows = fields.map(([field, entry]) => {
    const value = snakeToCamel(field);
    const expression = entry.type.includes('[]') ? `JSON.stringify(${value} ?? [])` : `String(${value} ?? 'Not available')`;
    const text = framework === 'html'
      ? escapeHtml(entry.type.includes('[]') ? JSON.stringify(model[value] ?? []) : String(model[value] ?? 'Not available'))
      : framework === 'react' ? `{${expression}}` : `{{ ${expression} }}`;
    return `<div${framework === 'react' ? ` key="${escapeHtml(field)}"` : ''}><dt>${escapeHtml(fieldLabel(field))}</dt><dd><code>${text}</code></dd></div>`;
  });
  return `<details data-oods-reference-inspection="true"><summary>Reference details</summary><dl>${rows.join('')}</dl></details>`;
}
