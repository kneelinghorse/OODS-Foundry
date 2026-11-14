import type { FieldDefinition, SemanticMapping } from '../objects/types.js';

/**
 * Whether a string field holds long text, so a form edits it in a text area: a multiline hint, a length of 120 or more,
 * or a name or description that says so. s246-m02: moved here from design.compose.ts unchanged, so the required-field
 * backfill in form-detail.ts asks a field the slots missed the same question a slotted field is asked.
 */
export function isLongTextField(
  fieldName: string,
  field: FieldDefinition,
  semantics?: Record<string, SemanticMapping>,
): boolean {
  if (field.type !== 'string') return false;

  const uiHints = semantics?.[fieldName]?.ui_hints;
  const hintMaxLength = typeof uiHints?.maxLength === 'number'
    ? uiHints.maxLength
    : undefined;
  const validationMaxLength = typeof field.validation?.maxLength === 'number'
    ? field.validation.maxLength
    : undefined;
  const normalizedName = fieldName.replace(/[_-]+/g, ' ');
  const lowerText = `${normalizedName} ${field.description}`.toLowerCase();

  return Boolean(
    uiHints?.multiline === true
    || (hintMaxLength && hintMaxLength >= 120)
    || (validationMaxLength && validationMaxLength >= 120)
    || /\b(description|summary|notes?|message|comment|reason|details?|body|content|bio|explanation|free form)\b/.test(lowerText),
  );
}

/**
 * s248-m01 (next step 1865): whether a form keeps a text area for a field, where a composer chose one. A field keeps it when
 * it holds long text: its name says so (description, summary, notes, message, comment, reason, details, body, content,
 * instructions, bio, explanation), its semantics ask for several lines (a multiline hint), or it may hold more than one
 * long line (a length above 240). A field whose semantics say `multiline: false` is one line (Mandate's ended_reason: why a
 * grant ended, in one line). A record's own name, title or label is one line whatever its length, and words in a
 * field's description are not read: "detail" in "Dunning phase or retry program detail" says nothing about its length.
 * isLongTextField above, which the slots ask, also counts a length of 120 and a description's words, so a title of 120
 * characters took a text area's slot; this is the form's last word on it, as the name list before it was.
 */
export function keepsTextArea(
  fieldName: string,
  field: FieldDefinition,
  semantics?: Record<string, SemanticMapping>,
): boolean {
  if (field.type !== 'string') return false;
  const semantic = semantics?.[fieldName];
  const words = fieldName.replace(/[_-]+/g, ' ').toLowerCase();
  const uiHints = semantic?.ui_hints;
  if (uiHints?.multiline === false || semantic?.semantic_type === 'text.label' || /(?:^|\s)(?:name|title|label)$/.test(words)) return false;
  const lengths = [uiHints?.maxLength, field.validation?.maxLength].filter((value): value is number => typeof value === 'number');
  return Boolean(
    uiHints?.multiline === true
    || lengths.some(length => length > 240)
    || /\b(description|summary|notes?|message|comment|reason|details?|body|content|instructions|bio|explanation)\b/.test(words),
  );
}
