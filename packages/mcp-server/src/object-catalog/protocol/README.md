# Object Catalog protocol contracts (Forge-owned)

These files are the semantic-protocol contract data Forge owns (decision #634).
They were relocated here in **s106-m02** out of the deleted `src/concordance/`
tree when the Concordance integration was torn down (decision #633). Concordance
was sunset; there is no external upstream to coordinate with anymore.

| File | Role | Consumed by |
|------|------|-------------|
| `manifest.schema.json` | Frozen SemanticManifest envelope (was Concordance wire 1.0.0). Structural contract for Object Catalog manifests. | `../manifest-validator.ts` (Object Catalog G1 gate). **This is live.** |
| `pragmatic-roles.json` | Closed `pragmatic_role` enum, v4.1 (10 values): the original 6 + the 4 page/IA roles added in s106-m03 (`page`, `landing`, `section`, `index`). Carries the `action_shaped` subset (original 4) and the `page_ia` subset. | **Reference data only** — see note below. |
| `edge-types.json` | Closed edge-type vocabulary. | Reference data (no runtime consumer). |
| `task-types.json` | Task-type weights vocabulary. | Reference data (no runtime consumer). |

## Where the LIVE pragmatic_role enum is (read before editing it)

`pragmatic-roles.json` is **reference data, not the validation source.** Nothing
in `src/` imports it. The enum that actually drives validation and codegen is
hardcoded in three places that must stay in sync:

1. `../schema.json` → `$defs.PragmaticRole.enum` (the AJV-validated enum)
2. `../types.ts` → `PragmaticRole` TypeScript union
3. `manifest.schema.json` → `$defs.PragmaticRole.enum` (the frozen envelope copy)

To expand `pragmatic_role`, edit those three plus this reference file. The
display labels in `../../codegen/*-emitter.ts` (`ROLE_LABEL`, an exhaustive
`Record<PragmaticRole, string>`) also enumerate the values and need a new entry
per added role or TS will fail. The action-shaped `if-then` validator in
`schema.json` / `manifest.schema.json` is an allowlist of the 4 action roles —
non-action roles you add do NOT need to touch it. (s106-m03 added the 4 page/IA
roles this way; existing 6 unchanged.)
