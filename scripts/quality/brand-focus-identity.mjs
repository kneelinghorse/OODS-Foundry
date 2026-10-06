/** S197: only the primary differed by brand. S222 m01: each brand is its own recipe, so its accent differs too; the neutral is shared. */
export function focusIdentityFailures(computed) {
  const failures = [];
  for (const theme of ['base', 'dark', 'hc']) {
    for (const slot of ['--theme-focus-ring-outer', '--theme-focus-ring-inner', '--theme-focus-text']) {
      const a = computed[`A/${theme}`]?.[slot];
      const b = computed[`B/${theme}`]?.[slot];
      // s222-m01 (#2502 rulings 3-5): each brand's recipe has its own accent, so its outer ring and focus text are its own in
      // light and dark; the inner ring is the canvas, which the shipped brands share. In hc every focus role is a system colour.
      const shouldMatch = theme === 'hc' || slot === '--theme-focus-ring-inner';
      if (typeof a !== 'string' || !a || typeof b !== 'string' || !b || (a === b) !== shouldMatch) {
        failures.push(`${theme} ${slot}: A paints ${a} and B paints ${b} — expected ${shouldMatch ? 'brand-invariant' : 'brand-distinct'} focus role`);
      }
    }
  }
  return failures;
}
