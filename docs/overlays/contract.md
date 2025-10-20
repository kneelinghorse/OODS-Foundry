Overlay Contract (Focus, Stacking, Escape)

Summary
- One contract for all overlays: deterministic focus trap, inert outside, predictable escape routes, tokenized stacking, HC-visible focus.
- Applies to Dialog, Sheet, Tooltip/Popover; proven with a minimal Storybook proof.

Rules
- Entry: move focus to first focusable in the overlay; save and restore previous focus on exit.
- Trap: Tab/Shift+Tab cycles within overlay focusables; no escape to the page while open.
- Inert outside: background content is not focusable or interactive while overlay is open.
- Escape: Esc closes when allowed; clicking the backdrop closes when policy is backdrop-closable.
- Stacking: use a simple ladder (z.base < z.raised < z.overlay < z.toast < z.tooltip).
- Reduced motion: opening/closing transitions fall back to instant under prefers-reduced-motion.
- Forced colors: borders and outlines remain visible; do not rely on shadows alone.

Tokens
- z.* ladder defined in base tokens; overlay.* tokens for backdrop opacity and timing.

Proof
- See src/stories/proofs/overlay-contract.stories.tsx for a minimal implementation with keyboard paths and HC-friendly outlines.
