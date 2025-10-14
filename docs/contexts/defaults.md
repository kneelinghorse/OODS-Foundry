# Context Defaults (List & Detail)

Context classes deliver opinionated spacing and typography deltas without touching component code. Each context toggles `--context-*` variables that cascade into component slots (`--cmp-*`), keeping React trees pure and themeable.

## Applying Context Classes

```tsx
<section className="context-list">
  <header data-region="header">Summary</header>
  <div data-region="body">…</div>
  <footer data-region="footer">Actions</footer>
</section>
```

- Attach exactly one `context-*` class to the layout root (`context-list`, `context-detail`, `context-form`, etc.).
- Annotate canonical regions with `data-region` attributes. The Tailwind plugin emits both context and region variants, so utilities such as `detail:body:gap-6` are available out of the box.
- Components never read `--context-*` directly; they stick to slot-level tokens (for example `--cmp-spacing-inset`). The stylesheets bridge slot tokens back to context variables.

## List Defaults

List views maximise scannability. Spacing squeezes toward the compact end of the scale while typography drops to `text.scale.body-sm` for dense cards.

| Region | Spacing | Typography | Surface | Status |
| --- | --- | --- | --- | --- |
| header | spacing.inset.compact | text.scale.heading-lg, text.line-height.tight | surface.default | — |
| badges | spacing.inline.xs | text.scale.caption | surface.badge.* | status.*.surface |
| meta | spacing.inline.xs | text.scale.caption | surface.transparent | — |
| body | spacing.inset.condensed | text.scale.body-sm | surface.default | — |
| sidebar | spacing.inset.compact | text.scale.body-sm | surface.subtle | — |
| footer | spacing.inset.compact | text.scale.body-sm | surface.default | — |
| actions | spacing.inset.compact | text.scale.label-md | surface.transparent | — |
| statusBanner | spacing.inset.default | text.scale.body-sm | status.*.surface | status.*.text |
| timeline | — | — | — | — |
| attachments | spacing.inset.condensed | text.scale.body-sm | surface.subtle | — |
| comments | spacing.inset.condensed | text.scale.body-sm | surface.subtle | — |

**Highlights**

- Small inline spacing (`spacing.inline.xs`) and caption typography keep metadata subordinate.
- The body region deliberately uses `spacing.inset.condensed` + `text.scale.body-sm` to maximise above-the-fold content.
- Status surfaces wildcard against the SaaS ramp so every badge inherits the correct tone.

## Detail Defaults

Detail views favour comprehension. Spacing opens up and the core body copy switches to `text.scale.body-md` with a loose line-height for longer reading sessions.

| Region | Spacing | Typography | Surface | Status |
| --- | --- | --- | --- | --- |
| header | spacing.inset.default | text.scale.heading-xl | surface.default | — |
| badges | spacing.inline.sm | text.scale.body-sm | surface.badge.* | status.*.surface |
| meta | spacing.stack.default | text.scale.body-sm | surface.transparent | — |
| body | spacing.inset.default | text.scale.body-md, text.line-height.loose | surface.default | — |
| sidebar | spacing.inset.default | text.scale.body-sm | surface.subtle | — |
| footer | spacing.inset.default | text.scale.body-sm | surface.default | — |
| actions | spacing.inset.default | text.scale.label-md | surface.transparent | — |
| statusBanner | spacing.inset.default | text.scale.body-sm | status.*.surface | status.*.text |
| timeline | — | — | — | — |
| attachments | spacing.inset.compact | text.scale.body-sm | surface.subtle | — |
| comments | spacing.inset.compact | text.scale.body-sm | surface.subtle | — |

**Highlights**

- Headers step up to `text.scale.heading-xl` to anchor the page hierarchy.
- Body copy loosens with `text.lineHeight.loose`, improving legibility for multi-paragraph content.
- Badges loosen their inline spacing for comfortable, tappable affordances while retaining the same status surfaces as list views.

## Implementation Checklist

1. Run `npm run build:tokens` whenever the context matrix or typography ramp changes to refresh CSS/TS/Tailwind outputs.
2. Keep `CONTEXT_MATRIX` as the single source of truth; docs, stories, and runtime CSS all derive from that object.
3. Avoid component-level conditionals. If a region needs bespoke styling, express it through the matrix so the plugin can emit a class-based solution.
