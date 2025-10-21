# Dialog

Accessible modal dialog built on the Overlay Manager. Uses tokenized surfaces and borders, traps focus, and restores focus on close.

- API: `<Dialog open onOpenChange title description closeOnEsc closeOnBackdrop />`
- ARIA: `role="dialog"`, `aria-modal="true"`, labelled by title, described by description.
- Policies: ESC closes by default; backdrop does not (configurable).

