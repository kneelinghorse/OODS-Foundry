# Storybook Taxonomy

This Storybook instance uses a fixed navigation tree so reviewers can jump to the right surface quickly. Titles **must** start with one of the following top-level groups:

- `Foundations` — token proofs, color rounds, and baseline checks.
- `Components/Primitives` — inputs, buttons, layout primitives, and other building blocks.
- `Components/Statusables` — components that reflect status enums (badges, banners, chips, toasts).
- `Components/Data` — data presentation layers such as tables and entity snapshots.
- `Components/Overlays` — dialog, sheet, popover, tooltip, and other layered surfaces.
- `Contexts` — backing providers or render contexts required by domains.
- `Domains` — end-to-end domain flows (e.g. Billing) composed from primitives and contexts.
- `Patterns` — composed UI patterns (headers, forms) that span multiple components.
- `Explorer` — sandbox and diagnostics stories for the internal explorer application (components, guardrails, proofs).
- `Brand` — cross-brand showcases and audits.

Additional rules:

- Do not re-introduce the legacy `Example/*`, `BrandA/*`, or `Tokens/*` groupings.
- Keep Stories under `Explorer/` scoped to diagnostics or sandboxes; production-ready components should live under `Components/`.
- When adding a new `Components/*` story pick the closest second-level bucket (Primitives, Statusables, Data, or Overlays); add a note here if a new bucket becomes necessary.
- Stories that demonstrate multiple flows should live under `Domains/` with the second level naming the domain and the third level naming the artifact.

Changes that expand or deviate from this tree should update this document and the backlog mission notes.
