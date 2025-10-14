# @oods/tw-variants

`@oods/tw-variants` exposes the Tailwind plugin that maps OODS context variants to design token CSS variables. The plugin reads the flattened token map emitted by `@oods/tokens` and generates region-aware utility classes.

```js
// tailwind.config.js
import { createContextVariantsPlugin } from '@oods/tw-variants';

export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  plugins: [
    createContextVariantsPlugin({
      tokensPath: './node_modules/@oods/tokens/dist/tailwind/tokens.json'
    })
  ]
};
```

The package publishes dual ESM/CJS entry points along with typed helpers so the plugin can be consumed in Node 20, Vite, and Next.js environments without additional configuration.
