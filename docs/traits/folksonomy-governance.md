# Folksonomy Governance Guide

Mission **B26.4** adds the final governance layer on top of the Classifiable trait so tags stay useful even as communities introduce thousands of alternates. This guide summarizes the schema changes, runtime services, and admin workflows required to operate the Stack Overflow–style "root tag" pattern inside OODS Foundry.

## Canonical Storage & Schema

The `classification.tags` table (see `database/migrations/20251118_tag_governance.sql`) persists every canonical tag with:

- `name`, `slug`, `usage_count`, `state`, `is_canonical`
- `synonyms[]` – normalized alternates that collapse to the canonical slug
- `metadata` – moderation hints, spam fingerprints, external IDs

Supporting tables:

| Table | Purpose |
| --- | --- |
| `classification.tag_synonyms` | Source → canonical mapping used by CLI + services |
| `classification.tag_relationships` | Object ↔ tag join table so merges can reassign relationships transactionally |
| `classification.tag_moderation_queue` | Pending/approved/rejected tag submissions |
| `classification.tag_audit_log` / `tag_merges` | Immutable audit + merge telemetry for diagnostics |

`classification.merge_tags()` wraps the full workflow: lock rows, union synonyms, rewrite relationships (`classification.tag_relationships`), insert audit events, and delete the source tag. It is safe to call from application code or CLI tooling.

## Runtime Services

New runtime modules live under `src/traits/classifiable/tag/`:

| Module | Responsibility |
| --- | --- |
| `tag-manager.ts` | High-level orchestration (create, addSynonym, merge, detectSpam) with audit logging |
| `tag-merger.ts` | Pure merge logic that handles relationship reassignment + synonym promotion |
| `synonym-mapper.ts` | Root-tag resolver (slug/synonym → canonical tag) enforcing one alias → one canonical rule |
| `spam-detector.ts` | Heuristic rules: low reputation single-use tags, suspicious patterns (URLs/profanity), velocity guardrails, per-item tag caps |

```ts
import { TagManager } from '@/traits/classifiable/tag/tag-manager.ts';
import { SpamDetector } from '@/traits/classifiable/tag/spam-detector.ts';
import { InMemoryTagRepository } from '@/tests/fixtures/tags';

const manager = new TagManager({
  repository: new InMemoryTagRepository(),
  spamDetector: new SpamDetector({ reputationThreshold: 25 }),
});

const creation = await manager.create(
  { name: 'JavaScript', synonyms: ['js', 'ecmascript'] },
  {
    actor: 'taxonomy-admin',
    spamContext: { userId: 'taxonomy-admin', userReputation: 80, recentCreations: [] },
  }
);

if (creation.created) {
  console.log('Canonical tag id', creation.tag.id);
}
```

## Admin Workflows

1. **Synonym approvals** – surfaced through `<TagGovernanceDashboard>` (`src/components/classification/TagGovernanceDashboard.tsx`). Review queued alternates, approve, and the TagManager updates synonyms + audit log.
2. **Merge duplicates** – rely on merge suggestions (usage overlap, synonyms). Trigger `TagManager.merge(sourceId, targetId, actor)`; the stored procedure and runtime service both call `classification.merge_tags()` to ensure relationships update atomically.
3. **Spam triage** – heuristics feed the moderation queue. Approving a finding records a `tag_audit_log` entry; rejecting keeps the synonym blocked.

## CLI & Diagnostics Hooks

- CLI commands (`./cmos/cli.py mission ...`) can call `classification.merge_tags()` for bulk merges.
- Diagnostics ingest the `tag_merges` table to report affected relationships, providing visibility into folksonomy debt.
- `docs/traits/classifiable-trait.md` links back here for governance specifics.

## References

- [R21.4 Deep Dive – Folksonomy](../../cmos/research/R21.4_Deep-Dive-Implementation-Research-for-the-Classifiable-Core-Trait.md)
- [Stack Overflow Root Tag Pattern](https://stackoverflow.blog/2010/08/02/stack-overflow-tags-a-three-year-retrospective/)
- Mission B26.4 success criteria (`cmos/missions/backlog.yaml`)
