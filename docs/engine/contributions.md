# Trait Contribution Registry

Traits can now register lightweight UI fragments that are scoped to a specific render context and canonical region. The contribution registry coordinates these fragments so `RenderObject` can merge them with existing view extensions without any trait needing to know about layout details.

## Why contributions?

* Canonical contexts (detail, list, form, timeline, …) often need unique chrome.
* Traits own their semantics; views own layout. Contributions let traits sprinkle context-aware UI (status chips, toolbars, timelines) into the correct slots without duplicating templates.
* Contributions respect the same priority pipeline as traditional view extensions, so modifiers and wrappers continue to compose correctly.

## API surface

```ts
import {
  registerContribution,
  collectContributionExtensions,
  type ContributionRegistration,
} from '../../src/engine/contributions/index.js';
```

### `registerContribution`

Registers a contribution for a trait. Each registration supplies:

| Field | Notes |
| --- | --- |
| `id` | Unique per trait. Re-registering with the same `id` replaces the entry. |
| `traitId` | Trait adapter `id` (after any overrides). |
| `context` | Single `ContextKind` or array. Only matching contexts render the contribution. |
| `region` | Canonical region id (`pageHeader`, `viewToolbar`, …). |
| `type` | Optional extension type (`section`, `action`, `wrapper`, `modifier`). Defaults to `section`. |
| `priority` | Optional numeric priority; defaults to the regular extension priority. |
| `render` | `(ctx) => ReactNode`. Only invoked when the contribution is eligible. |
| `when` | Optional predicate for additional gating. |
| `metadata` | Optional `ViewExtensionMetadata` (tags, notes, etc.). `sourceTrait` falls back to `traitId` and a `contribution` tag is appended automatically. |

### `collectContributionExtensions`

```ts
const extensions = collectContributionExtensions({
  object,           // ObjectSpec<Data>
  context,          // ContextKind (detail, list, …)
  renderContext,    // RenderContext<Data>
});
```

Returns an array of `ViewExtension` instances derived from registered contributions for the requested context. `RenderObject` appends these extensions to the trait-provided ones before running the compositor, so everything flows through the existing priority/condition pipeline.

### Reset helpers

`clearContributions()` and `listRegisteredContributionIds(traitId)` are exported for tests and diagnostics.

## Registering contributions in a trait

```ts
registerContribution<{ status?: string }>({
  id: 'statusable:page-header:chip',
  traitId,
  context: ['detail', 'list', 'form'],
  region: 'pageHeader',
  priority: 40,
  render: ({ renderContext }) => {
    const status = renderContext.data.status;
    if (!status) return null;
    return <Badge status={status} emphasis="solid" />;
  },
});
```

Best practices:

1. **Scope narrowly.** Register only for contexts where the UI is meaningful. Use `context` arrays and `when` guards liberally.
2. **Stay composable.** Contributions should render semantic React nodes (never raw strings) and rely on design-system components or semantic tokens—no bespoke CSS.
3. **Provide stable ids.** Prefix ids with the trait name and region to keep Chromatic snapshots stable (`statusable:timeline:event-stream`).
4. **Share options.** Wrap registration in trait factory helpers so options (e.g., max visible tags) feed both the trait adapter and the contribution renderers.

## Integrating with `RenderObject`

`RenderObject` now combines trait extensions and contributions automatically:

```ts
const traitExtensions = resolveTraitExtensions(object, renderContext);
const contributionExtensions = collectContributionExtensions({ object, context, renderContext });
const regions = composeExtensions([...traitExtensions, ...contributionExtensions], renderContext);
```

No changes are required for existing stories or consumers—the registry is internal to the engine, and contributions render wherever the context’s view profile exposes a matching region.

## Debugging contributions

* Enable `debug` mode on `<RenderObject>` to see contribution ids and ordering in the rendered report.
* Use `listRegisteredContributionIds(traitId)` in tests to assert registrations.
* Contributions share the same error handling pipeline as trait views. If `render` throws, the optional `onTraitViewError` hook receives the exception when `RenderObject` is in debug mode.
