import { describe, expect, it } from 'vitest';
import {
  canonicalCssVarName,
  sanitizeOverlayValue,
  emitRootBlock,
  resolveTokenOverlay,
} from './brand-overlay.js';
import { renderDocument } from './document.js';
import { isToolError } from '../errors/tool-error.js';

const codeOf = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (err) {
    return isToolError(err) ? err.opiCode : `non-tool-error:${String(err)}`;
  }
  return undefined; // did not throw
};

describe('brand-overlay canonicalCssVarName', () => {
  it('emits the brand-agnostic --oods- Style-Dictionary name (drops $value, no brand suffix)', () => {
    // This is the reachability contract: the name must equal what the Button selector references.
    expect(canonicalCssVarName(['size', 'spacing', 'sm'])).toBe('--oods-size-spacing-sm');
    expect(canonicalCssVarName(['size', 'spacing', 'md', '$value'])).toBe('--oods-size-spacing-md');
  });

  it('kebab-neutralises hostile path segments into a safe --oods-[a-z0-9-]+ name', () => {
    // A segment with metacharacters can never produce a name that breaks out of `--name: value;`.
    expect(canonicalCssVarName(['Foo', 'Bar Baz'])).toBe('--oods-foo-bar-baz');
    expect(canonicalCssVarName(['a}b{c'])).toBe('--oods-a-b-c');
  });
});

describe('brand-overlay sanitizeOverlayValue', () => {
  it('passes legitimate CSS color/length/number grammar unchanged', () => {
    for (const v of [
      '#4f46e5',
      'rgba(0, 0, 0, 0.5)',
      'color-mix(in srgb, #fff 50%, #000)',
      '8px',
      '-0.5rem',
      'calc(100% - 8px)',
      'hsl(240 100% 50%)',
      '1.5',
      'transparent',
    ]) {
      expect(sanitizeOverlayValue(v)).toBe(v);
    }
  });

  it('rejects values carrying <style>-breakout / CSS-injection metacharacters with OODS-V136', () => {
    for (const v of [
      '</style><script>alert(1)</script>',
      'red; } body{display:none}',
      'red} @import url(evil)',
      'a/*c*/b',
      'a\\3c b',
      'line1\nline2',
      '   ',
    ]) {
      expect(codeOf(() => sanitizeOverlayValue(v))).toBe('OODS-V136');
    }
  });
});

describe('brand-overlay resolveTokenOverlay', () => {
  it('resolves a bare nested delta to a reachable scoped :root{} block', () => {
    expect(resolveTokenOverlay({ size: { spacing: { sm: '10px' } } })).toBe(
      ':root {\n  --oods-size-spacing-sm: 10px;\n}\n',
    );
  });

  it('treats a DTCG {$value} leaf identically and drops $type/$description', () => {
    const bare = resolveTokenOverlay({ size: { spacing: { sm: '10px' } } });
    const dtcg = resolveTokenOverlay({
      size: { spacing: { sm: { $value: '10px', $type: 'dimension', $description: 'x' } } },
    });
    expect(dtcg).toBe(bare);
  });

  it('returns an empty string for an empty delta (default-absent render stays byte-identical)', () => {
    expect(resolveTokenOverlay({})).toBe('');
  });

  it('rejects a malicious value before emit so it never reaches the <style> sink (OODS-V136)', () => {
    expect(codeOf(() => resolveTokenOverlay({ color: { brand: '</style><script>' } }))).toBe(
      'OODS-V136',
    );
  });

  it('rejects a prototype-pollution key via the shared isUnsafeKey denylist (OODS-V113)', () => {
    expect(codeOf(() => resolveTokenOverlay({ ['__proto__']: { x: '1px' } }))).toBe('OODS-V113');
  });
});

describe('brand-overlay emitRootBlock (FS byte-identity contract)', () => {
  it('emits the historical :root{} shape with sanitisation OFF (no var-name/value drift)', () => {
    expect(
      emitRootBlock([{ name: '--brand-a-surface-canvas', value: '#ffffff' }], {
        sanitizeValues: false,
        emptyFallback: '/* No variable changes detected for brand A. */\n',
      }),
    ).toBe(':root {\n  --brand-a-surface-canvas: #ffffff;\n}\n');
  });

  it('returns the caller fallback when there are no declarations', () => {
    expect(
      emitRootBlock([], {
        sanitizeValues: false,
        emptyFallback: '/* No variable changes detected for brand A. */\n',
      }),
    ).toBe('/* No variable changes detected for brand A. */\n');
  });

  it('first-wins dedup matches the prior generateCssSnapshot semantics', () => {
    expect(
      emitRootBlock(
        [
          { name: '--x', value: '1' },
          { name: '--x', value: '2' },
        ],
        {},
      ),
    ).toBe(':root {\n  --x: 1;\n}\n');
  });
});

describe('brand-overlay reachability against the rendered Button', () => {
  it('produces a :root override for the exact --oods-* var the Button padding consumes', () => {
    const overlay = resolveTokenOverlay({ size: { spacing: { sm: '10px' } } });
    const html = renderDocument({ screenHtml: '<div>Test</div>', componentCss: overlay });
    // The Button rule references the var...
    const buttonBlock = html.slice(html.indexOf('[data-oods-component="Button"]'));
    expect(buttonBlock).toContain('var(--oods-size-spacing-sm)');
    // ...and the overlay sets that very same var in the same <style data-source="components"> block.
    expect(html).toContain(':root {\n  --oods-size-spacing-sm: 10px;\n}');
  });

  it('a malicious overlay value cannot break out of the <style> element', () => {
    // resolveTokenOverlay throws before any HTML is produced, so the payload never reaches the sink.
    expect(codeOf(() => resolveTokenOverlay({ size: { spacing: { sm: '10px</style><script>1' } } }))).toBe(
      'OODS-V136',
    );
  });
});
