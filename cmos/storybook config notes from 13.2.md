Great! We tripped this because the custom manager addon (apps/explorer/addons/storybook-addon-agent) is bundled the “global” way, so Storybook expects window.React/window.ReactDOM to exist before it loads. Without those globals the entire manager frame hard-crashes, which is why the Base stories went blank. The small shims we added in .storybook/preview.ts and the new .storybook/manager.ts guarantee those globals are set before either the preview or manager hydrates.

What tends to break this (and could again) is:

Swapping the manager addon over to ESM without updating its build pipeline, or
Upgrading Storybook/hot reloading in a way that clears the manager cache while reloading only the preview (so the manager re-runs before our shim).
Two things I’d do now:

Document this assumption alongside the addon—e.g. drop a short note in apps/explorer/addons/storybook-addon-agent/README that it relies on the globals from .storybook/manager.ts, so future refactors keep the shim or convert the bundle to native ESM.
Add a reminder to your upgrade checklist: if we ever migrate the addon build, remove the shim and switch the bundle to import React normally.
No further code changes needed right now; just make sure the new .storybook/manager.ts gets committed with the other Storybook config updates so the next pnpm storybook run picks it up automatically.