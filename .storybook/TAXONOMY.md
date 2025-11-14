# Storybook Taxonomy

This Storybook instance uses a fixed navigation tree so reviewers can jump to the right surface quickly. Titles **must** start with one of the following top-level groups (rendered in order):

1. `Intro` — splash / release notes for public visitors (single story, no nesting).
2. `Docs` — narrative MDX pages (Contexts, Foundations, accessibility write-ups).
3. `Foundations` — token proofs, color rounds, and baseline checks.
4. `Components` — canonical UI implementations; the second level must be one of `Primitives`, `Statusables`, `Data`, or `Overlays`.
5. `Contexts` — backing providers or render contexts required by domains.
6. `Domains` — end-to-end domain flows (e.g. Billing) composed from primitives and contexts.
7. `Patterns` — composed UI patterns (headers, forms) that span multiple components.
8. `Explorer` — sandbox and diagnostics stories for the internal explorer application (components, guardrails, proofs).
9. `Brand` — cross-brand showcases, audits, and high-contrast proofs (`Brand/High Contrast/*`).

Additional rules:

- Do not re-introduce the legacy `Example/*`, `BrandA/*`, or `Tokens/*` groupings.
- Keep Stories under `Explorer/` scoped to diagnostics or sandboxes; production-ready components should live under `Components/`.
- When adding a new `Components/*` story pick the closest second-level bucket (Primitives, Statusables, Data, or Overlays); add a note here if a new bucket becomes necessary.
- Stories that demonstrate multiple flows should live under `Domains/` with the second level naming the domain and the third level naming the artifact.

Changes that expand or deviate from this tree should update this document and the backlog mission notes.
