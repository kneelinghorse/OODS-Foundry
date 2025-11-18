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
```

## Testing & Validation

- `tests/schemas/classification.test.ts` covers normalization of ltree paths, synonym handling, and governance defaults.
- Ajv validation can load the JSON Schemas directly (see `scripts/types/generate.ts` for generation pipeline).

## References

- [R21.4 Classifiable Implementation Deep Dive](../../cmos/research/R21.4_Deep-Dive-Implementation-Research-for-the-Classifiable-Core-Trait.md)
- [Core Traits Specification Draft (Classifiable section)](../../cmos/planning/Core_Traits_Specification_Draft.md)
