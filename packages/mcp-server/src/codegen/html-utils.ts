/**
 * Shared HTML escape + attribute helpers for C-track emitters.
 *
 * Extracted from boxes-arrows-emitter (sprint-98), wireframe-emitter
 * (sprint-99), and review-emitter (sprint-99) where the same three functions
 * were duplicated byte-for-byte. The rule-of-three trigger fired and the
 * extraction landed as the s100-m04 alternate promoted when concordance.validate
 * pipeline auto-integration re-deferred with zero usage signal.
 *
 * Behavior is intentionally identical to the prior duplicated copies:
 *   - escapeHtml: minimal entity set (&, <, >, ", ') for HTML attribute + text
 *     contexts. Not a full HTML escaper — these emitters render into
 *     server-side templates only and do not handle untrusted CSS/JS contexts.
 *   - attr / dataAttr: skip empty/null/undefined values; otherwise emit
 *     ` name="escaped-value"` with leading space.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function attr(name: string, value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') return '';
  return ` ${name}="${escapeHtml(String(value))}"`;
}

export function dataAttr(
  name: string,
  value: string | number | undefined | null,
): string {
  return attr(`data-${name}`, value);
}
