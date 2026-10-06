# @oods/component-styles

Shared CSS for OODS React and Vue components. It supplies component styles and imports `@oods/tokens/css`; it contains no React or Vue runtime.

## Install

```sh
npm install @oods/component-styles @oods/tokens
```

## First result

Import the stylesheet once in your application's entry, alongside the component package for your framework:

```js
import '@oods/component-styles/css';
document.documentElement.dataset.brand = 'A';
document.documentElement.dataset.theme = 'light';
```

Render a component from `@oods/components-react` or `@oods/components-vue` to see its styles. Set `data-theme` to `dark` or `hc` for those scopes; high-contrast behaviour also follows the browser's forced-colour settings.

The stylesheet expects OODS component markup and classes. Applying it to an unrelated component library does not make that library implement OODS contracts. A custom brand's generated stylesheet must also be imported when it is not part of this token build.

## Limits

Use matching versions of the OODS packages. These packages are separate from the local MCP server, `@oods/foundry`. For an unpublished release candidate, install the supplied tarballs together instead of resolving them from npm.

## License

Apache License 2.0. See [LICENSE](https://cdn.jsdelivr.net/npm/@oods/component-styles@0.7.0/LICENSE) and [NOTICE](https://cdn.jsdelivr.net/npm/@oods/component-styles@0.7.0/NOTICE). Generated output belongs to its user; installed package dependencies retain their own licenses.
