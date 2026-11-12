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
