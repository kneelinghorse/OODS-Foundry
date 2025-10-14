# Canonical Region Specification — Sprint 03

The Sprint 03 consolidation finalises the Object-Oriented Design System (OODS) region contract. All contexts (list, detail, form, timeline, card, inline) render through the same six canonical regions. Regions define durable semantic slots; transient UI like banners or tabs render inside these slots rather than introducing new region IDs.

## Canonical Region Set

| Region ID (`CanonicalRegionId`) | Category  | Primary Responsibilities                                           | Notes |
| ------------------------------- | --------- | ------------------------------------------------------------------ | ----- |
| `globalNavigation`              | Chrome    | Workspace/product navigation, global utilities, shell scaffolding  | Optional for inline/card contexts; align to app shell guidance. |
| `pageHeader`                    | Chrome    | Title, metadata, primary actions, status badges                    | Single source of truth for hero content and key actions. |
| `breadcrumbs`                   | Chrome    | Hierarchical orientation, return-path affordances                  | Collapses into `pageHeader` when horizontal space is constrained. |
| `viewToolbar`                   | Chrome    | View-level controls (filters, density, exports, segmentation)     | Required for list contexts; optional elsewhere. |
| `main`                          | Surface   | Primary content canvas, contextual components, banners, tabs      | Banners, notifications, and tabs are authored here as composable sections. |
| `contextPanel`                  | Surface   | Secondary column for related timelines, attachments, conversations | Optional drawer/right-rail for supporting artefacts. |

### Context Coverage Matrix

| Context  | globalNavigation | pageHeader | breadcrumbs | viewToolbar | main | contextPanel | Notes |
| -------- | ---------------- | ---------- | ----------- | ----------- | ---- | ------------ | ----- |
| list     | Optional         | Required   | Optional    | Required    | Required | Optional | KPIs and saved views live in `contextPanel`; filters stay in `viewToolbar`. |
| detail   | Optional         | Required   | Recommended | Optional    | Required | Recommended | Timelines, attachments, and comments render inside `contextPanel`. |
| form     | Optional         | Required   | Optional    | Optional    | Required | Optional | Form actions live in `pageHeader`; helpers/documentation use `contextPanel`. |
| timeline | Optional         | Required   | Optional    | Required    | Required | Recommended | Activity feeds stay in `main`; channel filters surface via `viewToolbar`. |
| card     | Not used         | Optional   | Not used    | Not used    | Required | Optional | Collapse chrome slots; supporting data nests inside `contextPanel`. |
| inline   | Not used         | Optional   | Not used    | Not used    | Required | Not used | Inline summaries focus solely on the `main` surface. |

## Migration from the 11-Region Draft

Mission R3.1 reduced the draft list of 11 regions to the canonical six. Use this map when updating legacy traits or context templates. All banner-like content now lives inside the `main` region; no dedicated `statusBanner` slot remains.

| Legacy Region | New Canonical Destination(s) | Migration Guidance |
| ------------- | ---------------------------- | ------------------ |
| header        | pageHeader                   | Merge title, metadata, and hero actions into the unified header slot. |
| badges        | pageHeader                   | Render status chips and counts alongside primary header content. |
| meta          | pageHeader                   | Fold secondary metadata into header body copy. |
| actions       | pageHeader / viewToolbar     | Keep object actions in `pageHeader`; move view controls into `viewToolbar`. |
| body          | main                         | Primary content remains the canonical `main` surface. |
| sidebar       | contextPanel                 | Rename and retain as the supporting column/drawer. |
| footer        | main                         | Render inline as a section inside `main`; avoid a dedicated footer region. |
| statusBanner  | main                         | Treat banners as contextual sections mounted within `main`. |
| timeline      | main / contextPanel          | Prefer `main` for primary feeds; optionally mirror in `contextPanel`. |
| attachments   | contextPanel                 | Group supporting artefacts with other side-panel content. |
| comments      | contextPanel                 | Collocate collaborative threads in the supporting panel. |

The migration preserves trait determinism: adding or removing a trait only affects the targeted region. When porting older templates, ensure all IDs are normalised via `resolveCanonicalRegionId` and avoid resurrecting obsolete identifiers.

## Authoring Checklist

- ✅ Target only the six canonical region IDs. Run `npm run validate:pipeline` to catch typos or legacy IDs.
- ✅ Place banners, tabs, alerts, and other transient content inside `main`. Do not introduce new top-level regions for these patterns.
- ✅ Document responsive collapse rules (e.g., `contextPanel` as drawer) in context-level specs.
- ✅ Include debug snapshots (`RenderObject debug`) during reviews to confirm region/extension coverage.

## References

- `app/src/types/regions.ts` — source of truth for `REGION_ORDER` and legacy alias resolution.
- `missions/research/r3.1_Page-Level Region Models.md` — rationale for consolidating the original 11-region draft.
- `docs/Canonical Region Contract.md` — token, Figma, and implementation guidance for each canonical region.
