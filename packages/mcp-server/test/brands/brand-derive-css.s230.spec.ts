import { describe, expect, it } from 'vitest';
import { deriveBrandFromCss } from '../../src/lib/brand-derive-css.js';

const theme = ':root { --primary: oklch(.55 .2 262); --background: oklch(.98 .01 260); --radius: .625rem; --font-sans: Inter; } .dark { --primary: oklch(.5 .2 100); }';
describe('nested light theme derivation', () => {
  it.each(['@layer base', '@media (min-width: 1px)', '@layer base { @media screen'])('reads roots inside %s without taking the dark override', wrapper => {
    const css = `${wrapper} { ${theme} }${wrapper.includes('{') ? ' }' : ''}`;
    expect(deriveBrandFromCss(css)).toEqual(deriveBrandFromCss(theme));
  });
  it.each(['html', ':root, .light'])('accepts %s as the light selector', selector => {
    expect(deriveBrandFromCss(theme.replace(':root', selector))).toEqual(deriveBrandFromCss(theme));
  });
  it('does not invent a light accent from a dark-only or descendant rule', () => {
    const result = deriveBrandFromCss('@layer base { .dark { --primary: oklch(.5 .2 200); } :root .child { --ring: oklch(.5 .2 100); } }');
    expect(result.recipe.accentHue).toBeUndefined();
    expect(result.gaps.find(gap => gap.field === 'accentHue')?.reason).toContain('No opaque chromatic accent');
  });
});
