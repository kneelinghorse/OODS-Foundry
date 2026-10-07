# @oods/tokens

CSS variables and JavaScript token values used by OODS components. The built package contains the shipped brands and their light, dark and high-contrast scopes. It does not run an MCP server.

## Install

```sh
npm install @oods/tokens
```

## First result

In a bundler-based app, import the stylesheet once and choose a scope on the document:

```js
import '@oods/tokens/css';
document.documentElement.dataset.brand = 'A';
document.documentElement.dataset.theme = 'light';
```

Use a semantic role in your CSS:

```css
body {
  background: var(--sys-surface-canvas);
  color: var(--sys-text-primary);
}
```

For JavaScript values:

```js
import tokens from '@oods/tokens';
console.log(tokens.cssVariablesByScope.A.light['--oods-sys-surface-canvas']); // oklch(1 0 286)
```

A scope works on any element, not only the document: a panel with its own `data-brand` and `data-theme` gets that brand's and theme's roles, so a dark preview can sit in a light page.

The stylesheet also declares DM Sans, the sans-serif the tokens name. Its files ship in `dist/fonts` and load from beside the stylesheet, never from the network; a browser fetches one only for text that uses the family. Vite copies them with the stylesheet; esbuild needs a loader for them (`--loader:.woff2=file`), and webpack an asset rule for `.woff2`.

`cssVariablesByScope` holds every variable of each brand and theme with its value resolved, keyed by its full name, which begins with `--oods-`. The stylesheet uses the short name: `--oods-sys-surface-canvas` in JavaScript is the value `var(--sys-surface-canvas)` takes under `data-brand="A"` and `data-theme="light"`.

`@oods/tokens/brands` exports the brands in this build. `@oods/tokens/tailwind` exports the built JSON token payload; it does not install or configure Tailwind for you.

To turn your colour tokens into an OODS Foundry brand, use `brand_intake` through `@oods/foundry` and its shipped `QUICKSTART.md`. A generated app for that brand carries a separate stylesheet containing its custom scopes.

## Limits

Use matching versions of the OODS packages. These packages are separate from the local MCP server, `@oods/foundry`. For an unpublished release candidate, install the supplied tarballs together instead of resolving them from npm.

## License

Apache License 2.0. See [LICENSE](https://cdn.jsdelivr.net/npm/@oods/tokens@0.8.0/LICENSE) and [NOTICE](https://cdn.jsdelivr.net/npm/@oods/tokens@0.8.0/NOTICE). The DM Sans font files are under the SIL Open Font License 1.1; NOTICE carries that licence and where the files come from. Generated output belongs to its user; installed package dependencies retain their own licenses.
