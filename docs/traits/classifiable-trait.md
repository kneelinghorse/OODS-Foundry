# Classifiable Trait

> Core taxonomy + folksonomy capability incorporating the R21.4 Classifiable research track. Enables canonical category trees (PostgreSQL ltree) and governed tags (Stack Overflow synonym pattern) with identical metadata in TypeScript (Zod) and JSON Schema (Ajv).

## Why Classifiable?

1. **Multi-mode classification** — `classification_mode` toggles taxonomy, tag, or hybrid storage. Defaults follow [R21.4 Deep Dive](../../cmos/research/R21.4_Deep-Dive-Implementation-Research-for-the-Classifiable-Core-Trait.md): materialized-path (`ltree`) for hierarchies, Stack Overflow pattern for tags.
2. **Governance baked in** — `tag_policy`, `tagLimit`, and `governance.spamHeuristics` codify synonym handling, moderation queues, and anti-spam heuristics so folksonomy does not overwhelm taxonomy.
3. **Canonical value objects** — `CategoryNode`, `Tag`, and `ClassificationMetadata` expose a single source of truth with Zod + JSON Schema parity. Runtime helpers ensure inputs collapse to deterministic IDs, slugs, and ltree paths for <3 ms subtree queries.

## Decision Table (R21.4 → Trait Parameters)

| Scenario | `classification_mode` | `hierarchy_storage_model` | `tag_policy` | Notes |
| --- | --- | --- | --- | --- |
| E-commerce taxonomy (ltree) | `taxonomy` | `materialized_path` | `locked` | ltree path persisted in `CategoryNode.ltreePath`; requires admin curation. |
| Social tagging | `tag` | `adjacency_list` | `open` | Taxonomy omitted; `Tag` governance enforces synonym + spam heuristics. |
| CMS hybrid (WordPress pattern) | `hybrid` | `materialized_path` | `moderated` | WordPress three-table model; taxonomy + tag experiences share `terms` table while moderation prevents spam. |
| Deep knowledge graph | `taxonomy` | `closure_table` | `locked` | Expensive writes but supports extremely deep hierarchies; see R21.4 §2.3. |

## Canonical Schemas & Helpers

| Value Object | Location | Description |
| --- | --- | --- |
| `CategoryNode` | [`src/schemas/classification/category-node.ts`](../../src/schemas/classification/category-node.ts) / [`schemas/classification/category-node.schema.json`](../../schemas/classification/category-node.schema.json) | Normalizes identifiers, slugs, ancestors, and `ltreePath` segments. Supports derived depth + metadata for governance dashboards. |
| `Tag` | [`src/schemas/classification/tag.ts`](../../src/schemas/classification/tag.ts) / [`schemas/classification/tag.schema.json`](../../schemas/classification/tag.schema.json) | Enforces synonym dedupe, state machine (`active | pending_review | archived`), and moderation metadata. |
| `ClassificationMetadata` | [`src/schemas/classification/classification-metadata.ts`](../../src/schemas/classification/classification-metadata.ts) / [`schemas/classification/classification-metadata.schema.json`](../../schemas/classification/classification-metadata.schema.json) | Stores effective mode, hierarchy storage model, tag policy, and governance heuristics for audits + diagnostics. |
| `Term`, `TermTaxonomyEntry`, `TermRelationship` | [`src/schemas/classification/term.ts`](../../src/schemas/classification/term.ts), [`term-taxonomy.ts`](../../src/schemas/classification/term-taxonomy.ts), [`term-relationship.ts`](../../src/schemas/classification/term-relationship.ts) | Canonical WordPress-style identity + usage models guaranteeing taxonomy + tag rows share the same slug/term metadata. |
| `classification.categories` (DDL) | [`database/migrations/20251118_b26_2_ltree_infrastructure.sql`](../../database/migrations/20251118_b26_2_ltree_infrastructure.sql) | Canonical Postgres schema with ltree paths, adjacency fallback, closure table, and `reparent_category` helper (<3 ms subtree reads, <10 ms reparent). |
| `classification.terms`, `term_taxonomy`, `term_relationships` (DDL) | [`database/migrations/20251119_b26_5_hybrid_bridge.sql`](../../database/migrations/20251119_b26_5_hybrid_bridge.sql) | WordPress bridge tables separating identity (terms) from role (taxonomy) plus relationship counts + triggers that keep taxonomy/tag modes in lockstep. |
| `LtreeQueryService` | [`src/services/classification/ltree-query-service.ts`](../../src/services/classification/ltree-query-service.ts) | Dialect-aware Node helper that builds paths, fetches subtrees/ancestors, and re-parents nodes via Postgres (`classification.reparent_category`) or sqlite mocks (sql.js). |
| `HybridTermAdapter` | [`src/services/classification/hybrid-term-adapter.ts`](../../src/services/classification/hybrid-term-adapter.ts) | Type-safe adapter that upserts canonical terms, taxonomy usages, and object relationships in both Postgres and sql.js (tests mirror WordPress 3-table semantics). |

The JSON Schema artifacts feed `json-schema-to-typescript`, emitting typed DTOs under [`generated/types/classification`](../../generated/types/classification). Ajv can validate persisted payloads directly, ensuring parity between runtime (Zod) and transport contracts.

## Trait Definition

- YAML: [`traits/core/Classifiable.trait.yaml`](../../traits/core/Classifiable.trait.yaml)
- TypeScript: [`traits/core/Classifiable.trait.ts`](../../traits/core/Classifiable.trait.ts)

**Parameters**

| Parameter | Type | Default | Notes |
| --- | --- | --- | --- |
| `classification_mode` | enum (`taxonomy | tag | hybrid`) | `hybrid` | Switches between pure taxonomy, pure tags, or WordPress hybrid. |
| `hierarchy_storage_model` | enum (`adjacency_list | materialized_path | closure_table`) | `materialized_path` | Governs DB DDL; defaults to PostgreSQL `ltree` (see R21.4 §2.2). |
| `tag_policy` | enum (`locked | moderated | open`) | `moderated` | Ties into governance heuristics + moderation queues. |
| `max_tags` | number (1–50) | `10` | Hard cap on canonical tags per object after synonym collapse. |
| `require_primary_category` | boolean | `false` | Enforces a breadcrumb anchor in taxonomy/hybrid modes. |

**Schema Highlights**

- `categories: CategoryNode[]` — Derived taxonomy nodes with ltree-aware identifiers.
- `tags: Tag[]` + `tag_count` + `tag_preview` — Folksonomy projection with pre-computed display strings.
- `classification_metadata: ClassificationMetadata` — Captures the applied mode, storage strategy, tag policy, and governance heuristics for diagnostics + contexts.

**Semantics & Views**

- `CategoryBreadcrumb`, `ClassificationBadge`, and `ClassificationPanel` connect taxonomy data to list/detail/form contexts.
- Token namespace `classification.*` enforces CSS variable usage (`--sys-*`, `--cmp-*`) per purity guardrails.

## Runtime Usage

```ts
import { normalizeCategoryNode } from '@/schemas/classification/category-node.ts';
import { normalizeTag } from '@/schemas/classification/tag.ts';
import { normalizeClassificationMetadata } from '@/schemas/classification/classification-metadata.ts';
import { LtreeQueryService } from '@/services/classification/ltree-query-service.ts';

const metadata = normalizeClassificationMetadata({
  mode: 'hybrid',
  hierarchyStorageModel: 'materialized_path',
  tagPolicy: 'moderated',
});

const categories = [
  normalizeCategoryNode({
    id: 'electronics',
    name: 'Electronics',
    path: '/electronics',
  }),
  normalizeCategoryNode({
    id: 'mobile-phones',
    name: 'Mobile Phones',
    ancestors: ['electronics'],
  }),
];

const tags = [
  normalizeTag({ id: 'javascript', name: 'JavaScript', synonyms: ['js'] }),
  normalizeTag({ id: 'ux', name: 'UX', state: 'pending_review' }),
];

const snapshot = {
  classification_metadata: metadata,
  categories,
  tags,
  tag_count: tags.length,
};

const taxonomyQueries = new LtreeQueryService(pgClient, {
  dialect: 'postgres',
});

const subtree = await taxonomyQueries.fetchSubtree({
  tenantId: 'tenant-a',
  path: 'electronics.mobile',
  includeRoot: false,
});

await taxonomyQueries.reparentSubtree({
  tenantId: 'tenant-a',
  categoryId: 'cat-accessories',
  newParentId: 'cat-mobile',
  actor: 'migration-script',
});
```

## Hybrid Mode (WordPress Bridge)

Hybrid deployments rely on the canonical `terms` ➝ `term_taxonomy` ➝ `term_relationships` trio. The pattern mirrors WordPress so a single slug (“news”) can act as both a hierarchical category and a flat tag without collisions:

1. **Identity (`classification.terms`)** — Normalizes slugs + descriptions once per tenant. All taxonomy/tag rows reference this table so governance (synonyms, locked words, etc.) happens in one place.
2. **Role (`classification.term_taxonomy`)** — Binds a term to a taxonomy (`category`, `tag`, `custom`). Each row can optionally point to a canonical category or tag record while storing hierarchy metadata (`hierarchy_path`, `depth`). Relationship counts are maintained by triggers for cache sizing.
3. **Relationships (`classification.term_relationships`)** — M:N bridge between domain objects and taxonomy entries. The table is append-only with automatic count updates and carries an optional `field` for primary/secondary markers.

### Caching Strategy

- **Slug cache** — Preload all `(taxonomy, slug) → term_taxonomy_id` pairs per tenant at process start (or lazy-load with LRU). The dataset is small (≤30 KB) and saves an extra join every time a category or tag needs to be resolved.
- **Hierarchy snapshots** — Keep the `hierarchy_path` and `parent_term_taxonomy_id` columns in memory for each taxonomy row. UI components (breadcrumbs, tree pickers) can read these snapshots instead of hitting the database for recursive queries.
- **Relationship fan-out** — For read-heavy contexts, fetch all `term_relationships` for a given object in a single query and cache the result with a short TTL (≤1 minute). The trigger-updated `relationship_count` flag lets you size caches and detect pathological over-classification.

### Invalidation & Diagnostics

- Use `updated_at` from `terms` and `term_taxonomy` as the cache version key. Triggers touch the column on every mutation so polling once per minute (or subscribing to logical decoding) keeps caches fresh without webhooks.
- `term_relationships` triggers increment/decrement `relationship_count`. When the count changes by >5 in a single transaction, emit a diagnostic log (or span) to flag runaway automation.
- `HybridTermAdapter.assignRelationship` guarantees idempotent inserts via `ON CONFLICT` so you can safely replay events from CDC streams without double-linking.
- Invalidations should cascade to search indexes: when a `term_taxonomy` row updates, reindex all objects whose relationships target that row. Use the `term_relationships` table as the authoritative source of affected object IDs.

## Testing & Validation

- `tests/schemas/classification.test.ts` covers normalization of ltree paths, synonym handling, and governance defaults.
- `tests/services/classification/ltree-query-service.spec.ts` exercises sqlite-backed mocks (sql.js) for subtree, ancestor, and reparent flows while enforcing the <10 ms reparent SLA.
- `tests/services/classification/hybrid-term-adapter.spec.ts` validates the WordPress bridge adapter: canonical terms shared between taxonomy + tags and relationship counts driven by triggers.
- Ajv validation can load the JSON Schemas directly (see `scripts/types/generate.ts` for generation pipeline).

## References

- [R21.4 Classifiable Implementation Deep Dive](../../cmos/research/R21.4_Deep-Dive-Implementation-Research-for-the-Classifiable-Core-Trait.md)
- [Core Traits Specification Draft (Classifiable section)](../../cmos/planning/Core_Traits_Specification_Draft.md)
- [Folksonomy Governance Guide](./folksonomy-governance.md)
