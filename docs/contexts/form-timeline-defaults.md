# Form & Timeline Context Defaults

These contexts extend the region matrix to interactive flows (Form) and chronological views (Timeline). Both reuse the
same component slots (`--cmp-*`)—context classes simply remap the underlying `--context-*` variables emitted by the Tailwind
plugin. Components remain pure; spacing, typography, surfaces, and status treatments are handled declaratively.

## Form Context

Form views prioritise clarity: wider structural spacing keeps sections distinct, while field groups rely on consistent stack
rhythm so controls remain scannable. Validation states map directly to status tokens—no hand-authored colour overrides.

| Region | Spacing | Typography | Surface | Status |
| --- | --- | --- | --- | --- |
| header | spacing.inset.default | text.scale.heading-lg | surface.default | — |
| badges | — | — | — | — |
| meta | — | — | — | — |
| body | spacing.inset.default, spacing.stack.default | text.scale.label-md, text.scale.body-md, text.line-height.relaxed | surface.default | — |
| sidebar | spacing.inset.default | text.scale.body-sm | surface.subtle | — |
| footer | spacing.inset.default | text.scale.body-sm | surface.default | — |
| actions | spacing.inset.default | text.scale.label-md | surface.transparent | — |
| statusBanner | spacing.inset.default | text.scale.body-sm | status.*.surface | status.*.text |
| timeline | — | — | — | — |
| attachments | spacing.inset.compact | text.scale.body-sm | surface.subtle | — |
| comments | — | — | — | — |

**Highlights**

- Section boundaries use `spacing.inset.default`; field groups fall back to `spacing.stack.default` so long forms stay
  legible without visual clutter.
- Labels inherit `text.scale.label-md` while inputs use `text.scale.body-md`. Tokens cover font family, weight, size, and line
  height to guarantee AA at accessibility zoom levels.
- Validation, warning, info, and success states pull from `status.*` tokens. Focus rings leverage `focus.*` values, ensuring
  consistent cues across keyboard and pointer interactions.
- Status chips inside form toolbars reuse the same component—`context-form` adjusts chip padding/typography using slot tokens.

## Timeline Context

Timeline views optimise chronological scanning. Compact vertical rhythm keeps events dense, while caption-scale typography
gives timestamps and metadata a clear hierarchy. Wildcard status tokens apply tone to markers, chips, and banners.

| Region | Spacing | Typography | Surface | Status |
| --- | --- | --- | --- | --- |
| header | spacing.inset.compact | text.scale.heading-lg | surface.default | — |
| badges | spacing.inline.xs | text.scale.caption | surface.badge.* | status.*.surface |
| meta | spacing.inline.xs | text.scale.caption | surface.transparent | — |
| body | spacing.inset.compact | text.scale.body-sm, text.scale.caption, text.line-height.standard | surface.default | — |
| sidebar | spacing.inset.compact | text.scale.body-sm | surface.subtle | — |
| footer | spacing.inset.compact | text.scale.body-sm | surface.default | — |
| actions | spacing.inset.compact | text.scale.label-md | surface.transparent | — |
| statusBanner | spacing.inset.default | text.scale.body-sm | status.*.surface | status.*.text |
| timeline | spacing.stack.compact | — | surface.transparent | — |
| attachments | — | — | — | — |
| comments | — | — | — | — |

**Highlights**

- `spacing.stack.compact` keeps the stream tight without sacrificing readability; gutter spacing stays aligned through
  `spacing.inset.compact`.
- Timestamp badges and metadata use `text.scale.caption`, while narratives use `text.scale.body-sm`—ensuring triage tasks
  remain fast even in dense feeds.
- `status.*` wildcards feed markers, badges, and banners, producing consistent tone across billing, usage, and success
  events.
- The context’s region + slot variants enable utility composition (`timeline:main:divide-y`, `timeline:timeline:gap-2`)
  without bespoke CSS rules.

## Implementation Notes

1. `CONTEXT_MATRIX` is the single source of truth—update it first, then regenerate artefacts (`npm run build:tokens`) if the
   token catalogue changes.
2. Explorer demo pages (`FormPage.tsx`, `TimelinePage.tsx`) consume these defaults purely through classes and data attributes;
   no component-level logic is introduced.
3. Status chips inherit padding, font size, and focus from `context-form` / `context-timeline` hooks defined in
   `styles/layers.css`, guaranteeing consistency with list/detail treatments.
