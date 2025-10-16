# Storybook Agent Panel — Approval Flow

## State Machine

| State | Description | Transitions |
| --- | --- | --- |
| `idle` | Default state after load or after changing tools. | → `planning` |
| `planning` | Bridge `/run` request issued with `apply:false`. Inputs disabled. | → `review` on success, → `error` on failure |
| `review` | Dry-run result available. Diff + artifact preview rendered. | → `planning` (re-run), → `awaiting-approval`, → `idle` (tool change) |
| `awaiting-approval` | Approval dialog visible. Focus trapped on Cancel/Approve. | → `review` on cancel, → `executing` on confirm |
| `executing` | Bridge `/run` request issued with `apply:true`. Inputs disabled. | → `summary` on success, → `error` on failure |
| `summary` | Apply completed. Success banner + applied artifacts table displayed. | → `planning` (new preview), → `idle` (tool change) |
| `error` | Error banner shown with retry/back actions + incident metadata. | → `planning` (retry, dry-run failure), → `executing` (retry, apply failure), → `review`/`idle` (back) |

## Interaction Flow

1. **Preview changes** — user triggers a dry run (`apply:false`). Panel announces “Plan ready.” and presents:
   - Diff viewer (Unified default, Split toggle).
   - Artifact table (transcript, bundle index, diagnostics, preview artifacts).
2. **Approve & Apply…** — opens blocking dialog (`Cancel` receives initial focus; Escape closes). Copy:
   - Title: “Approve & Apply changes?”
   - Body: “You are about to write new artifacts to `/artifacts/current-state/YYYY-MM-DD`. This action requires approval.”
   - Primary: “Approve & Apply” (Enter submits), Secondary: “Cancel”.
3. **Execute** — confirmation sends { `apply:true` }. Panel announces “Applying approved changes now.” while controls are disabled.
4. **Summary** — success banner “Changes Applied” plus applied artifacts table. Panel announces “Run complete. Artifacts available.”
5. **Errors** — failure banner “Apply Failed” includes error code and optional `Incident ID`. Buttons: `Retry`, `Back`. Screen reader announcement: “Run failed. See error details.”

## Accessibility Contracts

- `aria-live="polite"` status region relays: plan ready, apply start, apply complete, error.
- Diff viewer container focuses when entering `review`; dialog traps focus (Tab/Shift+Tab) and respects Escape.
- Focus order in `review`: Preview button → Diff viewer → Artifact table → Approve button.
- Error heading receives programmatic focus (`tabIndex=-1`) on entry.

## Outputs & Logging

- Dry-run and apply responses store transcript and bundle index paths; panel table links via bridge `/artifacts/*`.
- `planInputRef` ensures the `apply:true` request reuses reviewed inputs.
- SR announcements mirror CLI copy deck to keep CLI/Panel transcripts aligned.
