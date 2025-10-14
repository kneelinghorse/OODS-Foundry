# Canonical Region Contract (R3.1)

The canonical region set finalised in mission R3.1 defines six durable semantic slots that anchor every OODS view context. This document captures the token prefixes, Figma mapping guidance, and authoring notes required by downstream design and build flows.

## Region Quick Reference

| Region ID (`CanonicalRegionId`) | Token Prefix          | Figma Frame / Slot               | Default Layout Behavior                                  | Notes for Designers & Engineers |
| ------------------------------- | --------------------- | -------------------------------- | -------------------------------------------------------- | -------------------------------- |
| `globalNavigation`              | `region.globalNavigation` | `Page › Chrome › Global Nav`       | Fixed-width column on the left; sticky scroll preferred. | Optional in inline/card contexts; hosts workspace switchers and product nav. |
| `pageHeader`                    | `region.pageHeader`   | `Page › Chrome › Header`         | Full-width top strip above content canvas.               | Single source of truth for title, meta, primary actions, status badges. |
| `breadcrumbs`                   | `region.breadcrumbs`  | `Page › Chrome › Breadcrumbs`    | Inline list aligned with header baseline.                | Collapses into `pageHeader` when space constrained (card/inline). |
| `viewToolbar`                   | `region.viewToolbar`  | `Page › Chrome › Toolbar`        | Horizontal bar below header; responsive wrap on small widths. | Houses filters, density toggles, exports, view switchers. |
| `main`                          | `region.main`         | `Page › Surface › Main`          | Flexible primary canvas; supports stacked or split layouts. | Hosts contextual components (banners, tabs, notifications) per mission guidance. |
| `contextPanel`                  | `region.contextPanel` | `Page › Surface › Context Panel` | Secondary column on right; collapsible/drawer on narrow layouts. | Home for attachments, timelines, conversations, checklists, AI copilots. |

## Token Contract

- **Color:** Each `region.<id>.bg` and `region.<id>.fg` maps to semantic background/foreground tokens. Page chrome regions default to `surface/chrome`, content regions to `surface/base`. Support high-contrast overrides via `region.<id>.bgHigh` and `.fgHigh`.
- **Spacing:** Establish horizontal gutters via `region.<id>.paddingX` (default `space.600` for chrome, `space.700` for content) and `paddingY` (chrome: `space.400`, content: `space.500`). Context panels use `space.500` to align with Carbon’s right panel rhythm.
- **Elevation:** Chrome regions share `region.chrome.elevation` token (base = `elevation.raised`); `contextPanel` can opt into `elevation.overlay` when rendered as drawer.
- **Typography:** `pageHeader` ties to `type.heading.lg` for titles and `type.body.sm` for metadata. Toolbars and breadcrumbs inherit `type.body.sm`.
- **Divider:** Provide `region.viewToolbar.divider` and `region.contextPanel.border` to standardize separators across implementations.

## Figma Mapping Guidance

1. **Library Slots:** Add six auto-layout frames under `Page` component matching the frame names above. Apply tokenized styles to confirm parity with code constants.
2. **Variants:** Expose toggles for `hasBreadcrumbs`, `hasToolbar`, and `hasContextPanel` to allow context-specific previews. Inline/card variants disable navigation & toolbar slots by default.
3. **Annotations:** Use shared annotations to document conditional usage (e.g., “Toolbar optional for detail contexts; required for analytics lists”).
4. **Handoff:** Ensure exports reference the `CanonicalRegionId` exactly; DesignOps automation will sync with `types/regions.ts`.

## Authoring Checklist

- ✅ Use only the six canonical IDs when defining `viewExtensions` or context templates.
- ✅ If a prior component targeted `statusBanner`, `timeline`, `attachments`, or `comments`, retarget to `main` or `contextPanel` per migration table.
- ✅ When a layout omits `globalNavigation`, ensure `pageHeader` retains product orientation affordances.
- ✅ Document responsive collapse rules (e.g., `contextPanel` → drawer) in the View Context spec.

## Open Questions for B3.1

1. Do we enforce a minimum width for `contextPanel` across contexts or allow template-level overrides?
2. Should `globalNavigation` expose a collapsed “rail” sub-variant in `REGION_ORDER` metadata?
3. How do we expose token fallbacks for legacy themes lacking chrome-specific values?

Document steward: View Engine team (update with mission R3.2/B3.1 outcomes as contracts evolve).
