# @oods/components-vue

Vue components used by screens generated with OODS Foundry. The package exports controls, layouts and domain views; `@oods/component-styles` provides their CSS.

## Install

```sh
npm install @oods/components-vue @oods/component-styles @oods/tokens @oods/component-contracts vue
```

Use Vue 3. Bring your existing Vue app or use OODS Foundry's `code_generate` with `options.output: "application"` for an app entry and Vite configuration.

## First result

```vue
<script setup>
import { Button } from '@oods/components-vue';
import '@oods/component-styles/css';
const review = () => window.alert('Connect this action to your application.');
</script>

<template>
  <Button content="Review stock" intent="primary" @activate="review" />
</template>
```

Set `data-brand="A"` and `data-theme="light"` on the root HTML element. The result is a button labelled “Review stock” that invokes the supplied handler. Set the theme to `dark` or `hc` for those scopes.

Generated sample screens identify their sample data. A workflow's local store is not a production database; supply your data, navigation and persistence handlers. Retained component evidence covers named scenarios and themes, not every application you build. For your own implementation of a shipped component, use OODS Foundry's substitution mapping and inspect its advisory contract report.

## Limits

Use one version of the OODS packages together. Apps that `@oods/foundry` generates pin the tested 0.6.2 set; keep those pins unless you upgrade all of them together. These packages are separate from the local MCP server, `@oods/foundry`. <!-- history -->

## License

Apache License 2.0. See [LICENSE](https://cdn.jsdelivr.net/npm/@oods/components-vue@0.11.0/LICENSE) and [NOTICE](https://cdn.jsdelivr.net/npm/@oods/components-vue@0.11.0/NOTICE). Generated output belongs to its user; installed package dependencies retain their own licenses.
