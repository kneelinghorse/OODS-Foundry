# @oods/components-react

React components used by screens generated with OODS Foundry. The package exports controls, layouts and domain views; `@oods/component-styles` provides their CSS.

## Install

```sh
npm install @oods/components-react @oods/component-styles @oods/tokens @oods/component-contracts react react-dom
```

Use React and React DOM 18 or 19. Bring your existing React app or use OODS Foundry's `code_generate` with `options.output: "application"` for an app entry and Vite configuration.

## First result

```tsx
import { Button } from '@oods/components-react';
import '@oods/component-styles/css';

export function App() {
  return <Button content="Review stock" intent="primary"
    onActivate={() => window.alert('Connect this action to your application.')} />;
}
```

Set `data-brand="A"` and `data-theme="light"` on the root HTML element. The result is a button labelled “Review stock” that invokes the supplied handler. Set the theme to `dark` or `hc` for those scopes.

Generated sample screens identify their sample data. A workflow's local store is not a production database; supply your data, navigation and persistence handlers. Retained component evidence covers named scenarios and themes, not every application you build. For your own implementation of a shipped component, use OODS Foundry's substitution mapping and inspect its advisory contract report.

## Limits

Use one version of the OODS packages together. Apps that `@oods/foundry` generates pin the tested 0.6.2 set; keep those pins unless you upgrade all of them together. These packages are separate from the local MCP server, `@oods/foundry`. <!-- history -->

## License

Apache License 2.0. See [LICENSE](https://cdn.jsdelivr.net/npm/@oods/components-react@0.10.2/LICENSE) and [NOTICE](https://cdn.jsdelivr.net/npm/@oods/components-react@0.10.2/NOTICE). Generated output belongs to its user; installed package dependencies retain their own licenses.
