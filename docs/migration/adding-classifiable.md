# Migration Guide: Adding Classifiable to Product & Content Objects

Sprint 26 introduces the `core/Classifiable` trait to canonical Product and new content objects so taxonomy (categories) and folksonomy (tags) are modeled consistently across the Universal Quintet. Product now runs in **taxonomy mode**, while Article and Media demonstrate **hybrid/tag modes**. This guide outlines what changed, how to migrate downstream consumers, and which tests verify the work.

## Summary of Changes

- **Product** now composes `core/Classifiable` (taxonomy mode) for hierarchical category paths and breadcrumbs. The previous `behavioral/Taggable` trait has been replaced with structured `Tag[]` payloads.
- **Article** (new) composes the trait in **hybrid mode** so detail pages can show breadcrumbs plus governed tag chips.
- **Media** (new) composes the trait in **tag mode**, unlocking asset folksonomies and search filtering.
- `generated/objects/*.d.ts` include the new classification value objects (`CategoryNode`, `ClassificationMetadata`, `Tag`) for Product, Article, and Media.
- `src/search/faceted-search.ts` exposes helpers for building simple faceted search UIs (filtering, bucket counts, breadcrumbs).
- Storybook story (`Objects/Product/ProductCategoryBrowser`) showcases taxonomy browsing plus article tags.
- Integration test `tests/integration/classifiable-composition.test.ts` verifies composition + search helpers.

## Data Model Impact

| Field | Objects | Type | Notes |
|-------|---------|------|-------|
| `classification_metadata` | Product, Article, Media | `ClassificationMetadata` | Always present; describes mode, storage model, governance, and audit timestamps. |
| `categories` | Product, Article, Media (taxonomy/hybrid) | `CategoryNode[]` | Ordered list of attached taxonomy nodes. Empty for tag-only mode. |
| `primary_category_id` / `primary_category_path` | Product, Article, Media | `string` | Drives breadcrumb + default filter surfaces. Required when `require_primary_category=true`. |
| `tags` | Article, Media (Product when hybrid/tag) | `Tag[]` | Canonical tag objects with synonym + moderation metadata. Replaces string arrays from `Taggable`. |
| `tag_count` / `tag_preview` | All | `number` / `string` | Derived preview data for list contexts and search indexing. |

**Breaking change:** `Product.tags` transitioned from `string[]` to `Tag[]`. If downstream systems still expect raw strings, map to `tag.name` during serialization. The migration steps below include guidance.

## Migration Steps

1. **Regenerate types** – Already committed via `pnpm generate:objects`, but re-run locally if you have custom tooling that consumes the generator output.
2. **Update DTOs / contracts** – When projecting Product data externally, convert `Tag[]` to the appropriate representation (`tag.name`, `tag.slug`, or preserve the full object if the consumer understands the richer schema).
3. **Storage migrations** – Add JSON columns (or JSONB arrays) for `classification_metadata`, `categories`, `tags`, and `tag_preview` in any persistence layer that stores Product, Article, or Media data. For legacy rows, seed empty arrays and default metadata.
4. **Breadcrumbs** – Use `CategoryBreadcrumb` (already exported) together with `buildCategoryBreadcrumb` from `src/search/faceted-search.ts` to render category paths on product detail pages.
5. **Faceted search** – Replace ad-hoc filters with the new helpers:
   ```ts
   import { runFacetedSearch } from '@/search/faceted-search';

   const { items, categories, tags } = runFacetedSearch(dataset, {
     categoryIds: ['cat_mobile'],
     tagSlugs: ['taxonomy'],
   });
   ```
6. **Examples + docs** – Reference `examples/objects/product-with-categories.ts` and `examples/objects/article-with-hybrid.ts` for canonical payloads, and link to the new Storybook story for visual guidance.

## Testing Checklist

- [x] `pnpm generate:objects`
- [x] `pnpm vitest run tests/integration/classifiable-composition.test.ts`
- [ ] Run domain-level regression suites (commerce, CMS, DAM) once downstream services adopt the new JSON fields.
- [ ] Execute Storybook smoke test (`pnpm storybook`) to inspect the `Objects/Product/ProductCategoryBrowser` story manually if UI regressions are suspected.

## Operational Guidance

- **Backwards compatibility** – Expose both `tag_preview` (string) and full `tags` arrays during rollout. Clients that cannot yet parse `Tag[]` can keep using the preview string while modern consumers render governed tag chips.
- **Governance settings** – `classification_metadata` is now the source of truth for moderation, synonym behavior, and storage model per object. Avoid duplicating these settings in app-level config.
- **Search indexing** – Use `categories` (for taxonomy facets) and `tags` (for tag facets) when populating search documents. The helper module normalizes counts to keep the UI in sync with the data exported to your search backend.
- **Monitoring** – Add telemetry for `tag_count` and category path depth to detect runaway tagging or misclassified products. The metadata object already tracks `lastIndexedAt` and dataset versions for auditability.

Reach out to `taxonomy@oods.systems` for assistance mapping legacy tags to the new canonical structures or extending the trait to additional objects.
