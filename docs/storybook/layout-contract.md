# Storybook Layout Contract

Story containers are responsible for spacing and rhythm. Components remain pure; wrappers apply padding,
max-width constraints, and page chrome so demos render the way they appear in product surfaces.

## Layout Parameters

- `layout: 'centered'` — use for single-component demos that should float in the canvas. Override on a per-story basis when the default wrapper (below) is registered.
- `layout: 'fullscreen'` — required for page-level, grid, or status galleries so their container can stretch to the viewport. This is now the default for Statusables and domain render-object stories.
- `layout: 'padded'` — only for dense component tables that rely on Storybook’s intrinsic gutters. Avoid mixing with the page wrapper.

## `withPage` decorator

`~/.storybook/decorators/withPage` exports `withPage(options)`:

- Applies `var(--cmp-spacing-inset-spacious)` padding, canvas surface/background, and a grid gap of `var(--cmp-spacing-stack-default)`.
- Constrains content to `min(72rem, 100%)` by default so stories read like application pages.
- Pass `{ fullWidth: true }` for full-bleed surfaces (e.g. `Banner`, `PageHeader`) that need edge-to-edge layout.
- Use `position: 'center'` when a story needs vertical centering (rare; most pages stay top-aligned).

Add the decorator at the story meta level, then opt individual stories into `layout: 'centered'` when you need float-in-place behaviour. All statusable galleries and render-object stories now inherit the wrapper and explicitly choose `fullscreen` so Chromatic snapshots match product rhythm without manual div scaffolding.
