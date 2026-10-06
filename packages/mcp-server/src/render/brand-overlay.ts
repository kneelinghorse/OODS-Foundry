import { isUnsafeKey } from '../lib/safety.js';
import { ToolError } from '../errors/tool-error.js';
import type { StyleLibraryArtifact } from './style-library.js';

/**
 * Shared CSS-emit helper for the two token-overlay paths (sprint-121 B3):
 *
 *  - the FS path — brand.apply's generateCssSnapshot -> a standalone `variables.css` artifact, and
 *  - the inline path — repl render's `tokenOverlay` -> a scoped `:root{}` block emitted RAW into
 *    document.ts's `<style data-source="components">` sink (document.ts:220 applies NO HTML
 *    escaping, and isUnsafeKey is a key-only denylist that never inspects VALUES).
 *
 * The inline path is an HTML sink, so its values MUST pass sanitizeOverlayValue before emit. The FS
 * path writes a file artifact and must stay byte-identical to its historical output, so it opts OUT
 * of sanitization (`sanitizeValues: false`), supplies its own brand-suffixed variable names
 * (brand.apply's pointerToCssVariable), and passes its historical empty-case comment as the fallback.
 */

const CANONICAL_NAME = /^--oods-[a-z0-9-]+$/;

/**
 * Brand-AGNOSTIC canonical Style-Dictionary variable name for a token path.
 *
 * Mirrors style-dictionary.config.cjs (prefix 'oods' + kebab(path)): `--oods-` + kebab segments,
 * with any DTCG `$value` segment dropped and NO brand suffix — e.g. ['size','spacing','sm'] ->
 * '--oods-size-spacing-sm', the exact name the Button selector references in dist/css/tokens.css.
 *
 * Deliberately NOT brand.apply's pointerToCssVariable, which emits `--<segments>-<brand>` (keeps a
 * literal 'value' segment, appends a brand suffix, omits the --oods- prefix) -> e.g.
 * '--size-spacing-sm-value-a', which has ZERO overlap with the DOM name and renders an inert overlay.
 */
export function canonicalCssVarName(pathSegments: string[]): string {
  const kebab = pathSegments
    .filter((seg) => seg !== '$value')
    .map((seg) => seg.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().replace(/^-+|-+$/g, ''))
    .filter((seg) => seg.length > 0);
  const name = `--oods-${kebab.join('-')}`;
  if (!CANONICAL_NAME.test(name)) {
    throw new ToolError(
      'OODS-V136',
      `Token-overlay path does not yield a valid --oods-* variable name: ${JSON.stringify(pathSegments)}`,
      { path: pathSegments },
    );
  }
  return name;
}

// Printable CSS/HTML metacharacters that could break out of the raw <style> sink or inject CSS rules:
//   < >       - close the <style> element / open an HTML tag (`</style><script>`)
//   { }       - close the :root{} block and inject arbitrary rules
//   ;         - terminate the declaration and append more (the emitter adds the single trailing ';')
//   @         - at-rules (@import for remote fetch, @media, @charset)
//   \         - CSS escape sequences (e.g. `\3c` -> '<') that could smuggle the above past a check
//   /* */ //  - comment sequences that can comment out the closing brace
// Control characters (char code < 0x20: newlines, tabs, NUL) are rejected separately via charCodeAt
// so this source carries no literal control bytes.
const UNSAFE_VALUE = /[<>{}@;\\]|\/\*|\*\/|\/\//;

function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) < 0x20) return true;
  }
  return false;
}

/**
 * Validate a single CSS value bound for the raw <style> sink. Rejects (does not silently strip) any
 * value carrying CSS/HTML metacharacters — a malformed/malicious value can't succeed on retry, so it
 * surfaces a non-retryable OODS-V136. Legitimate CSS color/length/number grammar (#hex, rgb()/rgba()/
 * hsl()/color-mix()/calc(), px/rem/%/em, plain numbers, named colors) passes unchanged.
 */
export function sanitizeOverlayValue(value: string): string {
  if (value.trim().length === 0) {
    throw new ToolError('OODS-V136', 'Token-overlay value must be a non-empty string.', { value });
  }
  if (UNSAFE_VALUE.test(value) || hasControlChar(value)) {
    throw new ToolError(
      'OODS-V136',
      `Unsafe token-overlay value (CSS/HTML metacharacters not allowed): ${JSON.stringify(value)}`,
      { value },
    );
  }
  return value;
}

export interface OverlayDeclaration {
  /** The CSS custom-property name, including the leading `--`. */
  name: string;
  /** The CSS value (right-hand side, without the trailing `;`). */
  value: string;
}

export interface EmitRootBlockOptions {
  /** Inline (HTML-sink) path: run each value through sanitizeOverlayValue. FS path: false (byte-identity). */
  sanitizeValues?: boolean;
  /** Emitted verbatim when there are no declarations (the FS path supplies its historical comment). */
  emptyFallback?: string;
}

/**
 * Emit a scoped `:root{}` block from a list of declarations. First-wins dedup by name. The output
 * shape — `:root {\n  --name: value;\n  ...\n}\n` (and the caller-supplied fallback when empty) — is
 * byte-identical to brand.apply's prior inline emitter so the FS `variables.css` artifact does not drift.
 */
export function emitRootBlock(
  declarations: OverlayDeclaration[],
  opts: EmitRootBlockOptions = {},
): string {
  const sanitize = opts.sanitizeValues ?? false;
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const { name, value } of declarations) {
    if (seen.has(name)) continue;
    seen.add(name);
    const emitted = sanitize ? sanitizeOverlayValue(value) : value;
    lines.push(`  ${name}: ${emitted};`);
  }
  if (lines.length === 0) {
    return opts.emptyFallback ?? '';
  }
  return [':root {', ...lines, '}', ''].join('\n');
}

/**
 * Inline-path entry point: resolve a nested token-delta object to a sanitized, scoped `:root{}`
 * override. Walks to leaf values (bare `{size:{spacing:{sm:'10px'}}}` OR DTCG `{...:{$value:'10px'}}`),
 * names each via canonicalCssVarName, and sanitizes every value. Returns '' for an empty delta
 * (-> default-absent render stays byte-identical). Throws OODS-V113 on a denylisted key and OODS-V136
 * on an unsafe value or unnameable path.
 */
export function resolveTokenOverlay(delta: Record<string, unknown>): string {
  const declarations: OverlayDeclaration[] = [];
  collectLeaves(delta, [], declarations);
  return emitRootBlock(declarations, { sanitizeValues: true });
}

function collectLeaves(node: unknown, pathSegments: string[], out: OverlayDeclaration[]): void {
  if (node === null || node === undefined) return;

  if (typeof node === 'string' || typeof node === 'number') {
    out.push({ name: canonicalCssVarName(pathSegments), value: String(node) });
    return;
  }

  if (Array.isArray(node)) {
    throw new ToolError(
      'OODS-V136',
      `Token-overlay leaf must be a string or number, got an array at "${pathSegments.join('.')}".`,
      { path: pathSegments },
    );
  }

  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    // DTCG leaf: collapse {$value, $type?, $description?} to its $value; the name comes from the path
    // WITHOUT a $value segment, so $type/$description never leak into the emitted CSS.
    if (Object.prototype.hasOwnProperty.call(obj, '$value')) {
      const v = obj['$value'];
      if (typeof v === 'string' || typeof v === 'number') {
        out.push({ name: canonicalCssVarName(pathSegments), value: String(v) });
        return;
      }
      throw new ToolError(
        'OODS-V136',
        `DTCG $value must be a string or number at "${pathSegments.join('.')}".`,
        { path: pathSegments },
      );
    }
    for (const [key, child] of Object.entries(obj)) {
      if (isUnsafeKey(key)) {
        throw new ToolError('OODS-V113', `Unsafe key "${key}" is not allowed in token deltas.`, { key });
      }
      collectLeaves(child, [...pathSegments, key], out);
    }
  }
}

/**
 * SKIN-path entry point (sprint-123 A1): resolve a measured COLOUR delta to a sanitized,
 * scoped `:root{}` override on the --sys-/--ref- skin. Distinct from resolveTokenOverlay — it
 * does NOT call canonicalCssVarName (which hard-prefixes every name --oods- and throws V136 on
 * any --sys-/--ref- target). Instead it walks the delta to FULL dotted leaf-path keys (e.g.
 * ['color','surface','default'] -> 'color.surface.default') and looks each up in the Forge-owned
 * style library: a HIT pushes the mapped --sys-* declaration; a MISS throws OODS-V140. Values
 * still route through emitRootBlock(sanitizeValues:true) — the <style> sink is unescaped, so the
 * value side reuses the same sanitisation + first-wins dedup as the token path. Returns '' for an
 * empty delta (-> default-absent render stays byte-identical).
 */
export function resolveSkinOverlay(
  delta: Record<string, unknown>,
  library: StyleLibraryArtifact,
): string {
  const declarations: OverlayDeclaration[] = [];
  collectSkinDeclarations(delta, [], library, declarations);
  return emitRootBlock(declarations, { sanitizeValues: true });
}

/**
 * Walk a measured colour delta to leaf values, naming each by its FULL dotted leaf-path looked
 * up in the style library. Structurally mirrors collectLeaves (bare + DTCG `$value` leaves,
 * isUnsafeKey denylist, array-leaf rejection) but maps the name via the library instead of
 * canonicalCssVarName, so the --oods-/V136 token path stays verbatim.
 */
function collectSkinDeclarations(
  node: unknown,
  pathSegments: string[],
  library: StyleLibraryArtifact,
  out: OverlayDeclaration[],
): void {
  if (node === null || node === undefined) return;

  if (typeof node === 'string' || typeof node === 'number') {
    out.push(mapSkinLeaf(pathSegments, String(node), library));
    return;
  }

  if (Array.isArray(node)) {
    throw new ToolError(
      'OODS-V136',
      `Skin-overlay leaf must be a string or number, got an array at "${pathSegments.join('.')}".`,
      { path: pathSegments },
    );
  }

  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    // DTCG leaf: collapse {$value, $type?, $description?} to its $value; the logical key comes
    // from the path WITHOUT the $value segment, so $type/$description never leak into the lookup.
    if (Object.prototype.hasOwnProperty.call(obj, '$value')) {
      const v = obj['$value'];
      if (typeof v === 'string' || typeof v === 'number') {
        out.push(mapSkinLeaf(pathSegments, String(v), library));
        return;
      }
      throw new ToolError(
        'OODS-V136',
        `DTCG $value must be a string or number at "${pathSegments.join('.')}".`,
        { path: pathSegments },
      );
    }
    for (const [key, child] of Object.entries(obj)) {
      if (isUnsafeKey(key)) {
        throw new ToolError('OODS-V113', `Unsafe key "${key}" is not allowed in skin deltas.`, { key });
      }
      collectSkinDeclarations(child, [...pathSegments, key], library, out);
    }
  }
}

/**
 * Map one leaf to its --sys-/--ref- declaration via the style library. An unmapped FULL leaf-path
 * key is a closed-table config error -> OODS-V140 (non-retryable). The mapped name is the trusted
 * --sys-* literal from the library (constrained by the artifact schema's name pattern); only the
 * VALUE is consumer-supplied, and emitRootBlock sanitises it.
 */
function mapSkinLeaf(
  pathSegments: string[],
  value: string,
  library: StyleLibraryArtifact,
): OverlayDeclaration {
  const fullKey = pathSegments.join('.');
  const mapped = library.mappings[fullKey];
  if (mapped === undefined) {
    throw new ToolError(
      'OODS-V140',
      `Unmapped style-library logical key: "${fullKey}". No --sys-/--ref- target is registered for it.`,
      { key: fullKey },
    );
  }
  return { name: mapped, value };
}
