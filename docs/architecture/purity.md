# Tokens-Only Purity Audit

The design system enforces that runtime components consume `--cmp-*` tokens exclusively. Brand, theme, and reference layers resolve downstream in CSS. To support that contract we added a static purity audit that blocks pushes when violations appear in component or shared style sources.

## Audit Rules

- Flag any usage of `--ref-*` or `--theme-*` CSS custom properties inside `src/components` or `src/styles`.
- Flag hard-coded color literals (`#`, `rgb`, `hsl`, `oklch`) in the same directories.
- Allow documentation, stories, and examples to opt out through the centralized allowlist at `scripts/purity/allowlist.json`.

## Running the Audit

```bash
pnpm run purity:audit
```

The command reports each violation with file, line, column, and the offending token snippet. A non-zero exit blocks the push pipeline until the offending code is cleaned up or an explicit allowlist entry is added.

## Allowlisting

The allowlist is intentionally small. Additions should include a short justification, target the narrowest glob possible, and only cover scenarios where raw tokens are pedagogically useful (docs, examples). Actual runtime components must never rely on `--ref-*` or `--theme-*` variables or literal colors.
